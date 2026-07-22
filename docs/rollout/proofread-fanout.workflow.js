// proofread-fanout.workflow.js — DRAFT sketch of step 2 (the proofread sweep) as a
// deterministic fan-out. *** Not wired up; the Workflow tool requires opt-in. ***
//
// Invoke from the calling session:
//   Workflow({ scriptPath: "docs/rollout/proofread-fanout.workflow.js",
//              args: { repo: "base-types",
//                      catalog: "/abs/.agents/guidelines/english-style.md",
//                      files: [ ...ABSOLUTE prose file paths... ],
//                      chunkSize: 40 } })
//
// The CALLER pre-scopes `files` (ABSOLUTE paths) and passes the catalog's ABSOLUTE
// path, because the Workflow runtime has NO filesystem access — it can neither list
// files nor resolve repo-relative paths. Scope = `git ls-files` of
// *.kt/*.kts/*.java/*.proto/*.md minus build/, buildSrc/, .idea/, .claude/, .junie/,
// .github/, .agents/, the config-distributed Markdown, and the generated
// docs/dependencies/ reports. This script only chunks and fans out. After it
// returns, the caller AUDITS with whitespace visible (docs/rollout/proofread.md
// step 2) and commits. Agents edit DISJOINT files — no worktree isolation needed.

export const meta = {
  name: 'proofread-fanout',
  description: 'Fan the proofread sweep across a repo\'s prose files, one agent per chunk',
  phases: [{ title: 'Proofread', detail: 'one proofreader per file chunk' }],
}

// Structured report each proofreader returns (validated at the tool-call layer).
const REPORT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    filesChanged: { type: 'integer' },
    changes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['file', 'topic', 'before', 'after'],
        properties: {
          file: { type: 'string' }, line: { type: 'integer' },
          topic: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' },
        },
      },
    },
    skipped: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['file', 'topic', 'reason'],
        properties: { file: { type: 'string' }, topic: { type: 'string' }, reason: { type: 'string' } },
      },
    },
  },
  required: ['filesChanged', 'changes', 'skipped'],
}

// The Workflow harness may hand `args` in as a JSON string rather than an object;
// accept either so `args.files` can't silently read as undefined (0 files, 0 agents).
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const repo = A.repo
const catalog = A.catalog
const files = A.files || []
const CHUNK = A.chunkSize || 40
const chunks = []
for (let i = 0; i < files.length; i += CHUNK) chunks.push(files.slice(i, i + CHUNK))

log(`proofread ${files.length} files in ${repo} across ${chunks.length} chunk(s)`)
phase('Proofread')

// One proofreader per chunk, all concurrent (runtime caps at ~cores-2 at a time).
// parallel() is the right call here: a single stage whose results we aggregate.
const results = await parallel(chunks.map((chunk, i) => () =>
  agent(
    [
      `Proofread ONLY the files listed below (ABSOLUTE paths); they belong to ${repo}.`,
      `First read the catalog at ${catalog} IN FULL — it is the sole authority on what`,
      `counts as an error and when to leave text alone. Bias: a missed error is cheaper`,
      `than a wrong fix — skip anything not clearly correct and record it in "skipped".`,
      ``,
      `Edit PROSE ONLY: comments in .kt/.kts/.java/.proto (KDoc/Javadoc/line/block) and body`,
      `text in .md. NEVER touch identifiers, keywords, string literals, annotations, doc-link`,
      `targets like [Type], copyright headers, or machine-read directives. Keep edits minimal.`,
      `Do NOT run git, builds, or commits — only read and Edit the listed files.`,
      ``,
      `Files:`,
      ...chunk,
    ].join('\n'),
    { label: `proofread:${i}`, phase: 'Proofread', schema: REPORT }
  )
))

const ok = results.filter(Boolean)   // a died/refused agent resolves to null
return {
  repo,
  filesScanned: files.length,
  chunks: chunks.length,
  filesChanged: ok.reduce((n, r) => n + (r.filesChanged || 0), 0),
  changes: ok.flatMap(r => r.changes || []),
  skipped: ok.flatMap(r => r.skipped || []),
}
