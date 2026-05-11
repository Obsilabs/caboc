---
workflow: commit_message
version: 0.1.0
spec_version: caboc-llm/0.1.0
description: |
  Generate a Conventional Commits message from a unified diff. Returns
  type/scope/subject/body plus a breaking-change flag and citations to
  the lines that motivated each part of the message.

io:
  inputs:
    diff: { type: string }
    repo_name: { type: string, optional: true }
    target_branch: { type: string, optional: true, default: main }
  outputs:
    type: { enum: [feat, fix, docs, style, refactor, test, chore, build, ci, perf] }
    scope: { type: string }
    subject: { type: string }
    body_md: { type: string }
    breaking_change: { type: boolean }
    breaking_note: { type: string }
    confidence: { type: number }

budget:
  tokens: 4000
  wall_minutes: 2
---

# Commit Message (LLM-runtime)

PROCEDURE.

  STEP draft NON_DETERMINISTIC.
    DESCRIPTION. "Single-turn agent: parse diff, propose Conventional Commits message."
    USE AGENT commit_drafter SESSION fresh WITH inputs={
      diff: diff,
      repo_name: repo_name,
      target_branch: target_branch
    }.
    OUTPUT msg.
    EMIT type := msg.commit.type.
    EMIT scope := msg.commit.scope.
    EMIT subject := msg.commit.subject.
    EMIT body_md := msg.commit.body_md.
    EMIT breaking_change := msg.commit.breaking_change.
    EMIT breaking_note := msg.commit.breaking_note.
    EMIT confidence := msg.commit.confidence.
    GOTO step.finalize.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Terminal — runtime writes outputs.json."
  END STEP.

END PROCEDURE.

END WORKFLOW.
