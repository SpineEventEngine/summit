# summit

The meta-repository for automating cross-repository work across the [Spine SDK][spine-org].

`summit` is a Git superproject: it assembles the Spine SDK repositories as submodules
in a single working tree, so agents and the shared `config`/CI tooling can act across
the whole SDK at once. It ships no code and has no build of its own — its content is the
pinned commits of the submodules below, plus the shared agent tooling under `.agents/`.

## Repository layout

The submodules are pinned to fixed commits, giving a reproducible snapshot of the
SDK. They are grouped below by function, not by strict dependency order. The
build-order contract between them — including which dependency edges
sequence a cross-repository wave — lives in
[`docs/dependency-graph.md`](docs/dependency-graph.md).

### Shared infrastructure

| Submodule | Role |
|-----------|------|
| [`config`][config] | Dependencies and build configurations shared among subprojects |

The shared agent tooling — skills, scripts, and guidelines — lives in the
[`agents`][agents] repository, mounted at `.agents/shared`. Unlike the submodules
listed here, that mount floats to the tip of `master` rather than a pinned commit.
The same repository is also wired in as a pinned top-level submodule at `agents/`,
so cross-repository automation can run against the tooling repo itself, just as it
does against the SDK repositories above.

### Foundation & utilities

| Submodule | Role |
|-----------|------|
| [`base-libraries`][base-libraries] | The framework's base types and utilities |
| [`reflect`][reflect] | Utilities for working with reflection in Java and Kotlin projects |
| [`logging`][logging] | Fluent logging API for Kotlin projects |
| [`testlib`][testlib] | Testing utilities for Spine SDK development and users |

### Domain & value types

| Submodule | Role |
|-----------|------|
| [`base-types`][base-types] | Popular value object types and associated code |
| [`change`][change] | Data types and utilities for changes and mismatches in data values |
| [`time`][time] | Protobuf-based date/time types and utilities |
| [`money`][money] | Currency and money data types and operations |

### Compiler & code generation

| Submodule | Role |
|-----------|------|
| [`compiler`][compiler] | The Spine Compiler — extendable Protobuf compilation |
| [`tool-base`][tool-base] | Common code for development tools |
| [`ProtoTap`][ProtoTap] | Utilities for tapping `protoc` output |
| [`validation`][validation] | Library and Compiler plugins for generating custom validation code |
| [`core-jvm-compiler`][core-jvm-compiler] | Plugins of the CoreJvm library for the Spine Compiler |

### Framework core

| Submodule | Role |
|-----------|------|
| [`core-jvm`][core-jvm] | The JVM-based implementation of the Spine framework core |

### Storage & runtime

| Submodule | Role |
|-----------|------|
| [`jdbc-storage`][jdbc-storage] | Support for storage in JDBC-compliant databases |
| [`gcloud-jvm`][gcloud-jvm] | Support for Spine-based Kotlin and Java apps on Google Cloud |

## Getting started

Clone with all submodules in one step:

```bash
git clone --recursive https://github.com/SpineEventEngine/summit.git
```

If you cloned without `--recursive`, or you are working in a fresh `git worktree` or
a shallow checkout, the submodules start uninitialised and the `.agents` symlinks
dangle. Bootstrap them with:

```bash
./init-submodules   # materialise the config-managed submodules at their pinned commits
./config/pull       # float the shared submodules and copy in the shared files
```

`./init-submodules` runs automatically at the start of a Claude Code session. See
[`AGENTS.md`](AGENTS.md) for the full bootstrap chain and the rationale behind it.

## Working across repositories

`summit` is where cross-repository work happens: coordinated agent sessions and the
shared `config` tooling propagate changes — dependency bumps, CI workflows, agent
guidelines — across the SDK from one place. Agent orientation, safety rules, and the
available skills are described in [`AGENTS.md`](AGENTS.md).

## License

`summit`, like the rest of the Spine SDK, is distributed under the
[Apache License 2.0](LICENSE).

[spine-org]: https://github.com/SpineEventEngine
[agents]: https://github.com/SpineEventEngine/agents
[config]: https://github.com/SpineEventEngine/config
[base-libraries]: https://github.com/SpineEventEngine/base-libraries
[reflect]: https://github.com/SpineEventEngine/reflect
[logging]: https://github.com/SpineEventEngine/logging
[testlib]: https://github.com/SpineEventEngine/testlib
[base-types]: https://github.com/SpineEventEngine/base-types
[change]: https://github.com/SpineEventEngine/change
[time]: https://github.com/SpineEventEngine/time
[money]: https://github.com/SpineEventEngine/money
[compiler]: https://github.com/SpineEventEngine/compiler
[tool-base]: https://github.com/SpineEventEngine/tool-base
[ProtoTap]: https://github.com/SpineEventEngine/ProtoTap
[validation]: https://github.com/SpineEventEngine/validation
[core-jvm-compiler]: https://github.com/SpineEventEngine/core-jvm-compiler
[core-jvm]: https://github.com/SpineEventEngine/core-jvm
[jdbc-storage]: https://github.com/SpineEventEngine/jdbc-storage
[gcloud-jvm]: https://github.com/SpineEventEngine/gcloud-jvm
