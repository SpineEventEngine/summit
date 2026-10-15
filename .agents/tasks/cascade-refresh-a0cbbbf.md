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
