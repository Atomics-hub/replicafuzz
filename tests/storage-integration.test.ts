import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserFixtureAdapter } from "../src/browser-adapter.js";
import { runSchedule } from "../src/runner.js";

describe("fourth-app storage integration", () => {
  let adapter: BrowserFixtureAdapter;
  beforeAll(async () => { adapter = await BrowserFixtureAdapter.create(); }, 30_000);
  afterAll(async () => { await adapter.shutdown(); });

  it("converges three isolated clients and survives reload", async () => {
    const result = await runSchedule(adapter, {
      fixture: "storage",
      clients: 3,
      seed: 404,
      schedule: [
        { kind: "act", client: 0, action: { type: "increment", amount: 2 } },
        { kind: "act", client: 1, action: { type: "increment", amount: 1 } },
        { kind: "reload", client: 2 },
        { kind: "pause", ms: 60 },
        { kind: "checkpoint", label: "after-reload" },
      ],
    });
    expect(result.status, result.error ?? JSON.stringify(result.failures)).toBe("passed");
  }, 30_000);
});
