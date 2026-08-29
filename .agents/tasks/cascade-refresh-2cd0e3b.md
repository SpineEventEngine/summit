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
