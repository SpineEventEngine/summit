# Repo-by-repo proofread rollout

A parameterised procedure for running the `proofread` skill across the Spine SDK
repositories from `summit`, one repo at a time, ending in a pull request.

The deterministic mechanics live in the repo-owned [`proofread-repo`](../../proofread-repo)
script; the two judgement steps — the proofread sweep and the pre-PR review — are
agent-driven and described below. Run the four steps in order for a given `<repo>`
(e.g. `base-libraries`).

> **Why a script *and* a playbook?** The interventions the first run needed
> (`JAVA_HOME`, `./config/pull` ordering, flaky dependency reports) were
> deterministic mechanics, not judgement — so they live in the script, where they
> can't be re-interpreted. Only the proofread and the review genuinely need an
> agent.

## 0. Prerequisites (once per machine)

- `JAVA_HOME`: `proofread-repo` exports it for its own builds, but the **agent-run**
  builds (step 1's edge-case bump and step 3's `pre-pr`) run in separate shells that do
  **not** inherit it — so a durable `export JAVA_HOME="$(/usr/libexec/java_home -v 21)"`
  in your shell profile is the real fix. Without it the Gradle Doctor plugin
  hard-fails every build.
- `gh auth status` shows a token with `repo` + `workflow` scope.

## 1. Prep (mechanical) — `./proofread-repo prep <repo>`

Cuts `proofread-sweep` off the latest `master`, floats the repo's `.agents/shared`
to current via `./config/pull` (committed on its own, so the repo has the current
`english-style` catalog and `proofread` skill), bumps the snapshot version, then
regenerates `docs/dependencies/` with a clean build and commits it verbatim — so the
reports reflect any dependency-pin updates `config/pull` brought in as well as the
bump. No agent judgement.

The bump handles the common snapshot case (`+1`). For a **release-line version** or a
`version.gradle.kts` still using `by extra(...)` (which needs migration), `prep` stops
and asks you to run the `bump-version` skill first, then re-run `./proofread-repo prep
<repo>`. Every step is idempotent, so the re-run picks up where it left off.

## 2. Proofread sweep (agent)

**Scope.** `git ls-files` of project-owned prose — `*.kt`, `*.kts`, `*.java`,
`*.proto`, `*.md`. **Exclude** (not project-owned, or not prose): `build/`,
`.gradle/`, `buildSrc/`, `.idea/`, `.claude/`, `.junie/`, `.github/`, `.agents/`,
`AGENTS.md`, `CLAUDE.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and the
**generated** `docs/dependencies/` reports.

**Fan out.** Split the file list into ~40-file chunks and run one proofreader per
chunk. Each reads `.agents/guidelines/english-style.md` (present after step 1) and
edits **prose only** — comments in source, body in Markdown — never identifiers,
string literals, doc-link targets (`[Type]`), or machine-read directives. Bias:
*a missed error is cheaper than a wrong fix*; skip ambiguous cases. See
[`proofread-fanout.workflow.js`](proofread-fanout.workflow.js) for this step as a saved
Workflow — the fan-out as one deterministic, opt-in call that reports any failed chunks
(`failedFiles`) instead of dropping them. Validated on `base-types`; invoked on demand,
never auto-run from `proofread-repo`.

**Audit before committing — do NOT rely on `git diff --ignore-all-space`.** A
`PostToolUse` formatter hook (`sanitize-source-code.sh`) strips trailing whitespace
file-wide after each edit. That is house style everywhere *except* inside
whitespace-sensitive **test string literals**, where it silently corrupts fixtures
(this broke a `StringsSpec` trim test on the first run, caught only by the build +
reviewers). So: inspect `git diff` **with** whitespace, and restore any stripped
trailing whitespace inside string literals with `sed` via Bash — the hook fires on
`Edit`/`Write`/`MultiEdit` only, so a Bash edit is not re-stripped. Then commit.

## 3. Pre-PR (agent) — run the `pre-pr` skill

Version gate (already satisfied), `./gradlew clean build dokkaGenerate`, and the
reviewers (`review-docs`, `spine-code-review`, `kotlin-engineer`). Apply their
Must-fixes; apply the clear Should-fixes that are genuine proofread misses. On PASS
it writes the `.git/pre-pr.ok` sentinel that gates PR creation.

## 4. Ship (mechanical) — `./proofread-repo ship <repo>`

Verifies the sentinel matches HEAD, discards any post-build report noise, pushes
`proofread-sweep`, and opens the PR from [`proofread-pr-body.md`](proofread-pr-body.md).

## Cost & caveats

- A full run is **expensive** — a dozen proofreader subagents, **two clean builds**
  (`prep` regenerates the reports and verifies the bump; `pre-pr` re-verifies after
  the sweep), and three reviewers per repo. Budget accordingly. Because the sweep
  touches `.proto`, `pre-pr` runs a *clean* build per policy; an incremental build
  would suffice for doc-only proto edits and is a worthwhile refinement.
- If `./config/pull` updates dependency pins, that simply flows through: the
  regenerated reports reflect reality and the proofread lands on top of them.
- `proofread-repo` uses macOS `sed -i ''`; adjust for Linux runners.
