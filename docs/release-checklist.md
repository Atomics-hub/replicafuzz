# ReplicaFuzz alpha release checklist

## Offline release candidate

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm exec playwright install chromium`
- [ ] `pnpm verify`
- [ ] `pnpm measure:yjs` passes 10/10
- [ ] Etherpad 3.3.2 is running locally and `pnpm test:etherpad` passes
- [ ] `pnpm proof:etherpad -- --runs 10` emits a minimized 5/5 replay
- [ ] `pnpm proof` reports five bounded synthetic-fixture passes
- [ ] `pnpm package:smoke` installs and executes the packed CLI
- [ ] `pnpm audit --audit-level=high` reports no known vulnerabilities
- [ ] `pnpm name:check` reports no exact npm/GitHub repository-name collision
- [ ] `pnpm release:preflight` reports `ready_for_github_alpha`
- [ ] `git diff --check` passes and the intended release commit is clean

## GitHub publication

- [ ] Create public `Atomics-hub/replicafuzz`
- [ ] Push `main` and wait for `ci`
- [ ] Enable private vulnerability reporting, secret scanning, and Dependabot
- [ ] Add a `main` ruleset requiring the `verify` status check and blocking force pushes
- [ ] Create labels used by issue forms: `bug` and `adapter`
- [ ] Tag `v0.1.0-alpha.2`
- [ ] Create the GitHub prerelease from `docs/release-notes-0.1.0-alpha.2.md`
- [ ] Attach the packed tarball, checksum, proof report, and release preflight

## npm publication (separate credential gate)

- [ ] Sign in to npm and confirm ownership of the unscoped `replicafuzz` name
- [ ] Configure GitHub Actions as an npm trusted publisher
- [ ] Publish `0.1.0-alpha.2` under the `alpha` dist-tag
- [ ] Install from the public registry in a clean directory and run `replicafuzz help`

The checklist distinguishes an offline preflight, a public GitHub alpha, and an
npm release. Passing one layer must not be described as completing another.
