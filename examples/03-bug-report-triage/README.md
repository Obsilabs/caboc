# Example 03 — bug-report-triage

A standalone CABOC routine that triages an inbound bug-report ticket
and proposes the next concrete action. Aimed at customer-support and
SRE workflows where a human still owns the final call but wants a
consistent first pass.

## Why this example

- Single agent, but two-step body — shows how a `DETERMINISTIC` step
  consumes a `NON_DETERMINISTIC` step's emitted fields to route.
- Shows `IF / ELSE IF / ELSE / END IF` plus `GOTO step.finalize`.
- Demonstrates a `structured_extraction` capability profile (vs. the
  `reasoning` profile in `01-commit-message`).

## Layout

```
03-bug-report-triage/
├── WORKFLOW.md
├── agents/
│   └── triager.agent.md
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                      (populated at run time)
```

## Inputs

```json
{
  "ticket_subject": "string",
  "ticket_body": "string",
  "customer_tier": "free | pro | enterprise (optional)",
  "product_area": "string (optional)"
}
```

## Outputs

```json
{
  "severity": "low | medium | high | critical",
  "component": "string",
  "reproducible": true,
  "next_action": "ask_repro | assign_engineering | knowledge_base | escalate_oncall",
  "draft_reply_md": "string",
  "confidence": 0.0
}
```

## Routing rules

Evaluated in order inside `STEP route`:

1. `severity = "critical"` → `escalate_oncall`.
2. `reproducible = false` → `ask_repro`.
3. `has_kb_match = true` → `knowledge_base`.
4. otherwise → `assign_engineering`.

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/03-bug-report-triage
   ```

2. Seed a run:

   ```
   mkdir -p examples/03-bug-report-triage/runs/local-001
   cp examples/03-bug-report-triage/__fixtures__/sample-inputs.json \
      examples/03-bug-report-triage/runs/local-001/inputs.json
   ```

3. In a Claude Code session with the `caboc-runtime` skill loaded:

   > run routine `examples/03-bug-report-triage` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect:

   ```
   npx caboc inspect examples/03-bug-report-triage/runs/local-001/
   ```

## Notes on `confidence`

- `>= 0.8` — severity + component + reproducible all well-supported by the body.
- `0.6 - 0.8` — one of the three is a judgement call; have a human skim.
- `< 0.6` — body is thin or contradictory; treat the draft reply as a
  starting point only.

## License

Apache-2.0.
