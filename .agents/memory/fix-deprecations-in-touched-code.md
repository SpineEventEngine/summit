---
name: fix-deprecations-in-touched-code
description: Fix deprecated API usage in code being touched, without being asked
metadata:
  type: feedback
---

When editing a file, fix deprecated API usage on the lines being touched —
do not leave it for a follow-up or wait to be asked. This applies whether or
not the deprecation predates the change.

**Why:** in `config#754` a fixture line was rewritten while
`val name by configurations.creating { }` was left in place. That syntax is
deprecated *and scheduled for removal in Gradle 10*, so the file would have
stopped compiling on that upgrade. The reviewer had to catch it. Shipping a
line one has just edited, still carrying a removal-scheduled API, wastes a
review cycle on something the author should have seen.

**How to apply:**

- Treat a deprecation on a touched line as in scope, and say in the commit
  message that the form predated the change.
- Verify with `./gradlew <task> --warning-mode all`. Do **not** use `-q` when
  checking for deprecations: it suppresses the nagging summary, which is
  exactly how the case above was missed.
- A failed build aborts before the deprecation summary prints — re-check
  after the build is green, not only on the failing run.
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
