# ReplicaFuzz 0.1.0-alpha.2

This alpha adds the first unfamiliar production-application proof without
turning ReplicaFuzz into a hosted platform.

## Added

- An external adapter for unmodified Etherpad 3.3.2 at upstream commit
  `3c90fa07c3a1e1c52c782932e21d70f4628bfb41`.
- Semantic text append actions and canonical document snapshots.
- Quiescence based on equal stable text, equal Etherpad collaboration revision,
  and no native unaccepted commit.
- Real browser disconnect/reconnect, reload, page death, and relaunch coverage.
- A ten-schedule, three-client Etherpad campaign with shrinking and deterministic
  replay.

## Evidence

- Etherpad integrated in 35.1 minutes including selection, clone/install/build,
  adapter work, tests, campaign, shrink, replay, and source-test review.
- The reconnect UI-readiness candidate shrank from eight steps to three:
  disconnect, reconnect, append.
- The minimized counterexample reproduced 5/5 on fresh pads.
- A targeted Etherpad test review found related simulated disconnect and
  initial-readiness tests, but no equivalent real-network reconnect-then-type
  case.

## Boundaries

This is one local default Etherpad deployment without plugins, authentication,
reverse proxies, or a production database. Packet loss/delay, clock injection,
and server death remain unsupported in this adapter. The finding is an
actionable candidate, not a maintainer-confirmed upstream bug. npm publication
is a separate credential and interactive-authentication gate.
