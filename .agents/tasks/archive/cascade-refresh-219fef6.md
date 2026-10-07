---
slug: cascade-refresh-219fef6
branch: cascade-refresh-219fef6
owner: cascade
status: in-progress
started: 2026-10-07
---

# Wave `cascade-refresh-219fef6` (refresh)

Machine state: [`cascade-refresh-219fef6.json`](cascade-refresh-219fef6.json). Park reasons and decisions land here.

## Repos

- [ ] reflect

## Log

- 2026-10-07 — wave planned.
- 2026-10-07 — **parked** `reflect`: buildSrc orphans: config/pull's cp -R overlay left 20 files config no longer ships (Runtime.kt, CoreJava.kt, ArtifactVersion.kt, dokka-for-*.gradle.kts, report/coverage/*, ...) -> 13 :buildSrc compile errors; fix belongs in config migrate's retired-file removal (testlib carries 14 such orphans too)
- 2026-10-07 — resumed `reflect`.
