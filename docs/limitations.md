# Limitations

- The apps are synthetic micro-fixtures. No third-party production repository is
  integrated, so broad vendor neutrality remains unproven.
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
- The integration clock measures a contract-shaped synthetic app, not discovery
  work in an unfamiliar codebase.
- The “novel failure” is actionable only inside the included synthetic fixture;
  it is not a customer or production bug.

## Baseline fixture findings

1. If one outbound WebSocket operation is dropped, a later unrelated inbound
   snapshot clears the client's pending count. The operation is silently lost;
   only the semantic-model invariant detects the missing increment.
This finding has a short regression test. It is useful evidence that the harness
catches a multi-client failure outside the fixture's single-client test, not
evidence of customer impact.
