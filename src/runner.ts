import { randomUUID } from "node:crypto";
import type { AdapterRunOptions, ClientHandle, RunResult, ScheduleStep, SyncAdapter, TimelineEntry } from "./types.js";

export type RunScheduleOptions = {
  fixture: AdapterRunOptions["fixture"];
  clients: number;
  seed: number;
  schedule: ScheduleStep[];
  mutant?: string;
  runId?: string;
};

export async function runSchedule(adapter: SyncAdapter, input: RunScheduleOptions): Promise<RunResult> {
  const runId = input.runId ?? randomUUID();
  const options: AdapterRunOptions = { fixture: input.fixture, clients: input.clients, runId, mutant: input.mutant };
  const started = performance.now();
  const timeline: TimelineEntry[] = [];
  const clients: ClientHandle[] = [];
  try {
    await adapter.reset(options);
    for (let id = 0; id < input.clients; id += 1) clients.push(await adapter.launch(id, options));
    for (let index = 0; index < input.schedule.length; index += 1) {
      const step = input.schedule[index]!;
      if (step.kind === "act") await adapter.act(clients[step.client]!, step.action);
      else if (step.kind === "pause") await new Promise((resolve) => setTimeout(resolve, step.ms));
      else if (step.kind !== "checkpoint") await adapter.control(clients[step.client]!, step, options);
      const entry: TimelineEntry = { index, elapsedMs: Math.round(performance.now() - started), step };
      if (step.kind === "checkpoint") {
        entry.snapshots = Object.fromEntries(await Promise.all(clients.map(async (client) => [`client-${client.id + 1}`, await adapter.canonicalSnapshot(client)])));
      }
      timeline.push(entry);
    }
    await adapter.waitForQuiescence(clients);
    const failures = await adapter.assertInvariants(clients);
    return {
      status: failures.length ? "failed" : "passed",
      seed: input.seed,
      fixture: input.fixture,
      mutant: input.mutant,
      runId,
      durationMs: Math.round(performance.now() - started),
      schedule: input.schedule,
      timeline,
      failures,
    };
  } catch (error) {
    return {
      status: "error",
      seed: input.seed,
      fixture: input.fixture,
      mutant: input.mutant,
      runId,
      durationMs: Math.round(performance.now() - started),
      schedule: input.schedule,
      timeline,
      failures: [],
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
  } finally {
    await adapter.close(clients);
  }
}
