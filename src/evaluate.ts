import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BrowserFixtureAdapter } from "./browser-adapter.js";
import { seededFaults } from "./faults.js";
import { runSchedule } from "./runner.js";
import { generateSchedule, seededFaultSchedule } from "./schedule.js";
import { shrinkSchedule } from "./shrink.js";
import { writeArtifact } from "./artifact.js";
import type { FixtureName, ReplayArtifact, RunResult, ScheduleStep } from "./types.js";

export type FaultEvaluation = {
  id: string;
  fixture: FixtureName;
  mutant: string;
  detected: boolean;
  originalSteps: number;
  minimizedSteps: number;
  shrinkAttempts: number;
  replayed: boolean;
  durationMs: number;
  artifact?: string;
  error?: string;
};

export async function evaluateFaults(adapter: BrowserFixtureAdapter, artifactDir = "output/playwright/faults"): Promise<FaultEvaluation[]> {
  const evaluations: FaultEvaluation[] = [];
  for (const fault of seededFaults) {
    const schedule = seededFaultSchedule(fault.seed, 3);
    const initial = await runSchedule(adapter, { fixture: fault.fixture, clients: 3, seed: fault.seed, mutant: fault.mutant, schedule });
    if (initial.status !== "failed") {
      evaluations.push({ id: fault.id, fixture: fault.fixture, mutant: fault.mutant, detected: false, originalSteps: schedule.length, minimizedSteps: schedule.length, shrinkAttempts: 0, replayed: false, durationMs: initial.durationMs, error: initial.error });
      continue;
    }
    const shrunk = await shrinkSchedule(schedule, async (candidate) => {
      const result = await runSchedule(adapter, { fixture: fault.fixture, clients: 3, seed: fault.seed, mutant: fault.mutant, schedule: candidate });
      return result.status === "failed";
    });
    const minimized = await runSchedule(adapter, { fixture: fault.fixture, clients: 3, seed: fault.seed, mutant: fault.mutant, schedule: shrunk.schedule });
    const failure = minimized.failures[0] ?? initial.failures[0]!;
    const artifact: ReplayArtifact = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      command: `pnpm syncfuzz replay ${artifactDir}/${fault.id}.json`,
      seed: fault.seed,
      replayPath: shrunk.replayPath,
      fixture: fault.fixture,
      mutant: fault.mutant,
      clients: 3,
      originalSteps: schedule.length,
      minimizedSteps: shrunk.schedule.length,
      schedule: shrunk.schedule,
      failure,
      timeline: minimized.timeline,
    };
    const paths = await writeArtifact(artifact, `${artifactDir}/${fault.id}.json`);
    const replay = await runSchedule(adapter, { fixture: artifact.fixture, clients: artifact.clients, seed: artifact.seed, mutant: artifact.mutant, schedule: artifact.schedule });
    evaluations.push({
      id: fault.id,
      fixture: fault.fixture,
      mutant: fault.mutant,
      detected: true,
      originalSteps: schedule.length,
      minimizedSteps: shrunk.schedule.length,
      shrinkAttempts: shrunk.attempts,
      replayed: replay.status === "failed",
      durationMs: initial.durationMs,
      artifact: paths.json,
    });
  }
  return evaluations;
}

export type CampaignResult = {
  fixture: FixtureName;
  runs: number;
  clients: number;
  workers: number;
  passed: number;
  failed: number;
  errors: number;
  wallMs: number;
  p50ScheduleMs: number;
  p95ScheduleMs: number;
};

export async function runCampaign(adapter: BrowserFixtureAdapter, fixture: FixtureName, runs: number, clients: number, workers: number): Promise<CampaignResult> {
  const started = performance.now();
  const results: RunResult[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= runs) return;
      const seed = 50_000 + index;
      const generated = generateSchedule(seed, clients, 5).filter((step) => !["offline", "online", "kill", "relaunch"].includes(step.kind));
      const schedule: ScheduleStep[] = generated.length ? generated : seededFaultSchedule(seed, clients);
      results.push(await runSchedule(adapter, { fixture, clients, seed, schedule }));
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const percentile = (p: number) => durations[Math.min(durations.length - 1, Math.floor(durations.length * p))] ?? 0;
  return {
    fixture, runs, clients, workers,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    errors: results.filter((result) => result.status === "error").length,
    wallMs: Math.round(performance.now() - started),
    p50ScheduleMs: percentile(0.5),
    p95ScheduleMs: percentile(0.95),
  };
}

export async function replayArtifact(adapter: BrowserFixtureAdapter, path: string): Promise<RunResult> {
  const artifact = JSON.parse(await readFile(path, "utf8")) as ReplayArtifact;
  return runSchedule(adapter, { fixture: artifact.fixture, clients: artifact.clients, seed: artifact.seed, mutant: artifact.mutant, schedule: artifact.schedule });
}

export async function runNovelFailure(adapter: BrowserFixtureAdapter): Promise<RunResult> {
  const schedule: ScheduleStep[] = [
    { kind: "dropNext", client: 0, direction: "outbound" },
    { kind: "act", client: 0, action: { type: "increment", amount: 1 } },
    { kind: "act", client: 1, action: { type: "increment", amount: 1 } },
    { kind: "pause", ms: 60 },
    { kind: "checkpoint", label: "single-message-loss" },
  ];
  return runSchedule(adapter, { fixture: "websocket", clients: 3, seed: 88_021, schedule });
}

export async function writeProofReport(report: unknown, directory = "outputs"): Promise<{ json: string; markdown: string }> {
  await mkdir(directory, { recursive: true });
  const jsonPath = resolve(directory, "syncfuzz-proof-report.json");
  const markdownPath = resolve(directory, "syncfuzz-proof-report.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const data = report as any;
  const gateLines = data.gates.map((gate: any, index: number) => `${index + 1}. **${gate.name}: ${gate.status.toUpperCase()}** — ${gate.evidence}`);
  const markdown = [
    "# SyncFuzz technical proof report",
    "",
    `Generated: ${data.generatedAt}`,
    "",
    "> Scope: local synthetic browser fixtures and seeded mutants. This report does not establish production-stack portability, demand, or a company thesis.",
    "",
    "## Verdict",
    "",
    data.verdict,
    "",
    "## Pass-or-kill gates",
    "",
    ...gateLines,
    "",
    "## Measurements",
    "",
    "```json",
    JSON.stringify(data.measurements, null, 2),
    "```",
    "",
    "## Limitations",
    "",
    ...data.limitations.map((item: string) => `- ${item}`),
    "",
  ].join("\n");
  await writeFile(markdownPath, markdown);
  return { json: jsonPath, markdown: markdownPath };
}
