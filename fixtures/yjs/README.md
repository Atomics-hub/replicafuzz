# Yjs integration target

This target uses the external MIT-licensed `yjs` package. Three isolated
Playwright browser contexts edit one Y.Array-backed counter. ReplicaFuzz supplies
a small WebSocket relay that stores and forwards native Yjs updates.

It exercises real CRDT merge and reconnect behavior. The surrounding counter UI
and adapter are purpose-built for ReplicaFuzz, so this is a real sync-library
integration—not a third-party production application integration.

Convergence must cross the relay rather than a shared browser storage channel.
