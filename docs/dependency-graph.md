# Spine SDK dependency graph

How the Spine SDK repositories depend on each other, which of them must be
built before which, and the artifact coordinates each one publishes. In the
dependency diagrams arrows point **at the dependency**: `compiler --> tool-base`
reads "`compiler` depends on artifacts published by `tool-base`". The
mutual-pair section reverses the direction — its arrows show already-published
artifacts flowing into their consumers — and says so in place.

## Mutual dependencies and how the SDK stays buildable

The raw dependency relation is **cyclic**, because the SDK is self-hosting:
`logging` depends on `base-libraries` (its API uses `spine-base` types), while
`base-libraries` also depends on `logging` (its code writes logs); the same
holds for `ProtoTap` and the `compiler`. Taken literally, neither member of
such a pair could ever be built first.

The cycles resolve because the two directions of a mutual pair are satisfied
by **different generations of artifacts**. One direction — from the repository
*later* in the canonical order below to the one *earlier* — behaves as a
normal build-order dependency on current artifacts. The reverse direction is
satisfied by a version **already published** to the registry, built against an
older generation, so it never constrains what must be built before what. On
each successive release the two sides catch up alternately, staying about one
generation apart.

## Canonical build order

One-way dependencies constrain this order absolutely, and regeneration audits
that (a repository is never placed before one it depends on unless the pair is
genuinely mutual). Which member of a **mutual** pair counts as "earlier" is a
convention, not a derivable fact — so the order is recorded here, as reviewed
documentation:

1. `base-libraries`
2. `reflect`
3. `logging`
4. `testlib`
5. `base-types`
6. `change`
7. `tool-base`
8. `ProtoTap`
9. `time`
10. `compiler`
11. `validation`
12. `money`
13. `core-jvm-compiler`
14. `core-jvm`
15. `jdbc-storage`
16. `gcloud-jvm`
17. `delivery-server`
18. `BuildSpeed`

## Production dependencies (transitive reduction)

Declared production-scope dependencies between the repositories — the
structure of the published artifacts. For readability the diagram omits edges
implied by longer paths: `c --> b --> a` means `c` also depends on `a`
directly. Arrows point at the dependency. The complete relation (production
and test scope) is the machine-readable list at the bottom of this file.
References that merely manage versions — `force(...)`, `constraints`,
`exclude` — are not dependencies and create no edge.

```mermaid
flowchart BT
    base-types --> base-libraries
    change --> base-libraries
    logging --> base-libraries
    validation --> base-types
    validation --> change
    validation --> compiler
    delivery-server --> core-jvm
    gcloud-jvm --> core-jvm
    jdbc-storage --> core-jvm
    BuildSpeed --> core-jvm-compiler
    core-jvm --> core-jvm-compiler
    testlib --> logging
    logging --> reflect
    tool-base --> testlib
    compiler --> time
    ProtoTap --> tool-base
    time --> tool-base
    core-jvm-compiler --> validation
    money --> validation
```

<details>
<summary>Test-only dependencies (used by the repository's tests, not by its
published artifacts). `ProtoTap` is test-only by design — it taps `protoc`
output in tests — so every edge pointing at it lives here or among the mutual
pairs, never in the production diagram.</summary>

```mermaid
flowchart BT
    compiler --> ProtoTap
    core-jvm-compiler --> ProtoTap
    time --> ProtoTap
    validation --> ProtoTap
    time --> logging
    ProtoTap --> testlib
    base-types --> testlib
    delivery-server --> testlib
    gcloud-jvm --> testlib
    money --> testlib
    time --> testlib
    validation --> testlib
    delivery-server --> time
```

</details>

<details>
<summary>Reverse directions of the mutual dependencies — satisfied by
previously published versions, so they impose no build order. The arrow leads
from the already-published artifact to the repository consuming it.</summary>

```mermaid
flowchart BT
    compiler -.-> time
    core-jvm -.-> compiler
    core-jvm -.-> core-jvm-compiler
    core-jvm -.-> validation
    core-jvm-compiler -.-> base-types
    core-jvm-compiler -.-> compiler
    core-jvm-compiler -.-> validation
    logging -.-> base-libraries
    reflect -.-> base-libraries
    testlib -.-> base-libraries
    testlib -.-> logging
    testlib -.-> reflect
    time -.-> change
    tool-base -.-> base-libraries
    tool-base -.-> testlib
    validation -.-> base-types
    validation -.-> change
    validation -.-> compiler
    validation -.-> time
```

</details>

## Repository metadata

Class `library` publishes Maven artifacts; `verify-only` builds but publishes
nothing. The marker is one published artifact whose registry metadata answers
"is version X of this repository published?"; the version property is the name
of the literal in the repository's `version.gradle.kts`.

| Repository | Class | Registry : marker | Version property |
|---|---|---|---|
| `base-libraries` | library | gcar : `io.spine:spine-base` | `versionToPublish` |
| `reflect` | library | gcar : `io.spine:spine-reflect` | `versionToPublish` |
| `logging` | library | gcar : `io.spine:spine-logging` | `versionToPublish` |
| `testlib` | library | gcar : `io.spine.tools:spine-testlib` | `versionToPublish` |
| `base-types` | library | gcar : `io.spine:spine-base-types` | `versionToPublish` |
| `change` | library | gcar : `io.spine:spine-change` | `versionToPublish` |
| `tool-base` | library | gcar : `io.spine.tools:spine-tool-base` | `versionToPublish` |
| `ProtoTap` | library | gcar : `io.spine.tools:prototap-gradle-plugin` | `versionToPublish` |
| `time` | library | gcar : `io.spine:spine-time` | `versionToPublish` |
| `compiler` | library | gcar : `io.spine.tools:compiler-jvm` | `compilerVersion` |
| `validation` | library | gcar : `io.spine.tools:spine-validation-java` | `validationVersion` |
| `money` | library | gcar : `io.spine:spine-money` | `versionToPublish` |
| `core-jvm-compiler` | library | gcar : `io.spine.tools:core-jvm-gradle-plugin` | `coreJvmCompilerVersion` |
| `core-jvm` | library | gcar : `io.spine:spine-core` | `versionToPublish` |
| `jdbc-storage` | library | gcar : `io.spine:spine-rdbms` | `versionToPublish` |
| `gcloud-jvm` | library | gcar : `io.spine.gcloud:spine-datastore` | `versionToPublish` |
| `delivery-server` | library | github : `io.spine.delivery:spine-delivery-server` | `versionToPublish` |
| `BuildSpeed` | verify-only | — | — |

`documentation` is not on the graph: it is a Spine 1.x site project, not part
of the SDK build line.

## Maintenance

The relation is derived from `import io.spine.dependency.local.*` usages in
each repository's own build files (never the config-distributed `buildSrc/`,
whose files exist in every repository regardless of use), plus the manual
edges kept in `extra_edges()` in [`../cascade`](../cascade) for dependencies
wired through convention scripts. Regenerate after a topology change with:

```bash
./cascade graph
```

Cross-repository automation ([`rollout/rebuild.md`](rollout/rebuild.md))
consumes this file as its ordering contract and verifies it against a fresh
derivation before acting, so changes — including changes to the canonical
order — must land here, reviewed, first.

## Complete dependency list (machine-readable)

Every direct **declared** dependency (production and test scope), one
`dependent dependency` pair per line — the left repository depends on
artifacts published by the right one. Both directions of the mutual pairs are
included; version-management references are excluded; the diagrams above are
renderings of this list.

```edges
BuildSpeed core-jvm-compiler
ProtoTap base-libraries
ProtoTap logging
ProtoTap testlib
ProtoTap tool-base
base-libraries logging
base-libraries reflect
base-libraries testlib
base-libraries tool-base
base-types base-libraries
base-types core-jvm-compiler
base-types testlib
base-types validation
change base-libraries
change time
change validation
compiler ProtoTap
compiler base-libraries
compiler core-jvm
compiler core-jvm-compiler
compiler logging
compiler reflect
compiler testlib
compiler time
compiler tool-base
compiler validation
core-jvm base-libraries
core-jvm base-types
core-jvm change
core-jvm core-jvm-compiler
core-jvm logging
core-jvm reflect
core-jvm testlib
core-jvm time
core-jvm validation
core-jvm-compiler ProtoTap
core-jvm-compiler base-libraries
core-jvm-compiler compiler
core-jvm-compiler core-jvm
core-jvm-compiler logging
core-jvm-compiler reflect
core-jvm-compiler testlib
core-jvm-compiler time
core-jvm-compiler tool-base
core-jvm-compiler validation
delivery-server core-jvm
delivery-server core-jvm-compiler
delivery-server logging
delivery-server testlib
delivery-server time
delivery-server validation
gcloud-jvm base-libraries
gcloud-jvm base-types
gcloud-jvm core-jvm
gcloud-jvm core-jvm-compiler
gcloud-jvm logging
gcloud-jvm testlib
gcloud-jvm validation
jdbc-storage core-jvm
jdbc-storage core-jvm-compiler
jdbc-storage validation
logging base-libraries
logging reflect
logging testlib
money base-libraries
money testlib
money validation
reflect testlib
testlib logging
testlib tool-base
time ProtoTap
time base-libraries
time compiler
time logging
time testlib
time tool-base
time validation
tool-base base-libraries
tool-base logging
tool-base testlib
validation ProtoTap
validation base-libraries
validation base-types
validation change
validation compiler
validation core-jvm
validation core-jvm-compiler
validation logging
validation reflect
validation testlib
validation time
validation tool-base
```
