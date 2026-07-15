# Contributing

ReplicaFuzz welcomes small, evidence-backed contributions.

1. Open an issue describing the target, invariant, or runner defect.
2. Keep adapters semantic: actions should express user intent and snapshots
   should remove unstable IDs, timestamps, and presentation-only state.
3. Add a failing test or replay artifact before the fix when practical.
4. Run `pnpm verify` and `pnpm package:smoke` before opening a pull request.
5. Keep claims bounded. A synthetic fixture or single library adapter is not
   evidence of broad production portability.

Do not commit credentials, captured customer data, private URLs, or proprietary
application artifacts. By contributing, you agree that your contribution is
licensed under the repository's MIT license.
