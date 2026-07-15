# Etherpad external adapter

This adapter targets the unmodified upstream Etherpad application through its
real browser UI. It was developed against Etherpad 3.3.2 at commit
`3c90fa07c3a1e1c52c782932e21d70f4628bfb41`.

## Run locally

Build and start Etherpad using its official source instructions, then run:

```sh
ETHERPAD_ORIGIN=http://127.0.0.1:9001 pnpm test:etherpad
ETHERPAD_ORIGIN=http://127.0.0.1:9001 pnpm proof:etherpad -- --runs 10
```

Each schedule gets a fresh UUID-scoped pad, so the adapter does not need API
credentials or destructive reset access. Three isolated Playwright contexts
append unique semantic tokens through Etherpad's contenteditable editor.

Canonical state is the normalized editor text plus Etherpad's collaboration
revision. Quiescence requires three stable observations where every client has
the same text and revision and `collabClient.hasUnacceptedCommit()` is false.

## Honest control boundary

The adapter uses real Playwright offline/online, reload, page death, and
relaunch controls. It does not claim packet drop, packet delay, clock
injection, server death, authentication, plugin, proxy, or production-database
coverage. Etherpad 3.3.2 removes `contenteditable` while disconnected, so the
campaign tests stale-observer catch-up and post-reconnect edits rather than
claiming offline editing. A proxy or application-specific hook is required for
traffic faults.
