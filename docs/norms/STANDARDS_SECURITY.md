# STANDARDS_SECURITY — Security baseline

> Status: draft v0.1
> Scope: every CABOC package, routine, and runtime invocation.

## 1. Coordinated vulnerability disclosure

See `/SECURITY.md` at the repo root for the canonical disclosure policy,
contact address, and response SLAs. This norms file describes the
engineering practices that prevent vulnerabilities in the first place.

## 2. Threat model — routine execution

A CABOC routine is executed by an LLM main loop that has filesystem
access. The runtime treats the routine itself as **trusted input** (the
author committed it) and the routine's `inputs` as **untrusted input**
(typically user-provided).

Out of scope of this threat model:

- Compromise of the host LLM provider.
- Prompt injection inside `inputs` is partially mitigated (agents are
  instructed to ignore meta-instructions in inputs), but full
  resistance is the routine author's responsibility.

## 3. Filesystem sandbox

Per the SKILL.md contract, the runtime may only:

- **Read** `WORKFLOW.md` and `agents/*.agent.md` inside the routine
  directory.
- **Read** `runs/<run-id>/inputs.json` and `runs/<run-id>/state.json`
  it previously wrote.
- **Append** to `runs/<run-id>/transcript.ndjson`.
- **Write** to `runs/<run-id>/state.json`, `runs/<run-id>/outputs.json`,
  `runs/<run-id>/error.json`, `runs/<run-id>/sessions/<agent>.transcript.json`.

Any write outside `runs/<run-id>/` is a sandbox violation and is a
P0 bug.

## 4. Secrets

- Routine source files **must never** contain secrets, API keys, OAuth
  tokens, or signed URLs.
- Inputs may carry references (e.g. a record id, a contract id) but
  **must not** carry raw credentials.
- `caboc lint` runs a credential scanner (e.g. `gitleaks` config) over
  every routine in CI.

## 5. Input validation

- Every workflow declares `io.inputs` as a JSON schema.
- The runtime validates `inputs.json` against this schema before
  starting the run; an invalid input fails fast with
  `CABOC_E_INPUT_VALIDATION_FAILED`.
- Every agent declares `io.outputs` as a JSON schema.
- The runtime validates agent JSON output against this schema; up to
  two repair retries before failing with `CABOC_E_AGENT_OUTPUT_INVALID`.

## 6. Output redaction

Output schemas should bound free-text fields with `maxLength`. An
unbounded `body_md: string` field is a vector for exfiltrating large
amounts of input data into transcripts that may be shared. Lint rule:
flag any string field without `maxLength`.

## 7. The denylist

`caboc lint` rejects any routine, agent, skill, example, or doc that
contains a literal LLM model name. This prevents:

- Vendor lock-in via accidental coupling.
- Side-channel inference of provider routing.
- Stale references to deprecated models.

## 8. Dependency hygiene

- `pnpm audit` runs in CI and fails on `high` or `critical` advisories.
- Renovate / Dependabot tracks upgrades; security patches merge within
  the SLA in `SECURITY.md`.

## 9. Reproducibility

- Routine lockfiles (`routine.lock`, v0.2+) pin agent.md sha256 + spec
  version so a 6-month-old run can be reproduced.
- The transcript NDJSON is append-only; hash-chain integrity is
  optional in v0.1, required for compliance use cases in v0.2.

## 10. Supply chain

- Published packages are signed (sigstore or npm provenance).
- The `caboc-runtime` skill `manifest.json` includes a `sha256` field
  pinning the SKILL.md content for hosts that mirror the registry.
- Community routines installed via `npx caboc install <url>` pass
  through TOFU + content-hash verification at first install.
