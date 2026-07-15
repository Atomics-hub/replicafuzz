#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BrowserFixtureAdapter } from "./browser-adapter.js";
import { evaluateFaults, replayArtifact, runCampaign, runNovelFailure, writeProofReport } from "./evaluate.js";
import { generateSchedule, seededFaultSchedule } from "./schedule.js";
import { runSchedule } from "./runner.js";
import { shrinkSchedule } from "./shrink.js";
import { writeArtifact } from "./artifact.js";
import type { FixtureName, ReplayArtifact } from "./types.js";

function option(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "help";
  if (command === "help") {
    console.log("replicafuzz <smoke|demo|campaign|fault-suite|replay|proof|novel> [options]");
    return;
  }
  const adapter = await BrowserFixtureAdapter.create();
  try {
    if (command === "smoke") {
      const fixtures: FixtureName[] = ["websocket", "sse", "rest", "storage", "yjs"];
      for (const fixture of fixtures) {
        const result = await runSchedule(adapter, { fixture, clients: 3, seed: 1, schedule: seededFaultSchedule(1, 3) });
        console.log(JSON.stringify({ fixture, status: result.status, durationMs: result.durationMs, failures: result.failures, error: result.error }));
      }
      return;
    }
    if (command === "campaign") {
      const result = await runCampaign(adapter, option("fixture", "websocket") as FixtureName, Number(option("runs", "50")), Number(option("clients", "3")), Number(option("workers", "4")));
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (command === "fault-suite") {
      console.log(JSON.stringify(await evaluateFaults(adapter), null, 2));
      return;
    }
    if (command === "novel") {
      console.log(JSON.stringify(await runNovelFailure(adapter), null, 2));
      return;
    }
    if (command === "replay") {
      const path = process.argv[3];
      if (!path) throw new Error("replay requires an artifact path");
      const result = await replayArtifact(adapter, path);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.status === "failed" ? 0 : 1;
      return;
    }
    if (command === "demo") {
      const fixture = option("fixture", "websocket") as FixtureName;
      const seed = Number(option("seed", "4242"));
      const mutant = option("mutant", "websocket-drop-first-outbound");
      const schedule = seededFaultSchedule(seed, 3);
      const initial = await runSchedule(adapter, { fixture, clients: 3, seed, mutant, schedule });
      if (initial.status !== "failed") throw new Error(`demo did not find divergence: ${initial.status} ${initial.error ?? ""}`);
      const shrunk = await shrinkSchedule(schedule, async (candidate) => (await runSchedule(adapter, { fixture, clients: 3, seed, mutant, schedule: candidate })).status === "failed");
      const minimized = await runSchedule(adapter, { fixture, clients: 3, seed, mutant, schedule: shrunk.schedule });
      const artifact: ReplayArtifact = {
        schemaVersion: 1, createdAt: new Date().toISOString(), seed, replayPath: shrunk.replayPath,
        fixture, mutant, clients: 3, originalSteps: schedule.length, minimizedSteps: shrunk.schedule.length,
        schedule: shrunk.schedule, failure: minimized.failures[0]!, timeline: minimized.timeline,
        command: "pnpm demo",
      };
      console.log(JSON.stringify(await writeArtifact(artifact, "output/playwright/demo-counterexample.json"), null, 2));
      return;
    }
    if (command === "proof") {
      const faults = await evaluateFaults(adapter);
      const campaign = await runCampaign(adapter, "websocket", 50, 3, 4);
      const novel = await runNovelFailure(adapter);
      const detected = faults.filter((fault) => fault.detected).length;
      const replayed = faults.filter((fault) => fault.detected && fault.replayed).length;
      const replayRate = detected ? replayed / detected : 0;
      const integrationPath = fileURLToPath(new URL("../evidence/fourth-app-integration.json", import.meta.url));
      const integration = JSON.parse(await readFile(integrationPath, "utf8")) as {
        elapsedMinutes: number;
        coreDiff: { filesChanged: number; insertions: number; deletions: number };
        claimBoundary: string;
      };
      const gates = [
        { name: "Fault detection", status: detected >= 16 ? "pass" : "fail", evidence: `${detected}/20 seeded mutants detected across WebSocket, SSE, and REST synthetic fixtures.` },
        { name: "Replay stability", status: replayRate >= 0.95 ? "pass" : "fail", evidence: `${replayed}/${detected} minimized failures reproduced (${(replayRate * 100).toFixed(1)}%).` },
        { name: "Fourth-app integration", status: integration.elapsedMinutes < 120 && integration.coreDiff.insertions + integration.coreDiff.deletions < 50 ? "pass" : "fail", evidence: `A fourth synthetic storage/polling app integrated in ${integration.elapsedMinutes.toFixed(1)} minutes with ${integration.coreDiff.insertions} insertions and ${integration.coreDiff.deletions} deletions across ${integration.coreDiff.filesChanged} core files. This is not a production-app timing claim.` },
        { name: "PR runtime", status: campaign.wallMs < 180_000 ? "pass" : "fail", evidence: `50 schedules, three clients, four workers completed in ${(campaign.wallMs / 1000).toFixed(2)} s (${campaign.passed} passed, ${campaign.failed} failed, ${campaign.errors} errors).` },
        { name: "Novel actionable failure", status: novel.status === "failed" ? "pass" : "fail", evidence: novel.status === "failed" ? "Baseline WebSocket fixture silently loses a dropped outbound operation when an unrelated inbound snapshot clears pending state; its declared single-client happy-path test does not exercise message loss. This is a synthetic-fixture finding, not a production bug." : `No baseline failure found (${novel.status}).` },
      ];
      const report = {
        generatedAt: new Date().toISOString(),
        verdict: gates.every((gate) => gate.status === "pass") ? "All technical gates passed on synthetic local fixtures." : "Partial local proof only. At least one pass-or-kill gate remains failed or untested.",
        gates,
        measurements: {
          seededFaults: { detected, total: 20, byFixture: Object.fromEntries(["websocket", "sse", "rest"].map((fixture) => [fixture, faults.filter((fault) => fault.fixture === fixture && fault.detected).length])) },
          replay: { reproduced: replayed, attempted: detected, rate: replayRate },
          shrink: { averageOriginalSteps: faults.reduce((sum, item) => sum + item.originalSteps, 0) / faults.length, averageMinimizedSteps: faults.reduce((sum, item) => sum + item.minimizedSteps, 0) / faults.length },
          campaign,
          integration,
          novelFailure: { status: novel.status, failures: novel.failures, existingTestScope: "single-client happy path" },
        },
        limitations: [
          "All four target applications are purpose-built micro-fixtures, not third-party production repositories.",
          "The 20 faults are disclosed seeded implementation mutants; detection does not estimate real-world defect prevalence.",
          "Traffic delay/drop controls are application-level shims; offline, reload, and process death use Playwright browser controls.",
          "Quiescence and canonical snapshots are application-defined, as they must be for a vendor-neutral adapter.",
          "No demand, pricing, hosted-service, mobile-device, service-worker, remote-queue, or credentialed integration claim is made.",
        ],
        faults,
      };
      console.log(JSON.stringify(await writeProofReport(report), null, 2));
      return;
    }
    throw new Error(`unknown command: ${command}`);
  } finally {
    await adapter.shutdown();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
