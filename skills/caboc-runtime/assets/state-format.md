# CABOC runtime — NDJSON event reference

Every line in `runs/<run-id>/transcript.ndjson` is one JSON object.

Common fields on every event:

| field | type | notes |
| --- | --- | --- |
| `kind` | string | event type (see below) |
| `ts` | string | ISO 8601 UTC, millisecond precision |

`run-id` and `routine` are implicit from the directory location, so events
do not repeat them after `run.started`.

## Event types

### `run.started`

Emitted once, after the run directory is created and `inputs.json` is
frozen.

| field | type | notes |
| --- | --- | --- |
| `run_id` | string | e.g. `20260511-140322-a3kf9q` |
| `routine` | string | routine directory name |
| `inputs_keys` | string[] | top-level keys in `inputs.json` (values are not logged) |
| `spec_version` | string | from `WORKFLOW.md` frontmatter |

### `step.started`

Emitted on entering each STEP block.

| field | type | notes |
| --- | --- | --- |
| `step` | string | STEP name |
| `modifiers` | object | optional modifiers parsed from the STEP header (`retry`, `timeout`, etc.) |

### `step.description`

Emitted when a STEP body contains `DESCRIPTION "<text>"`.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `text` | string | description text verbatim |

### `agent.started`

Emitted immediately before the Task subagent spawn.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `agent` | string | `agents/<ref>.agent.md` ref |
| `session` | string | `fresh`, `continuous(<step>)`, or `fork(<step>)` |
| `inputs_keys` | string[] | top-level keys passed to the agent (values not logged) |

### `agent.completed`

Emitted after the subagent returns and its JSON validates against
`io.outputs`.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `agent` | string | agent ref |
| `session` | string | session mode used |
| `wall_ms` | number | duration from `agent.started` to validation success |
| `output_keys` | string[] | top-level keys of the validated output |

### `agent.repair`

Emitted once per failed validation attempt. Maximum 2 per `USE AGENT` call.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `agent` | string | agent ref |
| `attempt` | number | 1 or 2 |
| `errors` | object[] | validator-produced error list |

### `binding.set`

Emitted after `LET`, `OUTPUT`, or `EMIT`.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `name` | string | bind target; for `EMIT` it is `outputs.<key>` |
| `kind` | string | `let` \| `output` \| `emit` |
| `value_preview` | string | first 256 chars of the stringified value |

### `branch.taken`

Emitted after an IF/ELSE IF/ELSE evaluates.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `branch` | string \| number | branch index (0-based) or `"else"` |
| `expr` | string | the branch's source expression (for the taken branch) |

### `parallel.started`

Emitted on entering a PARALLEL block.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `branches` | string[] | inner STEP names |
| `policy` | string | `all` \| `first` \| `majority` \| `quorum:K` |

### `parallel.completed`

Emitted after JOIN_POLICY is satisfied or the block fails.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `successes` | string[] | inner steps that returned valid output |
| `failures` | string[] | inner steps that failed |
| `wall_ms` | number | duration from `parallel.started` |

### `assertion.failed`

Emitted when an `ASSERT` evaluates false. Always followed by `run.failed`.

| field | type | notes |
| --- | --- | --- |
| `step` | string | enclosing STEP |
| `expr` | string | source expression |
| `message` | string | optional `MESSAGE "<text>"` argument |

### `step.completed`

Emitted on leaving a STEP (after its last construct ran or after a `GOTO`).

| field | type | notes |
| --- | --- | --- |
| `step` | string | STEP name |
| `wall_ms` | number | duration from `step.started` |

### `subroutine.invoked`

Reserved for inter-routine calls. Payload:

| field | type | notes |
| --- | --- | --- |
| `step` | string | calling STEP |
| `routine` | string | target routine ref |
| `child_run_id` | string | nested run id |

### `run.completed`

Emitted after `outputs.json` is written and validates.

| field | type | notes |
| --- | --- | --- |
| `run_id` | string | matches `run.started` |
| `outputs_keys` | string[] | top-level keys in `outputs.json` |
| `wall_ms` | number | total run duration |

### `run.failed`

Emitted on any unrecoverable failure. Same payload is written to
`error.json`.

| field | type | notes |
| --- | --- | --- |
| `error.kind` | string | e.g. `inputs.invalid`, `agent.output.invalid`, `expression.unsupported`, `assertion.failed`, `outputs.invalid` |
| `error.message` | string | one-line diagnosis |
| `error.step` | string? | STEP name when applicable |
| `error.agent` | string? | agent ref when applicable |
| `error.details` | object? | validator errors, expression source, etc. |

## Value privacy

`binding.set.value_preview` is truncated to 256 chars. The full value lives
in `state.json` (overwritten each step). Inputs/outputs payloads live only
in `inputs.json` / `outputs.json`, never inline in the transcript.
