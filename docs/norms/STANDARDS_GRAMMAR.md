# STANDARDS_GRAMMAR — CABOC body grammar v0.2

> Status: draft v0.2
> Scope: the complete body grammar consumed by the `caboc-llm` skill
> (the LLM-runtime SKILL.md) and validated by `caboc lint`.

## 1. Why this exists

`caboc-llm/0.1.0` froze a minimal subset. v0.2 extends it for tools,
loops, fanout, HITL, subroutines, and file-typed outputs. This file is
the canonical grammar reference; every other norm references it.

A routine targets `spec_version: caboc-llm/0.2.0`. Routines on `0.1.0`
keep running on a v0.2 runtime — the v0.1 subset is a strict subset of
v0.2.

## 2. Top-level shape

```
---
<frontmatter YAML — see STANDARDS_ROUTINES §2>
---

# <Title>

<Prose>

PROCEDURE.
  <stmt>*
END PROCEDURE.

[QUERIES.
  <query-decl>*
END QUERIES.]

[SIGNALS.
  <signal-decl>*
END SIGNALS.]

END WORKFLOW.
```

## 3. Statements — v0.2 closed set

Inside `PROCEDURE.`:

| Statement                                              | Norm reference            |
| ------------------------------------------------------ | ------------------------- |
| `STEP <name> <modifier+>. <body> END STEP.`            | this doc §4               |
| `DESCRIPTION. <quoted-or-prose>.`                      | this doc §5               |
| `LET <name> := <expr>.`                                | this doc §6               |
| `SET <name> := <expr>.`                                | `STANDARDS_LOOPS` §8      |
| `OUTPUT <name>(, <name>)*.`                            | this doc §7               |
| `OUTPUT { <name>(, <name>)* } FROM <bound-name>.`      | this doc §7 (rename form) |
| `EMIT <name> := <expr>.` / `EMIT <name>(, <name>)*.`   | this doc §8               |
| `IF <expr> THEN ... [ELSE IF ...]* [ELSE ...] END IF.` | this doc §9               |
| `GOTO step.<name>.`                                    | this doc §10              |
| `ASSERT <expr>.`                                       | this doc §11              |
| `USE TOOL <pkg>.<export>[.<method>] WITH inputs={...} [IDEMPOTENT BY <expr>] .` | `STANDARDS_TOOLS`         |
| `USE AGENT <ref> [SESSION fresh|continuous(<step>)|fork(<step>)] WITH inputs={...} [PROVIDER_ROLE <id>] .` | `STANDARDS_ROUTINES` §4 / `STANDARDS_PROVIDER_ROLES` §6 |
| `LOOP UNTIL <expr> MAX_ITERATIONS N DO ... END LOOP.`  | `STANDARDS_LOOPS` §2      |
| `LOOP WHILE <expr> MAX_ITERATIONS N DO ... END LOOP.`  | `STANDARDS_LOOPS` §2      |
| `REPEAT N DO ... END REPEAT.`                          | `STANDARDS_LOOPS` §3      |
| `FOR_EACH <var> IN <coll> [PARALLEL CONCURRENCY=<n>] [COLLECT INTO ...] DO ... END FOR_EACH.` | `STANDARDS_LOOPS` §4-6    |
| `BREAK.` / `CONTINUE.`                                 | `STANDARDS_LOOPS` §7      |
| `PARALLEL JOIN_POLICY=<all|first|majority|quorum:N>. <inner-steps> END PARALLEL.` | this doc §12 |
| `TRY. ... CATCH <error>(, <error>)*. ... [CATCH ANY <var>. ...] [FINALLY. ...] END TRY.` | this doc §13 |
| `INVOKE WORKFLOW <name> WITH inputs=<expr> [TIMEOUT <duration>] [PROVIDER_ROLES <override>] .` | `STANDARDS_SUBROUTINES`   |
| `PROMPT TO role=<role> [WITH context=<expr>] [WITH inputs=<expr>] .` | `STANDARDS_HITL`          |
| `AWAIT <var> FROM human WITHIN <duration> [ROUTE { case -> step.X }] [ON_TIMEOUT escalate TO <role>] .` | `STANDARDS_HITL`          |
| `ATTESTATION captured [WITH layer=L0..L4 [PRIVATE]] .` | this doc §14 (deferred semantics) |

## 4. STEP

```
STEP <name> <modifier>+.
  <body-stmt>*
END STEP.
```

Modifiers (one or more, space-separated):

- `DETERMINISTIC` — pure compute or `deterministic-pure`/`deterministic-read` tool calls; replay re-executes byte-identically.
- `NON_DETERMINISTIC` — may call `USE AGENT` or `non-deterministic-write` tool methods.
- `COMPENSATABLE` — pairs with a `DEFER` block (v0.3+) or a `TRY` catch.
- `HITL` — see `STANDARDS_HITL`.
- `PRIVATE` — witness redacted from attestation export (audit-grade).
- `MULTIPARTY` — N-of-M signing (v0.3+).

## 5. DESCRIPTION

```
DESCRIPTION. "Single quoted-string text".
DESCRIPTION. Free-form prose until a sentinel keyword.
```

Both forms are accepted. The free-form form ends at the next
statement-starting keyword on a new line.

## 6. LET

```
LET <name> := <expr>.
```

Declares a step- or procedure-scoped binding. Shadowing inside loops is
permitted; re-declaration at the same scope is `CABOC_E_REDECLARED`.

## 7. OUTPUT

Two forms.

### 7.1 Positional

```
OUTPUT <name>(, <name>)*.
```

Destructures the most-recent `USE AGENT` / `USE TOOL` result. Each
`<name>` must match a top-level key in the returned object. Validator
checks against the agent's `io.outputs` schema.

### 7.2 Rename form (v0.2)

```
OUTPUT { <alias>: <field>(, <alias>: <field>)* } FROM <bound-name>.
```

Or sugar:

```
USE AGENT planner ... OUTPUT_AS plan.
```

Lets the workflow flatten member-chain references like
`plan_out.classification.plan` → `plan`.

## 8. EMIT

```
EMIT <name>(, <name>)*.
EMIT <name> := <expr>.
EMIT signal TO workflow=<name> WITH inputs={...}.
EMIT alert TO <member> WITH severity=<level>, <error>.
```

Writes to the workflow contract output (form 1 binds local names; form
2 writes a single field; forms 3-4 fire async signals/alerts).

## 9. IF / ELSE IF / ELSE

```
IF <expr> THEN
  <stmt>*
[ELSE IF <expr> THEN
  <stmt>*]*
[ELSE
  <stmt>*]
END IF.
```

Conditions are evaluated against the visible scope (LET bindings, EMIT
fields, agent output bindings).

## 10. GOTO

```
GOTO step.<name>.
```

Discouraged in v0.2 outside saga/finalize patterns. Use `LOOP UNTIL`
+ `BREAK` instead of GOTO-back loops.

## 11. ASSERT

```
ASSERT <expr>.
```

Throws `CABOC_E_ASSERT_FAILED` with the expression text in the
transcript. Always emitted into NDJSON as `assertion.failed` on miss.

## 12. PARALLEL block

```
PARALLEL JOIN_POLICY=<all|first|majority|quorum:N>.
  STEP a NON_DETERMINISTIC. ... END STEP.
  STEP b NON_DETERMINISTIC. ... END STEP.
  ...
END PARALLEL.
```

Inner STEPs are spawned concurrently. The runtime applies the
join-policy threshold; on miss the workflow throws
`CABOC_E_PARALLEL_QUORUM_NOT_MET`.

`PARALLEL` is the **fixed-cardinality** sibling of
`FOR_EACH ... PARALLEL CONCURRENCY=N` (see `STANDARDS_LOOPS` §5 — the
latter is dynamic over a runtime-sized collection).

## 13. TRY / CATCH / FINALLY (v0.2)

```
TRY.
  <stmt>*
CATCH <error-code>(, <error-code>)*.
  <stmt>*
[CATCH ANY <var>.
  <stmt>*]
[FINALLY.
  <stmt>*]
END TRY.
```

`<error-code>` matches the `CABOC_E_*` or tool-emitted error codes.
Catches inside loops do not break iteration; use `BREAK` for that.

## 14. ATTESTATION

```
ATTESTATION captured [WITH layer=L0..L4 [PRIVATE]].
```

Marks the step output for inclusion in the run's attestation chain.
Cryptographic layer semantics deferred to a future
`STANDARDS_ATTESTATION` norm; v0.2 runtime treats this as documentation
and persists a `step.attestation` event in the NDJSON transcript.

## 15. Expressions

Stdlib closed set, GD1 from the v0.1 grammar (kept verbatim) plus v0.2
additions.

### 15.1 Literals

`123`, `1.5`, `"text"`, `TRUE`, `FALSE`, `{ key: value, ... }`,
`[<expr>, ...]`.

### 15.2 References

- `<ident>` — local binding or workflow input.
- `<expr>.<field>` — member access.
- `<expr>[<index>]` — array indexing (v0.2 add).
- `<expr>.length` — array length (v0.2 add).
- `workflow.run_id`, `workflow.failed_step` — runtime context refs.
- `memory.<field>` — namespace/workflow memory (v0.3+).
- `$input.<field>` — alias for workflow inputs.
- `$output.<field>` — alias for most-recent USE result.
- `_iteration` — inside a loop body, the 1-indexed iteration counter.

### 15.3 Operators

- Arithmetic: `+`, `-`, `*`, `/`, `%`, `ABS`, `ROUND`, `MIN`, `MAX`, `COALESCE`.
- Boolean: `AND`, `OR`, `NOT`, `=`, `!=`, `<`, `<=`, `>`, `>=`, `IN`, `NOT IN`, `BETWEEN`, `IS NULL`, `IS NOT NULL`.
- String: `CONCAT`, `LENGTH`, `STARTS_WITH`, `ENDS_WITH`, `MATCHES`, `LOWER`, `UPPER`, `TRIM`.
- Array: `COUNT`, `SUM`, `AVG`, `FILTER`, `MAP`, `INCLUDES`, `FIRST`, `LAST`, `LENGTH(arr)`.
- Object: `GET`, `KEYS`, `MERGE`.
- Time: `NOW()`, `DURATION(a, b)`, `BEFORE(a, b)`, `AFTER(a, b)`, `WITHIN(a, window)`.
- Ternary: `IF cond THEN a ELSE b END`.
- Builtins (v0.2 add): `range(start, end)`, `uuid()`.

## 16. Frontmatter cross-reference

| Frontmatter section          | Norm                          |
| ---------------------------- | ----------------------------- |
| `workflow:`, `agent:`, `tool:` | `STANDARDS_ROUTINES`, `STANDARDS_TOOLS`, `STANDARDS_NAMING` |
| `io.inputs` / `io.outputs`   | this doc §7, `STANDARDS_OUTPUTS` |
| `session.{capability, tier}` | `STANDARDS_ROUTINES` §4, `STANDARDS_PROVIDER_ROLES` |
| `provider_role:`             | `STANDARDS_PROVIDER_ROLES`    |
| `scratch_dirs:`              | `STANDARDS_OUTPUTS` §6        |
| `imports:`                   | `STANDARDS_ROUTINES` §4, `STANDARDS_TOOLS` |
| `budget:`                    | `STANDARDS_ROUTINES` §2       |
| `trust:`, `attestation:`     | future `STANDARDS_ATTESTATION` |
| `memory:`                    | v0.3+                         |
| `triggers:`                  | `STANDARDS_ROUTINES` §2       |

## 17. Spec version compatibility

- `caboc-llm/0.1.x` — minimal subset. Body: STEP / USE AGENT /
  LET / Assign / OUTPUT / EMIT / IF / GOTO / DESCRIPTION / ASSERT +
  PARALLEL with fixed inner-step count.
- `caboc-llm/0.2.x` — everything in §3. Adds USE TOOL, LOOP,
  FOR_EACH/PARALLEL/COLLECT INTO, BREAK/CONTINUE, INVOKE WORKFLOW,
  HITL block, TRY/CATCH/FINALLY, file-typed outputs, provider_role,
  array indexing + `.length`, SET, OUTPUT rename form.
- Major bumps are breaking. Minor bumps add keywords without removing
  any. A routine on `0.1.0` runs unchanged on `0.2.x`.

## 18. References

- `STANDARDS_ROUTINES` — frontmatter contracts.
- `STANDARDS_TOOLS` — USE TOOL semantics.
- `STANDARDS_LOOPS` — loops, fanout, SET, BREAK / CONTINUE.
- `STANDARDS_HITL` — PROMPT TO + AWAIT FROM.
- `STANDARDS_SUBROUTINES` — INVOKE WORKFLOW.
- `STANDARDS_OUTPUTS` — file / file_array, scratch_dirs, bundle.
- `STANDARDS_PROVIDER_ROLES` — agent role mapping.
- `STANDARDS_ALIASES` — `caboc run` resolution.
- `STANDARDS_DISTRIBUTION` — `caboc add` + lockfile.
