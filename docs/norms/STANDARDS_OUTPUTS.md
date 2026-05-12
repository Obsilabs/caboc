# STANDARDS_OUTPUTS — Outputs as files, scratch dirs, bundling

> Status: draft v0.2
> Scope: every workflow agent that emits multi-kilobyte content,
> binary artefacts, or file collections, plus the `caboc bundle`
> command.
> License: Apache 2.0.

## 1. Why this exists

A workflow that emits chapters, reports, PDFs, or attachments should
not JSON-stringify multi-kilobyte markdown into `outputs.json`. The
result is unreadable in transcripts, hostile to diffs, and unfriendly
to downstream tooling — pandoc, static-site generators, archive
bundlers, and reviewers all expect files on disk.

Files-as-outputs preserve diff-ability, let downstream tools read
artefacts at their native MIME type, and keep `outputs.json` a thin
index. `scratch_dirs` extends the same discipline to intermediate
state, and `caboc bundle` makes the run dir shippable as a single
deterministic archive.

## 2. Output type taxonomy

`io.outputs.<name>.type` in `WORKFLOW.md` accepts:

| Type         | Storage                                  |
| ------------ | ---------------------------------------- |
| `string`     | `outputs.json` value (UTF-8)             |
| `integer`    | `outputs.json` value                     |
| `number`     | `outputs.json` value                     |
| `boolean`    | `outputs.json` value                     |
| `object`     | `outputs.json` value                     |
| `array`      | `outputs.json` value                     |
| `enum`       | `outputs.json` value (`values:` required)|
| `file`       | file on disk; pointer in `outputs.json`  |
| `file_array` | glob of files; pointer list in `outputs.json` |

The first seven round-trip through `outputs.json`. The last two
describe artefacts on disk; `outputs.json` only carries pointers.

## 3. `file` output declaration

```yaml
outputs:
  report_pdf:
    type: file
    path: "outputs/report.pdf"
    content_type: application/pdf
```

- `path` is relative to the run dir and MUST start with `outputs/`.
- `content_type` is an IANA media type. Optional but recommended.
- The agent writes the file under
  `runs/<run-id>/outputs/<name>` before the run ends.
- Missing at end-of-run → `CABOC_E_FILE_OUTPUT_MISSING`.

## 4. `file_array` with `path_pattern`

```yaml
outputs:
  chapters:
    type: file_array
    path_pattern: "outputs/chapters/*.md"
    content_type: text/markdown
    order_by: lex
```

- `path_pattern` is a relative glob anchored under `outputs/`.
- `order_by: lex` (default) sorts by NFC-normalized path.
  `order_by: mtime` sorts ascending by file mtime.
- Glob semantics mirror the content-hash walker in
  `STANDARDS_DISTRIBUTION` §4 (no symlink following, LF endings).
- Empty matches allowed unless `min_count: <n>` is set.

## 5. Indexing in `outputs.json`

`outputs.json` is always written. `file` / `file_array` entries carry
pointers, not contents:

```jsonc
{
  "report_pdf": {
    "path": "outputs/report.pdf",
    "content_type": "application/pdf",
    "size_bytes": 184213,
    "sha256": "<hex>"
  },
  "chapters": [
    { "path": "outputs/chapters/01-intro.md",    "title": "Intro",    "size_bytes": 4211 },
    { "path": "outputs/chapters/02-overview.md", "title": "Overview", "size_bytes": 9123 }
  ]
}
```

All `path` values are relative to the run dir. `sha256` is lowercase
hex. `title` is optional and may come from a sidecar
`<file>.meta.json` or frontmatter convention.

## 6. `scratch_dirs:` — agent-declared scratch

```yaml
---
agent: writer
provider_role: forge-writer
scratch_dirs:
  - name: drafts
  - name: figures
keep_scratch: false
---
```

- Each `name` resolves to
  `runs/<run-id>/scratch/<agent-id>/<name>/`.
- Created by the runtime before the agent runs.
- Cleaned at run end unless `keep_scratch: true`.
- Never indexed in `outputs.json`. Never included in bundles.
- A scratch dir is the only writable location outside `outputs/`.

## 7. Sandbox

The runtime enforces per-agent FS access:

- Writes only under `runs/<run-id>/outputs/` or
  `runs/<run-id>/scratch/<agent-id>/<declared-name>/`.
- Reads only under the routine dir (`routines/<alias>/`) or the run
  dir (`runs/<run-id>/`).
- Any other path → `CABOC_E_FS_DENIED`.

See `STANDARDS_SECURITY` §3 for the broader posture.

## 8. `caboc bundle <run-dir>`

Produces a `.tar.gz` of the run for hand-off, archival, or replay:

```
<run-dir>.tar.gz
├── outputs/                  # declared files / file_arrays
├── outputs.json              # pointers + scalar outputs
├── transcript.ndjson         # full event log
└── metadata.json             # run id, routine source, sha256, timing
```

Determinism rules:

- Entries sorted lexicographically by path.
- All mtimes fixed to `1980-01-01T00:00:00Z`.
- No extended attrs, ACLs, or ownership; uid/gid zeroed; uname/gname empty.
- gzip with `--no-name` and a fixed compression level.

`scratch/` is excluded. Re-running the bundle on the same run dir
yields byte-identical output across machines.

## 9. Reproducibility

A bundle's sha256 may be pinned alongside the routine lockfile entry
for audit-grade replay via an optional `runs.lock`:

```jsonc
{
  "<alias>": {
    "bundles": {
      "<run-id>": { "sha256": "<hex>", "created_at": "<iso-8601-utc>" }
    }
  }
}
```

Its presence lets CI assert that a re-run produces the same artefacts
down to the byte.

## 10. NDJSON events

- `file_output.written` — on each write of a declared `file` or a
  member of a `file_array`. Payload: `name`, `path`, `size_bytes`,
  `sha256`.
- `scratch.cleaned` — at run end for each removed scratch dir.
  Skipped when `keep_scratch: true`.
- `bundle.created` — from `caboc bundle`. Payload: `path`,
  `size_bytes`, `sha256`.

## 11. Lint

`caboc lint` enforces:

- A declared `file` output written by run end →
  else `CABOC_E_FILE_OUTPUT_MISSING`.
- `file_array` with `min_count: <n>` MUST have ≥ `n` matches.
- `path` / `path_pattern` MUST be anchored under `outputs/`.
- `scratch_dirs[].name` MUST match the agent identifier shape
  (`STANDARDS_NAMING` §3): kebab-case, no slashes.
- No model literals in output declarations or scratch configs
  (shared rule with `STANDARDS_ROUTINES` §6).

## 12. Example — article-forge

```yaml
io:
  outputs:
    chapters:
      type: file_array
      path_pattern: "outputs/chapters/*.md"
      content_type: text/markdown
      order_by: lex
      min_count: 1
    index_md:
      type: file
      path: "outputs/index.md"
      content_type: text/markdown
    metadata:
      type: object
```

After a run:

```
runs/<run-id>/
├── outputs/
│   ├── index.md
│   └── chapters/01-intro.md, 02-background.md, 03-conclusion.md
├── outputs.json
├── transcript.ndjson
└── metadata.json
```

`caboc bundle runs/<run-id>` then produces `runs/<run-id>.tar.gz`.

## 13. References

- `STANDARDS_GRAMMAR` — `io.outputs` schema and type taxonomy host.
- `STANDARDS_ROUTINES` §6 — frontmatter validation and lint surface.
- `STANDARDS_DISTRIBUTION` §4 — canonical byte-stream reused by the
  bundle and the file-array glob walker.
- `STANDARDS_NAMING` §3 — scratch dir / agent identifier shape.
- `STANDARDS_SECURITY` §3 — filesystem and network sandbox posture.
