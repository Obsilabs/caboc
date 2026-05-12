# Example 11 — article-forge

A standalone CABOC routine that drives a research-and-writing pipeline
end-to-end: scout the subject, decompose it into a research matrix,
draft an editorial plan, pause for human approval, fan out parallel
research, write the article, iterate on residual gaps, then run a
structural review. The final outputs are a `outputs/index.md` plus
per-chapter Markdown files under `outputs/chapters/`.

Ported from the obsigraph `facet-article-forge` reference graph
(`facets/facet-article-forge/src/graphs/article-forge.ts`) onto the
`caboc-llm/0.2.0` grammar.

## Why this example matters

Example 11 is the canonical "everything-at-once" v0.2 routine. It
exercises every major grammar feature added in v0.2 in one routine,
so you can read a single `WORKFLOW.md` and see how the pieces compose.

## Pattern map — v0.2 features per step

| STEP                | v0.2 feature(s) demonstrated                                       |
| ------------------- | ------------------------------------------------------------------ |
| `scout`             | `provider_role:` on agent + capability/tier in `caboc.config.json` |
| `decompose`         | Schema-validated agent output (`ResearchCell[]`), `.length` later  |
| `editorial_planner` | Cross-agent schema references (`covers_cells` keys matrix `id`s)   |
| `checkpoint` (HITL) | `STEP HITL`, `PROMPT TO role=editor`, `AWAIT decision FROM human`, |
|                     | `WITHIN 7 DAYS`, `ROUTE { approve/modify/restart -> step.X }`,     |
|                     | `ON_TIMEOUT escalate TO senior-editor`                             |
| `collect`           | `LET`, `FOR_EACH cell IN cells PARALLEL CONCURRENCY=8`,            |
|                     | `COLLECT INTO research_results: Array<object>`                     |
| `write_and_iterate` | `LET` + `SET` counter/flag pattern,                                |
|                     | `LOOP UNTIL satisfied OR loop_count >= 3 MAX_ITERATIONS 3`,        |
|                     | nested `FOR_EACH ... PARALLEL` for the patch re-collection,        |
|                     | `MERGE(...)` of two collected arrays                               |
| `review_structure`  | Agent revises files in place via `scratch_dirs:`                   |
| `finalize`          | `EMIT` to declared workflow outputs, `outputs.json` indexing of    |
|                     | `file` (`index_md`) + `file_array` (`chapters`) outputs            |

## File / file_array outputs

```
outputs/
├── index.md                          # type: file
└── chapters/                         # type: file_array, path_pattern: outputs/chapters/*.md
    ├── 01-<slug>.md
    ├── 02-<slug>.md
    └── ...
```

The writer agent declares `scratch_dirs: [{ name: chapters }]` and is
sandboxed to writes under `outputs/chapters/` (declared file_array)
plus `outputs/index.md` (declared file) plus
`scratch/writer/chapters/` (intermediate). The reviewer has the same
permission and may overwrite chapter files in place during the
structural pass.

## Layout

```
11-article-forge/
├── WORKFLOW.md
├── caboc.config.json              # 8 provider roles, no model literals
├── agents/
│   ├── scout.agent.md
│   ├── decompose.agent.md
│   ├── editorial_planner.agent.md
│   ├── collector.agent.md
│   ├── writer.agent.md
│   ├── reviewer_structure.agent.md
│   └── gap_patcher.agent.md
├── schemas/
│   └── article_forge.schemas.md   # ScoutReport, ResearchCell, EditorialPlan, ...
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                          (populated at run time)
```

## Limitations vs the obsigraph reference

The obsigraph `facet-article-forge` graph performs live web research:
the scout and collector nodes hit real search APIs and ingest the
returned URLs. This CABOC port deliberately runs the same nodes as
**pure-LLM agents** — they reason over prior knowledge only.

The trade-off:

- Pro: the routine is standalone runnable. No external infra, no API
  keys, no MCP servers.
- Con: factual freshness and citation rigor are bounded by the
  underlying model's knowledge cutoff. The collector explicitly
  surfaces this via its `uncertainty[]` and `confidence` fields, and
  the gap-patcher feedback loop is designed to compensate by spawning
  follow-up cells when the writer flags `gaps[]`.

### Upgrade path to real web search

The collector agent's output contract is forward-compatible. To turn
this into the full obsigraph behavior:

1. Add a `web_search` tool stub somewhere reachable by the runtime
   (an MCP server or a local subprocess implementing the search
   interface).
2. In `agents/collector.agent.md`, replace the "no web search, no tool
   calls" paragraph with a `USE TOOL web_search.search WITH { query: ... }`
   directive plus instructions to map the returned hits into
   `findings_md` + citation-shaped `key_points`.
3. Optionally add the same to `agents/scout.agent.md` to ground the
   initial sub-themes in fresh sources.
4. Bump each agent's `version:` to `0.2.0` and re-run `caboc lint`.

The workflow body (`WORKFLOW.md`) does not change. Step boundaries,
parallelism, the HITL checkpoint, and the bounded feedback loop all
remain identical.

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/11-article-forge
   ```

2. Dry-run (validates schemas, capability resolution, sandbox rules
   without spending tokens):

   ```
   npx caboc dry-run examples/11-article-forge
   ```

3. Seed a run directory:

   ```
   mkdir -p examples/11-article-forge/runs/local-001
   cp examples/11-article-forge/__fixtures__/sample-inputs.json \
      examples/11-article-forge/runs/local-001/inputs.json
   ```

4. Run the routine:

   ```
   npx caboc run article-forge \
     --inputs examples/11-article-forge/runs/local-001/inputs.json \
     --run-dir examples/11-article-forge/runs/local-001
   ```

5. The run will pause at the HITL `checkpoint` step after the
   editorial plan is produced. Inspect the pending decision and resume:

   ```
   npx caboc inspect examples/11-article-forge/runs/local-001
   npx caboc resume   examples/11-article-forge/runs/local-001 \
     --decision '{"action":"approve"}'
   ```

   Or modify (`{"action":"modify","feedback":"..."}`) to re-enter
   `editorial_planner`, or restart (`{"action":"restart"}`) to re-enter
   `scout`.

6. Inspect outputs:

   ```
   npx caboc inspect examples/11-article-forge/runs/local-001
   cat examples/11-article-forge/runs/local-001/outputs/index.md
   ls  examples/11-article-forge/runs/local-001/outputs/chapters/
   ```

## Expected outputs structure

`outputs.json` carries pointers for `file` / `file_array` outputs and
scalar values for everything else (see `__fixtures__/expected-outputs.json`):

- `index_md`       — pointer to `outputs/index.md`.
- `chapters`       — list of pointers to `outputs/chapters/*.md`.
- `metadata`       — echoed inputs + `cells_collected`, `gaps_patched`,
  `generated_at` (ISO-8601 UTC).
- `review_report`  — Markdown structural-review report, ≤ 8000 chars.
- `loops_used`     — integer 0..3, how many feedback-loop iterations ran.
- `chapter_count`  — integer, count of final chapters after review.

## Conventions

- License: Apache-2.0.
- No model literals anywhere; the 8 provider roles in
  `caboc.config.json` carry the `(capability, tier, constraints)`
  triples. The runtime freezes resolved `(provider, model, version)`
  into the lockfile at install time per `STANDARDS_PROVIDER_ROLES` §7.
- All headings ATX (`#`), no Setext, no emojis.
- Every step modifier matches its body (no `DETERMINISTIC` step calls
  a non-deterministic agent).
- Every `USE AGENT` result destructured into a named binding
  (`scout_out`, `decomp_out`, `plan_out`, `writer_out`, ...). No orphan
  calls.

## License

Apache-2.0.
