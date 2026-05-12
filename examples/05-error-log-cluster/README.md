# Example 05 — error-log-cluster

A standalone CABOC routine that turns a batch of raw log lines into a
short, ranked investigation plan. Aimed at SREs who want a consistent
first pass on a wall of error noise before a human picks where to dig.

## Why this example

- Two agents, sequential — output of the first feeds the input of the
  second via `EMIT` and `OUTPUT` plumbing.
- Mixes `structured_extraction` (signature derivation) with `reasoning`
  (ranking + plan writing) inside one routine.
- Realistic input shape: an array of messy log strings; stable,
  count-driven output suitable for pasting into an incident channel.

## Layout

```
05-error-log-cluster/
├── WORKFLOW.md
├── agents/
│   ├── signature_extractor.agent.md
│   └── prioritizer.agent.md
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                      (populated at run time)
```

## Inputs

```json
{
  "log_lines": ["string", "..."],
  "window_minutes": 30
}
```

`window_minutes` is informational — not used to filter input.

## Outputs

```json
{
  "groups": [
    { "signature": "string", "count": 1, "severity": "low | medium | high | critical", "suggested_check": "string", "example_line": "string" }
  ],
  "priority_order": ["signature", "..."],
  "investigation_plan_md": "string"
}
```

## Ranking rule

`prioritize` sorts by:

1. `severity` descending — `critical` > `high` > `medium` > `low`.
2. `count` descending within the same severity.
3. Original group order as final tiebreaker.

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/05-error-log-cluster
   ```

2. Seed a run:

   ```
   mkdir -p examples/05-error-log-cluster/runs/local-001
   cp examples/05-error-log-cluster/__fixtures__/sample-inputs.json \
      examples/05-error-log-cluster/runs/local-001/inputs.json
   ```

3. In a Claude Code session with the `caboc-runtime` skill loaded:

   > run routine `examples/05-error-log-cluster` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect:

   ```
   npx caboc inspect examples/05-error-log-cluster/runs/local-001/
   ```

## Notes on signatures

Variable parts (UUIDs, request IDs, IPs, ports, PIDs, pod hashes,
timestamps, byte counts) are stripped; the error class, HTTP status,
and owning component are kept.

## License

Apache-2.0.
