# ReplicaFuzz Etherpad proof

- Target: Etherpad 3.3.2 at `3c90fa07c3a1e1c52c782932e21d70f4628bfb41`
- Campaign: 10 schedules, 3 isolated browser clients
- Result: 0 passed, 10 invariant failures, 0 infrastructure errors
- Wall time: 251.78 seconds
- Integration effort: 35.1 minutes
- Counterexample: outputs/replicafuzz-etherpad-counterexample.json
- Minimized replay: 8 -> 3 steps; 5/5 reproduced
- Verdict: ReplicaFuzz found a minimized, reproducible Etherpad UI-readiness failure after a real browser reconnect; targeted source-test review found no equivalent case, but maintainer confirmation is still required.

## Existing-test comparison

- unaccepted_commit_warning.spec.ts checks commit acknowledgement and a simulated pending-commit disconnect warning
- pad_modal.js checks that a simulated disconnected state disables the editor
- xxauto_reconnect.js checks timer-driven reconnect reload behavior
- padHelper.ts waits for initial contenteditable readiness and documents silently dropped input during initial load
- Equivalent real-network reconnect typing test found: no
- This is a targeted source-test comparison, not an exhaustive coverage proof; maintainer confirmation is still required.

## Boundaries

- This is one unfamiliar open-source production application, not broad production portability.
- Runs use a local default Etherpad configuration without plugins, authentication, reverse proxies, or a production database.
- An invariant failure is not called an Etherpad bug until the minimized replay is inspected against expected product behavior.
