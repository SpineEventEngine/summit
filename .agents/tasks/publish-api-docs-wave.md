---
slug: publish-api-docs-wave
branch: publish-api-docs-wave
owner: claude
status: in-progress
started: 2026-10-21
---

## Goal

Every SDK repository in `summit` pulls the `config` that splits API-docs
publishing from Maven publishing, and none of its own Gradle files names
`updateGitHubPages` any more. `publish` no longer depends on the docs task, and
the docs reach GitHub Pages through the root `publishAllApiDocs` task, run by the
new `publish-api-docs.yml` workflow on every push to `master`.

This is a one-time job, and this file is the whole procedure. Do not turn it
into a skill.

## Context

- **The `config` change.** SpineEventEngine/config#815 (merged 2026-10-22 as
  `58cd2d4a31`) splits API-docs publishing from Maven publishing; its plan is
  `config/.agents/tasks/publish-api-docs.md`. The package
  `io.spine.gradle.github.pages` stays, and there are no deprecated aliases.
  - **Renames.** `UpdateGitHubPages` becomes `PublishApiDocs`,
    `UpdateGitHubPagesExtension` becomes `PublishApiDocsExtension`, the DSL and
    extension `updateGitHubPages` become `publishApiDocs`, and
    `TaskName.updateGitHubPages` becomes `TaskName.publishApiDocs`. Block bodies
    stay as they are: `rootFolder` and `includeInputs` are unchanged.
  - **Root aggregate.** `spinePublishing { }` registers `publishAllApiDocs`. It
    depends on the `publishApiDocs` task of every published module that applies
    the plugin, and does nothing where there is none.
  - **Workflow.** The distributed `publish-api-docs.yml` runs
    `./gradlew :publishAllApiDocs` on every push to `master`, after decrypting
    the repository's own `deploy_key_rsa.gpg` with its `GIT_CREDENTIALS_KEY`
    secret. `publishing.yml` no longer touches the docs.
- **The pull rewrites consumer scripts.** `migrate` deletes the three retired
  plugin files (`UpdateGitHubPages.kt`, `UpdateGitHubPagesExtension.kt`, and
  `Update.kt`). Since SpineEventEngine/config#817 (merged 2026-10-22), it also
  runs `scripts/migrate-publish-api-docs.sh`. That script renames the import and
  the call, deletes the `publish` dependency in both known forms
  (`tasks.named("publish") { … }` and an `afterEvaluate` hook), renames
  `configureGitHubPages()` to `configureApiDocs()`, and reports any use it
  cannot rewrite. `cascade prep` commits the rewrite with the pull.
- **Consumers are safe until they pull.** Each `publish.yml` pins
  `publishing.yml@<config sha>` and compiles the repository's own `buildSrc`, so
  the `config` merge breaks nothing by itself; the pull brings the new API and
  the rewrite together.
- **Snapshot versions push no docs to `gh-pages`.** On a `-SNAPSHOT.N` version,
  each module's `publishApiDocs` only logs a skip, so the docs run ends green
  without generating or pushing anything. Dokka and `publish` still build and
  upload the Javadoc and HTML archives. The wave keeps every repository on
  snapshots, so `gh-pages` stops changing until each one's next release; until
  now, every merge pushed its snapshot's docs.

## Status (2026-11-05)

**Done: all 18 repositories.** The last seven took the change in the scoped wave
`cascade-refresh-1dbad1f-publish-api-docs`; see the Log. Only step 4a, the first
release version's docs run, is still open.

**Before the wave: 11 repositories.** `tool-base`, `ProtoTap`, `compiler`,
`validation`, `core-jvm-compiler`, `time`, `money`, `core-jvm`, `jdbc-storage`,
`gcloud-jvm`, and `delivery` already pull a `config` with the split. Most got it
in the `cascade-refresh-604420c` wave, whose `./config/pull` took the latest
`config` `master` after 2026-10-22; the others in their own PRs. Each has
`PublishApiDocs.kt` and `publish-api-docs.yml`, no reference to the old names,
and no `publish` dependency on the docs. Every `publish-api-docs.yml` run so far
is green; all of them ran on snapshot versions, so they skipped the docs.

**The wave: 7 repositories,** on a `config` from before config#815 as of
2026-11-04.

| Repository       | `config` pin | What the pull changes in the repository's own files     |
|------------------|--------------|---------------------------------------------------------|
| `base-libraries` | `604420cd`   | `module.gradle.kts`: import, call, `afterEvaluate` hook |
| `testlib`        | `604420cd`   | `module.gradle.kts`: import, call, `afterEvaluate` hook |
| `change`         | `ad3dff08`   | `module.gradle.kts`: import and top-level call          |
| `reflect`        | `604420cd`   | nothing; only config-owned files name the old API       |
| `logging`        | `a53eca4b`   | nothing                                                 |
| `dokka-tools`    | `604420cd`   | nothing                                                 |
| `base-types`     | `ad3dff08`   | nothing                                                 |

In `base-libraries` and `testlib` the script also renames
`configureGitHubPages()` to `configureApiDocs()`. A dry run of
`config/scripts/migrate-publish-api-docs.sh` on copies of these files from
`master` (2026-11-04) rewrote `base-libraries`, `testlib`, and `change`
completely and reported nothing, so no hand edit is expected.

**Behaviour change.** `change` has never wired the docs to `publish`, so its
`gh-pages` has had no documentation since 2025-12-22. After the pull, it
publishes API docs from its next release version, as approved on 2026-10-21.
`tool-base`, the other such repository, is already done.

### Outside `summit`: not in this wave

- **`Chords`** (pins `config@838f9a02`) and **`Chords-Gradle-plugin`**
  (`config@dcd2cee3`) carry the old `io.spine.internal.gradle.github.pages`
  copy, and `Chords`' `publish.yml` runs `publish -x updateGitHubPages`. Their
  next `./config/pull` is a migration in its own right. It overwrites that
  `publish.yml`, and the rewrite script reports any other workflow that names
  the old task. **Behaviour change.** The new workflow then publishes their
  docs from their next release version. Check that each repository has
  `.github/keys/deploy_key_rsa.gpg` and the `GIT_CREDENTIALS_KEY` secret, or
  drop their plugin call if publishing is not wanted.
- **`elastic`** (`config@c2aae6e7`) names the old API only in config-owned
  files, so its next pull is enough.
- **`doc-tools`**, **`gradle-execfork-plugin`**, and **`users`** have been dormant
  since 2021–2023. **`web`**, **`dart`**, **`text`**, **`model-compiler`**, and
  **`model-tools`** are archived. Ignore all of them.

## Wave plan

No dedicated wave is needed any more: the remaining seven pick the change up
with their next `./config/pull`, which rewrites their scripts. The default is
to let the next routine `refresh` wave
([`docs/rollout/rebuild.md`](../../docs/rollout/rebuild.md)) carry it. If it is
wanted sooner, plan a `refresh` wave scoped to the seven: one `--exclude` for
each other repository, and `--slug-suffix publish-api-docs`.

The user chose the scoped wave on 2026-11-04; it ran as
`cascade-refresh-1dbad1f-publish-api-docs`.

### Gates

- [x] G1. The `config` change is merged: config#815 as `58cd2d4a31`, and the
      script rewrite, config#817, as `c5d6e5b2a5`, both on 2026-10-22.
- [x] G2. The names are final.
- [x] G3. Wave `cascade-refresh-604420c` is closed and archived.
- [x] G4. The user says go, and chooses the next routine wave or a scoped one:
      a scoped wave, on 2026-11-04.

### Steps

- [x] 1. Run `./cascade plan --kind refresh`, scoped or not, and review the
      order.
- [x] 2. In each of the seven, after `PREP:<repo>`:
    1. **Pull output.** The rewrite prints "Rewrote `<file>` for
         `publishApiDocs`" for each file it changes, and reports any use of the
         old API it cannot rewrite. Fix a reported use by hand, in a commit of
         its own.
    2. **Proof.** Use dry runs only: on a release version, a real
         `publishApiDocs` run pushes to `gh-pages`. Run the checks between wave
         builds, never alongside one.
         - `git grep -n -E 'updateGitHubPages|UpdateGitHubPages'` finds nothing.
         - `./gradlew publish -m` lists none of `publishApiDocs`,
           `copyJavadocDocs`, or `copyHtmlDocs`.
         - `./gradlew :publishAllApiDocs -m`, the task the workflow runs, plans
           the `publishApiDocs` task of each published module that is
           documented. On a snapshot version it lists no `copyJavadocDocs` or
           `copyHtmlDocs`, because snapshots push no docs to `gh-pages`.
- [x] 3. Commit and PR rules: `cascade` makes its own `PREP` and `BUILD` commits.
      A hand fix and `SHIP` (push plus draft PR) happen only at the user's
      explicit request (`AGENTS.md`). Post each PR link as it is opened.
- [x] 4. After each merge, watch two runs: the repository's first `Publish` run,
      which must no longer touch the docs, and its first `publish-api-docs.yml`
      run, which must end green. On a snapshot version, that docs run decrypts
      the deploy key and then logs, for each documented module, that the docs
      are not published; it clones and pushes nothing. A failed docs run does
      not block downstream repositories, because the registry is unaffected, so
      fix it afterwards instead of treating it as a failed publish.
- [ ] 4a. On the first release version of any SDK repository, watch its
      `publish-api-docs.yml` run. It is the first real use of the sparse
      `gh-pages` clone and push from config#815; its commits read "Publish the
      `<format>` documentation of the module …". Report a failure at the clone
      or push step on SpineEventEngine/config, citing config#815.
- [ ] 5. Run `CLOSE` as usual. Then delete this file together with the wave's
      state pair. If step 4a is still open at that point, move it into the
      task file of the next release first.
      `CLOSE` ran (config#836, merged 2026-11-05). No release task file exists
      yet, so this file stays, holding step 4a, until one does.

## Log

- 2026-10-21. Drafted from the inventory above. Waiting on the `config` merge,
  the `config` session's answers, and the user's go.
- 2026-10-21. The user decided that `tool-base` and `change` start publishing
  API docs: Group C keeps the rename-only edit.
- 2026-10-21. The `config` plan (`publish-api-docs.md`) answered the open
  questions: `migrate` deletes the stale files, the DSL is
  `Project.publishApiDocs { }`, and the workflow is a self-contained distributed
  file that runs `:publishApiDocs`. Updated the context, step 2.1, and
  the proof.
- 2026-10-21. The `config` session confirmed the names, the retired paths, and
  the workflow's secret (`GIT_CREDENTIALS_KEY`); G2 is done. Its hand-over lists
  `change` with a `publish` dependency, and `web`, `dart`, `elastic`, `text`,
  `model-compiler`, and `model-tools` as affected, based on local clones.
  Checked against GitHub: `change` has only the DSL call (Group C), `elastic`
  references only the config-owned `jvm-module`, and the other five
  are archived.
- 2026-10-21. Moved to branch `publish-api-docs-wave`, cut from
  `origin/master` in a separate worktree, to keep the plan off the in-flight
  wave's branch. The wave itself (Phase 2) still runs from the main `summit`
  checkout, which has the repositories on disk.
- 2026-10-22. config#814 merged; config#815 now targets `master` and skips the
  API docs of snapshot versions. Names and consumer edits are unchanged. Updated
  the context, Group C, the Chords note, G1, the proof, and step 4: a green first
  docs run on a snapshot proves the wiring only.
- 2026-10-22. config#815 renamed the root aggregate to `publishAllApiDocs`,
  and the workflow now runs `./gradlew :publishAllApiDocs`. The module DSL and
  task stay `publishApiDocs`, so the consumer edits are unchanged; only the
  proof command changed.
- 2026-10-22. config#815 (`10643809`) retires a third file, `Update.kt` (now
  `DocsPublication.kt`), which `migrate` also deletes, and clones `gh-pages`
  sparsely. Snapshots get a do-nothing task, so the wave never runs the clone or
  push; added step 4a for the first release version, and told
  the `config` session.
- 2026-10-22. Applied the pre-PR documentation review: fixed the nested lists
  in step 2, the stale task name in Group C, and the reference to
  `FIX-PUBLISH`, which `master` does not define yet; dropped the repeated
  `File` column from the tables.
- 2026-10-22. A review asked to rename `delivery` to `delivery-server`, the name
  on `summit`'s `master`. Kept `delivery`, the current GitHub name, which
  summit#5 adopts, and added a note that maps the two names.
- 2026-11-04. Revised for config#817, which makes `./config/pull` rewrite the
  consumer scripts. Eleven repositories already took the change in the
  `cascade-refresh-604420c` wave or their own PRs; seven remain, and a dry run
  of the rewrite shows no hand edit for them. Replaced the inventory with that
  status, and the hand-edit steps with checks of the pull's output. Tightened
  the context; G1–G3 are done.
- 2026-11-04. The user chose a scoped wave,
  `cascade-refresh-1dbad1f-publish-api-docs`, run from the main `summit`
  checkout; G4 is done.
- 2026-11-05. The wave is closed. Its PRs: base-libraries#969 (`.463`),
  reflect#17 (`.204`), logging#154 (`.429`), dokka-tools#14 (`.13`),
  change#11 (`.210`), testlib#17 (`.217`), and base-types#58 (`.228`), all
  `2.0.0-SNAPSHOT`; `CLOSE` landed as config#836. The rewrite reported nothing
  and no old name remains. Two hand fixes, both outside the docs:
  `base-libraries` and `testlib` force `Reflect.lib` on the buildscript
  classpath, because `protobuf-setup-plugins` pulls an older `spine-reflect`;
  `base-libraries`' `base` module makes `kspKotlin` and `kspTestKotlin` depend
  on `generateProto` and `generateTestProto`. Every first `Publish` run is
  green and no longer touches the docs. Every first docs run is green except
  `base-libraries`', which failed before Gradle, at the runner's "Add swap
  space" step (`pierotofy/set-swap-space` on the zram image
  `ubuntu24/20261101.114`). Its re-run on 2026-11-05 (run 41925743501,
  attempt 2) is green.
