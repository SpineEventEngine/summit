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
