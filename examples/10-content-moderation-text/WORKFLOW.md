---
workflow: content_moderation_text
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Score a piece of user-generated text against 8 trust-and-safety policy
  buckets, propose a moderation verdict (allow / shadow_ban / block /
  takedown), surface the verbatim phrases that drove the scores, and
  decide whether the case still needs a human reviewer. Audience: a
  trust-and-safety team that wants a fast, consistent first-pass triage
  before queuing borderline content to a human moderator.

io:
  inputs:
    text: { type: string }
    policy_summary: { type: string, optional: true }
    account_age_days: { type: integer, optional: true }
  outputs:
    scores:
      type: object
      properties:
        sexual: { type: number, minimum: 0, maximum: 1 }
        violence: { type: number, minimum: 0, maximum: 1 }
        hate: { type: number, minimum: 0, maximum: 1 }
        self_harm: { type: number, minimum: 0, maximum: 1 }
        illegal: { type: number, minimum: 0, maximum: 1 }
        spam: { type: number, minimum: 0, maximum: 1 }
        pii_leak: { type: number, minimum: 0, maximum: 1 }
        csam: { type: number, minimum: 0, maximum: 1 }
    verdict: { enum: [allow, shadow_ban, block, takedown] }
    flagged_phrases:
      type: array
      items: { type: string }
    rationale_md: { type: string, maxLength: 800 }
    requires_human_review: { type: boolean }

budget:
  tokens: 4000
  wall_minutes: 2
---

# Content Moderation — Text (LLM-runtime)

PROCEDURE.

  STEP moderate NON_DETERMINISTIC.
    DESCRIPTION. "Single-turn moderation pass over the text."
    USE AGENT moderator SESSION fresh WITH inputs={
      text: text,
      policy_summary: policy_summary,
      account_age_days: account_age_days
    }.
    OUTPUT mod_out.
    EMIT scores := mod_out.assessment.scores.
    EMIT verdict := mod_out.assessment.verdict.
    EMIT flagged_phrases := mod_out.assessment.flagged_phrases.
    EMIT rationale_md := mod_out.assessment.rationale_md.
  END STEP.

  STEP route DETERMINISTIC.
    DESCRIPTION. "Set requires_human_review based on verdict + age."
    IF verdict = "takedown" THEN
      EMIT requires_human_review := true.
      GOTO step.finalize.
    ELSE IF verdict = "block" AND account_age_days > 90 THEN
      EMIT requires_human_review := true.
      GOTO step.finalize.
    ELSE
      EMIT requires_human_review := mod_out.assessment.requires_human_review.
      GOTO step.finalize.
    END IF.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
