# ReplicaFuzz 0.1.0-alpha.1

ReplicaFuzz is an experimental browser-first falsification harness for
collaborative and offline-capable applications.

## Included

- Two to five isolated Playwright browser clients.
- Semantic actions, canonical snapshots, application-defined quiescence, and
  invariants behind a small adapter contract.
- Seeded fast-check schedules, deterministic replay, and replay-driven shrinking.
- Browser offline/reconnect, reload, page death/relaunch, delay/drop shims, and
  application-clock variation with explicit control-layer labels.
- Human-readable JSON and Markdown counterexamples.
- Synthetic WebSocket, SSE, REST, and storage/polling fixtures.
- A real Yjs v13 CRDT library target using native Yjs updates across a small
  local WebSocket relay.

## Evidence

- 20/20 disclosed mutants detected across three synthetic transport fixtures.
- 20/20 minimized failures replayed in the latest bounded proof.
- Average shrink from five steps to one.
- Fifty three-client schedules complete well below the three-minute gate on four
  local workers.
- The Yjs target passed ten fresh three-client lifecycle runs.
- The packed CLI installs and responds from a clean temporary consumer project.

## Boundaries

This release does not establish broad production portability, customer impact,
hosted-service reliability, or demand. The original five gates are synthetic;
the Yjs target is a real external CRDT library in a purpose-built app, not an
unfamiliar production application. ReplicaFuzz remains an experimental alpha.
