# Measurement method

## Fault detection

The catalog contains 20 named mutants: seven WebSocket, six SSE, and seven REST.
A mutant is detected only when the normal invariant engine returns `failed`.
Runner exceptions are recorded as errors and do not count as detections.

## Replay

Each detected schedule is minimized, executed again to capture the final failure,
serialized, then executed once more from the artifact's seed and schedule. Replay
rate is reproduced minimized failures divided by detected minimized failures.

## Shrink quality

The report records original and minimized step counts. Step count is deliberately
simple; it does not claim semantic complexity or globally minimal traces.

## Runtime

Wall time starts immediately before four worker loops and stops after all 50 runs
close their browser contexts. Each run has three clients. Browser launch, target
reset, schedule execution, quiescence, invariant checks, and context cleanup are
included. Dependency installation and the shared browser/server startup are not.

## Integration

The baseline is local commit `5c1e2cc`, containing the generic runner and three
fixtures. UTC start/end timestamps, core diff size, added fixture files, and test
command are recorded in `evidence/fourth-app-integration.json`.
