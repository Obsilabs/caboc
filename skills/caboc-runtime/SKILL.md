---
name: caboc-runtime
version: 0.1.0
description: |
  Execute a CABOC routine directory as a directly-driven LLM pipeline.
  Read WORKFLOW.md, dispatch USE AGENT calls as Task subagent spawns,
  persist NDJSON transcript per run.
license: Apache-2.0

# Anthropic SKILL.md compatibility (capability abstract — no model is named).
allowed_tools:
  - file_read
  - file_write
  - subagent_spawn

# skills.sh distribution metadata
homepage: https://github.com/caboc-project/caboc
install_url: https://raw.githubusercontent.com/caboc-project/caboc/main/skills/caboc-runtime/
spec_version: caboc-llm/0.1.0
---

# CABOC runtime skill

You are the CABOC LLM runtime. Activate this skill when the user (or a parent
agent) issues an intent equivalent to:

> "run routine `<routine-dir>` with inputs `<json>`"

Examples that trigger activation:
- "run the routine at `./routines/code-review` with `{ "diff_path": "x.patch" }`"
- "execute CABOC routine `routines/triage` on inputs `{ ... }`"
- "/caboc run routines/foo {...}"

If the intent is ambiguous (no routine directory, no inputs object), ask the
user for the missing piece and stop. Otherwise proceed with the algorithm
below. Do not invent a routine directory.

## Hard constraints

These hold for every run. Violating any of them is a runtime bug.

1. NEVER name an LLM model (no `claude-*`, `gpt-*`, `gemini-*`, etc.) in any
   file this skill writes — `transcript.ndjson`, `outputs.json`, `error.json`,
   `state.json`, repair prompts, anything. Routines reference capabilities
   (`reasoning`, `classification`, `structured_extraction`, `vision`) and
   tiers (`fast`, `balanced`, `deep`) only.
2. NEVER read or modify files outside `routines/<routine>/runs/<run-id>/`
   during execution. The only files outside that the skill is allowed to read
   are the routine's own `WORKFLOW.md` and `agents/*.agent.md`. Anything else
   the user wants the routine to touch must come in through `inputs`.
3. Default `SESSION` modifier when omitted is `fresh`.
4. Bind expressions are restricted to: literals (string, number, bool, null,
   list, object), identifier lookups against `state.json`, dotted member
   access, arithmetic (`+ - * /`), boolean (`&& || !`), comparison (`== != <
   <= > >=`), string builtins (`CONCAT`, `LENGTH`, `MIN`, `MAX`, `COALESCE`),
   and the ternary `IF cond THEN a ELSE b END`. No arbitrary code
   evaluation. If a routine asks for anything outside this grammar, halt with
   `run.failed` and `error.kind = "expression.unsupported"`.
5. Append-only: never rewrite earlier lines of `transcript.ndjson`.

## Algorithm

### 1. Resolve and load

1. Resolve the routine directory. If it does not exist or `WORKFLOW.md` is
   missing, fail loudly with a single error message naming the missing path.
   Do not try alternates.
2. Read `WORKFLOW.md`. Split on the first `---` fences:
   - YAML frontmatter — parse as the routine manifest.
   - Body — keep verbatim. The body is the PROCEDURE; steps are iterated
     literally over its text.
3. List `agents/`. Each `<name>.agent.md` is one agent definition. Parse its
   frontmatter (YAML) and keep the body verbatim as its system prompt.

### 2. Validate inputs

1. Validate the user-supplied inputs against `frontmatter.io.inputs`. The
   schema is either a JSON Schema object or a Zod-style serialized shape.
   Treat unknown schema dialects as JSON Schema.
2. If a required field is missing or a type mismatches, fail before opening
   the run directory. Error message names the offending field.

### 3. Create the run

1. Generate `run_id` as `YYYYMMDD-HHmmss-<6chars>` where the suffix is six
   random lowercase alphanumerics. Use UTC for the timestamp.
2. Create `routines/<routine>/runs/<run_id>/`. Inside it:
   - Write `inputs.json` — the frozen, validated inputs.
   - Create empty `transcript.ndjson` and `state.json`.
   - `state.json` starts as `{ "step": null, "bindings": {}, "outputs": {} }`.
3. Emit `run.started`:
   ```json
   { "kind": "run.started", "run_id": "...", "routine": "...", "inputs_keys": [...], "ts": "..." }
   ```

### 4. Walk PROCEDURE

Iterate STEP blocks in body order. Maintain a `next_step` pointer; default
advances by source order, but `GOTO step.<name>` overrides it.

For each STEP:

1. Emit `step.started` with `{ step, modifiers, ts }`. Modifiers are anything
   the STEP header carries (e.g. retry, timeout).
2. Walk the STEP body line by line and dispatch each construct:

   - `DESCRIPTION "<text>"` — emit `step.description { step, text, ts }`.
   - `LET <name> = <expr>` — evaluate `<expr>` under the bind-expression
     grammar (constraint 4). Write `state.bindings[<name>] = <value>`. Emit
     `binding.set { step, name, ts }` (do NOT log the value if it is large or
     sensitive; truncate at 256 chars).
   - `USE AGENT <ref> [SESSION ...] WITH inputs={...}.` — dispatch a Task
     subagent (see "USE AGENT dispatch" below). On return, the parsed JSON
     becomes the step's `result` variable.
   - `OUTPUT <name> FROM <agent-ref>` — bind the most recent return from
     `<agent-ref>` (in this step) to `state.bindings[<name>]`. Emit
     `binding.set`.
   - `EMIT <key> = <expr>` — evaluate `<expr>` and write to
     `state.outputs[<key>]`. This is what ends up in `outputs.json`. Emit
     `binding.set { step, name: "outputs." + key, ts }`.
   - `IF <expr> ... ELSE IF <expr> ... ELSE ... END IF` — evaluate the
     conditions in order. Take the first true branch (or `ELSE` if none).
     Emit `branch.taken { step, branch, ts }` where `branch` is the index or
     `"else"`. Skip the body of the untaken branches entirely.
   - `GOTO step.<name>` — set `next_step` to `<name>`. Stop walking this
     STEP body.
   - `PARALLEL JOIN_POLICY=<policy> ... END PARALLEL` — see "PARALLEL" below.
   - `ASSERT <expr> [MESSAGE "<text>"]` — evaluate `<expr>`. If false, emit
     `assertion.failed { step, expr, message, ts }` and fail the run.

3. After the STEP body finishes (or after a `GOTO` sets `next_step`), write
   `state.json` to disk (overwrite). Emit `step.completed { step, ts }`.

If a STEP has nothing to do (empty body), still emit started/completed.

### 5. USE AGENT dispatch

Given `USE AGENT <ref> [SESSION <mode>] WITH inputs={...}.`:

1. Read `agents/<ref>.agent.md`. Parse frontmatter and body.
2. Compose the subagent prompt:
   ```
   You are <agent.id or ref>. <agent.description>.

   <full agent.md body verbatim>

   ## Inputs
   <JSON-stringified resolved inputs>

   ## Output contract
   Return strict JSON matching this schema. No prose outside the JSON object.
   <io.outputs schema, stringified>
   ```
3. Resolve inputs — each value in the `WITH inputs={...}` map may be a
   literal or a bind expression. Evaluate every expression first, then
   stringify the resolved object.
4. Emit `agent.started { step, agent, ref, session, ts }` and the wall-clock
   start time.
5. Apply the SESSION modifier:
   - `fresh` (default) — pass only the composed prompt. No prior history.
   - `continuous(<step>)` — prepend the transcript stored at
     `runs/<run-id>/sessions/<agent>.transcript.json` whose `step` field
     matches `<step>`. Append the new turn to the same file after success.
   - `fork(<step>)` — load that transcript as in `continuous`, but write the
     resulting turn to a new file
     `sessions/<agent>__forkof_<step>__<this-step>.transcript.json`.
6. Spawn one Task subagent (`general-purpose` subagent_type) with the
   composed prompt. The subagent must return a JSON object.
7. Validate the response against `io.outputs`:
   - On success, bind it as the STEP's `result` and as the agent's most
     recent return.
   - On validation failure, emit `agent.repair { step, agent, attempt, errors, ts }`
     and retry up to 2 times. The repair prompt is the original prompt plus:
     ```
     Your previous response failed validation. Errors:
     <serialized validation errors>
     Return only the corrected JSON object.
     ```
   - After 2 failed repairs, fail the run with `error.kind = "agent.output.invalid"`.
8. Persist the turn to `sessions/<agent>.transcript.json` (or the fork file)
   so future `continuous`/`fork` references work.
9. Emit `agent.completed { step, agent, session, wall_ms, ts }`.

### 6. PARALLEL

`PARALLEL JOIN_POLICY=<policy> ... END PARALLEL` contains inner STEP-like
blocks. Each inner block must dispatch exactly one `USE AGENT` (the runtime
does not nest control flow inside PARALLEL).

1. Emit `parallel.started { step, branches: [...], policy, ts }`.
2. Spawn ALL inner Task subagent calls in one assistant message. The runtime
   batches them; the underlying host runs them concurrently.
3. Apply `JOIN_POLICY`:
   - `all` — wait for N successful returns (N = branch count). Any failure
     fails the parallel block.
   - `first` — first successful return wins; the rest are ignored.
   - `majority` — wait until `floor(N/2) + 1` succeed.
   - `quorum:K` — wait until exactly `K` succeed (literal K).
4. Bind outputs by inner step name. For `first`, only the winner's binding
   is set. For `majority`/`quorum`, every successful branch's binding is set.
5. Emit `parallel.completed { step, successes, failures, ts }`.

### 7. Termination

When `next_step` is `null` (no GOTO and source order exhausted) or PROCEDURE
reaches an explicit END:

1. Write `runs/<run-id>/outputs.json` from `state.outputs`. Match the
   `frontmatter.io.outputs` schema; emit `run.failed` if the final
   outputs object does not validate.
2. Emit `run.completed { run_id, outputs_keys, wall_ms, ts }`.
3. Reply to the user with:
   - The absolute path to `runs/<run-id>/`.
   - A one-line summary derived from `state.outputs` (top-level keys).

### 8. On error

Any failure (input validation, expression error, agent output invalid after
repairs, assertion, schema mismatch on outputs):

1. Emit `run.failed { error: { kind, message, step?, agent?, details? }, ts }`.
2. Write `runs/<run-id>/error.json` with the same payload.
3. Reply to the user with a short diagnosis: error kind, step where it
   happened, the field or assertion that failed.

Do not attempt recovery beyond the explicit repair retries on agent output.

## NDJSON event types

Every event is one line of JSON in `transcript.ndjson`. Every event has
`kind` and `ts` (ISO 8601 UTC, e.g. `"2026-05-11T14:03:22.117Z"`).

| kind | when |
| --- | --- |
| `run.started` | after run dir created |
| `step.started` | entering each STEP |
| `step.description` | when STEP body has a `DESCRIPTION` |
| `agent.started` | before subagent spawn |
| `agent.completed` | after subagent returns and validates |
| `agent.repair` | per failed validation attempt |
| `binding.set` | after `LET` / `OUTPUT` / `EMIT` |
| `branch.taken` | after IF/ELSE resolution |
| `parallel.started` | entering PARALLEL block |
| `parallel.completed` | after PARALLEL JOIN_POLICY satisfied |
| `assertion.failed` | when `ASSERT` evaluates false |
| `step.completed` | leaving each STEP (success or branched out) |
| `subroutine.invoked` | when one routine calls another |
| `run.completed` | after `outputs.json` written |
| `run.failed` | any unrecoverable error |

Full field reference for each event lives in
`assets/state-format.md`. The supported body grammar lives in
`assets/grammar-subset.md`.

## Worked invocation (mental model)

User says: "run routine `routines/code-review` with inputs `{ "diff_path": "x.patch" }`".

1. Read `routines/code-review/WORKFLOW.md` → parse frontmatter, hold body.
2. Validate inputs against `io.inputs`. OK.
3. Create `routines/code-review/runs/20260511-140322-a3kf9q/`.
4. Emit `run.started`.
5. For each STEP in body: emit `step.started`, dispatch its constructs (each
   `USE AGENT` becomes one Task subagent call), update `state.json`, emit
   `step.completed`.
6. At END: write `outputs.json`, emit `run.completed`, reply with run dir
   path.

That's it. The skill is intentionally narrow — interpret the routine,
dispatch agents as subagents, log everything, never name a model.
