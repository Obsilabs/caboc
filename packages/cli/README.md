# @caboc/cli

A tiny Node CLI for [CABOC](https://github.com/caboc) — a markdown-only DSL for AI workflows.

CABOC routines are directories of markdown files (workflow + agents). An LLM main loop (e.g. Claude Code) reads and executes them. This CLI does **not** run an LLM itself — it scaffolds new routines, lints them, prints the system prompt the runtime should consume, and inspects past runs.

## Install

```bash
npx @caboc/cli <cmd>
# or
npm i -g @caboc/cli
```

## Commands

### `caboc init <routine-name>`

Scaffold a new routine under `routines/<routine-name>/` with a starter `WORKFLOW.md` and a sample agent.

```bash
caboc init triage
```

### `caboc lint <routine-dir>`

Validate frontmatter, enforce the model-name denylist, and ensure every `USE AGENT <ref>` resolves to a sibling `agents/<ref>.agent.md`.

```bash
caboc lint routines/triage
```

Exits `0` on success, `1` on any failure. Prints `✓` per passed check and `✗ <file>:<line> — <reason>` per failure.

### `caboc run <routine-dir> --inputs <inputs.json>`

Prints the system prompt that an LLM-runtime should be fed to execute the routine. Also creates `runs/<run-id>/inputs.json` inside the routine directory and references that path in the prompt.

Pipe into Claude Code, paste into a chat — your call.

```bash
caboc run routines/triage --inputs ./issue.json | claude --print
```

### `caboc inspect <run-dir>`

Pretty-prints a summary of a completed run: event counts by kind, step durations, truncated `summary_md`, and any `assertion.failed` / `agent.repair` events.

```bash
caboc inspect routines/triage/runs/20260511-143022-a1b2c3
```

## Routine layout

```
routines/<name>/
├── WORKFLOW.md             # frontmatter (YAML) + PROCEDURE body
├── agents/
│   └── <agent>.agent.md    # frontmatter + system prompt body
└── runs/<run-id>/          # populated at exec
    ├── inputs.json
    ├── transcript.ndjson
    ├── outputs.json
    └── state.json
```

Body invocations are limited to:

```
USE AGENT <ref> [SESSION fresh|continuous|fork] WITH inputs={...}.
```

## License

Apache-2.0
