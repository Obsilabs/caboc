# STANDARDS_ROUTINES — Routine + agent contracts

> Status: draft v0.2 (updates v0.1 to reference the v0.2 grammar +
> companion norms)
> Scope: every routine directory under `routines/` or `examples/`.

For the full body grammar see `STANDARDS_GRAMMAR.md`. For specific
constructs:

- `USE TOOL` — `STANDARDS_TOOLS.md`
- `LOOP` / `FOR_EACH` / `PARALLEL CONCURRENCY` / `BREAK` / `SET` — `STANDARDS_LOOPS.md`
- `STEP HITL` / `PROMPT TO` / `AWAIT FROM human` — `STANDARDS_HITL.md`
- `INVOKE WORKFLOW` — `STANDARDS_SUBROUTINES.md`
- File-typed outputs + `scratch_dirs:` + `caboc bundle` — `STANDARDS_OUTPUTS.md`
- `provider_role:` on agents + `caboc.config.json.roles` — `STANDARDS_PROVIDER_ROLES.md`
- `caboc add` + `routines.lock` — `STANDARDS_DISTRIBUTION.md`
- `caboc run <alias>` resolution — `STANDARDS_ALIASES.md`

## 1. Routine layout

```
<routine-dir>/
├── WORKFLOW.md                workflow definition (mandatory)
├── agents/
│   └── <agent-id>.agent.md    one or more agents (mandatory if WORKFLOW.md uses USE AGENT)
├── __fixtures__/              sample inputs + expected outputs (recommended)
│   ├── sample-inputs.json
│   └── expected-outputs.json
├── runs/                      run artefacts (populated at exec; gitignored except .gitkeep)
└── README.md                  human-facing doc (mandatory)
```

Optional:

- `schemas/` — external JSON Schema or `.zod.ts` files referenced by
  `$ref` from frontmatter.
- `package.json` — workspace marker if the routine is published.

## 2. WORKFLOW.md frontmatter (mandatory fields)

```yaml
---
workflow: <kebab-case-id>
version: <semver>
spec_version: caboc-llm/0.1.0
description: |
  Single paragraph explaining what the routine does.

io:
  inputs:
    <name>: { type: <t>, ... }
  outputs:
    <name>: { type: <t>, ... }

budget:
  tokens: <int>          # soft cap, runtime emits warning past threshold
  wall_minutes: <int>    # soft cap, runtime emits warning past threshold
---
```

Optional:

- `triggers:` — HTTP / queue / event / cron declarations (informational
  in v0.1; consumed by hosted runtimes in v0.2).
- `attestation:` — signing + redaction config (v0.2+).
- `memory:` — namespace-shared facts schema (v0.2+).

## 3. WORKFLOW.md body grammar (subset accepted by v0.1 runtime)

```
PROCEDURE.

  STEP <name> <modifier+>.
    <statements>
  END STEP.

  ...

END PROCEDURE.

END WORKFLOW.
```

Allowed step modifiers:

- `DETERMINISTIC` — pure read or compute.
- `NON_DETERMINISTIC` — calls an agent or external surface.
- `HITL` — human-in-the-loop (paused on AWAIT FROM human signal).
- `COMPENSATABLE` — pairs with a DEFER block.
- `PRIVATE` — witness redaction at L4 (v0.2+).
- `MULTIPARTY` — N-of-M signing (v0.2+).

Allowed statements inside a STEP body:

- `DESCRIPTION. <quoted-or-prose>.`
- `USE AGENT <ref> [SESSION fresh|continuous(<step>)|fork(<step>)] WITH inputs={...}.`
- `LET <name> := <expr>.`
- `<name> := <expr>.` (re-assignment of a declared name)
- `OUTPUT <name>(, <name>)*.`
- `EMIT <name> := <expr>.` or `EMIT <name>(, <name>)*.`
- `IF <expr> THEN ... [ELSE IF ... THEN ...]* [ELSE ...] END IF.`
- `GOTO step.<name>.`
- `ASSERT <expr>.`

Block constructs at the PROCEDURE level:

- `PARALLEL JOIN_POLICY=<all|first|majority|quorum:N>. <inner-steps> END PARALLEL.`

Out of scope in v0.1: `USE TOOL`, `TRANSACTION`, `TRY/CATCH/FINALLY`,
`FOR_EACH`, `INVOKE WORKFLOW`, `DEFER`, `WITNESS`, `ATTESTATION`,
`REQUIRE_SIGNATURES_FROM`, `SLEEP`, `WITHIN BUDGET`.

## 4. Agent file (`<agent-id>.agent.md`) frontmatter (mandatory fields)

```yaml
---
agent: <kebab-case-id>
version: <semver>
spec_version: caboc-llm/0.1.0
description: <one line>

session:
  capability: reasoning | classification | structured_extraction | vision
  tier: fast | balanced | deep
  allowed_modes: [fresh, continuous, fork]

io:
  inputs:
    <name>: { type: <t>, ... }
  outputs:
    <name>: { type: <t>, ... }   # MUST declare a schema (no unstructured strings)
---
```

The body of an agent file is the **system prompt** for that agent.
Plain markdown. Reference inputs by name in the prompt text. Include a
short "## Output contract" section that mirrors the frontmatter schema
in human-readable form.

## 5. Constraints (lint-enforced)

- No LLM model literals anywhere in the routine.
- Every `USE AGENT <ref>` resolves to a sibling `agents/<ref>.agent.md`.
- Every agent's `io.outputs` declares a schema. Free-text fields are
  bounded with `maxLength`.
- Every workflow's `io.inputs` and `io.outputs` declares a schema.
- `SESSION continuous(<step>)` references a step that is guaranteed to
  have executed on the current control-flow path (best-effort static
  check; runtime falls back to `fresh` on missing reference and emits a
  warning event).

## 6. Run artefacts

Every run produces:

```
runs/<run-id>/
├── inputs.json          frozen inputs (as received)
├── state.json           latest bindings + step pointer (overwritten)
├── transcript.ndjson    append-only NDJSON event log
├── outputs.json         contract outputs (written at terminal step)
├── error.json           optional, on failure
└── sessions/
    └── <agent-id>.transcript.json   for SESSION continuous mode
```

Run-id format: `YYYYMMDD-HHmmss-<6 [a-z0-9]>`.

## 7. Forbidden in routine source

- Hardcoded provider URLs, API keys, tokens.
- File reads outside the routine directory (the runtime enforces this).
- Inline JavaScript or shell escape hatches.
- Comments referencing specific model names.

## 8. Versioning

- `version:` in WORKFLOW.md and in each agent file uses semver.
- Breaking changes to the workflow's `io.inputs` or `io.outputs` bump
  the major.
- Tightening an output schema is a major (consumers may depend on the
  looser shape).
- Loosening an output schema is a minor.
- Pure prose changes to an agent's body are a patch.
