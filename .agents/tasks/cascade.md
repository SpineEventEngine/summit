---
slug: cascade
branch: cascade-machinery
owner: alexander.yevsyukov
status: draft
started: 2026-08-29
---

# `cascade` — automated cross-repository waves

Design under discussion — do **not** start implementation until this task is
`approved`.

## Context

Changes must regularly propagate across the SDK repos in dependency order: per repo —
`./config/pull`, refresh local dependency pins, bump/assign the version, build, open a
PR — with downstream PRs opening only after upstream artifacts are actually published.
Today this is manual. Goal: humans only review/approve PRs; everything else is
automated. Phase 1 runs from a Claude session in `summit`; phase 2 moves to cloud
workflows. Three wave kinds cover the known triggers:

- **`refresh`** — `config` merged (e.g. the pending `refresh-dependencies` branch);
  every repo rebuilds against the new baseline.
- **`ripple`** — a top upstream repo (e.g. `base-libraries`) published a new version;
  only its downstream closure rebuilds.
- **`retarget`** — a coordinated version assignment across all repos, e.g. dropping
  the `SNAPSHOT` infix to release `2.0.0-M1` everywhere.

A fourth kind (`custom`: mass mechanical edits) is a later extension; the kind
abstraction (scope rule + per-repo edit step + version rule) is its seam.

Key mechanics (verified this session) the design exploits:

- `config/pull` resets every consumer's `buildSrc/` (and so all
  `io.spine.dependency.local/*.kt` pins) to config@master — config's pins **are** the
  published version vector; a wave applies only the *delta* per repo.
- Versions are static literals in `version.gradle.kts`; `publish.yml` (on master push)
  publishes exactly that literal → deterministic at PR time.
- `standardToSpineSdk()` puts `mavenLocal()` **last** → a *bumped* (not-yet-published)
  version resolves from mavenLocal locally and from GCAR in CI after upstream merges.
  Same coordinates, no config switching.
- Publishedness is anonymously probeable:
  `https://europe-maven.pkg.dev/spine-event-engine/{snapshots,releases}/<group>/<artifact>/maven-metadata.xml`.
- House pattern to mirror: `proofread-repo` script (mechanics, git-state idempotency,
  exit-3 escalation to agent) + `docs/rollout/` playbook + shared skill (judgement,
  commit authorization).

Decisions made with the user: mechanical breakage fixed autonomously, semantic
breakage parks the repo (downstream holds, independent DAG branches continue); eager
builds against mavenLocal, PR *creation* sequenced by upstream publish; version vector
propagates per-repo during the wave, one closing `config` PR records the final vector;
humans merge (agent `gh pr merge` is deny-listed).

## Architecture digest

**Wave** = one cascade run; consumer branch name = wave slug (per-wave branches keep
two waves independent). Kind determines slug, scope, and version rule:

| kind       | slug                                  | scope                                                                                                                                                        | version rule                                                                                       |
|------------|---------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `refresh`  | `cascade-refresh-<7-char config SHA>` | all non-excluded repos                                                                                                                                       | snapshot `+1`                                                                                      |
| `ripple`   | `cascade-ripple-<seed>-<ver>`         | downstream closure of `--seed <repo>[@<version>]` (seed itself included when its PR is part of the wave; recorded pre-`done` when already published by hand) | snapshot `+1`                                                                                      |
| `retarget` | `cascade-retarget-<version>`          | all non-excluded repos                                                                                                                                       | every repo's version **set to** `--target` (e.g. `2.0.0-M1`); pins point at upstreams' same target |

Per-repo procedure is identical across kinds; `./config/pull` always runs (keeps repos
current, floats agent tooling) but its commit is skipped when it stages nothing
(ripple/retarget with unmoved config). For `retarget`, published-floor constants still
hold last *published* versions during the wave and advance only at `close`, by which
point the target is published everywhere. `retarget` has a hard prerequisite: the
straggler repos must be caught up first (every module carries the target, and
`reflect`/`testlib` are pinned across the graph). Roadmap (owner's decision):
**wave 1** `refresh` on the healthy set (machinery shakedown) → **wave 2** attended
straggler catch-up (`refresh --include reflect --include money --include testlib`) →
M1 `retarget` unblocked. A follow-up `retarget` reopens development (back to the
snapshot line) with the same machinery.

**State** — two files per wave in summit, created by the script:
- `.agents/tasks/<wave>.md` — human/agent contract (frontmatter, checklist, log, park reasons).
- `.agents/tasks/<wave>.json` — machine manifest, script-written only. Records: wave
  `kind` + trigger (config SHA / seed@version / wave target), frozen DAG edges + grep
  evidence, per-repo `state`, `target_version`, `pin_vector`,
  PR refs, park reasons, repo class (`library` | `verify-only`), eager/deferred flag,
  `version_property` name. Committed to the wave's summit branch at checkpoints
  (subject `Update cascade state`).
- Honesty rule: `status` **re-derives** every derived fact (branch commits via
  log-grep, `pinned` **by content** — every `track` constant equals the manifest
  `pin_vector`, so it honestly regresses after drift; sentinel via `pre-pr.ok`; PR via
  `gh pr view`; publishedness via metadata probe; mavenLocal via `~/.m2` path).
  `built` is the one recorded happy-path fact `{success, head_sha}` and holds only
  while `head_sha == HEAD` — any later commit demotes the repo and forces a rebuild.
  `state` is a cache, never proof.

**Per-repo states**: `pending → pulled → pinned → bumped → built → published-local →
pr-ready → pr-open → merged → published-remote → done`, plus `parked` (recorded),
`blocked` (derived from upstream parks), `deferred` (pluginManagement gap — build
only after gap-upstreams publish), `superseded`. Wave-level `halted` on HTTP 429.
`merged ≠ published-remote` — publish can fail; downstream gates on the probe.

**Dependency graph as documentation** — `summit/docs/dependency-graph.md` (NEW,
committed, linked from `README.md`): a fenced ```mermaid `flowchart TD` whose edge
lines (`base-libraries --> tool-base`) are the canonical, agent-parseable adjacency
(GitHub renders it natively for humans), grouped by the README sections via Mermaid
subgraphs; below it a metadata table per repo: class (`library`/`verify-only`/
`excluded` + reason), probe artifact (e.g. `spine-base`), `version_property` name.
Maintained by `cascade graph`: derives edges by grep (`import
io.spine.dependency.local.<Object>` in consumer-owned build files only — root/module
`build.gradle.kts`, `settings.gradle.kts`, `buildSrc/.../module.gradle.kts`; excludes
`config/**` and the rest of distributed `buildSrc/**`; object→repo table in script),
compares with the stored file, and updates it or reports drift. Topology changes ride
normal summit PRs, so the graph is reviewed documentation, not per-wave ephemera.

**Script** — `summit/cascade` (sibling of `proofread-repo`, same conventions +
`sed_inplace()` BSD/GNU wrapper). Exit codes: 0 ok/idempotent, 1 hard error, 2 usage,
**3 agent required** (message names skill + resume command), **4 waiting on external
event**, **5 throttle halt**. Subcommands:
- `graph [--check]` — regenerate/verify `docs/dependency-graph.md` (above); `--check`
  is the freshness gate other subcommands use.
- `plan --kind refresh|ripple|retarget [--seed <repo>[@<ver>]] [--target <ver>]` —
  freeze the trigger (config SHA / seed version / target); **read the stored graph**,
  re-verify it against fresh derivation (drift → exit 3: review + commit the graph
  update first), freeze the edges + evidence into the manifest; apply the kind's scope
  rule (table above); classify repos (`verify-only`: BuildSpeed — no
  `version.gradle.kts`, no publishing, settings *generated* via
  `substitute-settings.py`, so sed-based `apply_pins` may not reach its pin source:
  expected parked in wave 1, per-class pin hook if it earns one; `deferred`: repo applies a Spine Gradle plugin
  advancing this wave AND its `pluginManagement` has neither mavenLocal nor Spine
  registry — base-libraries, core-jvm, tool-base pattern); default-exclude
  `documentation` (Spine 1.x) and stragglers `reflect`/`money`/`testlib` (config
  hundreds of commits behind — their pull is a migration; opt-in via `--include`);
  detect carryover `cascade-*` PRs (excluded unless `--supersede`); write manifest +
  task file; print reviewable plan.
- `status` / `next --json` — re-derive truth / emit action list
  (`BUILD|SHIP|REFRESH|ADAPT|WAIT|HALTED|DONE`).
- `prep <repo>` — branch off `origin/master`; `./config/pull` + commit
  `Update shared agent tooling and config (./config/pull)` (floats the new skill in;
  commit skipped when pull stages nothing); `apply_pins` (read each in-wave upstream's
  **actual** version from its wave branch — or the wave target for `retarget` — sed
  the consumer pins, commit `Update local dependency pins`); version step per kind:
  `+1` snapshot fast path on the repo's `version_property`, or write the retarget
  target verbatim; commit ``Bump version -> `X` `` (retarget subject:
  ``Set version -> `X` ``); `by extra(...)`/non-snapshot line on a `+1` wave →
  exit 3 → `bump-version` skill.
- `build <repo>` — self-run `version-bumped.sh` gate (script-internal gradle bypasses
  the PreToolUse hooks, so re-implement); `./gradlew clean build dokkaGenerate`;
  `publishToMavenLocal` where `build` doesn't chain it; **strictly sequential across
  repos** (Central throttling); 429 → record halt, exit 5, never retry; other failure
  → exit 3 → `cascade-adapt` skill (budget: **three** adapt→rebuild rounds per repo
  per wave, tracked in the manifest; the third failed rebuild auto-parks with the
  full failure history); success → commit `Update dependency reports`
  (empty diff while `docs/dependencies/` exists → exit 3: `ensure-reports-updated.yml`
  would fail); verify mavenLocal serves the target.
- `ship <repo>` — sentinel gate (`pre-pr.ok` PASS + head==HEAD, exit 3 → re-run
  `pre-pr`); **upstream-published gate** (every pinned version present in registry
  metadata, else exit 4); drift gate (upstream re-bumped past pin → exit 3 →
  `refresh`); discard report noise; push; `gh pr create --body-file
  docs/rollout/rebuild-pr-body.md` (PR exists → push-only). Records PR + head SHA;
  checkpoints manifest.
- `refresh <repo>` — drift repair: re-apply pins to current published versions,
  commit, exit 3 → `pre-pr` (incremental build) → `ship`. Registry collision →
  `bump-version` sanctioned re-bump #1.
- `await [--timeout-min 30]` — background watcher (run via `run_in_background`):
  polls `gh pr view` (120 s) + metadata (60–90 s when something is `merged`, 5 min
  idle); **exits 0 on any change** to the `next` action set, 4 on timeout, 5 on halt.
  `PUBLISH_OVERDUE` after 45 min merged-without-publish.
- `park <repo> --reason` / `resume <repo>`; `close` — final vector into config's
  `local/*.kt` **including published-floor constants**, branch `<wave>-vector`,
  commit, exit 3 → `pre-pr` in config → `close --ship` opens the config PR.

**Pin-edit mechanics** — per-file constant-role table in the script:
`track` (advance during wave) vs `published-floor` (feed buildscript/pluginManagement
classpaths, which can't see mavenLocal — advanced only by `close`):
`Base.kt` version/versionForBuildScript; `ToolBase.kt` version/dogfoodingVersion
(+`JavadocFilter.version` ignored — separate line); `CoreJvmCompiler.kt`
version/dogfoodingVersion; `Compiler.kt` fallbackVersion/fallbackDfVersion; all others
`version`=track. Edit = name+old-value anchored `sed_inplace`; post-edit occurrence
verification; mismatch → revert file, exit 3.

**Skill** — `cascade-adapt` (agents repo, `skills/cascade-adapt/SKILL.md`): diagnose
the escalated build failure; classify mechanical (renames, moved packages, signature
changes, documented deprecation successors, missing explicit dependency) vs semantic
(design judgement); fix mechanical + commit; semantic → write diagnosis to task file,
`./cascade park`. Never edits `buildSrc/**` (config-owned → park) or
`version.gradle.kts` (bump-version's). `## Commit authorization` (house wording):
exactly one commit per invocation, stage only the adapted source/test files, subject
`Adapt to refreshed dependencies`, no push/tag/rebase/amend; fresh invocation on later
breakage may commit again; semantic → report, park, stop, no commit.

**Orchestrator loop (phase 1)** — `summit/.claude/commands/cascade.md` (`/cascade
<wave>`): `status` → `next` → execute actions (builds one at a time; exit 3 → invoke
the named skill and rebuild, within the three-round budget; between `built` and
`ship` run `pre-pr` in the repo) →
if only `WAIT`, launch `await` in background and end turn (its exit re-invokes the
session — no sleep-polling; optional `/loop 45m /cascade <wave>` as crash backstop) →
every iteration ends with the wave status table + "Needed from you" lines.
Human touch: review/merge PRs, park decisions, supersede decisions, throttle-halt ack.

## Change list

**PR A — agents repo** (branch `cascade-adapt-skill` in `.agents/shared/`, PR to
SpineEventEngine/agents):
- NEW `skills/cascade-adapt/SKILL.md` (+ `agents/openai.yaml` stub, matching siblings).
- NEW `claude/commands/cascade.md` — the `/cascade` loop command. It lives here,
  not in summit: summit's `.claude/commands` is a symlink into this repo, so
  slash commands are shared org-wide (the command declares itself summit-only).
- Merge before wave 1 — the wave's own `./config/pull` then floats it everywhere.

**PR B — config repo** (`/Users/sanders/Projects/Spine/config`):
- `.claude/settings.json`: remove `"Bash(git commit:*)"` from `permissions.ask`
  (violates `safety-rules.md` §Commits — an ask outranks every allow and freezes
  autonomous sessions; `migrate` distributes this file to every consumer). Add to
  `allow`: `"Bash(gh pr view:*)"`, `"Bash(gh pr list:*)"`, `"Bash(gh run list:*)"`.
- Merge before the first *unattended* wave (each mid-wave pull redistributes the file).

**PR C — summit repo** (`/Users/sanders/Projects/Spine/summit`):
- NEW `cascade` (script above; model on `proofread-repo`).
- NEW `docs/dependency-graph.md` (generated by `cascade graph`, reviewed by hand
  against the known order; `README.md` links to it from the Repository layout section).
- NEW `docs/rollout/rebuild.md` (playbook: prerequisites — durable `JAVA_HOME`,
  `gh auth status` (no per-developer settings step: the commit allow ships in summit's
  project settings); kickoff prompt with the session loop-grant wording; per-repo
  procedure; sequential-build rule; cost notes).
- NEW `docs/rollout/rebuild-pr-body.md` (modeled on `proofread-pr-body.md`; lists the
  standard commits: pull / pins / bump / reports / optional adapt).
- `.claude/settings.json`: same ask-rule removal; add `allow`:
  `"Bash(git commit:*)"` (owner's decision: summit — where cascades execute — grants
  protocol-governed autonomous commits; repo-rooted sessions elsewhere keep the org
  default prompt), `"Bash(./cascade:*)"`, `"Bash(gh pr view:*)"`,
  `"Bash(gh pr list:*)"`, `"Bash(gh run list:*)"`.
- `docs/project.md`: add `rollout/rebuild.md` to the Cross-repository workflows list.
- Per AGENTS.md, open `.agents/tasks/rebuild-cascade.md` task file when implementation
  starts; delete on merge.

Ordering: A and B are independent; C references the skill by name only. Attended
wave 1 can run from the C branch before it merges (script invoked by path).

**Phase 2 (later, design only — PR D):** `repository_dispatch` step appended to
config's distributed `publish.yml` (needs an org PAT secret on consumers — open
prerequisite) + `summit/.github/workflows/cascade.yml` (dispatch + 30-min schedule
backstop) running `status`/`next` and invoking headless Claude only on exit 3.
Phase-1 choices that keep this cheap: per-wave branches, manifest on a pushed summit
branch, typed exit codes, `sed_inplace`, publishedness always re-proved from metadata.
Recorded phase-2 prerequisites: an org secret for the cross-repo dispatch AND a bot
identity for the workflow's pushes/`gh pr create` (cascade PRs must not impersonate a
person). Inherited risk: shared runner egress worsens Central throttling — revive the
on-hold throttling task's cache/proxy phases before unattended cloud waves.

## Verification

1. **Graph**: `cascade graph` output renders on GitHub, matches the known order
   (base-libraries → logging/testlib/base-types/change/time → tool-base/ProtoTap/
   compiler → validation → core-jvm-compiler → core-jvm → jdbc-storage/gcloud-jvm/
   delivery-server; BuildSpeed verify-only); `graph --check` flags drift after a
   hand-edited edge.
2. **Unit-level**: `plan --kind refresh` reads the graph and freezes edges; `plan
   --kind ripple --seed base-libraries@<ver>` scopes to the downstream closure only.
   `prep` twice on one repo (idempotent, three commits max). Pin-edit verification on
   the multi-constant files (`Base.kt`, `ToolBase.kt`, `CoreJvmCompiler.kt`,
   `Compiler.kt`). `status` after hand-reverting a commit (state honestly regresses).
3. **Dry wave**: a two-repo `--include base-libraries --include time` attended run:
   eager builds land in `~/.m2`; `ship` blocks with exit 4 until base-libraries'
   version appears in GCAR metadata; drift path exercised by a manual re-bump.
4. **Wave 1 (real)**: after the `config` `refresh-dependencies` PR merges — attended,
   full default set. Every park and exit-3 becomes a hardening note in the playbook.
   Then **wave 2**: the dedicated straggler catch-up (`--include reflect/money/
   testlib`, attended) — the M1 retarget's prerequisite.
5. **Before any `retarget` wave**: verify `CheckVersionIncrement` and
   `version-bumped.sh` accept the jump (Maven ordering of `2.0.0-M1` vs
   `2.0.0-SNAPSHOT.NNN` — a milestone qualifier may compare *lower* than the
   snapshot line, tripping the increment guard); if rejected, that wave needs a
   guard-bypass decision recorded in config first. Also confirm which registry
   (`releases` vs `snapshots`) receives non-snapshot versions — the probe checks both.
6. Throughout: no task reported done without the manifest's derived proof (registry
   metadata, PR state, sentinel).

## Risks (mitigation baked in)

pluginManagement gap → published-floor pins + `deferred` class · Central 429 →
sequential builds, halt-never-retry · straggler migrations → default-excluded,
adapt-parks when included · sentinel voided by trailing commits → fixed commit order,
`ship` re-verifies with exit-3 remedy · merged-but-unpublished upstream → `ship`'s
metadata gate · `build` chains publishToMavenLocal (compiler/core-jvm-compiler/time)
→ bump precedes any gradle run + self-gate · multi-constant pin files → role table +
anchored sed + verify-or-revert · sibling-PR reddening → one cascade PR per repo per
wave, sanctioned re-bump path · `ask: ./gradlew clean:*` could stall an agent-typed
clean build → cascade never types one (script runs builds; pre-pr uses incremental
scope for deps-only changes) · macOS sed → wrapper from day 1 · retarget version
ordering vs increment guards → pre-wave verification item (Verification §5) · stored
graph rots as repos evolve → `plan` re-verifies against fresh derivation every wave
and refuses to run on drift.

## Plan

- [ ] PR A (agents): `skills/cascade-adapt/SKILL.md` + `agents/openai.yaml`
- [ ] PR B (config): drop `ask: Bash(git commit:*)` from distributed
      `.claude/settings.json`; add read-only `gh` allows
- [ ] PR C (summit): `cascade` script, `docs/dependency-graph.md`,
      `docs/rollout/rebuild.md`, `docs/rollout/rebuild-pr-body.md`,
      `.claude/commands/cascade.md`, settings fix, `docs/project.md` link
- [ ] Verification ladder (graph → unit-level → two-repo dry wave → real wave 1)
- [ ] Phase 2 design notes recorded (dispatch + summit workflow) — build later

## Log

- 2026-08-29 — Canonical order corrected per owner's catch: ProtoTap depends
  on tool-base one-way (gradle-plugin module) yet preceded it. Added an
  `audit_order` pass to `cascade graph`: every floor edge must close a genuine
  cycle, else the order itself is flagged. The audit immediately found three
  more one-way violations (time→ProtoTap, time→tool-base, money→validation);
  order now: … change, tool-base, ProtoTap, time, compiler, validation, money,
  core-jvm-compiler, … Audit silent; 19 remaining floors all close real
  cycles.

- 2026-08-29 — Derivation review round 3 (owner proved ProtoTap→compiler was a
  copy-pasted force list, no `dependencies` declaration): version-management
  references (`force`/`constraints`/`exclude`) now create **no edge**; the
  classifier is block-aware (context stack — bare lines under
  `dependencies { listOf(...) }` are real declarations, per compiler/api;
  bare lines under `force(` are not). Convention-borne edges added
  (`module-testing` → testlib test-dep; `kmp-module` → testlib main).
  Net: 138 → 92 edges (47 force-only edges removed, `base-types → testlib`
  added); removals spot-verified (reflect→logging, jdbc-storage→testlib,
  time→reflect had zero declaration-context usages). Doc prose updated to
  state the declared-only contract.

- 2026-08-29 — Derivation review round 2 (owner's findings): plugin
  applications are edges too — bare convention accessors (`prototap`,
  `spineCompiler`, `coreJvmCompiler`) and `io.spine.*` plugin-id strings now
  map to their provider repos (ProtoTap, compiler, core-jvm-compiler,
  tool-base for artifact-meta/descriptor-set-file/generated-sources).
  Owner ruling encoded: **ProtoTap is test-only by design** (scope override in
  `apply_scope_rules`). Nested submodules of a scanned repo are excluded
  (validation/docs/_time is the vendored time repo). Result: 138 edges;
  validation/core-jvm-compiler/compiler --> ProtoTap restored (test section);
  new true edges BuildSpeed --> core-jvm-compiler, jdbc-storage -->
  core-jvm-compiler, base-libraries --> tool-base (mutual).

- 2026-08-29 — Graph derivation upgraded per review: an edge now requires an
  actual usage (imports alone proved nothing) and carries a scope class —
  `main` (declared deps/plugins), `test` (test-only), `other` (force blocks,
  excludes). The production diagram renders reduced main-scope edges only and
  now matches the real Maven structure; test-only deps and the mutual pairs
  sit in their own collapsed sections; mutual-pair arrows reversed per review
  (published artifact → consumer). Machine list unchanged in format (132
  edges, all scopes — force pins still order a wave).

- 2026-08-29 — Graph-doc review feedback applied: `dependency-graph.md` is now
  a standalone document (no wave vocabulary; the rollout playbook references
  it, and owns the wave semantics of forward vs reverse edges); arrows
  reversed to depends-on direction (`compiler --> tool-base`, rendered
  `flowchart BT` so foundations stay on top; machine block is
  `dependent dependency`, script swaps on read); the cryptic "floor pins"
  section replaced by a plain-language account of mutual dependencies
  resolved by generation lag.

- 2026-08-29 — Implementation findings (branch `cascade-machinery`):
  * JDK **17**, not 21 (owner's correction; `config/.java-version` = 17.0.14).
    Pre-existing `proofread-repo:43` still says 21 — flagged, not touched.
  * The raw dependency graph is **cyclic** (self-hosting SDK); introduced the
    canonical wave order + forward (wave-ordering) vs floor (dashed,
    last-published) edge split in `docs/dependency-graph.md`. 132 edges: 94
    forward, 38 floor. One manual edge: core-jvm-compiler → core-jvm.
    Per review feedback the rendered diagram is now the transitive reduction
    of the forward edges (19 solid edges — the ordering skeleton); the full
    132-edge set stays canonical in a machine-readable ```edges block (each
    edge is a direct pin the wave advances, so none can be dropped from the
    data — only from the rendering).
  * `delivery-server` publishes **only to GitHub Packages** (proprietary) —
    probes gained a per-repo registry field; reading GH Packages needs the
    `read:packages` token scope (playbook prerequisite; `plan` warns, ship
    hard-requires).
  * ProtoTap artifacts carry no `spine-` prefix and live in `releases`
    (marker: `prototap-gradle-plugin`).
  * Parallel builds: the ProjectBuilder/Central issue is retired by the
    stub-repository fixture in core-jvm-compiler (owner's correction — the
    Aug-21 "on hold" task note was stale). the initial driver stays sequential for
    simplicity only; first refinement = a `make --jobs`-style concurrency
    option for the `cascade` script running up to N graph-independent builds
    at once (prereqs: manifest write-lock, daemon-RAM budget). 429 halt kept
    as insurance.
  * bash 3.2 portability landed (no assoc arrays, no `case` inside `$()`).
  * `/cascade` command moved to PR A (shared commands symlink discovery).

- 2026-08-29 — Orchestrator discussion: loop confirmed policy-free (script's `next`
  is the single policy source; session and future workflow are thin executors);
  phase-2 prerequisites recorded (dispatch secret + bot identity); cloud throttling
  risk tied to the on-hold maven-central-throttling task. All four discussion areas
  now covered.

- 2026-08-29 — Wave kinds discussion: `retarget` declared bidirectional (release +
  reopen-development); straggler catch-up recognized as a hard `retarget`
  prerequisite; roadmap fixed (owner's decision): wave 1 refresh on healthy set →
  wave 2 attended straggler catch-up → M1 retarget. Milestone-vs-snapshot guard
  ordering stays a pre-retarget verification item.

- 2026-08-29 — Autonomy discussion: `Bash(git commit:*)` allow lands in **summit's
  project settings** (owner's decision) — cascade sessions commit dialog-free under
  the skills/scripts protocol; other repos keep the org-default prompt once PR B
  removes the distributed `ask` rule. Playbook loses the per-developer settings step.

- 2026-08-29 — State-machine discussion: `pinned` now derived by pin-file content vs
  the manifest vector; `built` bound to its recorded HEAD SHA (any commit demotes);
  adapt→rebuild budget set to **three rounds** then auto-park (owner's decision);
  BuildSpeed flagged: generated settings may defeat `apply_pins` — expect park in
  wave 1.

- 2026-08-29 — Design drafted from two exploration passes + Plan-agent synthesis.
  Wave kinds generalized (`refresh` / `ripple` / `retarget`) per review feedback;
  dependency graph promoted to maintained documentation (`docs/dependency-graph.md`).
  Script renamed `cascade-repo` → `cascade` (wave-level subcommands dominate).
  Status: draft — under discussion, implementation not started.
