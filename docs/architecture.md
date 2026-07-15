# Architecture

## Execution path

1. A seed produces a sequence of semantic and lifecycle steps.
2. The adapter resets the target and launches isolated browser contexts.
3. The runner executes one step at a time and records a monotonic timeline.
4. At checkpoints and final quiescence, the adapter returns canonical snapshots.
5. Invariants compare clients with each other and with the semantic action total.
6. On failure, delta debugging removes chunks and re-runs the real browsers.
7. The minimized schedule is run once more and serialized with seed, replay path,
   invariant, snapshots, and a human-readable timeline.

## Boundaries

The runner knows clients, schedule steps, and the adapter interface. It does not
know DOM selectors, sync protocols, storage schemas, or what equality means for
the target. The adapter owns those facts.

The local fixture server supports WebSocket push, SSE push with HTTP writes, and
HTTP polling. These share a tiny authoritative counter model to keep the oracle
auditable; the browser transport behavior is different, but the fixtures are not
three production frameworks.

## Determinism

Seeded generation is deterministic. Browser execution is not assumed to be.
Every minimized failure is therefore replayed from a clean reset. The artifact's
`replayPath` describes delta-debugging removals, not a claim that network timing
was bit-for-bit deterministic.

## Invariants

- `canonical-convergence`: every live client has equal value and revision.
- `semantic-model`: every value equals the sum of accepted semantic increments.
- `quiescent-outbox`: no client reports pending work after the quiescence window.
- `all-clients-observable`: each expected client can return a snapshot.
- `non-negative-counter`: corruption cannot drive the fixture below zero.

Production adapters should add domain invariants such as referential integrity,
monotonic tombstones, authorization boundaries, or lossless rich-text structure.
