import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserFixtureAdapter } from "../src/browser-adapter.js";
import { runNovelFailure } from "../src/evaluate.js";

describe("failure absent from the fixture's declared happy-path suite", () => {
  let adapter: BrowserFixtureAdapter;
  beforeAll(async () => { adapter = await BrowserFixtureAdapter.create(); }, 30_000);
  afterAll(async () => { await adapter.shutdown(); });

  it("finds that one dropped outbound message is silently forgotten", async () => {
    const result = await runNovelFailure(adapter);
    expect(result.status).toBe("failed");
    expect(result.failures.map((failure) => failure.invariant)).toContain("semantic-model");
  }, 30_000);
});
