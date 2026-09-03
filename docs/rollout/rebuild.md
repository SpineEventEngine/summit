# Cross-repository rebuild waves

A parameterised procedure for propagating a change across the Spine SDK
repositories from `summit`, in dependency order, ending in one pull request per
repository plus a closing `config` PR that records the new version vector.

The deterministic mechanics live in the repo-owned [`cascade`](../../cascade)
script; the judgement steps — fixing build breakage, the pre-PR review, and the
version edge cases — are agent-driven, requested by the script via **exit code 3**
(the message always names a resume command, and a skill when the fix needs
judgement). State is derived, never remembered: interrupt anything, re-run it,
and the wave resumes.

How a wave uses [`../dependency-graph.md`](../dependency-graph.md): only
dependencies on repositories *earlier* in that document's canonical build
order sequence a wave — the repo re-pins those at their wave versions. The
reverse directions of the mutual dependencies are satisfied by previously
published artifacts, impose nothing on the wave, and are advanced only by the
closing `config` PR.

Wave kinds:

| kind       | trigger                                          | scope                  |
|------------|--------------------------------------------------|------------------------|
| `refresh`  | `config` master advanced                         | all non-excluded repos |
| `ripple`   | one upstream published a new version             | its downstream closure |
| `retarget` | coordinated version assignment (e.g. `2.0.0-M1`) | all non-excluded repos |

## 0. Prerequisites (once per machine)

- A durable `JAVA_HOME` pointing at a JDK 17 in your shell profile — agent-run
  builds (`pre-pr`, `bump-version`) do not inherit the script's own export. On
  macOS that is `export JAVA_HOME="$(/usr/libexec/java_home -v 17)"`; elsewhere
  set it to the JDK 17 path directly, or use your distribution's alternatives
  mechanism.
- `gh auth status` shows a token with `repo` + `workflow` scope, plus
  `read:packages` — `delivery-server` publishes to GitHub Packages, and
  `ship` and `close` cannot verify its artifacts without that scope.
- Builds run **strictly sequentially** — never start a second Gradle build while
  a wave build runs. Maven Central consumption blocks (HTTP 429) are machine-wide
  and retries extend them up to 24 h; the script halts the wave on the first 429
  and `./cascade resume` requires your explicit acknowledgement.

## 1. Plan

```bash
./cascade plan --kind refresh                      # after a config merge
./cascade plan --kind ripple --seed base-libraries@2.0.0-SNAPSHOT.442
./cascade plan --kind retarget --target 2.0.0-M1
```

`plan` verifies [`../dependency-graph.md`](../dependency-graph.md) against a
fresh derivation (drift → fix the graph first), validates the registry probe
markers, refuses to run over open `cascade-*` PRs, and writes the wave manifest
pair to `.agents/tasks/<wave>.{json,md}`. **Review the printed order before
continuing.** Stragglers (`reflect`, `money`, `testlib`) are excluded by default;
opt them in with `--include` — their first `config/pull` is a migration, so
expect adapt work or parks.

`retarget` prerequisite: the stragglers must be caught up first (every module
carries the target version). Verify the version guards accept the jump — Maven
qualifier ordering may rank `M1` below the `SNAPSHOT` line.

## 2. Drive the wave

`./cascade next` prints the wave's pending actions; the **driver** is whatever
executes them — the `/cascade` slash-command session locally, a cloud workflow
later, or you at the terminal. Action tokens name *wave steps*, not Gradle
tasks: `BUILD:time` means "run `./cascade build time`", which wraps the Gradle
build in the step's gates and bookkeeping (listed below). To drive by hand,
repeat:

```bash
./cascade next
```

and execute what it prints, in order:

- `PREP:<repo>` → `./cascade prep <repo>` — branch, `./config/pull` (own commit),
  pin deltas (own commit), version bump/assignment (own commit). Exit 3 routes
  to `bump-version` (deprecated `by extra(...)`, non-snapshot lines).
- `BUILD:<repo>` → `./cascade build <repo>` — version self-gate, clean build +
  Dokka, mavenLocal publication, dependency-reports commit. Exit 3 routes to the
  `cascade-adapt` skill (mechanical fixes committed; semantic breakage parks the
  repo — three adapt→rebuild rounds, then auto-park). Exit 5 = throttling halt.
- `PREPR:<repo>` → run the `pre-pr` skill inside the repo (writes the sentinel).
- `SHIP:<repo>` → `./cascade ship <repo>` — sentinel gate, upstream-published
  gate, floor gate (every version the repo pins — forward upstreams *and*
  published floors — proven in the registry, derived from the pin files by
  content, since floors never appear in the manifest), drift gate, push, PR.
  Exit 4 means an upstream is not published yet: wait, don't force.
- `WAIT-*` only → `./cascade await` (background it) — exits the moment the
  action set changes; then run `next` again.
- `CLOSE` → `./cascade close` — stages the final vector in `config` (floors
  included, now provably published), exit 3 → `pre-pr` in config →
  `./cascade close --ship` opens the closing PR.

Humans do exactly: review/merge PRs, resolve parks (`./cascade resume`), and
acknowledge throttle halts. Everything else is the loop.

## 3. Drift

If an upstream re-bumps while a downstream PR is in review (registry collision
or breaking-PR reclassification), `ship` detects it:

```bash
./cascade refresh <repo>     # re-pin, then rebuild + pre-pr + ship again
```

## Cost & caveats

- A full `refresh` wave is roughly one clean build + one Dokka run per repo,
  sequentially — budget hours, not minutes; `pre-pr` adds reviewer passes.
- **Parallel builds of graph-independent repos** are viable: the historical
  blocker — `ProjectBuilder`/TestKit test JVMs re-resolving their graphs against
  Maven Central past the shared cache — is retired by the stub-repository
  fixture (`core-jvm-compiler/gradle-plugin/build.gradle.kts`, `stubRepoDeps` →
  `build/stub-repo` → `-Dstub.repository`), which keeps test resolution local.
  The initial implementation of the driver loop still runs one
  `./cascade build` at a time purely for simplicity. The planned first refinement adds a
  concurrency option to the `cascade` script (styled after `make --jobs N`):
  the driver would then run up to `N` graph-independent builds at once.
  Prerequisites for that refinement: a manifest write-lock (concurrent state
  writes) and a Gradle-daemon RAM budget. The HTTP 429 halt in
  `./cascade build` stays as cheap insurance regardless.
- `BuildSpeed` is `verify-only` (generated settings, no publishing); expect it
  parked in the first wave until its pin mechanics earn a per-class hook.
- The wave state pair `.agents/tasks/<wave>.{json,md}` is committed to the
  summit wave branch by the script at checkpoints; delete both when the wave is
  done (house task-file lifecycle).
