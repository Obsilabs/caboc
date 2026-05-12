# Example 10 — content-moderation-text

A standalone CABOC routine that scores a piece of user-generated text
against 8 trust-and-safety policy buckets, proposes a verdict
(`allow` / `shadow_ban` / `block` / `takedown`), surfaces the verbatim
phrases that drove the scores, and decides whether the case still needs
a human reviewer.

## Pattern

Single LLM agent followed by a deterministic routing step that promotes
borderline-but-impactful cases (takedowns, blocks on older accounts) to
human review. Demonstrates conditional routing (`IF` / `ELSE IF` /
`ELSE`) without spawning a second agent.

## Layout

```
10-content-moderation-text/
├── WORKFLOW.md
├── agents/
│   └── moderator.agent.md
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                       (populated at run time)
```

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/10-content-moderation-text
   ```

2. Seed a run directory:

   ```
   mkdir -p examples/10-content-moderation-text/runs/local-001
   cp examples/10-content-moderation-text/__fixtures__/sample-inputs.json \
      examples/10-content-moderation-text/runs/local-001/inputs.json
   ```

3. In a Claude Code session, load the `caboc-runtime` skill and ask:

   > run routine `examples/10-content-moderation-text` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect the transcript and outputs:

   ```
   npx caboc inspect examples/10-content-moderation-text/runs/local-001/
   ```

## Verdict rubric (summary)

Applied in order, first match wins:

1. `csam >= 0.05` -> `takedown` (never overturnable).
2. Any score `>= 0.85` -> `block`.
3. Sum of scores `>= 0.55` totals `>= 1.2` -> `shadow_ban`.
4. Otherwise -> `allow`.

## Human-review routing

The `route` step promotes a case to human review when:

- `verdict = takedown` (always reviewed), or
- `verdict = block` and `account_age_days > 90` (established accounts
  warrant a closer look before a hard block), or
- the agent itself flagged it (any score in the 0.55 - 0.85 uncertain
  zone).

The workflow can only escalate to review — it never downgrades the
agent's `true` to `false`.

## Notes

- Inputs are pure strings + integers. No tools, no network, no MCP.
- CSAM signals are never overturnable, never downgradable, and never
  subject to `policy_summary` override.
- `flagged_phrases` are verbatim substrings of the input text, not
  paraphrases — they must be safe to log for downstream review.

## License

Apache-2.0.
