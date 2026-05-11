# caboc-runtime

An installable LLM skill that turns a CABOC routine directory into an
executable pipeline. The skill teaches a host LLM (Claude Code, Codex CLI,
Cursor, Gemini CLI — anything that loads `SKILL.md` per the skills.sh
convention) how to read `WORKFLOW.md`, dispatch agents as Task subagents,
and persist an NDJSON transcript per run.

## What the skill does

Given a routine directory like:

```
routines/<name>/
  WORKFLOW.md            frontmatter (YAML) + PROCEDURE body
  agents/
    <agent>.agent.md     frontmatter + system prompt
  runs/<run-id>/         populated at execution time
    inputs.json
    transcript.ndjson
    outputs.json
    state.json
```

…and a user intent of the form "run routine `<dir>` with inputs `<json>`",
the host LLM:

1. Parses `WORKFLOW.md` frontmatter and body.
2. Validates inputs against `io.inputs`.
3. Walks STEP / IF / GOTO / PARALLEL control flow.
4. Dispatches each `USE AGENT` call as a single Task subagent spawn,
   composing its prompt from the agent's system body + JSON inputs +
   strict output contract.
5. Validates each agent's JSON return against its `io.outputs` schema, with
   up to 2 repair retries.
6. Appends an event to `transcript.ndjson` for every meaningful action.
7. Writes `outputs.json` on success or `error.json` on failure.

The skill never names an LLM model. Routines reference capabilities
(`reasoning`, `classification`, `structured_extraction`, `vision`) and tiers
(`fast`, `balanced`, `deep`). Model selection is the host's concern.

## Install

### Via skills.sh (preferred)

```sh
npx skills add caboc-runtime
```

This drops the skill into your host's skill registry (for Claude Code:
`~/.claude/skills/caboc-runtime/`).

### Manually

Copy this directory into your host's skill location. For Claude Code:

```sh
mkdir -p ~/.claude/skills/caboc-runtime
cp -r SKILL.md manifest.json assets ~/.claude/skills/caboc-runtime/
```

The host should pick up `SKILL.md` on its next session.

## Usage

In a Claude Code (or compatible) session, say:

> run routine `./routines/code-review` with inputs `{ "diff_path": "x.patch" }`

The skill activates, executes the routine, and replies with the absolute
path to `runs/<run-id>/` plus a one-line summary of `outputs.json`.

Equivalent intents the skill recognizes:
- "execute CABOC routine `<dir>` on inputs `<json>`"
- "/caboc run `<dir>` `<json>`"

If the routine directory or inputs are missing, the skill asks for them
and stops rather than guessing.

## Examples

A worked example routine lives at `../../examples/01-code-review/`.
Run it from your session to confirm the install is wired up.

## Reference

- `SKILL.md` — the executable instruction (this is what the host LLM loads).
- `assets/state-format.md` — NDJSON event types and payload fields.
- `assets/grammar-subset.md` — supported subset of the CABOC body grammar.
- `manifest.json` — skills.sh distribution metadata.

## Spec compatibility

This skill implements `caboc-llm/0.1.0`. Routines that declare a higher
`spec_version` may fail to load.

## License

Apache 2.0. See `../../LICENSE`.
