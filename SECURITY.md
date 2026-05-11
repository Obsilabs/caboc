# Security Policy

## Reporting a vulnerability

Email **security@caboc.example** with:

- A clear description of the issue.
- Steps to reproduce (or a proof-of-concept).
- Affected versions, components, or routines.
- Your name / handle if you want public credit; otherwise we keep your
  report anonymous.

Please do **not** open a public GitHub issue for security reports.

## Response targets

| Severity | Triage   | Patch SLA           | Disclosure window |
| -------- | -------- | ------------------- | ----------------- |
| Critical | 24 h     | 72 h                | Coordinated, ≤ 7 d after patch |
| High     | 48 h     | 7 calendar days     | Coordinated, ≤ 14 d after patch |
| Medium   | 5 days   | 30 calendar days    | Coordinated, ≤ 30 d after patch |
| Low      | 10 days  | Next minor release  | Public on release |

We follow a coordinated-disclosure model. We will not file CVEs without
your awareness.

## Scope

In scope:

- The `@caboc/*` packages published from this repository.
- The `caboc-runtime` skill (SKILL.md + manifest.json).
- Example routines under `examples/`.
- Documentation in `docs/`.

Out of scope:

- Third-party dependencies (report upstream first; we will track).
- Hosted services or websites unrelated to this repository.
- The behavior of an LLM provider executing a routine — that is the
  provider's responsibility, not ours.

## Hardening notes for routine authors

CABOC routines are executed by an LLM main loop with file-system access
limited to `runs/<run-id>/` plus read-only access to `WORKFLOW.md` and
`agents/`. Authors must:

- Never store secrets in routine files or in committed `runs/`.
- Treat agent prompts as code: review changes through PRs.
- Ensure `io.outputs` schemas reject unbounded fields that could
  exfiltrate large amounts of input data into the transcript.
- Use the `caboc lint` denylist to prevent accidental model literals or
  provider URLs in routine source.

## Acknowledgements

Public credit and a place on `SECURITY_HALL_OF_FAME.md` (created on
first report) are offered to every reporter who opts in.
