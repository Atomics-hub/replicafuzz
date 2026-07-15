import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserFixtureAdapter } from "../src/browser-adapter.js";
import { runSchedule } from "../src/runner.js";

describe("fixture's pre-existing happy-path scope", () => {
  let adapter: BrowserFixtureAdapter;
  beforeAll(async () => { adapter = await BrowserFixtureAdapter.create(); }, 30_000);
  afterAll(async () => { await adapter.shutdown(); });

  it("accepts an increment from one WebSocket client", async () => {
    const result = await runSchedule(adapter, {
      fixture: "websocket",
      clients: 1,
      seed: 1,
      schedule: [
        { kind: "act", client: 0, action: { type: "increment", amount: 1 } },
        { kind: "checkpoint", label: "happy-path" },
      ],
    });
    expect(result.status).toBe("passed");
  }, 30_000);
});
