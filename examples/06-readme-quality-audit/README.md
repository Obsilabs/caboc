# Example 06 — readme-quality-audit

A standalone CABOC routine that scores a project README on six
dimensions, names missing sections, writes a short critique, and
assigns an overall letter grade. Aimed at OSS maintainers who want a
fast, consistent first pass before tightening their docs.

## Why this example

- Single agent, single non-deterministic step — the minimal shape of
  a CABOC routine. Useful as a starting template.
- Demonstrates a `reasoning` capability with `balanced` tier and an
  inline nested-object output schema.
- Shows a deterministic rubric inside the agent prompt (score band
  anchors + grade thresholds) without leaking it into the workflow.

## Layout

```
06-readme-quality-audit/
├── WORKFLOW.md
├── agents/
│   └── readme_auditor.agent.md
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                      (populated at run time)
```

## Inputs

```json
{
  "readme_md": "string (the full README markdown)",
  "repo_name": "string",
  "package_kind": "cli | lib | app | framework"
}
```

## Outputs

```json
{
  "scores": {
    "what": 0,
    "install": 0,
    "usage": 0,
    "api": 0,
    "license": 0,
    "contributing": 0
  },
  "missing_sections": ["Installation", "Contributing"],
  "critique_md": "string",
  "overall_grade": "A | B | C | D | F"
}
```

## Grade thresholds

Unweighted mean of the six dimension scores:

- `A` — ≥ 8.0
- `B` — ≥ 6.0
- `C` — ≥ 4.0
- `D` — ≥ 2.0
- `F` — < 2.0

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/06-readme-quality-audit
   ```

2. Seed a run:

   ```
   mkdir -p examples/06-readme-quality-audit/runs/local-001
   cp examples/06-readme-quality-audit/__fixtures__/sample-inputs.json \
      examples/06-readme-quality-audit/runs/local-001/inputs.json
   ```

3. In a Claude Code session with the `caboc-runtime` skill loaded:

   > run routine `examples/06-readme-quality-audit` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect:

   ```
   npx caboc inspect examples/06-readme-quality-audit/runs/local-001/
   ```

## License

Apache-2.0.
