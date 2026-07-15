# ReplicaFuzz adapter guide

## Minimum hooks

`reset` must create a clean, addressable run. `launch` must produce one isolated
client. `act` should express user intent (for example “rename card”), not DOM
mechanics. `canonicalSnapshot` should remove ordering and ephemeral metadata.
`waitForQuiescence` needs an observable application condition; a fixed sleep is
only a fallback. `assertInvariants` owns both convergence and domain safety.

The proof also exposes `control` for lifecycle and fault actions. An adapter may
reject unsupported controls, but should say which layer was controlled: browser,
application transport, proxy, or real infrastructure.

## Integration checklist

1. Make reset idempotent and run-scoped.
2. Launch clients with separate storage and auth/session identity where relevant.
3. Implement one high-value semantic action first.
4. Canonicalize IDs, timestamps, ordering, and derived UI state.
5. Expose pending request/outbox/subscription counts for quiescence.
6. Add a semantic model or at least conservation invariants.
7. Verify one planted fault is detected before growing the action grammar.
8. Replay the emitted minimal artifact in a fresh process.

## Common integration traps

- Comparing DOM text instead of application state.
- Treating “all requests finished” as sync quiescence.
- Sharing a browser context and accidentally sharing storage between clients.
- Generating invalid action sequences that only test error handling.
- Calling a proxy-level drop equivalent to an OS-level partition.
- Shrinking without clean resets, which produces false minimal schedules.
