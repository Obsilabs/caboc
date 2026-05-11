# Example 01 — commit-message

A standalone CABOC routine that turns a unified diff into a
[Conventional Commits 1.0](https://www.conventionalcommits.org/) message,
with a body, a breaking-change flag, and per-part citations back to the
hunks that motivated each decision.

## Why this is the first example

- Self-contained — input is a string (`diff`). No tools, no network, no MCP.
- Single agent — one `USE AGENT` call, one structured-JSON output.
- Recognizable — every OSS contributor has written a commit message.
- Demonstrates the full minimum CABOC surface: frontmatter, `PROCEDURE`,
  `STEP`, `USE AGENT ... SESSION fresh`, `OUTPUT`, `EMIT`, `GOTO`.

## Layout

```
01-commit-message/
├── WORKFLOW.md
├── agents/
│   └── commit_drafter.agent.md
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                       (populated at run time)
```

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/01-commit-message
   ```

2. Create a run directory and seed it with inputs:

   ```
   mkdir -p examples/01-commit-message/runs/local-001
   cp examples/01-commit-message/__fixtures__/sample-inputs.json \
      examples/01-commit-message/runs/local-001/inputs.json
   ```

   `inputs.json` shape:

   ```json
   {
     "diff": "diff --git a/...",
     "repo_name": "acme-platform",
     "target_branch": "main"
   }
   ```

3. In a Claude Code session, load the `caboc-runtime` skill and ask:

   > run routine `examples/01-commit-message` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect the resulting transcript and outputs:

   ```
   npx caboc inspect examples/01-commit-message/runs/local-001/
   ```

## Expected outputs

`outputs.json` matches the schema declared in `WORKFLOW.md`:

```json
{
  "type": "fix",
  "scope": "pagination",
  "subject": "include final page item in range check",
  "body_md": "...why...",
  "breaking_change": false,
  "breaking_note": "",
  "confidence": 0.84
}
```

## Notes on `confidence`

- `>= 0.8` — the diff is single-concern and the message is unambiguous.
- `0.6 - 0.8` — message is reasonable; a human should still skim.
- `< 0.6` — the diff likely mixes concerns or is unusually large; consider
  splitting the commit before accepting the message.

## License

Apache-2.0.
