# Example 04 — customer-feedback-clusters

A standalone CABOC routine that clusters a batch of customer feedback
items by underlying theme and writes a short markdown brief of the top
themes. Aimed at product and customer-experience teams scanning weekly
inbound feedback for signal.

## Why this example

- Two agents, sequential — shows a `NON_DETERMINISTIC` step feeding the
  next `NON_DETERMINISTIC` step via an `OUTPUT` reference.
- Mixes capability profiles in one routine: `structured_extraction`
  (balanced) for clustering, `reasoning` (fast) for the markdown brief.
- Demonstrates `EMIT` from the second step pulling fields from both the
  current step's output and a prior step's output binding.

## Layout

```
04-customer-feedback-clusters/
├── WORKFLOW.md
├── agents/
│   ├── clusterer.agent.md
│   └── summarizer.agent.md
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                      (populated at run time)
```

## Inputs

```json
{
  "feedback_items": [
    { "id": "fb_001", "text": "string", "source": "string" }
  ]
}
```

## Outputs

```json
{
  "clusters": [
    {
      "theme": "string",
      "sentiment": "positive | negative | neutral | mixed",
      "ids": ["fb_001"],
      "representative_quote": "string"
    }
  ],
  "top_themes_summary_md": "string"
}
```

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/04-customer-feedback-clusters
   ```

2. Seed a run:

   ```
   mkdir -p examples/04-customer-feedback-clusters/runs/local-001
   cp examples/04-customer-feedback-clusters/__fixtures__/sample-inputs.json \
      examples/04-customer-feedback-clusters/runs/local-001/inputs.json
   ```

3. In a Claude Code session with the `caboc-runtime` skill loaded:

   > run routine `examples/04-customer-feedback-clusters` with inputs
   > from `runs/local-001/inputs.json`

4. Inspect:

   ```
   npx caboc inspect examples/04-customer-feedback-clusters/runs/local-001/
   ```

## Notes on clustering quality

- The clusterer must assign every input `id` to exactly one cluster —
  no drops, no duplicates. The expected-outputs fixture demonstrates
  full coverage.
- Singleton clusters are allowed but discouraged; the agent prompt
  pushes toward merging overlapping themes.
- The summarizer is intentionally narrow: top 3 by size, ties broken
  by negative sentiment first. The product reader should be able to
  skim the brief in under a minute.

## License

Apache-2.0.
