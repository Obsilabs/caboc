---
workflow: email_thread_summarize
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  TL;DR an email thread, extract commitments and open questions, classify
  sentiment, and draft a suggested reply with an appropriate tone. A
  single reasoning agent handles the full synthesis in one pass.

io:
  inputs:
    thread:
      type: array
      items:
        type: object
        properties:
          from: { type: string, format: email }
          ts: { type: string, format: date-time }
          body: { type: string }
    our_team_domain: { type: string }
  outputs:
    tldr_md: { type: string }
    participants:
      type: array
      items:
        type: object
        properties:
          email: { type: string }
          role: { type: string, enum: [us, customer, partner, other] }
    open_questions:
      type: array
      items: { type: string }
    commitments:
      type: array
      items:
        type: object
        properties:
          who: { type: string }
          what: { type: string }
          when: { type: string }
    sentiment: { type: string, enum: [positive, neutral, at_risk] }
    suggested_reply_md: { type: string }
    suggested_reply_tone: { type: string, enum: [concise, empathetic, escalate] }

budget:
  tokens: 12000
  wall_minutes: 3
---

# Email Thread Summarize (LLM-runtime)

PROCEDURE.

  STEP synthesize NON_DETERMINISTIC.
    DESCRIPTION. "Single-turn agent: read thread, derive all outputs."
    USE AGENT thread_synthesizer SESSION fresh WITH inputs={
      thread: thread,
      our_team_domain: our_team_domain
    }.
    OUTPUT syn_out.
    EMIT tldr_md := syn_out.summary.tldr_md.
    EMIT participants := syn_out.summary.participants.
    EMIT open_questions := syn_out.summary.open_questions.
    EMIT commitments := syn_out.summary.commitments.
    EMIT sentiment := syn_out.summary.sentiment.
    EMIT suggested_reply_md := syn_out.summary.suggested_reply_md.
    EMIT suggested_reply_tone := syn_out.summary.suggested_reply_tone.
    GOTO step.finalize.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
