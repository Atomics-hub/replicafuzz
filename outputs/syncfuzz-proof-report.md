# SyncFuzz technical proof report

Generated: 2026-07-15T19:40:22.853Z

> Scope: local synthetic browser fixtures and seeded mutants. This report does not establish production-stack portability, demand, or a company thesis.

## Verdict

All technical gates passed on synthetic local fixtures.

## Pass-or-kill gates

1. **Fault detection: PASS** — 20/20 seeded mutants detected across WebSocket, SSE, and REST synthetic fixtures.
2. **Replay stability: PASS** — 20/20 minimized failures reproduced (100.0%).
3. **Fourth-app integration: PASS** — A fourth synthetic storage/polling app integrated in 1.7 minutes with 4 insertions and 2 deletions across 3 core files. This is not a production-app timing claim.
4. **PR runtime: PASS** — 50 schedules, three clients, four workers completed in 26.26 s (42 passed, 8 failed, 0 errors).
5. **Novel actionable failure: PASS** — Baseline WebSocket fixture silently loses a dropped outbound operation when an unrelated inbound snapshot clears pending state; its declared single-client happy-path test does not exercise message loss. This is a synthetic-fixture finding, not a production bug.

## Measurements

```json
{
  "seededFaults": {
    "detected": 20,
    "total": 20,
    "byFixture": {
      "websocket": 7,
      "sse": 6,
      "rest": 7
    }
  },
  "replay": {
    "reproduced": 20,
    "attempted": 20,
    "rate": 1
  },
  "shrink": {
    "averageOriginalSteps": 5,
    "averageMinimizedSteps": 1
  },
  "campaign": {
    "fixture": "websocket",
    "runs": 50,
    "clients": 3,
    "workers": 4,
    "passed": 42,
    "failed": 8,
    "errors": 0,
    "wallMs": 26260,
    "p50ScheduleMs": 1771,
    "p95ScheduleMs": 3022
  },
  "integration": {
    "schemaVersion": 1,
    "app": "storage-polling synthetic browser fixture",
    "startedAt": "2026-07-15T19:21:55Z",
    "completedAt": "2026-07-15T19:23:37Z",
    "elapsedSeconds": 102,
    "elapsedMinutes": 1.7,
    "baselineCommit": "5c1e2cc",
    "coreDiff": {
      "filesChanged": 3,
      "insertions": 4,
      "deletions": 2,
      "files": [
        "fixtures/server.ts",
        "src/cli.ts",
        "src/types.ts"
      ]
    },
    "fixtureSpecificFiles": [
      "fixtures/storage/manifest.ts",
      "fixtures/storage/README.md",
      "tests/storage-integration.test.ts"
    ],
    "verification": {
      "command": "vitest run tests/storage-integration.test.ts --maxWorkers=1",
      "result": "passed",
      "clients": 3,
      "scenario": "two semantic increments, third-client reload, convergence checkpoint"
    },
    "claimBoundary": "Measures integration of a purpose-built fourth fixture against an already-defined browser contract; it does not measure an unfamiliar production application."
  },
  "novelFailure": {
    "status": "failed",
    "failures": [
      {
        "invariant": "semantic-model",
        "message": "canonical value differs from accepted semantic total 2",
        "snapshots": {
          "client-1": {
            "value": 1,
            "pending": 0,
            "revision": 1
          },
          "client-2": {
            "value": 1,
            "pending": 0,
            "revision": 1
          },
          "client-3": {
            "value": 1,
            "pending": 0,
            "revision": 1
          }
        }
      }
    ],
    "existingTestScope": "single-client happy path"
  }
}
```

## Limitations

- All four target applications are purpose-built micro-fixtures, not third-party production repositories.
- The 20 faults are disclosed seeded implementation mutants; detection does not estimate real-world defect prevalence.
- Traffic delay/drop controls are application-level shims; offline, reload, and process death use Playwright browser controls.
- Quiescence and canonical snapshots are application-defined, as they must be for a vendor-neutral adapter.
- No demand, pricing, hosted-service, mobile-device, service-worker, remote-queue, or credentialed integration claim is made.
