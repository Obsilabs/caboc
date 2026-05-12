---
workflow: error_log_cluster
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Group raw application/infrastructure log lines into stable error signatures,
  count occurrences, tag severity, and emit an SRE-friendly investigation
  plan. Two specialist agents run sequentially: the first derives signatures
  from variable-laden text, the second ranks them and writes a markdown plan.

io:
  inputs:
    log_lines: { type: array, items: { type: string } }
    window_minutes: { type: integer, optional: true }
  outputs:
    groups:
      type: array
      items:
        type: object
        properties:
          signature: { type: string }
          count: { type: integer }
          severity: { enum: [low, medium, high, critical] }
          suggested_check: { type: string }
          example_line: { type: string }
    priority_order: { type: array, items: { type: string } }
    investigation_plan_md: { type: string }

budget:
  tokens: 8000
  wall_minutes: 3
---

# Error Log Cluster (LLM-runtime)

PROCEDURE.

  STEP extract_signatures NON_DETERMINISTIC.
    DESCRIPTION. "Group log lines by error signature. Strip timestamps, request ids, addresses."
    USE AGENT signature_extractor SESSION fresh WITH inputs={
      log_lines: log_lines,
      window_minutes: window_minutes
    }.
    OUTPUT sig_out.
  END STEP.

  STEP prioritize NON_DETERMINISTIC.
    DESCRIPTION. "Rank signatures by severity then count; emit ordered list + markdown plan."
    USE AGENT prioritizer SESSION fresh WITH inputs={
      groups: sig_out.groups
    }.
    OUTPUT pri_out.
    EMIT groups := sig_out.groups.
    EMIT priority_order := pri_out.priority_order.
    EMIT investigation_plan_md := pri_out.investigation_plan_md.
    GOTO step.finalize.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
