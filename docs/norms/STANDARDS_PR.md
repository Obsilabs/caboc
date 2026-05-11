# STANDARDS_PR — Pull Request conventions

> Status: draft v0.1
> Scope: every Pull Request on every CABOC repo.

## 1. PR title

PR title follows the same format as commit headers (see
`STANDARDS_COMMITS.md`):

```
<type>(<scope>): <short summary>
```

Because public repos use squash-merge, the PR title becomes the merged
commit subject on `main`. Therefore the title **must** be a valid
Conventional Commit.

## 2. PR body template

```
## What

<one paragraph: what changed at a high level>

## Why

<one paragraph: why this change, what problem it solves>

## How

<bullets describing the approach, especially decisions a reviewer
needs to question>

## Testing

<how the change was verified — unit tests, manual reproduction,
fixture diffs>

## Checklist

- [ ] Conventional Commits PR title.
- [ ] Tests added / updated.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean locally.
- [ ] No LLM model names anywhere in the diff.
- [ ] If the diff touches `docs/norms/`, RFC discussion linked.
- [ ] If the diff introduces a breaking change, footer added.
```

The template lives at `.github/pull_request_template.md` and is
auto-populated on PR open.

## 3. Required checks

Every PR must pass before merge:

| Check                     | What                                                            |
| ------------------------- | --------------------------------------------------------------- |
| `commitlint`              | Title matches Conventional Commits 1.0.                         |
| `lint`                    | `pnpm lint` clean (Biome).                                      |
| `typecheck`               | `pnpm typecheck` clean (TypeScript).                            |
| `test`                    | `pnpm test` clean (Vitest).                                     |
| `caboc-lint-fixtures`     | `pnpm caboc lint examples/*` clean (routine validity).          |
| `license-check`           | No forbidden licenses in the dependency graph.                  |
| `denylist-check`          | No LLM model literals in source files or routine files.         |

Required reviewers: one maintainer for code changes, two for any change
under `docs/norms/`.

## 4. Squash-merge

All PRs are squash-merged. No merge commits, no rebase-merges. The PR
title becomes the `main` commit subject.

## 5. Branch naming

```
<author>/<type>/<short-slug>
```

Examples:

- `alice/feat/cli-inspect-cmd`
- `bob/fix/skill-runtime-session-default`
- `chore/deps/bump-zod`

Personal branches live on author forks for community contributions; on
the main repo for maintainers.

## 6. Draft PRs

Open early as a draft. Mark "Ready for review" only when CI is green.
Reviewers ignore draft PRs unless explicitly pinged.

## 7. Stale PRs

A PR with no activity for 30 days is auto-labelled `stale`. After 60
days it is auto-closed. Authors can reopen with a comment.

## 8. RFC PRs against `docs/norms/`

Norm changes require a dedicated PR that:

- Has the title prefix `rfc(norms): ...`.
- Includes a "Decision drivers" section explaining the rationale.
- Stays open for at least 7 calendar days before merge.
- Requires two maintainer approvals.

After merge, the change is announced in `CHANGELOG.md` at the repo root.
