# Example 08 — design-doc-adversarial

A standalone CABOC routine that performs an adversarial review of a
design or architecture proposal. Two independent reviewers read the
same doc in parallel; a synthesizer merges them, dedupes, and ships a
`reject` / `revise` / `approve` recommendation with a short written
rationale aimed at the doc's author.

## Why this example

- Demonstrates `PARALLEL JOIN_POLICY=all` with **two** sibling
  reviewers running against the same input — the simplest useful
  fan-out shape after a single agent.
- Shows a `reasoning`-tier-`deep` pair of reviewers feeding a
  `reasoning`-tier-`balanced` synthesizer — the synthesizer's job is
  merging and judgement, not net-new reasoning.
- Uses `SESSION fresh` for both reviewers so each forms its critique
  without bias from the other's output.

## Layout

```
08-design-doc-adversarial/
├── WORKFLOW.md
├── agents/
│   ├── blind_spot_hunter.agent.md     (reasoning · deep)
│   ├── tradeoff_critic.agent.md       (reasoning · deep)
│   └── review_synthesizer.agent.md    (reasoning · balanced)
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                              (populated at run time)
```

## Pattern: 2 parallel + 1 synth

```
                 doc_md
                   |
        +----------+----------+
        |                     |
 blind_spot_hunter     tradeoff_critic   (PARALLEL JOIN_POLICY=all)
        |                     |
        +----------+----------+
                   |
            review_synthesizer           (sequential)
                   |
                outputs
```

- Both reviewers run concurrently; the runtime joins on **all**
  before `synthesize` starts.
- The two reviewers are deliberately orthogonal — one looks for what
  the doc *omits*, the other for what the doc *picks*. Running them
  on the same input keeps the prompts narrow.
- The synthesizer is the only step that sees both arrays. It dedupes,
  sorts by severity, applies the recommendation rubric, and writes
  `rationale_md`.

## Inputs

```json
{
  "doc_md": "## Proposal\n...",
  "proposal_scope": "bugfix | refactor | feature | architecture",
  "target_release": "2026Q3 (optional)"
}
```

## Outputs

```json
{
  "critiques":   [ /* sorted by severity desc, then doc order */ ],
  "blind_spots": [ /* sorted by impact desc */ ],
  "recommend":   "approve | revise | reject",
  "rationale_md": "**Recommendation: revise** ..."
}
```

## Recommendation rubric

Applied by `review_synthesizer` over the deduped critique list:

1. Any `blocker` present → `reject`.
2. No blockers, ≥ 2 `major` → `revise`.
3. No blockers, ≤ 1 `major` → `approve`.
4. Escalation: ≥ 3 production-critical blind spots bumps `approve` → `revise`.

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/08-design-doc-adversarial
   ```

2. Seed a run:

   ```
   mkdir -p examples/08-design-doc-adversarial/runs/local-001
   cp examples/08-design-doc-adversarial/__fixtures__/sample-inputs.json \
      examples/08-design-doc-adversarial/runs/local-001/inputs.json
   ```

3. In a Claude Code session with the `caboc-runtime` skill loaded:

   > run routine `examples/08-design-doc-adversarial` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect:

   ```
   npx caboc inspect examples/08-design-doc-adversarial/runs/local-001/
   ```

## License

Apache-2.0.
