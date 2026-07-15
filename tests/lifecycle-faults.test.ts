import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserFixtureAdapter } from "../src/browser-adapter.js";
import { runSchedule } from "../src/runner.js";

describe("browser-level lifecycle faults", () => {
  let adapter: BrowserFixtureAdapter;
  beforeAll(async () => { adapter = await BrowserFixtureAdapter.create(); }, 30_000);
  afterAll(async () => { await adapter.shutdown(); });

  it("recovers after offline/reconnect, reload, death, relaunch, delay, and clock skew", async () => {
    const result = await runSchedule(adapter, {
      fixture: "websocket",
      clients: 3,
      seed: 707,
      schedule: [
        { kind: "offline", client: 1 },
        { kind: "online", client: 1 },
        { kind: "pause", ms: 40 },
        { kind: "kill", client: 1 },
        { kind: "act", client: 2, action: { type: "increment", amount: 2 } },
        { kind: "relaunch", client: 1 },
        { kind: "delayTraffic", client: 0, ms: 10 },
        { kind: "clockSkew", client: 0, ms: 5000 },
        { kind: "act", client: 0, action: { type: "increment", amount: 1 } },
        { kind: "reload", client: 2 },
        { kind: "pause", ms: 80 },
        { kind: "checkpoint", label: "recovered" },
      ],
    });
    expect(result.status, result.error ?? JSON.stringify(result.failures)).toBe("passed");
  }, 30_000);
});
