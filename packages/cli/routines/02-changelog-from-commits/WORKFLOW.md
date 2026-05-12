---
workflow: changelog_from_commits
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Generate a user-facing CHANGELOG entry from a list of Conventional
  Commits messages. Infers semver bump, groups commits into Features /
  Fixes / Breaking / Notes, and drafts release-manager-ready markdown
  tuned to the requested audience.

io:
  inputs:
    commits:
      type: array
      items: { type: string }
    since_version: { type: string, optional: true }
    audience: { enum: [users, developers, all], default: users }
  outputs:
    version_bump: { enum: [major, minor, patch] }
    sections:
      type: object
      properties:
        features: { type: array, items: { type: string } }
        fixes: { type: array, items: { type: string } }
        breaking: { type: array, items: { type: string } }
        notes: { type: array, items: { type: string } }
    markdown: { type: string }

budget:
  tokens: 4000
  wall_minutes: 2
---

# Changelog From Commits (LLM-runtime)

PROCEDURE.

  STEP draft NON_DETERMINISTIC.
    DESCRIPTION. "Single-turn agent: parse commits, infer bump, categorize, draft markdown."
    USE AGENT changelog_writer SESSION fresh WITH inputs={
      commits: commits,
      since_version: since_version,
      audience: audience
    }.
    OUTPUT result.
    EMIT version_bump := result.changelog.version_bump.
    EMIT sections := result.changelog.sections.
    EMIT markdown := result.changelog.markdown.
    GOTO step.finalize.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
