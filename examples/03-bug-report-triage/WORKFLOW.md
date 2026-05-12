---
workflow: bug_report_triage
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Triage an inbound bug-report ticket and propose the next concrete action.
  Reads subject/body plus optional customer tier and product area; emits
  severity, most-likely component, reproducibility judgement, a polite draft
  reply, and a routing decision (escalate / ask for repro / KB / engineering).

io:
  inputs:
    ticket_subject: { type: string }
    ticket_body: { type: string }
    customer_tier: { enum: [free, pro, enterprise], optional: true }
    product_area: { type: string, optional: true }
  outputs:
    severity: { enum: [low, medium, high, critical] }
    component: { type: string }
    reproducible: { type: boolean }
    next_action: { enum: [ask_repro, assign_engineering, knowledge_base, escalate_oncall] }
    draft_reply_md: { type: string }
    confidence: { type: number }

budget:
  tokens: 4000
  wall_minutes: 2
---

# Bug Report Triage (LLM-runtime)

PROCEDURE.

  STEP triage NON_DETERMINISTIC.
    DESCRIPTION. "Read ticket, infer severity/component/reproducible, draft a reply."
    USE AGENT triager SESSION fresh WITH inputs={
      ticket_subject: ticket_subject,
      ticket_body: ticket_body,
      customer_tier: customer_tier,
      product_area: product_area
    }.
    OUTPUT result.
    EMIT severity := result.assessment.severity.
    EMIT component := result.assessment.component.
    EMIT reproducible := result.assessment.reproducible.
    EMIT draft_reply_md := result.assessment.draft_reply_md.
    EMIT confidence := result.assessment.confidence.
  END STEP.

  STEP route DETERMINISTIC.
    DESCRIPTION. "Pick the next concrete action from the agent's assessment."
    IF severity = "critical" THEN
      EMIT next_action := "escalate_oncall".
      GOTO step.finalize.
    ELSE IF reproducible = false THEN
      EMIT next_action := "ask_repro".
      GOTO step.finalize.
    ELSE IF result.assessment.has_kb_match = true THEN
      EMIT next_action := "knowledge_base".
      GOTO step.finalize.
    ELSE
      EMIT next_action := "assign_engineering".
      GOTO step.finalize.
    END IF.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
