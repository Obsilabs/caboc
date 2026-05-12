# STANDARDS_SUBROUTINES — Sub-workflow invocation

> Status: draft v0.2
> Scope: any routine whose body contains `INVOKE WORKFLOW <name>`.

## 1. Why this exists

Routines compose. An intake routine interprets a free-form request,
confirms intent via HITL, hands off to `article-forge`. A QA
orchestrator invokes `bug-triage` and `content-moderation` as steps.
Each callee stays a versioned, lockfiled, replayable unit; the caller
stitches them with the same grammar used in-line.

## 2. Syntax

```
STEP run_article_forge NON_DETERMINISTIC.
  INVOKE WORKFLOW article-forge
    WITH inputs={topic: topic, audience: "general", tone: tone}
    TIMEOUT 30 MINUTES
    PROVIDER_ROLES {default: "deep", classifier: "fast"} .
  OUTPUT sub_result.
END STEP.
```

Grammar: `INVOKE WORKFLOW <name> WITH inputs=<expr> [TIMEOUT
<duration>] [PROVIDER_ROLES <object-expr>] .` `<name>` resolves
through the six-step alias precedence in `STANDARDS_ALIASES.md` §2,
identical to `caboc run <arg>`. The `OUTPUT <name>` on the next line
binds the child's `outputs.json` into the parent scope (§4).

## 3. State isolation

Each `INVOKE WORKFLOW` opens a fresh child scope. The child sees only
`inputs`; parent bindings, step pointer, transcript handle, and run-id
are invisible, and the child cannot read or write the parent's files
(its `runs/<run-id>/` is nested under the parent's run, §8). Provider
role config, timeout budgets, and aliases cascade (§7, §10); state
does not. This matches the boundary `caboc run` establishes for
top-level invocations.

## 4. Output propagation

The child writes `outputs.json` per `STANDARDS_ROUTINES.md` §6. The
parent reads it, validates against the child's `io.outputs` schema
(mismatch = `CABOC_E_SUBROUTINE_OUTPUT_INVALID`), binds it to the
parent's named target on the next `OUTPUT` line, and emits
`subroutine.completed`. The parent treats the bound value as ordinary
structured data.

## 5. Recursion depth and cycle detection

The runtime maintains a call stack across `INVOKE WORKFLOW`. Default
depth ceiling is 4 frames (parent + 3 nested), configurable via
`caboc.config.json.subroutines.max_depth`; the hosted runtime enforces
a global ceiling workspace config cannot raise. Exceeding raises
`CABOC_E_SUBROUTINE_RECURSION_LIMIT`. A workflow appearing twice on
the live stack (resolved by content hash, collapsing aliases at the
same routine) raises `CABOC_E_SUBROUTINE_CYCLE`. Diamond dependencies
(A → B and A → C both calling D sequentially) are not cycles.

## 6. Replay and lockfile

Reproducibility requires every routine in the tree pinned in
`routines.lock`. `caboc lint` walks every `INVOKE WORKFLOW` target and
reports unpinned callees as `CABOC_E_SUBROUTINE_UNLOCKED`;
`caboc install --frozen` refuses workspaces with any missing reachable
callee. Replay uses the lockfile's content hash for parent and every
transitive child. The lockfile format from `STANDARDS_DISTRIBUTION.md`
§5 is unchanged; `caboc add` walks transitive targets and offers to
pin them in the same TOFU prompt.

## 7. Timeout

Default `TIMEOUT` = parent's remaining `budget.wall_minutes` at the
invocation site. Explicit `TIMEOUT <duration>` parses with the unit
grammar from `STANDARDS_HITL.md` §4. Effective timeout =
`min(explicit, parent_remaining)`; lint warns when `explicit` exceeds
`budget.wall_minutes`. Timeout surfaces as
`CABOC_E_SUBROUTINE_TIMEOUT`; the child's partial transcript stays
under the nested `runs/` directory.

## 8. Subagent dispatch within sub-workflows

A child's `USE AGENT` spawns Task subagents in the parent's main loop,
identical to top-level routines. Child transcript events mirror into
the parent's `transcript.ndjson` with `step` rewritten as
`sub.<parent-step>.<child-step>`; nested invocations extend the prefix
(`sub.a.sub.b.c`). The child's `runs/<run-id>/` lives under
`runs/<parent-run-id>/subruns/<child-run-id>/`. `SESSION continuous`
references a step in the child's own scope; cross-boundary continuation
is unsupported in v0.2 and falls back to `fresh` with a warning.

## 9. NDJSON events

Appended to the parent's `transcript.ndjson` (the child keeps its own
log; the parent also mirrors child events per §8):

- `subroutine.invoke` (entry): `step`, `workflow`, `resolved_sha256`,
  `child_run_id`, `inputs`, `effective_timeout_ms`.
- `subroutine.completed` (after output validation): `step`, `workflow`,
  `child_run_id`, `outputs_sha256`.
- `subroutine.failed` (error/timeout): `step`, `workflow`,
  `child_run_id`, `error_code`, `error_message`.

## 10. Lint and provider-role cascade

`caboc.config.json.roles` (per `STANDARDS_PROVIDER_ROLES.md`) cascades
to every child. `PROVIDER_ROLES` overrides per-call as a shallow merge
on the parent's effective role map; the merged map is recorded in
`subroutine.invoke`, so replay reproduces the bindings. Lint codes:

| Code                                | Trigger                                                                |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `CABOC_E_SUBROUTINE_NOT_FOUND`      | `<name>` matches no alias, lockfile entry, or path                     |
| `CABOC_E_SUBROUTINE_UNLOCKED`       | Resolved target not in `routines.lock`                                 |
| `CABOC_E_SUBROUTINE_INPUTS_INVALID` | `inputs=<expr>` fails child's `io.inputs` schema                       |
| `CABOC_E_SUBROUTINE_OUTPUT_INVALID` | Child outputs fail `io.outputs` (runtime)                              |
| `CABOC_E_SUBROUTINE_RECURSION_LIMIT`| Call stack exceeds `max_depth` (runtime)                               |
| `CABOC_E_SUBROUTINE_CYCLE`          | Same content hash twice on the live stack (runtime)                    |
| `CABOC_E_SUBROUTINE_TIMEOUT`        | Child exceeds effective timeout (runtime)                              |

Warnings: `TIMEOUT` exceeds parent's `budget.wall_minutes`; callee's
`spec_version` major differs from caller (`STANDARDS_DISTRIBUTION.md` §12).

## 11. Example — intake routes into article-forge

An intake routine interprets a free-form query, confirms via a
`STEP confirm_intent HITL` (per `STANDARDS_HITL.md` §10), then:

```
STEP run_forge NON_DETERMINISTIC.
  INVOKE WORKFLOW article-forge
    WITH inputs={topic: plan.topic, audience: plan.audience, tone: plan.tone}
    TIMEOUT 30 MINUTES.
  OUTPUT article.
END STEP.
```

## 12. References

`STANDARDS_GRAMMAR.md` (v0.2 grammar including `INVOKE WORKFLOW`);
`STANDARDS_LOOPS.md` (invocation inside bounded loops);
`STANDARDS_ALIASES.md` §2 (six-step name resolution);
`STANDARDS_DISTRIBUTION.md` §5, §10 (lockfile envelope and `--frozen`);
`STANDARDS_HITL.md` §4 (duration grammar reused by `TIMEOUT`);
`STANDARDS_PROVIDER_ROLES.md` (role map and merge).
