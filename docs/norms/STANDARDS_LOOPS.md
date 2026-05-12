# STANDARDS_LOOPS — Loops, fanout, BREAK/CONTINUE

> Status: draft v0.2
> Scope: every `WORKFLOW.md` written against CABOC spec v0.2 or later.
> License: Apache-2.0.

## 1. Why

CABOC v0.1 had no native looping. Authors emulated feedback loops
(writer → reviewer → writer), bounded retries, and parallel research
fanout by stitching `LABEL`/`GOTO` jumps. Those workarounds were
fragile: lint could not prove termination, runtimes could not emit
structured iteration telemetry, and parallelism had to be encoded as
ad-hoc `USE AGENT ... | USE AGENT ...` chains with no concurrency cap.

v0.2 makes loops first-class so that:

- termination bounds are syntactically visible (`MAX_ITERATIONS N`),
- parallel fanout has an explicit concurrency knob,
- per-iteration outputs collect into named arrays/maps without
  bespoke scratch state,
- linters can enforce that condition variables are actually mutated,
- runtimes emit consistent NDJSON events for every iteration.

Cross-reference: see [`STANDARDS_GRAMMAR`](./STANDARDS_GRAMMAR.md) for
the full v0.2 grammar, [`STANDARDS_ROUTINES`](./STANDARDS_ROUTINES.md)
for routine layout, and [`STANDARDS_HITL`](./STANDARDS_HITL.md) for
human-in-the-loop checkpoints that frequently terminate retry loops.

## 2. `LOOP UNTIL` / `LOOP WHILE`

Bounded condition loops. `MAX_ITERATIONS` is mandatory — there are no
unbounded loops in CABOC.

```caboc
LOOP UNTIL <expr> MAX_ITERATIONS N DO
  <statements>
END LOOP.

LOOP WHILE <expr> MAX_ITERATIONS N DO
  <statements>
END LOOP.
```

Semantics:

- `LOOP UNTIL` is exit-test (post-condition). The body runs at least
  once; loop terminates the first iteration where `<expr>` evaluates
  truthy at the bottom.
- `LOOP WHILE` is entry-test (pre-condition). The body may run zero
  times; loop terminates as soon as `<expr>` is falsy at the top.
- `MAX_ITERATIONS N` is a hard ceiling. Reaching it without natural
  termination raises `CABOC_E_LOOP_BUDGET_EXHAUSTED` and the routine
  aborts unless an `ON_BREACH` policy says otherwise (see §10).
- The 1-indexed iteration counter is exposed inside the body as the
  bound identifier `_iteration`.

## 3. `REPEAT N`

Fixed-count sugar over `LOOP WHILE _iteration <= N MAX_ITERATIONS N`.

```caboc
REPEAT 3 DO
  USE AGENT pinger WITH { attempt: _iteration } .
END REPEAT.
```

`N` must be a literal integer or a `LET`-bound constant resolvable at
parse time so the lint can statically derive the bound.

## 4. `FOR_EACH` (sequential)

Iterate over an array sequentially. The body sees `<var>` bound to the
current element.

```caboc
FOR_EACH chunk IN input.chunks DO
  USE AGENT summarizer WITH { text: chunk } .
  OUTPUT chunk_summary.
END FOR_EACH.
```

`_iteration` is also bound inside `FOR_EACH` bodies.

## 5. `FOR_EACH ... PARALLEL`

Concurrent fanout. The runtime spawns up to `<n>` Task subagents in
flight; new iterations start as slots free. Output ordering is
preserved by iteration index even when execution is interleaved.

```caboc
FOR_EACH source IN research.sources PARALLEL CONCURRENCY=4 DO
  USE AGENT fetch_and_extract WITH { url: source.url } .
  OUTPUT extracted.
END FOR_EACH.
```

Rules:

- `CONCURRENCY=<n>` is mandatory and must be a positive integer.
- Runtimes MAY cap `<n>` to a deployment-wide ceiling; doing so emits
  a `parallel.concurrency.capped` event but does not fail the routine.
- The body must not contain `BREAK` targeting a parallel loop — see §7.

## 6. `COLLECT INTO`

Per-iteration outputs are gathered into a named array or map declared
on the `FOR_EACH` header. The collector is mandatory for any
`FOR_EACH` whose results are consumed downstream.

Variants:

```caboc
FOR_EACH chunk IN input.chunks
  COLLECT INTO summaries: Array<Summary>
DO
  USE AGENT summarizer WITH { text: chunk } .
  OUTPUT summaries[_iteration] := summary.
END FOR_EACH.
```

```caboc
FOR_EACH src IN research.sources PARALLEL CONCURRENCY=4
  COLLECT INTO by_domain: Map<string, Extract> KEY src.domain
            DEFAULT { error: "skipped" }
DO
  USE AGENT extractor WITH { url: src.url } .
  OUTPUT extract.
END FOR_EACH.
```

- `Array<T>` collectors preserve iteration order even under PARALLEL.
- `Map<string, T> KEY <expr>` keys each cell by an expression
  evaluated against the current iteration scope.
- `DEFAULT <expr>` fills cells whose iteration errored, was `CONTINUE`d,
  or hit a per-iteration `WITHIN BUDGET ... ON_BREACH skip` (§10).

## 7. `BREAK` / `CONTINUE`

Exit or skip the current loop iteration. Scoped to the nearest
enclosing loop.

```caboc
FOR_EACH item IN inbox COLLECT INTO processed: Array<Result> DO
  IF item.kind = "ignore" THEN
    CONTINUE.
  END IF.
  IF item.kind = "halt" THEN
    BREAK.
  END IF.
  USE AGENT handler WITH { item: item } .
  OUTPUT result.
END FOR_EACH.
```

Interaction with `COLLECT INTO`:

- An iteration ended by `CONTINUE` emits nothing into an `Array<T>`
  collector and writes the `DEFAULT` (if any) into a `Map<string, T>`
  collector for its key.
- An iteration ended by `BREAK` emits nothing; the loop terminates
  immediately.
- Under `PARALLEL`, `BREAK` is rejected at lint time
  (`CABOC_E_BREAK_IN_PARALLEL`) because in-flight iterations cannot be
  meaningfully cancelled in order. Use a guard `IF ... THEN CONTINUE`
  pattern and post-loop filtering instead.

## 8. `SET` vs `LET`

`LET` declares a binding once. `SET` mutates a binding that `LET`
already created in an enclosing or current scope.

```caboc
LET loop_count := 0.        # declaration + initial bind
SET loop_count := loop_count + 1.   # mutation
```

- `SET` on a name that no `LET` declared raises
  `CABOC_E_SET_UNDECLARED`.
- A second `LET` of the same name in the same scope raises
  `CABOC_E_DOUBLE_DECLARATION`.
- Inside a loop body, `SET` on an outer-scope name persists across
  iterations (this is how counters and `satisfied` flags work). Inside
  a parallel iteration, `SET` mutates a per-iteration snapshot only —
  see §11.

## 9. Counter pattern (canonical retry idiom)

```caboc
LET loop_count := 0.
LET satisfied := false.

LOOP UNTIL satisfied OR loop_count >= 3 MAX_ITERATIONS 10 DO
  SET loop_count := loop_count + 1.

  USE AGENT reviewer WITH { draft: draft, prior: review } .
  OUTPUT review.

  IF review.verdict = "approve" THEN
    SET satisfied := true.
  ELSE
    USE AGENT writer WITH { draft: draft, feedback: review.notes } .
    OUTPUT draft.
  END IF.
END LOOP.
```

The redundant `loop_count >= 3` guard alongside `MAX_ITERATIONS 10`
is intentional: the inner guard is the business retry budget, the
outer `MAX_ITERATIONS` is the hard safety stop.

## 10. Per-iteration error budget

Each iteration MAY be wrapped in a `WITHIN BUDGET` block referencing
the routine-level budget definitions (see future
`STANDARDS_BUDGET`). The block declares an `ON_BREACH` policy:

```caboc
FOR_EACH src IN sources PARALLEL CONCURRENCY=4
  COLLECT INTO extracts: Array<Extract> DEFAULT { error: "skipped" }
DO
  WITHIN BUDGET per_call ON_BREACH skip DO
    USE AGENT extractor WITH { url: src.url } .
    OUTPUT extract.
  END WITHIN.
END FOR_EACH.
```

`ON_BREACH` values:

- `skip` — treat as if the iteration `CONTINUE`d. Collector receives
  `DEFAULT` (Map) or nothing (Array).
- `abort` — terminate the whole loop with
  `CABOC_E_ITERATION_BUDGET_EXHAUSTED`.
- `escalate` — hand the breach to the routine's HITL channel; see
  [`STANDARDS_HITL`](./STANDARDS_HITL.md).

## 11. State visibility under `PARALLEL FOR_EACH`

Each parallel iteration runs against a snapshot of its enclosing
scope captured at the moment the iteration was scheduled.

- Reads inside an iteration see that snapshot, not the running
  mutations of sibling iterations.
- `SET` inside an iteration mutates a local copy only. The copy is
  discarded when the iteration ends.
- The only sanctioned way to surface per-iteration results to the
  outer scope is `COLLECT INTO`.
- `OUTPUT` statements inside the body are scoped to the iteration's
  collector cell, not the routine-level outputs.

This is what makes `PARALLEL` safe to lint and safe to retry: there
is no shared mutable state across iterations.

## 12. Lint rules

| Rule code                            | Trigger                                                     |
|--------------------------------------|-------------------------------------------------------------|
| `CABOC_E_MAX_ITERATIONS_REQUIRED`    | `LOOP UNTIL` / `LOOP WHILE` without `MAX_ITERATIONS N`.     |
| `CABOC_E_BREAK_OUTSIDE_LOOP`         | `BREAK.` not lexically inside a loop body.                  |
| `CABOC_E_CONTINUE_OUTSIDE_LOOP`      | `CONTINUE.` not lexically inside a loop body.               |
| `CABOC_E_BREAK_IN_PARALLEL`          | `BREAK.` inside a `FOR_EACH ... PARALLEL` body.             |
| `CABOC_E_SET_UNDECLARED`             | `SET` of a name no enclosing `LET` declared.                |
| `CABOC_E_DOUBLE_DECLARATION`         | `LET` of a name already declared in the same scope.         |
| `CABOC_E_COLLECT_REQUIRED`           | `FOR_EACH` whose outputs flow downstream lacks `COLLECT INTO`. |
| `CABOC_E_CONCURRENCY_REQUIRED`       | `FOR_EACH ... PARALLEL` without `CONCURRENCY=<n>`.          |
| `CABOC_W_LOOP_NEVER_MUTATES`         | Warning: loop body never `SET`s a name referenced by the    |
|                                      | termination condition. Likely infinite loop hitting the     |
|                                      | `MAX_ITERATIONS` ceiling on every run.                      |

## 13. Runtime NDJSON emission

Conformant runtimes MUST emit these events. Field names are stable.

```
{"event":"loop.iteration.start","loop_id":"...","iteration":1,"ts":"..."}
{"event":"loop.iteration.end","loop_id":"...","iteration":1,
 "outcome":"complete|continue|break|error","ts":"..."}
{"event":"loop.completed","loop_id":"...","iterations":3,
 "reason":"condition|max_iterations|break|error","ts":"..."}
{"event":"parallel.spawn","loop_id":"...","iteration":7,
 "in_flight":4,"concurrency":4,"ts":"..."}
{"event":"parallel.collect","loop_id":"...","iteration":7,
 "key":"...","collector":"by_domain","ts":"..."}
```

Loops MAY additionally emit `parallel.concurrency.capped` when a
runtime ceiling reduces the author-declared concurrency.
