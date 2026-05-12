# Example 09 — email-thread-summarize

A standalone CABOC routine that reads an email thread and emits a
TL;DR, participant roles, open questions, commitments, sentiment, and a
suggested reply (with tone). Audience: sales and CSM.

## Why this example

- Demonstrates the **single-agent** pattern: one `reasoning` agent
  produces every output field in a single structured pass.
- Shows how to specialize by **capability + tier** without naming any
  model: the agent uses `reasoning` at `balanced` tier.
- Shows `SESSION fresh` for a one-shot synthesis.

## Layout

```
09-email-thread-summarize/
├── WORKFLOW.md
├── agents/
│   └── thread_synthesizer.agent.md     (reasoning · balanced)
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                                (populated at run time)
```

## Pattern: single agent

```
   thread + our_team_domain
              |
      thread_synthesizer            (SESSION fresh, reasoning · balanced)
              |
           outputs
```

## Inputs

```json
{
  "thread": [
    { "from": "sarah@bigco.example", "ts": "2026-04-28T09:14:00Z", "body": "..." }
  ],
  "our_team_domain": "acme.example"
}
```

## Outputs

`outputs.json` matches the schema in `WORKFLOW.md`:

```json
{
  "tldr_md": "# TL;DR ...",
  "participants": [
    { "email": "alex@acme.example", "role": "us" },
    { "email": "sarah@bigco.example", "role": "customer" }
  ],
  "open_questions": ["..."],
  "commitments": [
    { "who": "alex@acme.example", "what": "Send updated webhook config", "when": "2026-05-08" }
  ],
  "sentiment": "at_risk",
  "suggested_reply_md": "...",
  "suggested_reply_tone": "escalate"
}
```

## Tone selection

- `escalate` — `sentiment=at_risk` and our last two replies did not
  address the customer's core question.
- `empathetic` — customer expresses frustration in their latest message.
- `concise` — otherwise.

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/09-email-thread-summarize
   ```

2. Seed a run:

   ```
   mkdir -p examples/09-email-thread-summarize/runs/local-001
   cp examples/09-email-thread-summarize/__fixtures__/sample-inputs.json \
      examples/09-email-thread-summarize/runs/local-001/inputs.json
   ```

3. In a Claude Code session, load the `caboc-runtime` skill and ask:

   > run routine `examples/09-email-thread-summarize` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect:

   ```
   npx caboc inspect examples/09-email-thread-summarize/runs/local-001/
   ```

## License

Apache-2.0.
