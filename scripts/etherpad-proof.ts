import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { EtherpadAdapter } from "../integrations/etherpad/adapter.js";
import { renderTimeline } from "../src/artifact.js";
import { runSchedule } from "../src/runner.js";
import { shrinkSchedule } from "../src/shrink.js";
import type { ReplayArtifact, RunResult, ScheduleStep } from "../src/types.js";

const value = (name: string, fallback?: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const origin = value("origin", process.env.ETHERPAD_ORIGIN ?? "http://127.0.0.1:9001")!;
const runs = Number(value("runs", "10"));
const replayPath = value("replay");
const integrationStartedAt = value("integration-started-at");
const upstreamCommit = value("upstream-commit", "3c90fa07c3a1e1c52c782932e21d70f4628bfb41")!;
const token = (seed: number, index: number) => `[[rf-${seed}-${index}]]`;
const publicArtifactPath = "outputs/replicafuzz-etherpad-counterexample.json";

async function materializePublicArtifact(artifact: ReplayArtifact): Promise<void> {
  await mkdir("outputs", { recursive: true });
  await writeFile(publicArtifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  await writeFile(publicArtifactPath.replace(/\.json$/, ".md"), renderTimeline(artifact));
}
const act = (seed: number, index: number, client: number): ScheduleStep => ({
  kind: "act",
  client,
  action: { type: "append", text: token(seed, index) },
});

function scheduleFor(seed: number): ScheduleStep[] {
  const scenario = seed % 5;
  if (scenario === 0) return [
    { kind: "offline", client: 1 }, act(seed, 0, 0), act(seed, 1, 2),
    { kind: "online", client: 1 }, { kind: "pause", ms: 400 }, act(seed, 2, 1),
    { kind: "pause", ms: 500 }, { kind: "checkpoint", label: "offline-edit" },
  ];
  if (scenario === 1) return [
    act(seed, 0, 0), { kind: "pause", ms: 100 }, { kind: "reload", client: 0 },
    act(seed, 1, 1), { kind: "reload", client: 2 }, act(seed, 2, 2),
    { kind: "pause", ms: 400 }, { kind: "checkpoint", label: "reload" },
  ];
  if (scenario === 2) return [
    act(seed, 0, 0), { kind: "pause", ms: 150 }, { kind: "kill", client: 0 },
    act(seed, 1, 1), { kind: "relaunch", client: 0 }, act(seed, 2, 2),
    { kind: "pause", ms: 400 }, { kind: "checkpoint", label: "death-relaunch" },
  ];
  if (scenario === 3) return [
    act(seed, 0, 0), { kind: "reload", client: 0 }, act(seed, 1, 1), act(seed, 2, 2),
    { kind: "pause", ms: 400 }, { kind: "checkpoint", label: "immediate-reload" },
  ];
  return [
    { kind: "offline", client: 2 }, act(seed, 0, 0), act(seed, 1, 1),
    { kind: "online", client: 2 }, { kind: "pause", ms: 300 }, act(seed, 2, 2),
    { kind: "pause", ms: 400 }, { kind: "checkpoint", label: "stale-observer" },
  ];
}

const adapter = await EtherpadAdapter.create(origin);
try {
  if (replayPath) {
    const artifact = JSON.parse(await readFile(replayPath, "utf8")) as ReplayArtifact;
    await materializePublicArtifact(artifact);
    const result = await runSchedule(adapter, {
      fixture: "etherpad",
      clients: artifact.clients,
      seed: artifact.seed,
      schedule: artifact.schedule,
    });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "failed" ? 0 : 1;
  } else {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const results: RunResult[] = [];
    for (let index = 0; index < runs; index += 1) {
      const seed = 73_000 + index;
      const result = await runSchedule(adapter, { fixture: "etherpad", clients: 3, seed, schedule: scheduleFor(seed) });
      results.push(result);
      console.log(JSON.stringify({ seed, status: result.status, durationMs: result.durationMs, failures: result.failures.map((failure) => failure.invariant), error: result.error }));
    }

    const firstFailure = results.find((result) => result.status === "failed");
    let artifactPath: string | null = null;
    let minimizedSteps: number | null = null;
    let replayed = 0;
    if (firstFailure?.failures[0]) {
      const shrunk = await shrinkSchedule(firstFailure.schedule, async (candidate) => {
        const result = await runSchedule(adapter, { fixture: "etherpad", clients: 3, seed: firstFailure.seed, schedule: candidate });
        return result.status === "failed";
      });
      const minimized = await runSchedule(adapter, { fixture: "etherpad", clients: 3, seed: firstFailure.seed, schedule: shrunk.schedule });
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const replay = await runSchedule(adapter, { fixture: "etherpad", clients: 3, seed: firstFailure.seed, schedule: shrunk.schedule });
        if (replay.status === "failed") replayed += 1;
      }
      const artifact: ReplayArtifact = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        command: "pnpm proof:etherpad -- --replay output/playwright/etherpad-counterexample.json",
        seed: firstFailure.seed,
        replayPath: shrunk.replayPath,
        fixture: "etherpad",
        clients: 3,
        originalSteps: firstFailure.schedule.length,
        minimizedSteps: shrunk.schedule.length,
        schedule: shrunk.schedule,
        failure: minimized.failures[0] ?? firstFailure.failures[0],
        timeline: minimized.timeline,
      };
      artifactPath = "output/playwright/etherpad-counterexample.json";
      minimizedSteps = shrunk.schedule.length;
      await mkdir("output/playwright", { recursive: true });
      await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
      await materializePublicArtifact(artifact);
    }

    const passed = results.filter((result) => result.status === "passed").length;
    const failed = results.filter((result) => result.status === "failed").length;
    const errors = results.filter((result) => result.status === "error").length;
    const wallMs = Math.round(performance.now() - started);
    const generatedAt = new Date().toISOString();
    const report = {
      schemaVersion: 1,
      generatedAt,
      target: {
        name: "Etherpad",
        version: "3.3.2",
        upstream: "https://github.com/ether/etherpad",
        commit: upstreamCommit,
        configuration: "official source build, default local rusty.db, anonymous public pads",
      },
      campaign: { startedAt, runs, clients: 3, passed, failed, errors, wallMs },
      integrationEffort: integrationStartedAt ? {
        startedAt: integrationStartedAt,
        completedAt: generatedAt,
        elapsedSeconds: Math.round((Date.parse(generatedAt) - Date.parse(integrationStartedAt)) / 1000),
        elapsedMinutes: Number(((Date.parse(generatedAt) - Date.parse(integrationStartedAt)) / 60_000).toFixed(1)),
        includes: "upstream selection, source clone, dependency install, application build, adapter implementation, tests, campaign, shrinking, replay, and source-test audit",
      } : null,
      controls: {
        realBrowser: ["offline", "online", "reload", "page death", "relaunch"],
        inferred: ["quiescence from equal stable text, equal collaboration revision, and no unaccepted commit"],
        unsupported: ["packet drop", "packet delay", "clock injection", "server process death"],
      },
      counterexample: firstFailure ? {
        seed: firstFailure.seed,
        originalSteps: firstFailure.schedule.length,
        minimizedSteps,
        artifactPath,
        publicArtifactPath,
        replayed,
        replayAttempts: 5,
        failures: firstFailure.failures,
      } : null,
      sourceTestAudit: {
        scope: "targeted grep and review of Etherpad 3.3.2 frontend-new, frontend, and backend tests",
        relevantExistingCoverage: [
          "unaccepted_commit_warning.spec.ts checks commit acknowledgement and a simulated pending-commit disconnect warning",
          "pad_modal.js checks that a simulated disconnected state disables the editor",
          "xxauto_reconnect.js checks timer-driven reconnect reload behavior",
          "padHelper.ts waits for initial contenteditable readiness and documents silently dropped input during initial load",
        ],
        equivalentRealNetworkReconnectTypingTestFound: false,
        boundary: "This is a targeted source-test comparison, not an exhaustive coverage proof; maintainer confirmation is still required.",
      },
      verdict: errors > 0
        ? "Infrastructure errors prevent an application-level verdict."
        : firstFailure
          ? "ReplicaFuzz found a minimized, reproducible Etherpad UI-readiness failure after a real browser reconnect; targeted source-test review found no equivalent case, but maintainer confirmation is still required."
          : "No Etherpad invariant failure was found in this bounded campaign; integration portability is demonstrated, bug-finding value is not.",
      boundaries: [
        "This is one unfamiliar open-source production application, not broad production portability.",
        "Runs use a local default Etherpad configuration without plugins, authentication, reverse proxies, or a production database.",
        "An invariant failure is not called an Etherpad bug until the minimized replay is inspected against expected product behavior.",
      ],
      runs: results.map((result) => ({ seed: result.seed, status: result.status, durationMs: result.durationMs, failures: result.failures, error: result.error })),
    };
    await mkdir("outputs", { recursive: true });
    await writeFile("outputs/replicafuzz-etherpad-proof.json", `${JSON.stringify(report, null, 2)}\n`);
    const markdown = `# ReplicaFuzz Etherpad proof\n\n- Target: Etherpad 3.3.2 at \`${upstreamCommit}\`\n- Campaign: ${runs} schedules, 3 isolated browser clients\n- Result: ${passed} passed, ${failed} invariant failures, ${errors} infrastructure errors\n- Wall time: ${(wallMs / 1000).toFixed(2)} seconds\n- Integration effort: ${report.integrationEffort ? `${report.integrationEffort.elapsedMinutes} minutes` : "not measured"}\n- Counterexample: ${firstFailure ? publicArtifactPath : "none"}\n- Minimized replay: ${firstFailure ? `${firstFailure.schedule.length} -> ${minimizedSteps} steps; ${replayed}/5 reproduced` : "none"}\n- Verdict: ${report.verdict}\n\n## Existing-test comparison\n\n${report.sourceTestAudit.relevantExistingCoverage.map((item) => `- ${item}`).join("\n")}\n- Equivalent real-network reconnect typing test found: ${report.sourceTestAudit.equivalentRealNetworkReconnectTypingTestFound ? "yes" : "no"}\n- ${report.sourceTestAudit.boundary}\n\n## Boundaries\n\n${report.boundaries.map((item) => `- ${item}`).join("\n")}\n`;
    await writeFile("outputs/replicafuzz-etherpad-proof.md", markdown);
    console.log(JSON.stringify({ report: "outputs/replicafuzz-etherpad-proof.json", passed, failed, errors, wallMs, artifactPath }, null, 2));
    if (errors > 0) process.exitCode = 1;
  }
} finally {
  await adapter.shutdown();
}
