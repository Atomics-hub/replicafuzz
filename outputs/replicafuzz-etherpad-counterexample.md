# ReplicaFuzz counterexample

- Fixture: `etherpad`
- Mutant: `none`
- Seed: `73000`
- Replay path: `ddmin/6:8,1:2,1:2,2:3`
- Shrink: 8 -> 3 steps
- Failure: issued append "[[rf-73000-2]]" had no immediate editor effect

## Replay

```sh
pnpm proof:etherpad -- --replay output/playwright/etherpad-counterexample.json
```

## Minimal timeline

1. offline client 2
2. online client 2
3. client 2 appends "[[rf-73000-2]]"

## Final snapshots

```json
{
  "client-1": {
    "value": 232,
    "pending": 0,
    "revision": 0,
    "document": "Welcome to Etherpad!\n\n\nThis pad text is synchronized as you type, so that everyone viewing this page sees the same text. This allows you to collaborate seamlessly on documents!\n\n\nEtherpad on Github: https://github.com/ether/etherpad"
  },
  "client-2": {
    "value": 232,
    "pending": 0,
    "revision": 0,
    "document": "Welcome to Etherpad!\n\n\nThis pad text is synchronized as you type, so that everyone viewing this page sees the same text. This allows you to collaborate seamlessly on documents!\n\n\nEtherpad on Github: https://github.com/ether/etherpad"
  },
  "client-3": {
    "value": 232,
    "pending": 0,
    "revision": 0,
    "document": "Welcome to Etherpad!\n\n\nThis pad text is synchronized as you type, so that everyone viewing this page sees the same text. This allows you to collaborate seamlessly on documents!\n\n\nEtherpad on Github: https://github.com/ether/etherpad"
  }
}
```
