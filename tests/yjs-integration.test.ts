import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserFixtureAdapter } from "../src/browser-adapter.js";
import { runSchedule } from "../src/runner.js";

describe("external Yjs sync-library integration", () => {
  let adapter: BrowserFixtureAdapter;
  beforeAll(async () => { adapter = await BrowserFixtureAdapter.create(); }, 30_000);
  afterAll(async () => { await adapter.shutdown(); });

  it("converges three isolated clients through reconnect, reload, and client death", async () => {
    const result = await runSchedule(adapter, {
      fixture: "yjs",
      clients: 3,
      seed: 13_613,
      schedule: [
        { kind: "act", client: 0, action: { type: "increment", amount: 2 } },
        { kind: "offline", client: 1 },
        { kind: "act", client: 2, action: { type: "increment", amount: 1 } },
        { kind: "online", client: 1 },
        { kind: "pause", ms: 100 },
        { kind: "reload", client: 1 },
        { kind: "kill", client: 2 },
        { kind: "act", client: 0, action: { type: "increment", amount: 1 } },
        { kind: "relaunch", client: 2 },
        { kind: "pause", ms: 160 },
        { kind: "checkpoint", label: "yjs-recovered" },
      ],
    });
    expect(result.status, result.error ?? JSON.stringify(result.failures)).toBe("passed");
  }, 30_000);
});
