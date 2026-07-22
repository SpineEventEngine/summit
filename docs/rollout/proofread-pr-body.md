## Summary

Repo-wide English proofread — grammar, spelling, punctuation, articles, restrictive
`which`/`that`, verb forms in API summaries, and verb complementation (`allow`/`enable`
+ gerund) — across KDoc, Javadoc, Protobuf doc comments, and Markdown.

**Prose only:** no executable code, identifiers, string literals, or doc-link targets
were changed.

## Commits

- **Update shared agent tooling** — floated `.agents/shared` to current via `./config/pull`.
- **Bump version** — snapshot increment required by the versioning policy.
- **Update dependency reports** — `docs/dependencies/` refreshed for the new version;
  the report diff is version-only (no dependency changes).
- **Proofread comments and documentation** — the prose fixes.

## Verification

- `./gradlew clean build dokkaGenerate` passes — compile, tests, and Dokka/KDoc link
  checks are all green.
- Reviewed with the repository's own reviewers (`review-docs`, `spine-code-review`,
  `kotlin-engineer`).

<!-- Applied by ./proofread-repo ship. For a per-repo body (version, representative
     fixes, notable review items), have the agent generate one in step 3 and point
     `gh pr create --body-file` at it instead. -->
