---
workflow: design_doc_adversarial
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Adversarial review of a design / architecture proposal. Two parallel
  reviewers (a blind-spot hunter and a tradeoff critic) read the same
  doc independently; a synthesizer merges them, dedupes, and ships a
  reject / revise / approve recommendation with a written rationale.
  Aimed at architects and senior engineers running pre-merge or
  pre-RFC review.

io:
  inputs:
    doc_md: { type: string }
    proposal_scope: { enum: [bugfix, refactor, feature, architecture] }
    target_release: { type: string, optional: true }
  outputs:
    critiques:
      type: array
      items:
        type: object
        properties:
          section_ref: { type: string }
          severity: { enum: [info, minor, major, blocker] }
          concern: { type: string }
          alternative: { type: string }
    blind_spots:
      type: array
      items:
        type: object
        properties:
          spot: { type: string }
          why_missed: { type: string }
    recommend: { enum: [approve, revise, reject] }
    rationale_md: { type: string, maxLength: 2500 }

budget:
  tokens: 16000
  wall_minutes: 5
---

# Design Doc Adversarial Review (LLM-runtime)

PROCEDURE.

  PARALLEL JOIN_POLICY=all.

    STEP hunt_blind_spots NON_DETERMINISTIC.
      DESCRIPTION. "Look for what the doc fails to consider."
      USE AGENT blind_spot_hunter SESSION fresh WITH inputs={
        doc_md: doc_md,
        proposal_scope: proposal_scope,
        target_release: target_release
      }.
      OUTPUT bsh_out.
    END STEP.

    STEP critique_tradeoffs NON_DETERMINISTIC.
      DESCRIPTION. "Find tradeoffs the doc states OR implies — challenge each one."
      USE AGENT tradeoff_critic SESSION fresh WITH inputs={
        doc_md: doc_md,
        proposal_scope: proposal_scope,
        target_release: target_release
      }.
      OUTPUT tc_out.
    END STEP.

  END PARALLEL.

  STEP synthesize NON_DETERMINISTIC.
    DESCRIPTION. "Merge perspectives. Decide recommend."
    USE AGENT review_synthesizer SESSION fresh WITH inputs={
      doc_md: doc_md,
      proposal_scope: proposal_scope,
      blind_spots: bsh_out.blind_spots,
      tradeoff_critiques: tc_out.critiques
    }.
    OUTPUT syn_out.
    EMIT critiques := syn_out.critiques.
    EMIT blind_spots := syn_out.blind_spots.
    EMIT recommend := syn_out.recommend.
    EMIT rationale_md := syn_out.rationale_md.
    GOTO step.finalize.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
