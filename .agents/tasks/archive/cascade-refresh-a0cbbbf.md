---
slug: cascade-refresh-a0cbbbf
branch: cascade-refresh-a0cbbbf
owner: cascade
status: in-progress
started: 2026-10-15
---

# Wave `cascade-refresh-a0cbbbf` (refresh)

Machine state: [`cascade-refresh-a0cbbbf.json`](cascade-refresh-a0cbbbf.json). Park reasons and decisions land here.

## Repos

- [ ] base-libraries
- [ ] reflect
- [ ] logging
- [ ] testlib
- [ ] dokka-tools
- [ ] tool-base
- [ ] ProtoTap
- [ ] compiler
- [ ] validation
- [ ] core-jvm-compiler
- [ ] base-types
- [ ] change
- [ ] time
- [ ] money
- [ ] core-jvm
- [ ] jdbc-storage
- [ ] gcloud-jvm
- [ ] delivery
- [ ] BuildSpeed

## Log

- 2026-10-15 — wave planned.
- 2026-10-15 — **parked** `BuildSpeed`: verify-only: SDK versions arrive as CI environment variables substituted into settings.gradle.kts.template, so there are no file pins to apply, no version to bump, and no artifact to publish
- 2026-10-15 — **parked** `core-jvm-compiler`: awaiting owner decision: 5 tests in tests/entity-queries (EntityQueryBuilderTest) assert FieldMask behavior that base-libraries#964 made a deprecated no-op ('Please remove the call'); deleting them was blocked as test removal
- 2026-10-16 — resumed `core-jvm-compiler`.
- 2026-10-16 — **parked** `validation`: waiting for a complete compiler publish: compiler .072's publish aborted at test-env's PublicationChecksums (config#764) before compiler-testlib uploaded; a compiler fix + config update + new compiler version are in progress, after which validation, core-jvm-compiler and time re-pin to it
- 2026-10-16 — retargeted `compiler` to `2.0.0-SNAPSHOT.074`: the publish of the wave's `.072` (compiler#91) failed midway at test-env's PublicationChecksums, leaving `compiler-testlib` unpublished; compiler#92 fixed the attestation and published `.074` completely. The local wave branch was fast-forwarded to master; downstream repos re-pin to `.074`.
- 2026-10-16 — resumed `validation`.
- 2026-10-19 — `base-types` collided: base-types#56 took `2.0.0-SNAPSHOT.226` on master. Merged master into the wave branch (the wave already carried its change) and re-bumped to `.227`; `core-jvm` and `gcloud-jvm` re-pinned.
- 2026-10-21 — superseded: the wave restarts as `cascade-refresh-604420c` with `config@604420c` (Gradle 9.8.2, Kotlin capped at the Gradle-embedded 2.4.10). Published here: base-libraries .461, reflect .202, logging .426, testlib .215, dokka-tools .11, tool-base .426, ProtoTap 0.17.3, compiler .074, validation .465. Unshipped branches carry over; core-jvm-compiler#119 closed.
