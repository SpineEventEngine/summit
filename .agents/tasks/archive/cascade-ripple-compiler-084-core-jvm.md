---
slug: cascade-ripple-compiler-084-core-jvm
branch: cascade-ripple-compiler-084-core-jvm
owner: cascade
status: in-progress
started: 2026-11-24
---

# Wave `cascade-ripple-compiler-084-core-jvm` (ripple)

Machine state: [`cascade-ripple-compiler-084-core-jvm.json`](cascade-ripple-compiler-084-core-jvm.json). Park reasons and decisions land here.

## Repos

- [x] compiler
- [x] validation
- [x] core-jvm-compiler
- [x] core-jvm

## Log

- 2026-11-24 — wave planned.
- 2026-11-24 — scoped to `validation`, `core-jvm-compiler`, and `core-jvm` with eight `--exclude` options.
- 2026-11-24 — `cascade` read the hand-published seed as `pending`; `derive_state` now derives a `repo@version` seed as published (`eca490a`).
- 2026-11-24 — `validation` adapted in two rounds: the stale `launchSpineCompiler` -> `kspKotlin` edge in `tests/validator` formed a cycle with Compiler `.084`, and `gradle-plugin` forces `ToolBase.jvmTools`.
- 2026-11-24 — `core-jvm-compiler` needed CoreJvm `.750`, Base `.465`, and ToolBase `.460` (its `./config/pull` lowered the last two); the routing fixture and `SignalDiscoverySpec` follow CoreJvm `.750` and Compiler `.084`.
- 2026-11-24 — `core-jvm` builds on CoreJvm Compiler `.106` (the owner raised `dogfoodingVersion` on the branch); re-bumped to `.781` after core-jvm#1734 (`.780`) merged first.
- 2026-11-24 — **closed**: config#846 (merged as `97dee91e`) records the wave's vector, with Base `.465` and ToolBase `.460` added by the owner's decision.
