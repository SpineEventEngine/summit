// proofread-fanout.workflow.js — step 2 (the proofread sweep) as a deterministic
// fan-out: one proofreader agent per file chunk.
//
// STATUS: the Proofread stage was validated once (base-types — 33 files, 3 chunks,
// 14 fixes), then hardened for coverage honesty (a failed chunk is reported in
// `failedFiles`, never silently dropped), loud input validation, and de-duplicated
// file lists. The Verify stage (below) is NEW and not yet exercised on a real corrupt
// diff. Neither stage has run on a large repo, an already-clean (no-op) repo, or a
// forced-failure run — see docs/rollout/proofread.md for the remaining validation.
//
// OPT-IN BY DESIGN (not a gap to close): the Workflow tool requires explicit opt-in,
// so this runs only when the calling session invokes it — it is never auto-triggered
// from the proofread-repo bash script.
//
// Invoke from the calling session:
//   Workflow({ scriptPath: "docs/rollout/proofread-fanout.workflow.js",
//              args: { repo: "base-types",
//                      root: "/abs/base-types",
//                      catalog: "/abs/.agents/guidelines/english-style.md",
//                      files: [ ...ABSOLUTE prose file paths... ],
//                      chunkSize: 40 } })
//
// The CALLER pre-scopes `files` (ABSOLUTE paths) and passes ABSOLUTE `catalog` and
// `root`, because the Workflow runtime has NO filesystem access — it can neither list
// files nor resolve repo-relative paths. Scope = `git ls-files` of
// *.kt/*.kts/*.java/*.proto/*.md minus build/, buildSrc/, .idea/, .claude/, .junie/,
// .github/, .agents/, the config-distributed Markdown, and the generated
// docs/dependencies/ reports. Proofread agents edit DISJOINT files — no worktree
// isolation needed.
//
// Two stages: (1) Proofread — one agent per file chunk edits prose in place;
// (2) Verify — read-only-git agents inspect the ACTUAL working-tree diff of every
// changed file and flag any edit that escaped prose, ESPECIALLY trailing whitespace
// stripped inside a string literal (the sanitize-source-code.sh hook's known corruption
// of test fixtures). Verify only reads — it never edits or commits. The caller still
// owns the final audit and the commit, but works from `verification.suspectFiles`
// instead of eyeballing the whole diff (docs/rollout/proofread.md step 2).

export const meta = {
  name: 'proofread-fanout',
  description: 'Fan the proofread sweep across a repo\'s prose files, then verify the diff',
  phases: [
    { title: 'Proofread', detail: 'one proofreader per file chunk' },
    { title: 'Verify', detail: 'read-only-git audit of every changed file' },
  ],
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

// Ground truth from the Verify stage's discover step: what actually changed on disk,
// independent of what the proofreaders self-reported.
const DISCOVER = {
  type: 'object',
  additionalProperties: false,
  required: ['gitOk', 'changedFiles'],
  properties: {
    gitOk: { type: 'boolean' },
    changedFiles: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
}

// Per-file verdict from the Verify stage's inspect step.
const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['files'],
  properties: {
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'status'],
        properties: {
          file: { type: 'string' },
          status: { type: 'string', enum: ['clean', 'suspect', 'unverified'] },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'detail'],
              properties: {
                kind: { type: 'string', enum: ['whitespace-in-string-literal', 'non-prose-edit', 'other'] },
                line: { type: 'integer' },
                detail: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
}

// The Workflow harness may hand `args` in as a JSON string rather than an object;
// accept either so `args.files` can't silently read as undefined (0 files, 0 agents).
let A
try {
  A = typeof args === 'string' ? JSON.parse(args) : (args || {})
} catch (e) {
  throw new Error(`proofread-fanout: \`args\` was a string but not valid JSON — ${e.message}`)
}
const repo = A.repo
const catalog = A.catalog
const root = A.root

// Fail loudly on caller mistakes instead of no-op'ing into an empty, "successful" run
// (the first base-types attempt silently proofread 0 files this way).
if (!repo) throw new Error('proofread-fanout: `repo` is required (the repo being swept).')
if (!catalog) {
  throw new Error('proofread-fanout: `catalog` is required — the ABSOLUTE path to english-style.md.')
}
if (!root) {
  throw new Error('proofread-fanout: `root` is required — the ABSOLUTE repo root for read-only git verification.')
}

// De-duplicate: agents edit DISJOINT files only if the list has no repeats. Without
// this, a duplicated path could land in two concurrent agents and race on one file.
const rawFiles = Array.isArray(A.files) ? A.files : []
const files = [...new Set(rawFiles)]
if (files.length === 0) {
  throw new Error('proofread-fanout: `files` is empty — the caller must pre-scope the prose file list (see the header).')
}
const deduped = rawFiles.length - files.length

const CHUNK = A.chunkSize || 40
const VCHUNK = A.verifyChunkSize || 20
const chunks = []
for (let i = 0; i < files.length; i += CHUNK) chunks.push(files.slice(i, i + CHUNK))

if (deduped > 0) log(`deduped ${deduped} repeated path(s) from the input`)
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

// A died/refused agent resolves to null. Do NOT silently drop it: its whole chunk
// went un-swept, so the caller must learn coverage was incomplete before committing.
const ok = []
const failedChunks = []
results.forEach((r, i) => {
  if (r) ok.push(r)
  else failedChunks.push(i)
})
const failedFiles = failedChunks.flatMap(i => chunks[i])
if (failedFiles.length > 0) {
  log(`WARNING: ${failedChunks.length}/${chunks.length} chunk(s) failed — ${failedFiles.length} file(s) were NOT proofread. Sweep the files in \`failedFiles\` before committing.`)
}

const changes = ok.flatMap(r => r.changes || [])
const skipped = ok.flatMap(r => r.skipped || [])
const claimedChanged = [...new Set(changes.map(c => c.file))]

// ---- Stage 2: Verify — close the whitespace-in-string-literal failure mode. ----
// The sanitize-source-code.sh PostToolUse hook strips trailing whitespace file-wide
// after every Edit, silently corrupting whitespace-sensitive test string literals
// (this broke a StringsSpec trim test). The proofreaders' self-reports cannot catch a
// side effect they never saw, so an INDEPENDENT pass inspects the actual working-tree
// diff of every changed file.
phase('Verify')

// Discover ground truth independently of what the proofreaders claimed — a verifier
// must not trust the party whose edits it checks.
const discovery = await agent(
  [
    `You verify a proofread sweep of ${repo}. Using ONLY read-only git, list the files that`,
    `currently differ in the working tree.`,
    ``,
    `Run exactly: git -C "${root}" diff --name-only`,
    `Return the repo-relative paths it prints as "changedFiles" and set "gitOk" true. If git`,
    `cannot run (no shell/git, or an error), set "gitOk" false, "changedFiles" [], and put the`,
    `error text in "note". Do NOT edit, stage, commit, or build anything.`,
  ].join('\n'),
  { label: 'verify:discover', phase: 'Verify', schema: DISCOVER }
)

let verification
if (!discovery || !discovery.gitOk) {
  const note = discovery ? (discovery.note || 'git unavailable') : 'discover agent did not return'
  log(`WARNING: verification could not enumerate changes (${note}) — audit the diff manually before committing.`)
  verification = { ran: false, verified: false, actualChanged: [], suspectFiles: [], unverifiedFiles: [], changedButNotClaimed: [], claimedButNotChanged: [], note }
} else {
  const actualChanged = [...new Set(discovery.changedFiles || [])]
  if (actualChanged.length === 0) {
    verification = { ran: true, verified: true, actualChanged: [], suspectFiles: [], unverifiedFiles: [], changedButNotClaimed: [], claimedButNotChanged: claimedChanged, note: 'no working-tree changes to verify' }
  } else {
    const vChunks = []
    for (let i = 0; i < actualChanged.length; i += VCHUNK) vChunks.push(actualChanged.slice(i, i + VCHUNK))
    log(`verify ${actualChanged.length} changed file(s) across ${vChunks.length} chunk(s)`)

    const vResults = await parallel(vChunks.map((chunk, i) => () =>
      agent(
        [
          `You audit a proofread sweep of ${repo} for edits that escaped prose. For EACH file`,
          `below, inspect its working-tree diff with read-only git and classify it.`,
          ``,
          `For each file run: git -C "${root}" diff -- "<file>"`,
          `A file is "clean" only if EVERY added/removed line is inside a comment (KDoc/Javadoc/`,
          `line/block) or Markdown body prose. Mark it "suspect" if the diff touches anything else,`,
          `and record one issue per offending hunk:`,
          `  - kind "whitespace-in-string-literal": a changed line inside a string literal —`,
          `    a raw/multiline string or test fixture — INCLUDING a pure trailing-whitespace`,
          `    removal. This is the sanitize-source-code.sh hook's known corruption; always flag it.`,
          `  - kind "non-prose-edit": a change to an identifier, keyword, annotation, a doc-link`,
          `    target like [Type], or any other executable token.`,
          `Quote the offending hunk in "detail" and give its "line". If git cannot run for a file,`,
          `mark it "unverified" with the reason. Do NOT edit, stage, commit, or build — read only.`,
          ``,
          `Files (repo-relative to ${root}):`,
          ...chunk,
        ].join('\n'),
        { label: `verify:${i}`, phase: 'Verify', schema: VERDICT }
      )
    ))

    const verdicts = vResults.filter(Boolean).flatMap(r => r.files || [])
    const deadVerify = []
    vResults.forEach((r, i) => { if (!r) deadVerify.push(...vChunks[i]) })

    const suspectFiles = verdicts.filter(v => v.status === 'suspect')
    const unverifiedFiles = [
      ...verdicts.filter(v => v.status === 'unverified')
        .map(v => ({ file: v.file, reason: (v.issues && v.issues[0] && v.issues[0].detail) || 'unverified' })),
      ...deadVerify.map(f => ({ file: f, reason: 'verifier agent failed' })),
    ]

    // Best-effort reconcile of ground truth against the proofreaders' self-reports;
    // paths may be absolute or repo-relative, so match on a shared suffix.
    const matches = (a, b) => a === b || a.endsWith('/' + b) || b.endsWith('/' + a)
    const changedButNotClaimed = actualChanged.filter(a => !claimedChanged.some(c => matches(a, c)))
    const claimedButNotChanged = claimedChanged.filter(c => !actualChanged.some(a => matches(a, c)))

    const verified = suspectFiles.length === 0 && unverifiedFiles.length === 0
    if (!verified) {
      log(`WARNING: verification flagged ${suspectFiles.length} suspect + ${unverifiedFiles.length} unverified file(s) — review \`verification.suspectFiles\` before committing.`)
    }
    verification = { ran: true, verified, actualChanged, suspectFiles, unverifiedFiles, changedButNotClaimed, claimedButNotChanged }
  }
}

return {
  repo,
  complete: failedChunks.length === 0,   // false ⇒ proofread coverage gap; see failedFiles
  filesScanned: files.length,
  chunksTotal: chunks.length,
  chunksSucceeded: ok.length,
  chunksFailed: failedChunks.length,
  failedFiles,                           // files whose proofread chunk failed — must be swept
  filesChanged: ok.reduce((n, r) => n + (r.filesChanged || 0), 0),
  changes,
  skipped,
  verification,                          // { ran, verified, suspectFiles, ... } — see Stage 2
}
