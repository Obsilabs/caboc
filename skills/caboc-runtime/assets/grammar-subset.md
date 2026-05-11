# CABOC runtime — supported body grammar

This is the subset of CABOC v0.2 the runtime skill interprets. Anything
outside this list is a hard error (`error.kind = "grammar.unsupported"`).

## Top-level structure

```
STEP <name> [modifier=value]*
  <construct>*
END STEP
```

STEPs are walked in source order. `GOTO step.<name>` overrides the next
pointer; otherwise control falls through to the next STEP.

Modifier examples (parser keeps them as a string-keyed object; the runtime
records them in `step.started.modifiers` but does not interpret them):
`retry=2`, `timeout=30s`.

## Constructs

### `DESCRIPTION`

```
DESCRIPTION "free text describing what this step does"
```

Logged to `step.description`. No effect on state.

### `LET`

```
LET <ident> = <expr>
```

Evaluates `<expr>` under the bind-expression grammar (see below) and binds
the result to `state.bindings[<ident>]`.

### `USE AGENT`

```
USE AGENT <ref> [SESSION <mode>] WITH inputs={ <kv>* }.
```

- `<ref>` resolves to `agents/<ref>.agent.md`.
- `SESSION <mode>` is one of `fresh` (default), `continuous(<step>)`,
  `fork(<step>)`.
- `<kv>` entries are `key: <expr>`. Each `<expr>` is evaluated before
  dispatch.

The trailing period is required.

### `OUTPUT`

```
OUTPUT <ident> FROM <agent-ref>
```

Binds the most recent return from `<agent-ref>` within the current STEP to
`state.bindings[<ident>]`. Errors if the agent has not run in this STEP.

### `EMIT`

```
EMIT <key> = <expr>
```

Writes `<expr>` to `state.outputs[<key>]`. These keys must match the
declared `io.outputs` schema at run-completion time.

### `IF` / `ELSE IF` / `ELSE` / `END IF`

```
IF <expr>
  <construct>*
ELSE IF <expr>
  <construct>*
ELSE
  <construct>*
END IF
```

Conditions are evaluated in order. First true branch runs; unselected
branches are skipped entirely (no events fire from them).

### `GOTO`

```
GOTO step.<name>
```

Sets `next_step` to `<name>`. Stops walking the current STEP body. The
referenced STEP must exist.

### `PARALLEL`

```
PARALLEL JOIN_POLICY=<policy>
  STEP <branch-name>
    USE AGENT <ref> WITH inputs={ ... }.
  END STEP
  STEP <branch-name>
    USE AGENT <ref> WITH inputs={ ... }.
  END STEP
END PARALLEL
```

Each inner STEP must contain exactly one `USE AGENT`. No nested control
flow inside a PARALLEL block.

`<policy>` is one of:
- `all` — wait for every branch.
- `first` — first success wins; others are discarded.
- `majority` — wait for `floor(N/2) + 1` successes (N = branch count).
- `quorum:K` — wait for exactly `K` successes (K is a literal integer).

### `ASSERT`

```
ASSERT <expr> [MESSAGE "<text>"]
```

Evaluates `<expr>`. If false, emits `assertion.failed` and fails the run.

## Bind expressions

Permitted forms only:

| form | example |
| --- | --- |
| literal | `42`, `"hi"`, `true`, `null`, `[1,2]`, `{a: 1}` |
| identifier | `severity` |
| member access | `result.findings[0].file` |
| arithmetic | `count + 1`, `wall_ms / 1000` |
| boolean | `ok && !skip`, `a || b` |
| comparison | `n >= 3`, `kind == "bug"` |
| string builtin | `CONCAT(a, "-", b)`, `LENGTH(items)` |
| min/max | `MIN(a, b)`, `MAX(a, b)` |
| coalesce | `COALESCE(maybe, fallback, "")` |
| ternary | `IF n > 0 THEN "yes" ELSE "no" END` |

No function calls beyond the listed builtins. No regex literals. No code
templates. No `eval`, no shell interpolation. If a routine needs anything
richer, the routine author should pre-compute it in an agent and bind the
result via `OUTPUT`.

## Whitespace and comments

- Lines starting with `#` are comments and ignored.
- Blank lines are ignored.
- Indentation inside STEPs is conventional only; the parser is whitespace-
  tolerant.
