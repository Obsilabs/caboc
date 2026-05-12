---
workflow: customer_feedback_clusters
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Cluster a batch of customer feedback items by underlying theme and
  summarize the top themes in a markdown brief. Aimed at product and
  customer-experience teams scanning weekly inbound feedback for signal.

io:
  inputs:
    feedback_items:
      type: array
      items:
        type: object
        properties:
          id: { type: string }
          text: { type: string }
          source: { type: string }
  outputs:
    clusters:
      type: array
      items:
        type: object
        properties:
          theme: { type: string, maxLength: 60 }
          sentiment: { enum: [positive, negative, neutral, mixed] }
          ids:
            type: array
            items: { type: string }
          representative_quote: { type: string, maxLength: 200 }
    top_themes_summary_md: { type: string, maxLength: 1500 }

budget:
  tokens: 6000
  wall_minutes: 3
---

# Customer Feedback Clusters (LLM-runtime)

PROCEDURE.

  STEP cluster NON_DETERMINISTIC.
    DESCRIPTION. "Group feedback items by underlying theme; tag each cluster's sentiment."
    USE AGENT clusterer SESSION fresh WITH inputs={ feedback_items: feedback_items }.
    OUTPUT cluster_out.
  END STEP.

  STEP summarize NON_DETERMINISTIC.
    DESCRIPTION. "Write a markdown brief of the top 3 themes with concrete examples."
    USE AGENT summarizer SESSION fresh WITH inputs={ clusters: cluster_out.clusters }.
    OUTPUT summary_out.
    EMIT clusters := cluster_out.clusters.
    EMIT top_themes_summary_md := summary_out.summary_md.
    GOTO step.finalize.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
