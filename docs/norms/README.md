# CABOC norms

Project conventions for the CABOC repository. Every contributor — human
or AI assistant — is expected to read the relevant file before opening
a PR.

## Index

| File                              | Scope                                                         |
| --------------------------------- | ------------------------------------------------------------- |
| `STANDARDS_NAMING.md`             | Package names, file names, agent + routine identifiers.       |
| `STANDARDS_LICENSING.md`          | Apache 2.0, NOTICE, SPDX headers, REUSE 3.3.                  |
| `STANDARDS_CODE.md`               | TypeScript baseline, Biome formatter, naming, imports.        |
| `STANDARDS_COMMITS.md`            | Conventional Commits 1.0 — types, scopes, footers.            |
| `STANDARDS_PR.md`                 | PR title format, review process, squash-merge policy.         |
| `STANDARDS_TESTS.md`              | Vitest, fixtures, snapshot rules, mock-LLM patterns.          |
| `STANDARDS_DOCS.md`               | README discipline, link checks, ATX-only headings.            |
| `STANDARDS_SECURITY.md`           | Coord-disclosure mirror, sandbox guidance for routines.       |
| `STANDARDS_ROUTINES.md`           | Routine + agent frontmatter contracts.                        |
| `STANDARDS_DISTRIBUTION.md`       | `caboc add` source forms, content hashing, lockfile, TOFU.    |
| `STANDARDS_ALIASES.md`            | `caboc run` alias config + resolution precedence.             |
| `STANDARDS_GRAMMAR.md`            | Body grammar v0.2 reference — every keyword + cross-link.     |
| `STANDARDS_TOOLS.md`              | `USE TOOL` semantics + TOOL.md manifest + sandbox.            |
| `STANDARDS_LOOPS.md`              | LOOP / REPEAT / FOR_EACH / PARALLEL CONCURRENCY / COLLECT / BREAK / SET. |
| `STANDARDS_HITL.md`               | `STEP HITL` + `PROMPT TO` + `AWAIT FROM human` + resume flow. |
| `STANDARDS_SUBROUTINES.md`        | `INVOKE WORKFLOW` + recursion limit + state isolation.        |
| `STANDARDS_OUTPUTS.md`            | File-typed outputs, scratch_dirs, `caboc bundle`.             |
| `STANDARDS_PROVIDER_ROLES.md`     | Agent `provider_role` + config `roles[]` mapping.             |
| `STANDARDS_RELEASES.md`           | Changesets, semver, CHANGELOG per package.                    |

## Status

All norms are at **draft v0.1** or **draft v0.2** (see header of each
file). Major changes require an RFC PR against `docs/norms/` reviewed
by at least two maintainers.

## Conventions of this folder

- Each `STANDARDS_*.md` is self-contained and links to siblings rather
  than duplicating content.
- All examples are runnable; pasted-in shell blocks assume the repo
  root as cwd.
- All recommendations come with a "Why" line so readers can challenge
  the rule on its merits.
