---
slug: publish-api-docs-wave
branch: publish-api-docs-wave
owner: claude
status: draft
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

- **The `config` change** is being made by the session "Publish API docs
  separately from Maven" (worktree
  `config/.claude/worktrees/publish-api-docs-a78bfa`, branch
  `claude/publish-api-docs-a78bfa`). It builds on the `publishing-reliability`
  hardening of `publishing.yml`. Its plan is in that worktree's
  `.agents/tasks/publish-api-docs.md`. The user chose no deprecated aliases for
  the old names. According to that plan:
  - **Renames.** The package `io.spine.gradle.github.pages` stays. Classes become
    `PublishApiDocs` and `PublishApiDocsExtension`, the DSL becomes
    `fun Project.publishApiDocs { }` with the extension named `publishApiDocs`,
    and the task name becomes `TaskName.publishApiDocs = "publishApiDocs"`.
    `rootFolder` and `includeInputs` are unchanged, so the body of each block
    stays as it is.
  - **Root aggregate.** `spinePublishing { }` registers `publishAllApiDocs`, a
    name only the root project has. It depends on the `publishApiDocs` task of
    every published module that applies the plugin, and does nothing in a
    repository without one. In a single-project repository it runs the root's
    own `publishApiDocs`. Consumers still apply the plugin per module through
    the DSL, which is what Groups A–C below rename.
  - **Workflow.** `.github-workflows/publish-api-docs.yml` is self-contained,
    with no reusable body and no `CONFIG_COMMIT` pin: every `./config/pull`
    overwrites it, and a `config:replaces publish-api-docs.yml` directive holds
    it back. It runs on push to `master`, decrypts the repository's own
    `.github/keys/deploy_key_rsa.gpg` with that repository's
    `GIT_CREDENTIALS_KEY` secret, and calls `./gradlew :publishAllApiDocs`.
    `publishing.yml` loses the key decryption and the docs-only variables.

  The `config` session confirmed these names on 2026-10-21 and will report any
  change made during review.
- **Snapshot versions push no docs to `gh-pages`.** The change in config#815
  restored this at the user's request on 2026-10-22. On a `-SNAPSHOT.N`
  version, each module's `publishApiDocs` only logs that it skips the docs, so
  the docs run (`publishAllApiDocs`, and the workflow) ends green without
  generating or pushing anything. Maven publishing is unaffected: Dokka still
  builds the Javadoc and HTML archives of every version, snapshots included,
  and `publish` still uploads them to the Maven repositories. Every SDK
  repository is on a snapshot version, and the wave bumps within that line. So
  after the wave, `gh-pages` stops changing until each repository's next
  release version, whereas until now every merge pushed the snapshot's docs.
  Commits on `gh-pages` are now authored by `PublishApiDocs Plugin`.
- **Consumers are safe until they pull.** Each repository's `publish.yml` pins
  `publishing.yml@<config sha>` and compiles its own `buildSrc`, so merging the
  `config` PR breaks nothing by itself. The break comes with `./config/pull`:
  after it, every consumer-owned reference to `updateGitHubPages` fails to
  compile. The edit therefore lands in the same PR as the pull, as a separate
  commit after it.
- **Stale files.** `config/migrate` copies `buildSrc` over the consumer's with
  `cp -R` and never deletes anything, so plugin files that `config` renames would
  survive in the consumer. Right after the copy, `migrate` now deletes three
  retired files from `buildSrc/src/main/kotlin/io/spine/gradle/github/pages/`:
  `UpdateGitHubPages.kt`, `UpdateGitHubPagesExtension.kt`, and `Update.kt` (now
  `DocsPublication.kt`). Its closing `git add ./buildSrc/src` stages the
  deletions, so they land in the pull commit. `TaskName.kt` stays; only its
  constant is renamed. The stale copies could not compile anyway, because they
  refer to the removed names. The wave deletes nothing and only checks that
  nothing stale is left (step 2.1).

## Inventory (2026-10-21, updated 2026-10-22)

**Sources searched:** all 18 JVM repositories in `summit` (`git grep` on their
`cascade-refresh-604420c` branches, every tracked file except
`docs/dependencies/`), `BuildSpeed`, `documentation`, and the whole organization
via `gh search code`. The line numbers come from those branches, so re-grep
them before editing.

**Repository names.** `delivery` is the GitHub repository
`SpineEventEngine/delivery`, formerly `delivery-server`; the old name redirects.
`summit`'s `master` still names the submodule `delivery-server`, and summit#5
renames it to `delivery` (`1fdd7cf`). Where a checkout still says
`delivery-server`, it is the same repository and takes the same edit.

### Config-owned: the pull updates them, no hand edit

In all 18 repositories these files are byte-identical to `config@604420c`:

- `buildSrc/src/main/kotlin/io/spine/gradle/github/pages/*` is the plugin itself.
  No repository has an extra file there, and no other `buildSrc` file outside
  the list below references it.
- `buildSrc/src/main/kotlin/jvm-module.gradle.kts` contains
  `publish?.dependsOn("${project.path}:updateGitHubPages")` (:156) and
  `updateGitHubPages { }` (:165).
- `buildSrc/src/main/kotlin/DokkaExts.kt:279`: `docsShippingTaskNames`, the
  Dokka gate. `publishApiDocs` must replace `updateGitHubPages` there, or the
  docs task gets no Dokka output.
- `buildSrc/src/test/kotlin/io/spine/gradle/docs/DokkaSetupIgTest.kt`.

### Consumer-owned: the wave edits these

**Group A.** In these repositories, `setupPublishing()` or `setupDocPublishing()`
configures the docs and adds
`tasks.named("publish") { dependsOn("${project.path}:updateGitHubPages") }`.
The code is in `buildSrc/src/main/kotlin/module.gradle.kts`, except in
`gcloud-jvm`, which keeps it in its root `build.gradle.kts`.

| Repository          | Import | Function (call site)                      |
|---------------------|--------|-------------------------------------------|
| `core-jvm`          | :54    | `Module.setupPublishing()` :257 (:93)     |
| `jdbc-storage`      | :53    | `Module.setupPublishing()` :229 (:92)     |
| `delivery`          | :50    | `Module.setupPublishing()` :386 (:116)    |
| `gcloud-jvm`        | :47    | `Project.setupPublishing()` :612 (:191)   |
| `compiler`          | :36    | `Module.setupDocPublishing()` :152 (:75)  |
| `validation`        | :50    | `Module.setupDocPublishing()` :239 (:91)  |
| `core-jvm-compiler` | :55    | `Module.setupDocPublishing()` :300 (:103) |
| `ProtoTap`          | :56    | `Module.setupDocPublishing()` :298 (:103) |

Edit (`core-jvm` shown):

```diff
-import io.spine.gradle.github.pages.updateGitHubPages
+import io.spine.gradle.github.pages.publishApiDocs
 ...
-    setupPublishing()
+    setupDocPublishing()
 ...
 /**
- * Configures publishing for this subproject.
+ * Configures documentation publishing for this subproject.
  */
-fun Module.setupPublishing() {
-    updateGitHubPages {
+fun Module.setupDocPublishing() {
+    publishApiDocs {
         rootFolder.set(rootDir)
     }
-
-    tasks.named("publish") {
-        dependsOn("${project.path}:updateGitHubPages")
-    }
 }
```

Delete the `publish` dependency; do not rename it to `publishApiDocs`, which
would couple the two jobs again. Left in place, it fails `publish` when Gradle
builds the task graph ("Task with path ':x:updateGitHubPages' not found"). The
same applies to the Group B hook.

The rename from `setupPublishing` to `setupDocPublishing`, with its KDoc and
call site, applies only to the four repositories that use the first name. Once
the `publish` wiring is gone, the function configures documentation only, and
the other four already call it that.

**Group B.** In these repositories, `configureGitHubPages()` configures the docs,
and an `afterEvaluate` hook inside `setTaskDependencies()` wires `publish` to
the docs task. The code is in `buildSrc/src/main/kotlin/module.gradle.kts`.

| Repository       | Import | `afterEvaluate` hook | `configureGitHubPages()` |
|------------------|--------|----------------------|--------------------------|
| `base-libraries` | :28    | :172–175             | :182                     |
| `testlib`        | :28    | :144–147             | :154                     |
| `time`           | :45    | :182–185             | :192                     |

Edit:

```diff
-import io.spine.gradle.github.pages.updateGitHubPages
+import io.spine.gradle.github.pages.publishApiDocs
 ...
         clean.configure {
             dependsOn(cleanGenerated)
         }
-
-        project.afterEvaluate {
-            val publish = tasks.findByName("publish")
-            publish?.dependsOn("${project.path}:updateGitHubPages")
-        }
     }
 ...
 fun Module.configureGitHubPages() {
-    updateGitHubPages {
+    publishApiDocs {
         rootFolder.set(rootDir)
     }
 }
```

`time` writes the call as `updateGitHubPages() {`. In `testlib`,
`configureGitHubPages()` also declares an unused `val docletVersion`. Leave it:
it is not part of this change.

**Group C.** These repositories call the DSL but have never wired it to
`publish`. The code is in `buildSrc/src/main/kotlin/module.gradle.kts`.

| Repository  | Import | Call                                    |
|-------------|--------|-----------------------------------------|
| `tool-base` | :41    | inside `configureGitHubPages()` :159    |
| `change`    | :42    | top level, `updateGitHubPages() {` :114 |

Edit: rename the import and the call. Nothing else changes.

**Behaviour change.** Because `publish` never ran the docs task here, the
newest commit on the `gh-pages` branch of each of these two repositories is
`Add CNAME for gh-pages`, dated 2025-12-02 in `tool-base` and 2025-12-22 in
`change`; no documentation update has landed since. Once
`publish-api-docs.yml` runs `publishAllApiDocs` on `master`, they start
publishing API docs from their next release version: the root aggregate picks
up every published module that applies the plugin. The user approved this on
2026-10-21, so the edit stays rename-only.

**Group D.** `reflect`, `logging`, `dokka-tools`, `base-types`, and `money` need
only the pull. They get the docs wiring from the config-owned `jvm-module`
script and own no reference to it.

**Not affected.** `BuildSpeed` is verify-only and has no references.
`documentation` is not a JVM consumer.

### Outside `summit`: not in this wave

- **`Chords`** (pins `config@838f9a02`, last pushed 2026-10-21) and
  **`Chords-Gradle-plugin`** (`config@dcd2cee3`) carry the old
  `io.spine.internal.gradle.github.pages` copy. `Chords/.github/workflows/publish.yml:56`
  runs `publish -x updateGitHubPages`. Their next `./config/pull` is a migration
  in its own right, and this edit becomes part of it. The `-x` must go, because
  Gradle fails on an excluded task it cannot find.
  **Behaviour change.** After that pull, the new workflow publishes their docs
  from their next release version. Check then that each repository has
  `.github/keys/deploy_key_rsa.gpg` and the `GIT_CREDENTIALS_KEY` secret. If
  publishing is not wanted, drop their plugin call; decide when they pull.
- **`elastic`** (`config@c2aae6e7`, last pushed 2026-07-06) references the task
  only in `jvm-module.gradle.kts`, which `config` owns (checked file by file on
  `master`), so it needs nothing beyond its next pull.
- **`doc-tools`**, **`gradle-execfork-plugin`**, and **`users`** have been dormant
  since 2021–2023. **`web`**, **`dart`**, **`text`**, **`model-compiler`**, and
  **`model-tools`** are archived. Ignore all of them.

## Wave plan

**Mechanism:** a regular `refresh` cascade wave
([`docs/rollout/rebuild.md`](../../docs/rollout/rebuild.md)) against the `config`
commit that carries the change, plus one hand-edit commit per repository. A
refresh wave fits here for three reasons:

- The edit can land neither in an earlier PR than the pull (the new DSL does
  not exist yet) nor in a later one (the pull alone breaks the build).
- Every PR needs a version bump anyway.
- `cascade` already handles dependency order, pins, and the publish gates.

The edit adds no ordering constraint of its own, because every change is
confined to the repository's own build logic.

### Gates

- [ ] G1. The `config` PRs are merged. The first, config#814 ("Make the
      `Publish` workflow reliable"), merged on 2026-10-22 as `ad3dff0890`. The
      second, config#815 ("Publish API docs apart from Maven publishing"), is
      open against `master`. Record its merge sha; it names the wave.
- [x] G2. The `config` session confirmed the names and the `migrate` deletions
      on 2026-10-21, and added the third retired file, `Update.kt`, on
      2026-10-22. Re-check only if it reports a name change from review.
- [ ] G3. Wave `cascade-refresh-604420c` is closed (`cascade plan` refuses to
      run over open `cascade-*` PRs).
- [ ] G4. The user says go.

### Steps

- [ ] 1. Run `./cascade plan --kind refresh`, producing
      `cascade-refresh-<sha>`. Review the order: 18 libraries in canonical
      order, with `BuildSpeed` parked as usual.
- [ ] 2. For each repository, in wave order, run the cascade loop with one
      insertion: `PREP:<repo>` (pull commit, pins, bump) → **hand edit** →
      `BUILD:<repo>` → `PREPR:<repo>` → `SHIP:<repo>`. The hand edit has three parts:
    1. **Stale-file check.** After the pull, run
         `git grep -n -E 'updateGitHubPages|UpdateGitHubPages'`. Only the
         consumer-owned files listed for the repository's group should match. A
         hit in a config-owned path is a retired file that `migrate` missed.
         Remove it with `git rm` if it is byte-identical to a blob `config` once
         shipped at that path (check with `git -C config log --raw -- buildSrc`),
         and commit as "Remove stale `buildSrc` files".
    2. **Group edit.** Apply the edit for the repository's group (A, B, or C),
         and commit it as "Publish API docs separately from `publish`". Group D
         repositories skip this part.
    3. **Proof.** Use dry runs only: on a release version, a real
         `publishApiDocs` run pushes to `gh-pages`. Run the checks between wave
         builds, never alongside one.
         - `git grep -n -E 'updateGitHubPages|UpdateGitHubPages'` finds nothing.
         - `./gradlew publish -m` lists none of `publishApiDocs`,
           `updateGitHubPages`, `copyJavadocDocs`, or `copyHtmlDocs`.
         - `./gradlew :publishAllApiDocs -m`, the task the workflow runs, plans
           the `publishApiDocs` task of each published module that is
           documented. In `tool-base` and `change` this list is new. On a
           snapshot version it lists no `copyJavadocDocs` or `copyHtmlDocs`,
           because snapshots push no docs to `gh-pages`.
- [ ] 3. Commit and PR rules: `cascade` makes its own `PREP` and `BUILD` commits.
      The hand-edit commits and `SHIP` (push plus draft PR) happen only at the
      user's explicit request (`AGENTS.md`). Post each PR link as it is opened.
- [ ] 4. After each merge, watch two runs: the repository's first `Publish` run,
      which must no longer touch the docs, and its first `publish-api-docs.yml`
      run, which must end green. On a snapshot version, `PublishApiDocs`
      registers a do-nothing task in place of the real one. That docs run
      decrypts the deploy key in a workflow step, then logs for each documented
      module that the docs are not published. It registers no SSH key, clones
      nothing, and pushes nothing, so it proves only the decryption and the
      task graph. A failed docs run does not block downstream repositories,
      because the registry is unaffected, so fix it afterwards instead of
      treating it as a failed publish.
- [ ] 4a. After the wave, on the first release version of any repository: watch
      its `publish-api-docs.yml` run. It is the first real use of the sparse
      `gh-pages` clone and push from config#815. Its commits read "Publish the
      `<format>` documentation of the module …". Report a failure at the clone
      or push step to the `config` session, or on config#815 if it has merged.
- [ ] 5. Run `CLOSE` as usual. Then delete this file together with the wave's
      state pair. If step 4a is still open at that point, move it into the
      task file of the next release first.

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
