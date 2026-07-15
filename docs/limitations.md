# ReplicaFuzz limitations

- Four core apps are synthetic micro-fixtures. Etherpad 3.3.2 is the first
  unfamiliar production repository integration; one app does not prove broad
  vendor neutrality.
- Seeded mutants validate observability and the oracle, not real defect incidence.
- The local server is deterministic enough for replay but does not model remote
  brokers, regional replicas, auth, rate limits, or background jobs.
- Service workers are blocked to reduce routing ambiguity. IndexedDB, native
  mobile lifecycle, browser engine diversity, and long-duration sleep/wake are
  not covered.
- Offline/reconnect, reload, and page death are browser-level. Delay/drop and
  clock skew are application-level controls in these fixtures.
- Quiescence is defined by pending operations plus stable snapshots. A production
  adapter needs deeper signals from its outbox, subscription, or sync engine.
- The semantic model is an additive counter. Rich CRDT or conflict-resolution
  semantics will require more expressive canonicalization and invariants.
- One replay per minimized fault supports the 95% gate numerically but does not
  estimate long-run flake probability tightly. A deeper campaign should replay
  every artifact many times across machines.
- The original 1.7-minute integration clock measures a contract-shaped synthetic
  app. The separate Etherpad clock is 35.1 minutes and includes upstream
  selection, clone/install/build, adapter work, tests, campaign, shrinking,
  replay, and targeted source-test review.
- The Etherpad reconnect finding is a minimized, 5/5-reproducing candidate
  actionable failure. It is not called an upstream bug until maintainers confirm
  expected behavior and test novelty.
- Etherpad disables editing while disconnected. The adapter tests reconnect
  readiness and stale-observer recovery, not offline document editing.

## Baseline fixture findings

1. If one outbound WebSocket operation is dropped, a later unrelated inbound
   snapshot clears the client's pending count. The operation is silently lost;
   only the semantic-model invariant detects the missing increment.
This finding has a short regression test. It is useful evidence that the harness
catches a multi-client failure outside the fixture's single-client test, not
evidence of customer impact.

## Etherpad candidate finding

After a real browser offline/online transition, Etherpad can restore
`contenteditable=true` while the first user-level insertion has no immediate
editor effect. All clients converge on the unchanged text with no unaccepted
commit. Delta debugging reduces the schedule to disconnect, reconnect, append;
the emitted replay reproduced 5/5 on fresh pads.

A targeted review found tests for simulated disconnect UI, pending-commit
warnings, timer-driven reconnect reload, and initial-load editor readiness, but
no equivalent real-network reconnect-then-type test. This is bounded evidence,
not an exhaustive coverage claim.
