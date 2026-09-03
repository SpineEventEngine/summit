---
name: own-deprecations-your-change-introduces
description: Fix deprecation warnings a change introduces, even in untouched lines
metadata:
  type: feedback
---

You own every deprecation warning your change introduces — whether or not
your diff touches the line that warns. A change introduces one in two ways:

- **You edited the line.** A deprecation already sitting on a line you
  rewrite is in scope, even though it predates your change.
- **You moved the baseline under it.** A dependency bump — a cascade wave
  propagating a new version, a Gradle upgrade — can deprecate API that
  untouched code uses. Nothing in the diff points at those lines, which is
  exactly why nobody looks at them.

**How far to go** — the same split [[cascade-adapt]] applies to build
breakage:

- **Mechanical** — the warning names a successor, or one is documented, and
  it preserves behaviour: fix it in the same PR. A bump is not finished
  while it emits warnings a successor would silence.
- **Semantic** — the replacement changes behaviour, or the surface is large
  enough to need design judgement: park the repo, write the diagnosis into
  the task file, and stop. Never guess at a replacement's semantics to keep
  a wave moving.

**Why:** in `config#754` a fixture line was rewritten while
`val name by configurations.creating { }` was left in place. That syntax is
deprecated *and scheduled for removal in Gradle 10*, so the file would have
stopped compiling on that upgrade, and a reviewer had to catch it. The bump
case is worse: no line in the diff points at the problem, so a warning can
ride along through every repo a wave touches and surface only at removal,
far from the change that caused it.

**How to apply:**

- Verify with `./gradlew <task> --warning-mode all`. Do **not** use `-q`:
  it suppresses the nagging summary, which is exactly how the case above was
  missed.
- A failed build aborts before the deprecation summary prints — re-check
  after the build is green, not only on the failing run.
- **After a dependency bump, read that summary even when nothing in the diff
  looks related.** That is the case this rule exists for.
- Ask about the whole construct, not one half of it. Asking a reviewer
  whether `isCanBeResolved` was deprecated returned a correct "no" while the
  `by ... creating` delegate wrapping it was the deprecated part.
- Confirm the replacement is itself clean and preserves behaviour before
  committing; Gradle's suggested replacement is usually right, but
  role-based factories can reject usages the legacy form allowed.

**Known third-party sources — do not chase these again:**

Two Gradle-10 deprecations fire in every Spine build and originate in
third-party plugins, so no Spine repo can fix them in its own code. Replacing
them is a dedicated dependency-update task, never adapt work:

- `Project.getProperties` — Gradle Doctor (`com.osacky.doctor` 0.12.1), from
  `DoctorPlugin.apply`.
- `ReportingExtension.file(String)` — the detekt Gradle plugin. The frame
  reads `detekt-code-analysis.gradle.kts:67`, which looks like a `config` bug
  but is the `plugins { id("io.gitlab.arturbosch.detekt") }` line; the call is
  inside the plugin, which uses it to derive its default reports directory.

Attribute a warning with `--warning-mode all --stacktrace` and look for an
`io.spine.*` or `*_gradle` frame before assuming the deprecation is ours. A
frame naming a `.gradle.kts` file may still be a third-party plugin being
applied on that line.
