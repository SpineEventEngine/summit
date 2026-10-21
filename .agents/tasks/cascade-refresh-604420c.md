---
slug: cascade-refresh-604420c
branch: cascade-refresh-604420c
owner: cascade
status: in-progress
started: 2026-10-21
---

# Wave `cascade-refresh-604420c` (refresh)

Machine state: [`cascade-refresh-604420c.json`](cascade-refresh-604420c.json). Park reasons and decisions land here.

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

- 2026-10-21 — wave planned.
- 2026-10-21 — **parked** `BuildSpeed`: verify-only: SDK versions arrive as CI environment variables substituted into settings.gradle.kts.template, so there are no file pins to apply, no version to bump, and no artifact to publish
- 2026-10-21 — **parked** `core-jvm-compiler`: CoreJvmPluginIgTest: applying the published plugin by ID in plugins{} with Compiler .080 on the buildscript classpath fails on Gradle's embedded-Kotlin pin (org.jetbrains:annotations strictly 13.0); worked with Compiler .074
- 2026-10-21 — resumed `core-jvm-compiler`.
- 2026-10-21 — `core-jvm-compiler` unparked. Root cause of the `CoreJvmPluginIgTest` failure: stale local builds from the abandoned `a0cbbbf` wave in `~/.m2` (core-jvm `.571`/`.572`, base-types `.226`, built with Kotlin 2.4.21 and endorsing `kotlin-bom` 2.4.21) shadowed the registry artifacts of the same versions, because the TestKit project lists `mavenLocal()` first; their graph cannot be reconciled with Gradle's strict embedded-Kotlin pins (`kotlin-stdlib` 2.4.10, `annotations` 13.0). Moved them to the session scratchpad; CI never sees them.
- 2026-10-21 — follow-up after the wave: config#813 (merged as `a53eca4b2e`) declares `OpenTelemetryKotlin.exportersCore`/`exportersOtlp`; once `logging` pulls a config at or past it, `otel-backend-bootstrap/build.gradle.kts` can drop the inline coordinates from `0bf9a733`.
- 2026-10-21 — retargeted `logging` to `2.0.0-SNAPSHOT.428` (logging#153, on the latest `config` with the named OpenTelemetry exporter accessors) at the owner's request; the wave branch was fast-forwarded to master. Unshipped downstream repos re-pin to `.428`; the already-published testlib `.216` and tool-base `.428` keep `.427` as a floor.
- 2026-10-21 — ProtoTap#24 merged on its pre-re-pin head (`08b843a`), so ProtoTap `0.17.4` pins logging `.427` (a floor, like testlib and tool-base); its local re-pin commits stay unpushed, and the local rebuild of `0.17.4` was moved out of `~/.m2`.
