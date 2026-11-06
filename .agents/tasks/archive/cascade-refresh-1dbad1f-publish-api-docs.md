---
slug: cascade-refresh-1dbad1f-publish-api-docs
branch: cascade-refresh-1dbad1f-publish-api-docs
owner: cascade
status: in-progress
started: 2026-11-04
---

# Wave `cascade-refresh-1dbad1f-publish-api-docs` (refresh)

Machine state: [`cascade-refresh-1dbad1f-publish-api-docs.json`](cascade-refresh-1dbad1f-publish-api-docs.json). Park reasons and decisions land here.

## Repos

- [ ] base-libraries
- [ ] reflect
- [ ] logging
- [ ] testlib
- [ ] dokka-tools
- [ ] base-types
- [ ] change

## Log

- 2026-11-04 — wave planned.
- 2026-11-04 — `base-libraries` and `testlib` adapted in round 1: the buildscript classpath resolved `spine-reflect` `.202` (via `protobuf-setup-plugins` `.451` > `spine-base` `.462`) against the pinned `.203`; each root `buildscript` now forces `Reflect.lib`. `base-libraries`' `base` module also orders `kspKotlin`/`kspTestKotlin` after `generateProto`/`generateTestProto`; the shared fix is config#838.
- 2026-11-04 — `base-libraries`' first `Publish API docs` run failed before Gradle, at the runner's "Add swap space" step (`pierotofy/set-swap-space` on the zram image `ubuntu24/20261101.114`); its re-run on 2026-11-05 is green.
- 2026-11-05 — **closed**: config#836 (merged as `5db9312a`) records the wave's version vector.
