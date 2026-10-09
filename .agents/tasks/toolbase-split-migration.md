---
slug: toolbase-split-migration
branch: toolbase-split-migration
owner: unassigned
status: approved
started: 2026-08-19
---

## Goal

Migrate every Spine SDK repository that depends on `tool-base` onto the modules
that replaced it, so the SDK builds against `io.spine.tools:*:2.0.0-SNAPSHOT.420`
and later.

## Context

[tool-base#189](https://github.com/SpineEventEngine/tool-base/pull/189) (merged
2026-08-19, `43ea6afa`) split the monolithic `tool-base` module into focused
modules and **retired the `io.spine.tools:tool-base` artifact**. The repository
keeps its name; only the module of that name is gone.

Package names of moved code were preserved wherever possible, so most repositories
need a dependency change and no source edits. The exceptions are listed under
*Tier 1* below.

| New module | Packages |
|---|---|
| `fs` | `io.spine.tools.fs` |
| `code` | `io.spine.tools.code` |
| `archive` | `io.spine.tools.archive` |
| `kotlin-code` | `io.spine.tools.kotlin` |
| `java-code` | `io.spine.tools.java`, `.java.code`, `.java.fs`, `.java.javadoc` |
| `proto-code` | `io.spine.tools.proto.code`, `.proto.fs`, `.proto.type` |
| `classic-codegen` | `io.spine.tools.java.code.poet`, `.roaster` (JavaPoet/Roaster wrappers only) |

`js-code` and `dart-code` were extracted during that PR and then **removed** —
JavaScript and Dart are not supported languages in v2.x.

### Prerequisites

1. **`2.0.0-SNAPSHOT.420` must be published.** As of 2026-08-19 15:07 UTC it was
   not: the `fs` POM returned HTTP 404 from the Artifact Registry. Nothing below
   can be verified until it is.
2. **[config#748](https://github.com/SpineEventEngine/config/pull/748)** declares
   the new constants and deprecates `ToolBase.lib`. It pins `.420`, so it must
   merge *after* the publication and *before* the repositories below are updated —
   they take the constants from it.

`ToolBase.lib` is **deprecated rather than deleted** precisely so these
repositories can migrate one at a time instead of all at once.

## Plan

### Tier 1 — source edits required

These import symbols that moved. Each needs the dependency change *and* the edits.

- [ ] **`core-jvm-compiler`** (active, 2026-08-18) — 12 edits:
      - `io.spine.tools.java.code.{classSpec, constructorSpec, methodSpec, codeBlock}`
        → `io.spine.tools.java.code.poet.*`:
        `signal/…/rejection/Javadoc.kt:33`,
        `RThrowableBuilderCode.kt:63-66`, `RThrowableCode.kt:40-42`
      - `…java.code.fullTextNormalized` → `…java.code.roaster.*`:
        `signal/…/rejection/RejectionJavadocIgTest.kt:44`
      - `io.spine.tools.{div, resolve}` → `io.spine.tools.fs.{div, resolve}`:
        `annotation/…/ApiAnnotationsPluginIgTest.kt:45`,
        `signal/…/JavadocTestEnv.kt:33`, `signal/…/RejectionCodegenIgTest.kt:38`

- [ ] **`compiler`** (active, 2026-08-13) — one import:
      `protoc-plugin/…/protoc/Plugin.kt:33`,
      `io.spine.tools.code.proto.CodeGeneratorRequestWriter`
      → `io.spine.tools.proto.code.CodeGeneratorRequestWriter`

- [ ] **`ProtoTap`** (active, 2026-06-17) — the same single import at
      `protoc-plugin/…/protoc/Plugin.kt:33`

Dormant, one stale `io.spine.tools.type` reference each — likely not worth
migrating: `core-java-1x` (2023-06-29), `model-tools` (2022-10-04).

### Tier 2 — replace `ToolBase.lib`

14 repositories reference `ToolBase.lib` **only inside version-forcing blocks**
(`doForceVersions` lists, `resolutionStrategy … .using(module(...))`) and import
nothing from the artifact. The fix is to drop the entry, or replace it with the
specific modules if the forced version still matters:

- [ ] `base-types` · `bootstrap` · `change` · `core-jvm` · `delivery-server`
- [ ] `dokka-tools` · `gcloud-jvm` · `jdbc-storage` · `logging` · `model-compiler`
- [ ] `reflect` · `time` · `validation` · `web`

Where a repository does import moved packages, the replacement constants are:

| Repo | Constants |
|---|---|
| `core-jvm-compiler` | `fs` `code` `kotlinCode` `javaCode` `classicCodegen` `protoCode` |
| `compiler`, `mc-java` | `fs` `code` `kotlinCode` `javaCode` `protoCode` |
| `ProtoData` | `fs` `code` `kotlinCode` `javaCode` |
| `validation`, `model-tools` | `code` |
| `ProtoTap`, `base-libraries`, `core-java-1x` | `protoCode` |
| `javadoc-tools` | `javaCode` |

### Tier 3 — no action

`elastic`, `testlib`, `config` reference only `JavadocFilter` and
`protobufSetupPlugins`, neither of which changed.

## Other breaking changes to watch for

Not currently used by any repository, but they will bite anyone who adopts them:

- **`Generated.dir(String)` / `SourceRoot.subDir(String, String)`** replaced the
  `SourceSetName` parameter. Extracting `io.spine.tools.fs` was otherwise
  impossible — a three-package cycle ran across the cut. The blank-name check
  `SourceSetName` performed is preserved inside `SourceRoot.subDir`.
- **`io.spine.tools.OsFamily` is gone.** Base Libraries publishes the same enum as
  `io.spine.environment.OsFamily` in its `spine-environment` artifact.
- **`Method(MethodSpec)` is gone**, replaced by `MethodSpec.toMethod()` in
  `io.spine.tools.java.code.poet`.
- **`io.spine.tools.{div, resolve, toAbsoluteFile, isProtoSource}`** moved to
  `io.spine.tools.fs`. Java callers import the **JVM facade**, which is now
  `io.spine.tools.fs.Paths` rather than `io.spine.tools.StandardTypes` — a
  spelling that shares no text with the Kotlin package, so it hides from the
  obvious grep.
- **`io.spine.tools.type` → `io.spine.tools.proto.type`** required a matching
  change to the runtime guard in `KnownTypes.Holder.extendWith`, delivered by
  [base-libraries#959](https://github.com/SpineEventEngine/base-libraries/pull/959)
  and available from Base `2.0.0-SNAPSHOT.441`. Any repository calling
  `MoreKnownTypes` needs that Base version or later, or it throws
  `SecurityException` **at runtime** — nothing fails to compile.

## Verification

Per repository: `./gradlew clean build`, plus `dokkaGenerate` where the repo
applies Dokka. Two traps met repeatedly during the split, worth repeating here:

- With `org.gradle.caching=true`, a renamed generated package can be restored from
  the build cache, so artifact checks need `--no-build-cache`.
- `clean build` in one invocation is unreliable under `org.gradle.parallel=true`;
  run `clean` as its own invocation.

## Log

- 2026-08-19 — drafted from the post-merge survey of tool-base#189. Counts and
  file/line references were taken from the working tree on that date; re-run the
  searches before starting, since several of these repositories are active.
