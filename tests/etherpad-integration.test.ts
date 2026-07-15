import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EtherpadAdapter } from "../integrations/etherpad/adapter.js";
import { runSchedule } from "../src/runner.js";
import type { ScheduleStep } from "../src/types.js";

const origin = process.env.ETHERPAD_ORIGIN;
const external = describe.skipIf(!origin);

external("Etherpad external production-app integration", () => {
  let adapter: EtherpadAdapter;

  beforeAll(async () => { adapter = await EtherpadAdapter.create(origin); });
  afterAll(async () => { await adapter.shutdown(); });

  it("converges after a settled reconnect, reload, and death", async () => {
    const schedule: ScheduleStep[] = [
      { kind: "offline", client: 1 },
      { kind: "act", client: 0, action: { type: "append", text: "[[rf-test-online]]" } },
      { kind: "online", client: 1 },
      { kind: "pause", ms: 1_500 },
      { kind: "reload", client: 2 },
      { kind: "kill", client: 0 },
      { kind: "act", client: 2, action: { type: "append", text: "[[rf-test-survivor]]" } },
      { kind: "relaunch", client: 0 },
      { kind: "pause", ms: 500 },
      { kind: "checkpoint", label: "etherpad-final" },
    ];
    const result = await runSchedule(adapter, { fixture: "etherpad", clients: 3, seed: 33_201, schedule });
    expect(result.status, JSON.stringify(result, null, 2)).toBe("passed");
  }, 90_000);

  it("detects an issued post-reconnect insertion with no editor effect", async () => {
    const schedule: ScheduleStep[] = [
      { kind: "offline", client: 1 },
      { kind: "act", client: 0, action: { type: "append", text: "[[rf-race-remote]]" } },
      { kind: "online", client: 1 },
      { kind: "pause", ms: 400 },
      { kind: "act", client: 1, action: { type: "append", text: "[[rf-race-reconnected]]" } },
      { kind: "pause", ms: 600 },
      { kind: "checkpoint", label: "post-reconnect-race" },
    ];
    const result = await runSchedule(adapter, { fixture: "etherpad", clients: 3, seed: 33_202, schedule });
    expect(result.status, JSON.stringify(result, null, 2)).toBe("failed");
    expect(result.failures.map((failure) => failure.invariant)).toContain("semantic-action-effect");
  }, 90_000);
});
