# STANDARDS_HITL — Human-in-the-loop pauses

> Status: draft v0.2
> Scope: any routine whose body contains a `STEP <name> HITL.` step.

## 1. Why this exists

Research, drafting, review, and regulated workflows need a human
decision injected mid-run: validate a plan before spending a token
budget, sign off on a draft, accept a compliance finding, break a tie
between parallel reviewers. Encoding those checkpoints in CABOC keeps
them inside the lockfiled, replayable routine instead of a side-band
channel. The runtime pauses cleanly, the transcript records the
decision, and the resumed run picks up at the same step.

## 2. `STEP HITL` semantics

A `HITL` step is the unit of pause. It MUST contain exactly one
`PROMPT TO` (dispatch a structured payload to a named role) followed
by exactly one `AWAIT <var> FROM human` (block until the response
arrives). Other statements (`DESCRIPTION.`, `LET`, `EMIT`,
`USE AGENT`) inside the body raise `CABOC_E_HITL_BODY_INVALID`. Prep
computation lives in a preceding `DETERMINISTIC` or
`NON_DETERMINISTIC` step.

## 3. `PROMPT TO` syntax + payload

```
PROMPT TO role=<role-id> [WITH context=<expr>] [WITH inputs=<expr>] .
```

- `role-id` is kebab-case per `STANDARDS_NAMING.md` §4 (`editor`,
  `compliance-reviewer`, `editor-lead`, `triage-on-call`).
- `context` is an arbitrary expression in the current step scope. The
  runtime serializes it to JSON; consumers (UI, queue, channel) parse
  it. The runtime treats it as opaque.
- `inputs` is optional, conventionally the shape a fresh routine run
  from this checkpoint would receive.

## 4. `AWAIT FROM human`

```
AWAIT <var> FROM human
  WITHIN <duration>
  [ROUTE { <case> -> step.<name> (, <case> -> step.<name>)* }]
  [ON_TIMEOUT escalate TO <role-id>] .
```

- `<var>` is a fresh binding receiving the validated response on
  resume. Shadowing an in-scope name is `CABOC_E_HITL_VAR_SHADOW`.
- `<duration>` is `<int><unit>`, unit ∈ `ms|s|m|h|d`. Whitespace
  between integer and unit is allowed (`24h`, `24 h`, `24 HOURS`).
- `ROUTE` is a branching table keyed by a single enum field of the
  response (declared in §5). The runtime takes the first matching arm
  and `GOTO step.<name>`. Without `ROUTE`, control falls through.
- `ON_TIMEOUT escalate TO <role>` re-dispatches the payload to the
  escalation role and resets the deadline once. Without it, `<var>`
  binds to `{action: "timeout"}` on timeout.

## 5. Response schema declaration

Declared in the workflow frontmatter under `hitl_schemas:`, keyed by
step name. Each entry is inline JSON-schema or a `$ref` to an external
file:

```yaml
hitl_schemas:
  review_plan:
    type: object
    required: [action]
    properties:
      action: { type: string, enum: [validate, modify, restart, timeout] }
      feedback: { type: string, maxLength: 4000 }
      revisions: { type: array, items: { type: string, maxLength: 800 } }
  other_step: { $ref: ./schemas/other-decision.zod.ts }
```

The enum field driving `ROUTE` MUST exist and be `enum`-typed
(`CABOC_E_HITL_ROUTE_KEY_MISSING`). Free-text fields MUST declare
`maxLength`, matching `STANDARDS_ROUTINES.md` §5.

## 6. Pause and resume flow

On entry to a `STEP HITL` the runtime evaluates `PROMPT TO` and emits
`hitl.prompt`, then writes `hitl.awaiting` (var, WITHIN, ROUTE,
ON_TIMEOUT). The LLM emits the pause payload as a top-level
`hitl.pause` line on stdout and exits. `state.json` persists the step
pointer, bindings, awaited `var`, deadline, and escalation target.

Resume is a separate CLI invocation:

```
caboc resume <run-dir> --decision-file <file>
caboc resume <run-dir> --decision '<inline-json>'
caboc resume <run-dir> --timeout
```

The decision is validated against the step's `hitl_schemas` entry.
Failure → `CABOC_E_HITL_DECISION_INVALID`, run stays paused. On
success the runtime appends `hitl.resumed`, binds `<var>`, applies
`ROUTE`, and continues. The resumed run reuses the original `run-id`
and the same directory.

## 7. Timeout policy

Default `WITHIN` when omitted is 24 hours; lint warns. The effective
`WITHIN` is hard-capped by the workflow's `budget.wall_minutes` minus
elapsed wall time at pause; `hitl.awaiting` records both requested and
effective values. `ON_TIMEOUT escalate` resets the deadline once; a
second timeout falls through to `{action: "timeout"}`.

## 8. NDJSON events

| Event             | When                                              | Required fields                                                         |
| ----------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `hitl.prompt`     | At entry into a `STEP HITL`                       | `step`, `role`, `context`, `inputs?`                                    |
| `hitl.awaiting`   | Immediately after `hitl.prompt`                   | `step`, `var`, `within_ms`, `effective_within_ms`, `route?`, `escalate?`|
| `hitl.resumed`    | On valid decision via `caboc resume`              | `step`, `var`, `payload`, `route_taken?`                                |
| `hitl.timeout`    | Deadline passed with no decision                  | `step`, `var`, `pause_started_at`, `deadline_at`                        |
| `hitl.escalated`  | When `ON_TIMEOUT escalate` fires                  | `step`, `from_role`, `to_role`, `new_deadline_at`                       |

Standard envelope (`ts`, `seq`, `step`) per `STANDARDS_ROUTINES.md` §6.

## 9. Lint rules

| Code                              | Trigger                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `CABOC_E_HITL_INCOMPLETE`         | `STEP HITL` missing `PROMPT TO` or `AWAIT FROM human`        |
| `CABOC_E_HITL_BODY_INVALID`       | Any other statement inside the body                          |
| `CABOC_E_HITL_PROMPT_DUPLICATE`   | More than one `PROMPT TO`                                    |
| `CABOC_E_HITL_AWAIT_DUPLICATE`    | More than one `AWAIT FROM human`                             |
| `CABOC_E_HITL_VAR_SHADOW`         | `AWAIT <var>` collides with an existing binding              |
| `CABOC_E_HITL_ROUTE_KEY_MISSING`  | `ROUTE` references a non-enum field in the schema            |
| `CABOC_E_HITL_SCHEMA_MISSING`     | No `hitl_schemas[<step>]` entry for a `HITL` step            |
| `CABOC_E_HITL_DECISION_INVALID`   | `caboc resume` decision fails schema validation (runtime)    |

Warnings: `AWAIT` without `ROUTE` when downstream branches on the
decision; `WITHIN` omitted (default 24h); `WITHIN` exceeding
`budget.wall_minutes` (clamped at runtime).

## 10. Example — research checkpoint

```
STEP draft_plan NON_DETERMINISTIC.
  USE AGENT research-planner SESSION fresh WITH inputs={topic: topic}.
  OUTPUT plan, refs.
END STEP.

STEP checkpoint_plan HITL.
  PROMPT TO role=editor WITH context={plan: plan, sources: refs}.
  AWAIT decision FROM human WITHIN 24 HOURS
    ROUTE {
      validate -> step.execute_plan,
      modify   -> step.revise_plan,
      restart  -> step.draft_plan
    }
    ON_TIMEOUT escalate TO editor-lead.
END STEP.

STEP revise_plan NON_DETERMINISTIC.
  USE AGENT research-planner SESSION continuous(draft_plan)
    WITH inputs={feedback: decision.feedback, revisions: decision.revisions}.
  OUTPUT plan, refs.
  GOTO step.checkpoint_plan.
END STEP.
```

Frontmatter excerpt: see §5.

## 11. References

- `STANDARDS_ROUTINES.md` §3 — step modifiers and statement grammar.
- `STANDARDS_GRAMMAR.md` — full v0.2 grammar including HITL forms.
- `STANDARDS_LOOPS.md` — interaction with `GOTO` and bounded loops.
- `STANDARDS_ALIASES.md` §2 — HITL role identifiers pass through
  opaquely; they do not resolve through aliases.
- `STANDARDS_DISTRIBUTION.md` §5 — lockfile envelope, unchanged.
- `STANDARDS_PROVIDER_ROLES.md` — provider roles (LLM dispatch) are
  disjoint from HITL roles (human dispatch).
