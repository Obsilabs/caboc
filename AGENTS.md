# AGENTS.md — guidance for AI assistants working in this repo

This file is read by AI coding assistants (Claude Code, Cursor, Codex
CLI, Gemini CLI, etc.) when they enter the repository. It is short on
purpose — read it, then read `docs/norms/`.

## What this repository is

CABOC — Common AI Business Oriented Convention. A markdown-only DSL for
AI workflows that an LLM main loop executes directly. Routines live in
directories, agents are markdown files with a system-prompt body, and
runs persist as NDJSON transcripts. The repository ships:

- `packages/cli/` — the `caboc` CLI exposed as `npx @caboc/cli`.
- `skills/caboc-runtime/` — the SKILL.md installable via `npx skills add caboc-runtime`.
- `examples/` — runnable canonical routines.
- `docs/norms/` — project conventions (naming, code, commits, PR, releases, tests, docs, security, routines, licensing).

## Hard rules — apply unconditionally

1. **Never name an LLM model.** No `claude-`, `gpt-`, `gemini-`,
   `mistral-`, `llama-`, `opus`, `sonnet`, `haiku` literals in any file
   under `routines/`, `examples/`, `skills/`, or `agents/`. Capabilities
   (`reasoning`, `classification`, `structured_extraction`, `vision`)
   and tiers (`fast`, `balanced`, `deep`) are the only abstractions
   allowed.
2. **Apache 2.0.** Every TypeScript source file starts with the two
   SPDX header lines (see `docs/norms/STANDARDS_LICENSING.md`).
3. **Strict TypeScript.** Every package extends `tsconfig.base.json`.
   No `any`. Validate at boundaries with Zod.
4. **Conventional Commits.** PR titles and commit subjects follow the
   format defined in `docs/norms/STANDARDS_COMMITS.md`.
5. **No tools in v0.1.** The runtime executes `USE AGENT` only.
   `USE TOOL` is deferred to v0.2.
6. **Inline frontmatter schemas.** Each `*.agent.md` declares its
   `io.outputs` schema inline (YAML JSON Schema) so the validator can
   enforce it at lint time.

## Layout cheat-sheet

```
/                            root config + license + AGENTS.md
docs/norms/                  conventions (read first)
packages/cli/                @caboc/cli — `npx caboc <cmd>`
skills/caboc-runtime/        SKILL.md installable via `npx skills add`
examples/<NN>-<slug>/        runnable example routines
```

## Workflow when adding a feature

1. Read the relevant `docs/norms/STANDARDS_*.md`.
2. Open or extend a package under `packages/` or an example under
   `examples/`.
3. Run `pnpm lint && pnpm typecheck && pnpm test` from the repo root.
4. Open a PR titled per Conventional Commits.

## When in doubt

- Naming → `docs/norms/STANDARDS_NAMING.md`
- Code style → `docs/norms/STANDARDS_CODE.md`
- Tests → `docs/norms/STANDARDS_TESTS.md`
- Routine layout → `docs/norms/STANDARDS_ROUTINES.md`
- Licensing + SPDX → `docs/norms/STANDARDS_LICENSING.md`
- Anything else → `docs/norms/README.md`

If a convention is missing or contradictory, file an RFC PR against
`docs/norms/` rather than working around it silently.
