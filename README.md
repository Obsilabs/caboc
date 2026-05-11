<!--
SPDX-FileCopyrightText: 2026 CABOC contributors
SPDX-License-Identifier: Apache-2.0
-->

# CABOC — Common AI Business Oriented Convention

CABOC is a markdown-only DSL for describing AI workflows as a directory of
instructions that an LLM main loop (for example, Claude Code) executes
directly. There is no compilation step, no separate execution backend, and no
runtime VM. A workflow is a folder. An agent is a markdown file. A run is an
NDJSON transcript on disk.

## Pitch

- **Markdown-native.** Workflows and agents live in plain `.md` files with
  YAML frontmatter. Diff-friendly. Reviewable. Greppable.
- **LLM-executable.** The runtime is a thin skill the host LLM loads. The LLM
  itself drives the loop, spawning subagents per `USE AGENT` invocation.
- **Model-agnostic.** No model name is ever written in a `.caboc` or
  `.agent.md` file. Capabilities and tiers are abstract; the runtime resolves
  them.
- **Auditable.** Every run produces an NDJSON transcript under
  `routines/<name>/runs/<run-id>/` — inputs, outputs, agent calls, durations.
- **Open.** Apache 2.0. No vendor lock-in. No proprietary protocol.

## Quickstart

```sh
# 1. Add the CABOC runtime skill to your Claude Code install
npx skills add caboc-runtime

# 2. Run a CABOC routine
npx caboc run examples/01-code-review
```

The runtime loads the routine, validates frontmatter, and hands control to
the host LLM, which executes the workflow body step by step.

## Layout

```
caboc/
  packages/
    cli/              # `caboc` CLI entrypoint
    runtime/          # Runtime helpers shared by skill + CLI
    skill-runtime/    # The skill installed into Claude Code
  skills/             # Reusable skill bundles
  examples/           # End-to-end CABOC routines
  docs/
    norms/            # Project standards (start here)
  LICENSE
  NOTICE
```

## A workflow at a glance

```
routines/01-code-review/
  WORKFLOW.md         # PROCEDURE body with STEPs
  agents/
    reviewer.agent.md # System prompt + I/O schema
    summarizer.agent.md
  runs/               # NDJSON transcripts (gitignored)
```

`WORKFLOW.md` calls agents using a single-line invocation form:

```
USE AGENT reviewer SESSION fresh WITH inputs={ "diff": "$diff" }.
```

`SESSION` may be `fresh`, `continuous`, or `fork`. The runtime spawns one
subagent per invocation and persists the transcript.

## Standards and norms

Read `docs/norms/` before contributing. Start with:

- `docs/norms/README.md` — index of all norms
- `docs/norms/STANDARDS_ROUTINES.md` — how to write a CABOC routine
- `docs/norms/STANDARDS_CODE.md` — TypeScript baseline
- `docs/norms/STANDARDS_COMMITS.md` — Conventional Commits

## Contributing

See `CONTRIBUTING.md`. By contributing you agree to the Developer Certificate
of Origin (DCO) and the `CODE_OF_CONDUCT.md`.

## Security

Report vulnerabilities to `security@caboc.example`. See `SECURITY.md` for the
disclosure policy and SLAs.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.
