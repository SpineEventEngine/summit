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
