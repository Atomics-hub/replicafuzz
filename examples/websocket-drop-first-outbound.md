# SyncFuzz counterexample

- Fixture: `websocket`
- Mutant: `websocket-drop-first-outbound`
- Seed: `10000`
- Replay path: `ddmin/3:5,0:2`
- Shrink: 5 -> 1 steps
- Failure: canonical value differs from accepted semantic total 1

## Replay

```sh
pnpm syncfuzz replay examples/websocket-drop-first-outbound.json
```

## Minimal timeline

1. client 1 increments by 1

## Final snapshots

```json
{
  "client-1": { "value": 0, "pending": 0, "revision": 0 },
  "client-2": { "value": 0, "pending": 0, "revision": 0 },
  "client-3": { "value": 0, "pending": 0, "revision": 0 }
}
```
