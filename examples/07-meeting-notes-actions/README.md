# Example 07 — meeting-notes-actions

A standalone CABOC routine that turns a raw meeting transcript into a
structured brief: decisions, action items, blockers, followups, plus a
markdown summary and an `attention_score` measuring how rich the
extraction was.

## Why this example

- Demonstrates `PARALLEL JOIN_POLICY=all` with four sibling steps that
  fan out over the same transcript, then a sequential synthesizer that
  merges + dedupes + ranks.
- Shows how to specialize agents by **capability + tier** without ever
  naming a model: four extractors use `structured_extraction`, the
  synthesizer uses `reasoning`.
- Uses `SESSION fresh` for every agent — each specialist sees the
  transcript without bias from sibling outputs.

## Layout

```
07-meeting-notes-actions/
├── WORKFLOW.md
├── agents/
│   ├── decisions_extractor.agent.md     (structured_extraction · balanced)
│   ├── actions_extractor.agent.md       (structured_extraction · balanced)
│   ├── blockers_extractor.agent.md      (structured_extraction · balanced)
│   ├── followups_extractor.agent.md     (structured_extraction · fast)
│   └── notes_synthesizer.agent.md       (reasoning · balanced)
├── __fixtures__/
│   ├── sample-inputs.json
│   └── expected-outputs.json
└── runs/                                 (populated at run time)
```

## Pattern: parallel fan-out + synthesizer

```
              transcript
                  |
   +-------+------+------+--------+
   |       |      |      |        |
 decisions actions blockers followups   (PARALLEL JOIN_POLICY=all)
   |       |      |      |        |
   +-------+------+------+--------+
                  |
            notes_synthesizer            (sequential)
                  |
                outputs
```

- All four extractors run concurrently; the runtime joins on **all**
  completing before `synthesize` starts.
- Each extractor has a narrow contract (one array, well-typed records
  with quotes), which keeps individual prompts small and parallelizable.
- The synthesizer is the only step that sees all four arrays. It
  dedupes by topic, sorts by priority/severity/confidence, writes
  `summary_md`, and computes `attention_score`.

## Agents in this routine

- `decisions_extractor` — concrete rulings + who made them + confidence.
- `actions_extractor` — owner, action, ISO due date, P0–P3 priority.
- `blockers_extractor` — what blocks what, who is being waited on,
  severity (low → critical).
- `followups_extractor` — topics deferred to a future meeting or async
  channel.
- `notes_synthesizer` — dedupe, sort, summarize, score.

## Inputs

```json
{
  "meeting_title": "Sprint 42 planning",
  "meeting_date": "2026-05-12",
  "participants": ["Ana", "Ben", "Cara", "Dev"],
  "transcript": "Ana: ... \nBen: ..."
}
```

## Outputs

`outputs.json` matches the schema in `WORKFLOW.md`:

```json
{
  "decisions":   [ /* sorted by confidence desc */ ],
  "actions":     [ /* sorted by P0 -> P3, then due asc */ ],
  "blockers":    [ /* sorted by critical -> low */ ],
  "followups":   [ /* dated first, undecided last */ ],
  "summary_md":  "# Sprint 42 planning — 2026-05-12 ...",
  "attention_score": 1.0
}
```

## Notes on `attention_score`

- `1.0` — every category populated with a supporting quote.
- Drops `0.2` per category empty when one would be expected.
- Drops `0.1` per item where `confidence < 0.5` or `quote` is missing.
- Floor at `0.0`, ceiling at `1.0`.

## Run it end-to-end

1. Lint the routine:

   ```
   npx caboc lint examples/07-meeting-notes-actions
   ```

2. Seed a run:

   ```
   mkdir -p examples/07-meeting-notes-actions/runs/local-001
   cp examples/07-meeting-notes-actions/__fixtures__/sample-inputs.json \
      examples/07-meeting-notes-actions/runs/local-001/inputs.json
   ```

3. In a Claude Code session, load the `caboc-runtime` skill and ask:

   > run routine `examples/07-meeting-notes-actions` with inputs from
   > `runs/local-001/inputs.json`

4. Inspect:

   ```
   npx caboc inspect examples/07-meeting-notes-actions/runs/local-001/
   ```

## License

Apache-2.0.
