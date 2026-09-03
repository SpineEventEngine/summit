---
slug: cascade-refresh-2cd0e3b
branch: cascade-refresh-2cd0e3b
owner: cascade
status: in-progress
started: 2026-08-29
---

# Wave `cascade-refresh-2cd0e3b` (refresh)

Machine state: [`cascade-refresh-2cd0e3b.json`](cascade-refresh-2cd0e3b.json). Park reasons and decisions land here.

## Repos

- [ ] base-libraries
- [ ] logging
- [ ] base-types
- [ ] change
- [ ] tool-base
- [ ] ProtoTap
- [ ] time
- [ ] compiler
- [ ] validation
- [ ] core-jvm-compiler
- [ ] core-jvm
- [ ] jdbc-storage
- [ ] gcloud-jvm
- [ ] delivery-server
- [ ] BuildSpeed

## Log

- 2026-08-29 — wave planned.
- 2026-08-29 — **parked** `logging`: adapt
- 2026-08-29 — resumed `logging`.
- 2026-08-29 — **parked** `logging`: adapt budget exhausted: three kotlinx conflict layers (coroutines-bom, atomicfu, coroutines-slf4j via ktor) vs baseline 1.11.0
- 2026-08-29 — resumed `logging`.
- 2026-08-29 — **parked** `base-types`: toolchain incompatibility: compiler .067 (pre-refresh pins, spine-format .423, jackson-bom 2.22.0) and core-jvm-plugins .091 (refresh-era, jackson 2.22.1) cannot share the plugin-managed :spineCompiler classpath; no post-refresh compiler is published; consumer-side forces do not reach that configuration. Unparks when this wave's compiler/validation/core-jvm-compiler publish a coherent toolchain.
- 2026-08-29 — **parked** `change`: toolchain incompatibility (same as base-types): compiler .067 floor and core-jvm-plugins .091 cannot share the :spineCompiler classpath; also uses the retired CoreJvmCompiler.pluginLib accessor. Resolvable only after a post-refresh toolchain publishes and floors advance.
- 2026-08-29 — **parked** `time`: toolchain incompatibility (same as base-types): compiler .067 floor and core-jvm-plugins .091 cannot share the :spineCompiler classpath; also uses the retired CoreJvmCompiler.pluginLib accessor. Resolvable only after a post-refresh toolchain publishes and floors advance.

- 2026-08-29 — **Wave halted by owner decision**: the refresh (config PR #752)
  published `core-jvm-plugins .091` against the new baseline while the compiler
  fallback stayed at pre-refresh `.067`; repos loading both plugins cannot
  resolve the plugin-managed `:spineCompiler` classpath, and the parked repos
  (`base-types`, `change`, `time`) block the toolchain lane that would fix
  them. Owner chose fixing the toolchain at source over a partial wave.
  Delivered before the halt: base-libraries PR #960 (open); logging and
  tool-base built, published to mavenLocal, logging reviewer-approved.
  Config/compiler follow-ups: (1) build+publish compiler on the refreshed
  baseline, then align `Compiler.fallback*` and `CoreJvmCompiler` pins
  coherently; (2) force the kotlinx set (coroutines-bom, atomicfu,
  coroutines-slf4j) centrally in distributed buildSrc; (3) retire dead
  accessors (`ToolBase.lib` -> `tool-base:` artifact gone;
  `CoreJvmCompiler.pluginLib` removed but still referenced by base-types,
  change, time); (4) `Coroutines.modules` lacks `slf4j`.

- 2026-08-29 — Owner's decision on the Kotlin/Gradle tension: **keep forcing
  Kotlin 2.4.10** over the Gradle-9.7.1-embedded 2.4.0 `strictly` pin.
  Config follow-up (5): implement the force centrally in the distributed
  build logic, adjacent to wherever the strictly constraint is emitted, so
  every classic `buildscript {}` consumer of refresh-era plugin jars gets it
  without local edits (compiler's local force then retires).
- 2026-08-29 — resumed `base-types`.
- 2026-08-29 — resumed `base-types`.
- 2026-08-29 — resumed `time`.
- 2026-08-29 — resumed `time`.
- 2026-08-29 — resumed `change`.
- 2026-08-30 — **parked** `BuildSpeed`: verify-only: SDK versions arrive as CI environment variables substituted into settings.gradle.kts.template, so there are no file pins to apply, no version to bump, and no artifact to publish
- 2026-08-31 — **superseded**: the `-Xcontext-parameters` removal now ships as
  its own PR, SpineEventEngine/config#753 (branch
  `drop-redundant-context-parameters`). The earlier decision to fold it into
  the closing vector PR no longer applies — `cascade close` must NOT
  cherry-pick it, or the change would be applied twice. If #753 is still open
  when the wave closes, the closing PR simply does not carry it.
  Context parameters stopped being experimental in Kotlin 2.4.10, so the flag
  now only emits "The argument '-Xcontext-parameters' is redundant for the
  current language version 2.4." Verified: `tool-base`'s
  `protobuf-setup-plugins` (the SDK's only user of the feature) compiles
  without it at 2.4.10, and the warning is gone from `base-types`.
  Caveat: the flag IS still required under Kotlin 2.3.x, so do not backport
  this to a pre-refresh baseline.
