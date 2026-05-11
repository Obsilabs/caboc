<!--
SPDX-FileCopyrightText: 2026 CABOC contributors
SPDX-License-Identifier: Apache-2.0
-->

# Contributing to CABOC

Thanks for your interest. CABOC is Apache 2.0, community-driven, and welcomes
pull requests, issues, and discussions.

## Before you start

1. Read `CODE_OF_CONDUCT.md`.
2. Skim `docs/norms/README.md` — every norm is short and load-bearing.
3. Open an issue for any non-trivial change so we can align on scope before
   you write code.

## Developer Certificate of Origin (DCO)

All commits must be signed off:

```sh
git commit -s -m "feat(runtime): parse WORKFLOW.md frontmatter"
```

The `-s` flag appends a `Signed-off-by:` trailer asserting your right to
contribute under the project license. PRs missing DCO sign-off will be
blocked by CI.

## Commits

We follow **Conventional Commits 1.0**. See `docs/norms/STANDARDS_COMMITS.md`.

```
<type>(<scope>): <subject>

<body>

<footer>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`,
`build`, `ci`, `perf`.

Scope is typically a package (`runtime`, `cli`) or routine name.

## Branches and PRs

- Branch from `main`. Name branches `<type>/<short-slug>`
  (e.g. `feat/workflow-parser`).
- Open a draft PR early; mark ready when CI is green.
- Squash-merge only. PR title must itself be a valid conventional commit.
- See `docs/norms/STANDARDS_PR.md` for the required checks.

## Local development

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

CI runs the same four commands. If any fails locally, it will fail in CI.

## Filing issues

- Bugs: include a minimal reproduction, expected vs actual behaviour, Node
  version, and `caboc --version` output.
- Feature requests: state the problem first; proposed solutions are
  welcome but secondary.
- Security: do **not** open a public issue. See `SECURITY.md`.

## Licensing of contributions

By submitting a contribution you license it under Apache 2.0 (see `LICENSE`)
and assert the DCO. Every new source file must carry the SPDX headers
documented in `docs/norms/STANDARDS_LICENSING.md`.
