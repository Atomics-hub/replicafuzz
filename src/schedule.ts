import fc from "fast-check";
import type { ScheduleStep } from "./types.js";

const amountArb = fc.integer({ min: 1, max: 3 });

export function scheduleArbitrary(clients: number, maxSteps = 8): fc.Arbitrary<ScheduleStep[]> {
  const client = fc.integer({ min: 0, max: clients - 1 });
  const action = fc.record({
    kind: fc.constant("act" as const),
    client,
    action: fc.record({ type: fc.constant("increment" as const), amount: amountArb }),
  });
  const lifecycle = fc.oneof(
    fc.record({ kind: fc.constant("reload" as const), client }),
    fc.record({ kind: fc.constant("offline" as const), client }),
    fc.record({ kind: fc.constant("online" as const), client }),
    fc.record({ kind: fc.constant("delayTraffic" as const), client, ms: fc.constantFrom(10, 25, 50) }),
    fc.record({ kind: fc.constant("dropNext" as const), client, direction: fc.constantFrom("inbound" as const, "outbound" as const) }),
    fc.record({ kind: fc.constant("clockSkew" as const), client, ms: fc.constantFrom(-5000, 5000) }),
  );
  const step: fc.Arbitrary<ScheduleStep> = fc.oneof(
    { weight: 5, arbitrary: action },
    { weight: 2, arbitrary: lifecycle },
  );
  return fc
    .array(step, {
      minLength: 3,
      maxLength: maxSteps,
    })
    .map((steps) => [...steps, { kind: "pause", ms: 40 }, { kind: "checkpoint", label: "final" }]);
}

export function generateSchedule(seed: number, clients: number, maxSteps = 8): ScheduleStep[] {
  return fc.sample(scheduleArbitrary(clients, maxSteps), { seed, numRuns: 1 })[0]!;
}

export function seededFaultSchedule(seed: number, clients: number): ScheduleStep[] {
  const amounts = fc.sample(fc.array(amountArb, { minLength: clients, maxLength: clients }), { seed, numRuns: 1 })[0]!;
  const order = fc.sample(fc.shuffledSubarray([...Array(clients).keys()], { minLength: clients, maxLength: clients }), {
    seed: seed ^ 0x51f15e,
    numRuns: 1,
  })[0]!;
  return [
    ...order.map((client) => ({ kind: "act", client, action: { type: "increment", amount: amounts[client]! } } as const)),
    { kind: "pause", ms: 50 },
    { kind: "checkpoint", label: "after-seeded-fault" },
  ];
}
