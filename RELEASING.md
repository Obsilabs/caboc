# Releasing CABOC packages

Reference checklist for maintainers publishing a CABOC package to npm.
See `docs/norms/STANDARDS_RELEASES.md` for the full policy.

## Prerequisites

- `pnpm` 9.x installed.
- `gh` authenticated against `Obsilabs` org.
- npm authenticated against the publisher account (see "First-time setup").
- The `@caboc` npm scope owned or shared with the publisher account.

## First-time setup

### 1. Authenticate npm

```
npm login
npm whoami        # confirm
```

`npm login` writes the auth token to `~/.npmrc`. **Never** commit that
file. The committed `.npmrc` at the repo root has no token in it.

### 2. Verify the scope exists

```
npm view @caboc/cli   # 404 means the scope is unclaimed
```

If unclaimed:

```
# from a maintainer account with publish rights:
npm org create caboc        # if your account is an org admin
# OR claim the scope by publishing a first package under it
```

### 3. Verify provenance (npm 9+)

The committed `.npmrc` sets `provenance=true`. This requires the publish
to happen from a CI environment with OIDC support, or with
`NPM_CONFIG_PROVENANCE=true` and a sigstore-compatible toolchain. From
a local laptop, you can override per-publish with `--no-provenance` if
you do not have OIDC.

## Per-release flow

### 1. Create a changeset

```
pnpm changeset
```

Pick the package(s), pick major / minor / patch, write the entry. The
generated file lands in `.changeset/`.

### 2. Open a PR with the changeset

```
git checkout -b release/<pkg>-<version>
git add .changeset
git commit -m "chore(release): add changeset for <pkg>@<version>"
git push -u origin release/<pkg>-<version>
gh pr create --fill
```

Wait for CI green + reviewer approval.

### 3. Bump versions + generate CHANGELOGs

After the changeset PR merges to `main`, a maintainer runs the version
PR:

```
git checkout main && git pull
pnpm changeset version
git checkout -b release/version-bump
git add -A
git commit -m "chore(release): version bump"
git push -u origin release/version-bump
gh pr create --fill
```

Squash-merge that PR.

### 4. Publish

After the version PR is on `main`:

```
git checkout main && git pull
pnpm -r build
pnpm changeset publish
```

The default dist-tag is `next` (per the committed `.npmrc`) for any
version matching `*-rc.*` or `*-beta.*`. A stable release goes to
`latest` automatically.

### 5. Tag + GitHub Release

`pnpm changeset publish` creates git tags. Push them:

```
git push --tags
```

Then create the GitHub Release for each tag:

```
gh release create <pkg>@<version> \
  --title "<pkg> <version>" \
  --notes-file packages/<pkg>/CHANGELOG.md \
  --verify-tag
```

For a pre-release add `--prerelease`.

## Hotfix release

For a single-package patch on top of a release tag:

```
git checkout <pkg>@<previous-version>
git checkout -b hotfix/<pkg>-<patch-version>
# fix the bug, add a `patch` changeset, commit
git push -u origin hotfix/<pkg>-<patch-version>
gh pr create --base main --fill
# after merge, follow steps 3-5
```

## Yanking a release

See `docs/norms/STANDARDS_RELEASES.md` §8.

```
npm deprecate @caboc/<pkg>@<bad-version> "use @caboc/<pkg>@<good-version>"
```

## CI publishing (planned, v0.2)

The `.github/workflows/release.yml` workflow (to be added) consumes
`NPM_TOKEN` from repository secrets and runs `pnpm changeset publish`
on push to `main` after a version bump merges. Until that workflow
lands, publishing is manual.
