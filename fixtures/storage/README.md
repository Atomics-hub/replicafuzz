# Storage/polling fixture

This is the fourth-app integration probe. It is a synthetic offline-shaped
browser app: HTTP polling supplies remote state and `localStorage` preserves the
last canonical snapshot across reloads.

The integration adds one fixture identifier, two fixture-local persistence
hooks, and this manifest. The generic runner, schedule format, shrinker, replay
artifact, and invariant engine are unchanged.

This does **not** show that an arbitrary production app can integrate in the
same time. It shows that a browser app already able to expose the five adapter
operations can do so without an invasive runner rewrite.
