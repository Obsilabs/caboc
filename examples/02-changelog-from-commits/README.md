# Example 02 — changelog-from-commits

A standalone CABOC routine that turns a list of Conventional Commits
messages into a user-facing CHANGELOG entry, with an inferred semver
bump and pre-grouped sections (Features / Fixes / Breaking / Notes).

## Why this example

- Still self-contained — input is `commits: string[]`. No tools, no
  network, no MCP.
- Single agent, one structured-JSON output, but exercises richer
  categorization and audience-tuned prose than example 01.
- Recognizable — every release manager has hand-stitched a CHANGELOG.

## Layout

```
02-changelog-from-commits/
├── WORKFLOW.md
├── agents/
│   └── changelog_writer.agent.md
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                       (populated at run time)
```

## Inputs

```json
{
  "commits": [
    "feat(api): add cursor-based pagination",
    "fix(parser): handle empty token stream"
  ],
  "since_version": "1.4.0",
  "audience": "users"
}
```

- `commits` — array of Conventional Commits subjects. Body (after a
  blank line within the same string) is optional and used to detect
  `BREAKING CHANGE` and to extract migration hints.
- `since_version` — optional. When present, the agent advances it per
  the inferred bump and uses the result as the markdown heading.
- `audience` — `users` (default), `developers`, or `all`. Tunes how
  technical the rewritten bullets are.

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/02-changelog-from-commits
   ```

2. Create a run directory and seed it with inputs:

   ```
   mkdir -p examples/02-changelog-from-commits/runs/local-001
   cp examples/02-changelog-from-commits/__fixtures__/sample-inputs.json \
      examples/02-changelog-from-commits/runs/local-001/inputs.json
   ```

3. In a Claude Code session, load the `caboc-runtime` skill and ask:

   > run routine `examples/02-changelog-from-commits` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect the resulting transcript and outputs:

   ```
   npx caboc inspect examples/02-changelog-from-commits/runs/local-001/
   ```

## Expected outputs

`outputs.json` matches the schema declared in `WORKFLOW.md`:

```json
{
  "version_bump": "minor",
  "sections": {
    "features": ["..."],
    "fixes": ["..."],
    "breaking": [],
    "notes": ["..."]
  },
  "markdown": "## 1.5.0\n\n### Features\n- ..."
}
```

## Notes on `version_bump`

- `major` — any input commit contains `BREAKING CHANGE` or a `!` after
  the type/scope.
- `minor` — at least one `feat:` commit and no breaking change.
- `patch` — only `fix:` / `perf:` / `refactor:` / `chore:` and friends.

## License

Apache-2.0.
