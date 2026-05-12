---
workflow: meeting_notes_to_actions
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Turn a raw meeting transcript into a structured brief. Four specialist
  extractors pull decisions, action items, blockers, and followups in
  parallel; a synthesizer dedupes, ranks, writes the summary markdown,
  and scores attention quality.

io:
  inputs:
    meeting_title: { type: string }
    meeting_date: { type: string, format: date }
    participants: { type: array, items: string }
    transcript: { type: string }
  outputs:
    decisions: { type: array }
    actions: { type: array }
    blockers: { type: array }
    followups: { type: array }
    summary_md: { type: string }
    attention_score: { type: number }

budget:
  tokens: 24000
  wall_minutes: 6
---

# Meeting Notes to Actions (LLM-runtime)

PROCEDURE.

  PARALLEL JOIN_POLICY=all.

    STEP extract_decisions NON_DETERMINISTIC.
      DESCRIPTION. "Pull decisions actually made (not deferred discussion)."
      USE AGENT decisions_extractor SESSION fresh WITH inputs={
        meeting_title: meeting_title,
        meeting_date: meeting_date,
        participants: participants,
        transcript: transcript
      }.
      OUTPUT dec_out.
    END STEP.

    STEP extract_actions NON_DETERMINISTIC.
      DESCRIPTION. "Pull action items with owner, due date, priority."
      USE AGENT actions_extractor SESSION fresh WITH inputs={
        meeting_title: meeting_title,
        meeting_date: meeting_date,
        participants: participants,
        transcript: transcript
      }.
      OUTPUT act_out.
    END STEP.

    STEP extract_blockers NON_DETERMINISTIC.
      DESCRIPTION. "Pull anything explicitly blocked or pending external input."
      USE AGENT blockers_extractor SESSION fresh WITH inputs={
        meeting_title: meeting_title,
        meeting_date: meeting_date,
        participants: participants,
        transcript: transcript
      }.
      OUTPUT blk_out.
    END STEP.

    STEP extract_followups NON_DETERMINISTIC.
      DESCRIPTION. "Pull topics scheduled for a follow-up meeting or async."
      USE AGENT followups_extractor SESSION fresh WITH inputs={
        meeting_title: meeting_title,
        meeting_date: meeting_date,
        participants: participants,
        transcript: transcript
      }.
      OUTPUT fup_out.
    END STEP.

  END PARALLEL.

  STEP synthesize NON_DETERMINISTIC.
    DESCRIPTION. "Dedupe, rank, write brief, score attention quality."
    USE AGENT notes_synthesizer SESSION fresh WITH inputs={
      meeting_title: meeting_title,
      meeting_date: meeting_date,
      participants: participants,
      decisions: dec_out.decisions,
      actions: act_out.actions,
      blockers: blk_out.blockers,
      followups: fup_out.followups
    }.
    OUTPUT synth.
    EMIT decisions := synth.decisions.
    EMIT actions := synth.actions.
    EMIT blockers := synth.blockers.
    EMIT followups := synth.followups.
    EMIT summary_md := synth.summary_md.
    EMIT attention_score := synth.attention_score.
    GOTO step.finalize.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
