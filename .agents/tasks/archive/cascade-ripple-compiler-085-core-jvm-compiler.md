---
slug: cascade-ripple-compiler-085-core-jvm-compiler
branch: cascade-ripple-compiler-085-core-jvm-compiler
owner: cascade
status: in-progress
started: 2026-11-24
---

# Wave `cascade-ripple-compiler-085-core-jvm-compiler` (ripple)

Machine state: [`cascade-ripple-compiler-085-core-jvm-compiler.json`](cascade-ripple-compiler-085-core-jvm-compiler.json). Park reasons and decisions land here.

## Repos

- [x] compiler
- [x] validation
- [x] core-jvm-compiler

## Log

- 2026-11-24 — wave planned.
- 2026-11-24 — scoped to `validation` and `core-jvm-compiler`, on Compiler `.085` (compiler#102, the move to CoreJvm `.781`). Local builds used the locally published `.085` until the registry served it.
- 2026-11-24 — `validation` took no adapt round; its docs lines follow the wave's versions (validation#343).
- 2026-11-24 — `core-jvm-compiler` dropped the enrichment field of its `EventContext` fixture (CoreJvm `.781` removed enrichments; the owner chose that over a local copy of the type) and gained `NestedTypeFieldSpec`. A review found that `MessageTypedField.classNameFor` gave types nested two or more levels deep an invalid class name; fixed in the same PR with a two-level test (core-jvm-compiler#130). Follow-ups were moved to a session of their own.
- 2026-11-24 — `validation`'s CI link check failed once on GitHub `503` responses; the driver reran it on the owner's go-ahead, and it passed.
- 2026-11-24 — **closing**: config#847 records Compiler `.085`, Validation `.472`, and CoreJvm Compiler `.107`; it was an open draft when this file was archived.
