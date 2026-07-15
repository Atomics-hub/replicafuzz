# Changelog

## 0.1.0-alpha.2

- Added an external adapter for unmodified Etherpad 3.3.2.
- Added semantic text actions and canonical document snapshots.
- Added a ten-schedule Etherpad campaign, deterministic replay, and shrinking.
- Recorded a three-step post-reconnect UI-readiness counterexample that replayed
  5/5 on fresh pads.
- Preserved explicit boundaries for unsupported traffic, clock, server, auth,
  plugin, proxy, and production-database faults.

## 0.1.0-alpha.1 - 2026-07-15

- Launch the ReplicaFuzz working alpha.
- Run two to five isolated Playwright browser clients.
- Expose reset, launch, semantic action, canonical snapshot, quiescence,
  invariant, and lifecycle/fault controls through a vendor-neutral adapter.
- Generate seeded schedules with fast-check and minimize browser failures with
  replay-driven delta debugging.
- Include WebSocket, SSE, REST, storage/polling, and external Yjs browser targets.
- Emit JSON and Markdown replay artifacts.
- Document bounded synthetic proof results and release limitations.
