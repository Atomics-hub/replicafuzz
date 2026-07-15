import type { FixtureName } from "../../src/types.js";

/**
 * Fourth-app integration fixture. It deliberately uses only the public browser
 * contract (`act`, `snapshot`, `quiescent`, `setControl`) and requires no
 * runner-specific subclass.
 */
export const storageFixture = {
  name: "storage" satisfies FixtureName,
  transport: "HTTP polling",
  localPersistence: "localStorage",
  semanticActions: ["increment"],
  snapshot: { fields: ["value", "pending", "revision"] },
  quiescence: "pending operation count is zero and snapshots are stable",
  invariants: ["canonical-convergence", "semantic-model", "quiescent-outbox", "non-negative-counter"],
} as const;
