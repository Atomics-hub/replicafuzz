# ReplicaFuzz final proof report

Generated: 2026-07-15T22:13:30.987Z

## Verdict

All five technical falsification gates pass within their stated local evidence boundaries. This does not prove broad portability, maintainer-confirmed bug status, customer demand, or a business.

## Pass-or-kill gates

1. **Fault detection: PASS** — 20/20 seeded mutants detected across WebSocket, SSE, and REST synthetic fixtures.
   Boundary: Disclosed seeded mutants across three purpose-built transport fixtures.
2. **Replay stability: PASS** — 20/20 synthetic minimized failures and 5/5 Etherpad minimized replays reproduced.
   Boundary: Local Chromium and one machine; not a cross-platform flake estimate.
3. **Fourth-app integration: PASS** — Unmodified Etherpad 3.3.2 integrated end to end in 35.1 minutes.
   Boundary: One unfamiliar production application under a local default configuration.
4. **PR runtime: PASS** — 50 schedules, three clients, four workers completed in 11.95 s (47 passed, 3 failed, 0 errors).
   Boundary: Synthetic WebSocket fixture campaign, local four-worker measurement.
5. **Novel actionable failure: PASS** — Etherpad reconnect UI-readiness failure shrank from 8 to 3 steps and replayed 5/5; targeted upstream source-test review found no equivalent real-network reconnect-then-type case.
   Boundary: Actionable candidate, not a maintainer-confirmed upstream bug; source-test search was targeted rather than exhaustive.

## Publication

- Repository: https://github.com/Atomics-hub/replicafuzz
- GitHub release: https://github.com/Atomics-hub/replicafuzz/releases/tag/v0.1.0-alpha.2
- npm: published_and_clean_install_verified
- npm URL: https://www.npmjs.com/package/replicafuzz/v/0.1.0-alpha.2
- npm boundary: replicafuzz@0.1.0-alpha.2 was read from the public registry and installed in a fresh temporary project; its CLI command listing exited 0. This verifies this release, not a future OIDC publish.
- Trusted publishing: configured_not_yet_exercised

## Remaining unproven claims

- broad portability across several unrelated production applications
- maintainer confirmation that the Etherpad finding is an upstream defect
- hosted-service reliability or security
- customer demand, pricing, or commercial viability
- trademark or legal clearance for the ReplicaFuzz name
