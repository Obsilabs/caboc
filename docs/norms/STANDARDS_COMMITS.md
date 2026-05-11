# STANDARDS_COMMITS — Commit message conventions

> Status: draft v0.1
> Scope: every commit on every CABOC repo.

## 1. Format — Conventional Commits 1.0

```
<type>(<scope>): <short summary>

<optional body>

<optional footers>
```

Reference: <https://www.conventionalcommits.org/en/v1.0.0/>.

## 2. Allowed types (closed set)

| Type       | Use                                                                |
| ---------- | ------------------------------------------------------------------ |
| `feat`     | A new user-facing capability.                                      |
| `fix`      | A bug fix observable from the outside.                             |
| `docs`     | Documentation only (no code change).                               |
| `style`    | Code style change without behaviour impact (formatter, lint fix).  |
| `refactor` | Code restructure with no behaviour change and no public API change. |
| `perf`     | Performance improvement, no behaviour change.                      |
| `test`     | Tests only.                                                        |
| `build`    | Build system, package config, dependency updates that affect build. |
| `ci`       | CI configuration only.                                             |
| `chore`    | Tooling, repo housekeeping, non-code changes.                      |

Anything else: open an RFC PR against this file.

## 3. Scope (recommended)

The scope is the package name (without `@caboc/` prefix) or the routine
slug:

- `cli`, `runtime`, `skill-runtime`, `conformance`
- `example-commit-message`, `routine-pr-triage`
- `norms`, `release` for repo-wide changes

Multi-scope changes split into multiple commits when possible.

## 4. Subject

- ≤ 72 characters.
- Imperative mood: "add x", not "added x", not "adds x".
- No trailing period.
- Lowercase first word (the type already handled capitalization).

## 5. Body

- Optional.
- Wrap at 100 columns.
- Explain the **why**, not the **what**. The diff already shows the what.
- Reference issues with `#NNN`. Use `Closes #NNN` only in the footer.

## 6. Footers

- `BREAKING CHANGE: <description>` — mandatory for any breaking change,
  even on `feat:` or `fix:`. Triggers a major version bump.
- `Closes #NNN`, `Refs #NNN`, `Reviewed-by: <name>`, `Co-authored-by: <name <email>>`.
- `Signed-off-by: <name <email>>` per the Developer Certificate of
  Origin if the package requires DCO.

## 7. Examples

Good:

```
feat(cli): add `caboc inspect` command for run dirs

Reads `runs/<run-id>/transcript.ndjson`, prints per-step durations,
counts repair events, surfaces assertion failures.

Closes #42
```

```
fix(skill-runtime): default SESSION to fresh when omitted

The runtime previously crashed with `session_mode_required` when a
USE AGENT call omitted the SESSION clause. Default behaviour is now
documented in the SKILL.md body.

Refs #58
```

```
chore(deps): bump zod to 3.23.8
```

Bad:

```
Added cli inspect            # missing type
feat: cli inspect            # missing scope
feat(cli): added inspect.    # past tense + trailing period
WIP                          # not a conventional commit
[feat] cli inspect           # brackets
```

## 8. Validation

`commitlint` runs on `commit-msg` (locally via `husky` or `lefthook`) and
on every `pull_request` event in CI. PRs with a non-conforming title or
commits with non-conforming messages are blocked from merging.

## 9. Squash-merge

All PRs are squash-merged into `main`. The PR title becomes the merged
commit subject; the PR body becomes the merged commit body. Therefore
the PR title **must** be a valid Conventional Commit.
