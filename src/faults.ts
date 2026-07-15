import type { FixtureName } from "./types.js";

export type SeededFault = {
  id: string;
  fixture: FixtureName;
  mutant: string;
  seed: number;
  class: "loss" | "duplication" | "corruption" | "staleness" | "partition";
};

const definitions: Array<[FixtureName, string[]]> = [
  ["websocket", [
    "drop-first-outbound",
    "duplicate-first-op",
    "reverse-first-op",
    "zero-first-op",
    "ignore-client-2",
    "stale-client-2",
    "revision-skew-client-1",
  ]],
  ["sse", [
    "drop-first-outbound",
    "duplicate-first-op",
    "reverse-first-op",
    "ignore-client-2",
    "stale-client-2",
    "skew-client-3",
  ]],
  ["rest", [
    "drop-first-outbound",
    "duplicate-first-op",
    "reverse-first-op",
    "zero-first-op",
    "ignore-client-2",
    "stale-client-2",
    "revision-skew-client-1",
  ]],
];

function faultClass(name: string): SeededFault["class"] {
  if (name.includes("drop") || name.includes("zero")) return "loss";
  if (name.includes("duplicate")) return "duplication";
  if (name.includes("stale")) return "staleness";
  if (name.includes("ignore")) return "partition";
  return "corruption";
}

export const seededFaults: SeededFault[] = definitions.flatMap(([fixture, names], fixtureIndex) =>
  names.map((name, index) => ({
    id: `${fixture}-${name}`,
    fixture,
    mutant: `${fixture}-${name}`,
    seed: 10_000 + fixtureIndex * 100 + index * 17,
    class: faultClass(name),
  })),
);
