# Project: summit

## Overview

`summit` is a Git superproject (a meta-repository) that assembles the Spine SDK
repositories as submodules in a single working tree. It exists to automate
cross-repository work across the SDK: coordinated agent sessions and the shared
`config`/CI machinery act over many repositories at once. `summit` ships no code and
has no build of its own — its content is the pinned commits of the submodules it
aggregates, plus the shared agent tooling under `.agents/`.

## Architecture

Role in the organisation: a **coordination superproject** — not a library, tool,
Gradle plugin, or application.

- **Submodules.** The SDK repositories listed in `.gitmodules` are pinned to fixed
  commits, giving a reproducible snapshot of the whole SDK. The shared
  `.agents/shared` submodule is the exception: it declares a tracked `branch` and
  floats to the tip of `master`, so shared skills, scripts, and guidelines stay
  current with no file churn in consumer pull requests.
- **Bootstrapping.** A fresh `git worktree` or shallow checkout starts with the
  submodules uninitialised, so the `.agents` symlinks dangle. Run `./init-submodules`
  to materialise the config-managed submodules at their pinned commits, then
  `./config/pull` to float the shared submodules and copy the shared files in. Claude
  Code runs `./init-submodules` automatically via a `SessionStart` hook.
- **Not a JVM build.** `summit` has no Gradle build, coding style, or tests of its
  own, so the shared JVM requirements in `.agents/guidelines/jvm-project.md` do not
  govern this repository. The aggregated repositories are JVM (Kotlin/Java) projects
  and are each subject to that guideline in their own right.

<!-- summit has no build of its own; the jvm-project.md link the template offers is
     intentionally left commented out. -->
