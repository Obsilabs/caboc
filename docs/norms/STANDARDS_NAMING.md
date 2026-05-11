# STANDARDS_NAMING — Naming conventions

> Status: draft v0.1
> Scope: every public-facing identifier — packages, files, symbols, env vars, CLI flags, error codes, log keys, routine + agent identifiers.

## 1. Why this exists

Every cross-cutting symbol must be predictable from name alone. A reader
who sees `CABOC_RUN_ID` should know it is an env var, where it is read,
and what shape it takes — without grep.

## 2. Package names (npm)

### 2.1 Scope

All first-party packages live under the `@caboc/` scope on npm. The
unscoped root name `caboc` is reserved for the CLI bin alias only (the
package itself is `@caboc/cli`).

### 2.2 Reserved single-segment first-party packages

| Package                     | Description                                         |
| --------------------------- | --------------------------------------------------- |
| `@caboc/cli`                | The `caboc` CLI (`init`, `lint`, `run`, `inspect`). |
| `@caboc/runtime`            | Programmatic runtime helpers (planned, v0.2).       |
| `@caboc/skill-runtime`      | Skill package marker shipped with `skills/caboc-runtime/`. |
| `@caboc/conformance`        | Conformance suite shared with downstream runtimes (planned). |

Adding a new single-segment package requires a norm update + a reservation
on npm.

### 2.3 Kinded packages

For routines and examples published as packages:

```
@caboc/example-<slug>      e.g. @caboc/example-commit-message
@caboc/routine-<slug>      community-contributed routines
```

### 2.4 Community packages

Community-published packages must **not** use the `@caboc/` scope. They
follow `caboc-<kind>-<slug>` unscoped (e.g. `caboc-routine-pr-triage`).

### 2.5 Forbidden

- `@caboc/core` (the SDK root is not a package today; if added it will be `@caboc/runtime`).
- Plurals (`@caboc/skills-runtime`, `@caboc/examples-*`).
- Mixed kinds in one package.

## 3. File names

### 3.1 Source files

- TypeScript source: `kebab-case.ts` (e.g. `cmd-lint.ts`, `parse-frontmatter.ts`).
- TypeScript test: `<source>.test.ts` (sibling of source, never `.spec.ts`).
- Index barrels: `index.ts` only — never `mod.ts` or `main.ts`.
- Test fixtures: `__fixtures__/` directory next to the test that uses them.

### 3.2 Markdown files in routines

- Workflow root: `WORKFLOW.md` (uppercase, exact).
- Agent: `<agent-id>.agent.md` (kebab-case agent id).
- Skill: `SKILL.md` (uppercase, exact).
- Tool manifest (v0.2): `TOOL.md` (uppercase, exact).

### 3.3 Folder names

- Routines: `<NN>-<slug>` where `NN` is a two-digit ordinal (`01-commit-message`, `02-support-triage`). Ordinals are stable once published; gaps allowed when a routine is retired.
- Packages: kebab-case directory matching the unscoped portion of the package name (`packages/cli`, `packages/runtime`).

## 4. Identifier shapes

| Kind                | Pattern                                                       | Example                          |
| ------------------- | ------------------------------------------------------------- | -------------------------------- |
| Routine id          | kebab-case, `<noun-or-verb>_<qualifier>`                      | `commit_message`, `support_ticket_triage` |
| Agent id            | kebab-case, `<role>_<qualifier>?`                             | `commit_drafter`, `intent_classifier` |
| Step name           | snake_case verb-phrase                                        | `extract_decisions`, `synthesize` |
| Workflow contract output key | snake_case                                          | `final_status`, `assigned_team`  |
| Env var             | `CABOC_<SCREAM_CASE>`                                         | `CABOC_RUN_ID`, `CABOC_DEBUG`    |
| Error code          | `CABOC_E_<CATEGORY>_<NAME>`                                   | `CABOC_E_ROUTINE_NOT_FOUND`      |
| CLI flag            | `--kebab-case`                                                | `--inputs`, `--run-id`           |

## 5. Capability names (reserved closed set)

Routines and agents reference capabilities by name only. The closed set
in v0.1:

| Capability               | Use                                                 |
| ------------------------ | --------------------------------------------------- |
| `reasoning`              | Multi-step thinking, drafting, synthesis.           |
| `classification`         | Pick one bucket from a closed set.                  |
| `structured_extraction`  | Pull typed objects from text.                       |
| `vision`                 | Reason about an image referenced by URL.            |

Adding a capability requires a norm update.

## 6. Tier names (reserved closed set)

| Tier      | Use                                              |
| --------- | ------------------------------------------------ |
| `fast`    | Latency-bound, simple structured extraction.     |
| `balanced`| Default for most reasoning + drafting.           |
| `deep`    | Long-context, hard synthesis, audit-grade work.  |

## 7. Forbidden

- Model literals anywhere in routine, agent, skill, example, or doc
  files (`claude-`, `gpt-`, `gemini-`, `mistral-`, `llama-`, `opus`,
  `sonnet`, `haiku`).
- Provider names in routine bodies (`anthropic`, `openai`, `google`,
  `mistral`, `meta`).
- Mixed casing in identifiers (e.g. `commitDrafter` instead of
  `commit_drafter`).
