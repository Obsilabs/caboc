---
workflow: readme_quality_audit
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Score a project README on six dimensions (what-is-it, install, usage,
  API reference, license, contributing), list concretely-missing sections,
  write a 2-3 paragraph critique, and assign an overall letter grade.
  Audience: an OSS maintainer who wants a fast, consistent first pass
  before tightening their docs.

io:
  inputs:
    readme_md: { type: string }
    repo_name: { type: string }
    package_kind: { enum: [cli, lib, app, framework] }
  outputs:
    scores:
      type: object
      properties:
        what: { type: integer, minimum: 0, maximum: 10 }
        install: { type: integer, minimum: 0, maximum: 10 }
        usage: { type: integer, minimum: 0, maximum: 10 }
        api: { type: integer, minimum: 0, maximum: 10 }
        license: { type: integer, minimum: 0, maximum: 10 }
        contributing: { type: integer, minimum: 0, maximum: 10 }
    missing_sections:
      type: array
      items: { type: string }
    critique_md: { type: string }
    overall_grade: { enum: [A, B, C, D, F] }

budget:
  tokens: 4000
  wall_minutes: 2
---

# README Quality Audit (LLM-runtime)

PROCEDURE.

  STEP audit NON_DETERMINISTIC.
    DESCRIPTION. "Score the README on 6 dimensions, identify missing sections, write critique, assign grade."
    USE AGENT readme_auditor SESSION fresh WITH inputs={
      readme_md: readme_md,
      repo_name: repo_name,
      package_kind: package_kind
    }.
    OUTPUT audit_out.
    EMIT scores := audit_out.audit.scores.
    EMIT missing_sections := audit_out.audit.missing_sections.
    EMIT critique_md := audit_out.audit.critique_md.
    EMIT overall_grade := audit_out.audit.overall_grade.
    GOTO step.finalize.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
