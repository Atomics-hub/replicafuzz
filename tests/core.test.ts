import { describe, expect, it } from "vitest";
import { generateSchedule } from "../src/schedule.js";
import { shrinkSchedule } from "../src/shrink.js";
import { renderTimeline } from "../src/artifact.js";
import type { ReplayArtifact, ScheduleStep } from "../src/types.js";

describe("deterministic scheduling", () => {
  it("generates the same schedule from the same seed", () => {
    expect(generateSchedule(12345, 3)).toEqual(generateSchedule(12345, 3));
    expect(generateSchedule(12345, 3)).not.toEqual(generateSchedule(12346, 3));
  });
});

describe("counterexample shrinking", () => {
  it("removes irrelevant steps while preserving the predicate", async () => {
    const schedule: ScheduleStep[] = [
      { kind: "pause", ms: 1 },
      { kind: "act", client: 0, action: { type: "increment", amount: 1 } },
      { kind: "pause", ms: 2 },
      { kind: "checkpoint", label: "end" },
    ];
    const result = await shrinkSchedule(schedule, async (candidate) => candidate.some((step) => step.kind === "act"));
    expect(result.schedule).toEqual([{ kind: "act", client: 0, action: { type: "increment", amount: 1 } }]);
    expect(result.replayPath).toMatch(/^ddmin\//);
  });
});

describe("human-readable replay", () => {
  it("renders the seed, command, and semantic timeline", () => {
    const artifact: ReplayArtifact = {
      schemaVersion: 1,
      createdAt: "2026-07-15T00:00:00Z",
      command: "replicafuzz replay failure.json",
      seed: 42,
      replayPath: "ddmin/0:1",
      fixture: "websocket",
      mutant: "websocket-drop-first-outbound",
      clients: 3,
      originalSteps: 2,
      minimizedSteps: 1,
      schedule: [{ kind: "act", client: 0, action: { type: "increment", amount: 2 } }],
      failure: { invariant: "semantic-model", message: "wrong total", snapshots: {} },
      timeline: [],
    };
    expect(renderTimeline(artifact)).toContain("client 1 increments by 2");
    expect(renderTimeline(artifact)).toContain("replicafuzz replay failure.json");
  });
});
