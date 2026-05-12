# STANDARDS_DISTRIBUTION — Routine distribution + lockfile

> Status: draft v0.1
> Scope: every routine installed into a workspace via `caboc add` or its
> programmatic equivalent.

## 1. Why this exists

A CABOC routine is plain markdown — distributable as a git repo, a
subdirectory of a git repo, or an HTTPS tarball. We adopt the
**boring** pattern proven by Go modules, Deno URL imports, and Nix
flakes: content-hash + lockfile + TOFU, zero hosted registry.

This norm fixes the surface so any host, mirror, or fork resolves to
the same bytes.

## 2. Source forms

`caboc add <source>[@<ref>][#<subpath>]` accepts:

| Form                                                       | Resolution                                                |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| `github.com/<org>/<repo>`                                  | HTTPS clone, default branch, root = routine               |
| `github.com/<org>/<repo>@<ref>`                            | tag, branch, or commit SHA                                |
| `github.com/<org>/<repo>#<subpath>`                        | subdirectory extraction                                   |
| `github.com/<org>/<repo>@<ref>#<subpath>`                  | tag + subdir                                              |
| `gh:<org>/<repo>` / `gh:<org>/<repo>@<ref>#<subpath>`      | shorthand for the above                                   |
| `gitlab.com/<org>/<repo>...`                               | same family                                               |
| `https://<host>/<path>.tar.gz`                             | HTTPS tarball                                             |
| `git+ssh://git@<host>/<org>/<repo>.git#<subpath>`          | private repos via SSH                                     |
| `./relative/path` / `/absolute/path`                       | local routine (no fetch, hash anyway)                     |

The closed set is enforced by `caboc add` parser. Unknown schemes
fail with `CABOC_E_SOURCE_UNRECOGNIZED`.

## 3. Resolution algorithm

```
1. Parse source into { scheme, host, path, ref?, subpath? }.
2. If ref is unspecified, query the remote for the default branch + its head sha.
3. Clone (bare) into ~/.cache/caboc/git/<sha256(source-without-ref)>/.
4. Checkout <ref> (tag → annotated commit sha; branch → tip sha; sha → as-is).
5. Extract <subpath> (default = repo root) into a temp dir.
6. Validate the routine via `caboc lint`. Reject on lint failure.
7. Compute content hash (see §4).
8. Copy / symlink into the workspace at `routines/<name>/` (default
   name = <subpath basename> or <repo name>).
9. Append or replace the entry in `routines.lock`.
```

## 4. Content hashing

The routine's `sha256` is computed over a canonical byte stream:

1. List every file inside the routine root, excluding `runs/`, `.git/`,
   `node_modules/`, and anything matched by `.cabocignore` (optional).
2. Sort relative paths lexicographically (`/`-separated, NFC-normalized).
3. For each file emit: `<rel-path>\x00<file-bytes>\x00`.
4. The final sha256 is over the concatenation, lowercase hex.

Line endings are normalized to LF before hashing. Symlinks are not
followed; they hash as their link target string.

## 5. The lockfile

A workspace that has installed at least one routine carries a
`routines.lock` at the workspace root (sibling to `package.json`):

```json
{
  "lockfile_version": 1,
  "spec_version": "caboc-llm/0.1.0",
  "routines": {
    "<alias>": {
      "source": "github.com/<org>/<repo>",
      "ref": "<resolved-commit-sha-40>",
      "subpath": "<subpath-or-null>",
      "sha256": "<content-hash>",
      "version": "<semver-from-frontmatter>",
      "fetched_at": "<iso-8601-utc>"
    }
  }
}
```

Rules:

- `ref` always stores a fully resolved commit SHA, even when the user
  passed a tag or a branch name. Tags can be moved; SHAs cannot.
- `version` mirrors the routine's `WORKFLOW.md.version`. Used for
  human-readable display and semver compatibility checks.
- `fetched_at` is informational. Reproducibility relies on `sha256`,
  not on timestamps.
- The lockfile is JSON canonicalized (keys sorted, 2-space indent,
  trailing newline). The same routine set produces a byte-identical
  lockfile across machines.

## 6. TOFU — Trust On First Use

On first install of a `<source>`:

1. Show the user: source URL, resolved SHA, `version`, content hash.
2. Prompt `[y/N]` unless `--yes` is set.
3. On confirmation, write the lockfile entry.

On subsequent installs / `caboc update`:

1. Re-fetch and re-hash.
2. Compare hash vs the lockfile entry.
3. If mismatch → `CABOC_E_ROUTINE_HASH_MISMATCH`, refuse update unless
   user passes `--accept-new` (which is interactive again).

## 7. Cache structure

```
~/.cache/caboc/
├── git/<sha256(source-without-ref)>/    bare clones, shared across workspaces
└── routines/<sha256(content)>/           extracted content-addressed snapshots
```

Snapshots are immutable. The workspace's `routines/<alias>/` is either
a symlink to a snapshot or a copy.

## 8. `routines/` layout in the workspace

```
<workspace-root>/
├── routines.lock
├── routines/
│   └── <alias>/              installed routine (mirrors examples/<NN>-<slug>/ shape)
└── ...
```

`routines/` is git-tracked. Its contents are derived from the
lockfile; a CI step can verify reproducibility by deleting `routines/`
and re-running `caboc install` against the lockfile.

## 9. Forbidden

- Mutating an installed routine in place. Edits must go through the
  source repo and a re-install.
- Publishing a routine that contains an LLM model literal. `caboc lint`
  refuses such routines at install time, not at run time.
- Committing `~/.cache/caboc/` into a workspace.

## 10. CI integration

```
caboc install --frozen    # refuses any new install; verifies all hashes
caboc lint                # validates lockfile vs routines/ snapshots
```

The `--frozen` flag is the CI equivalent of `npm ci`: if the lockfile
disagrees with the workspace, the build fails.

## 11. Mirror friendliness

Because the lockfile only depends on `sha256` and a resolved SHA, an
operator can:

- Mirror the source repo on another host.
- Update `source` in the lockfile to the mirror URL.
- Keep `sha256` + `ref` unchanged.

The next `caboc install` against the mirror returns byte-identical
content. The convention survives a host swap with zero coordination.

## 12. Version compatibility

A routine declares `spec_version: caboc-llm/<semver>` in its
frontmatter. The runtime SKILL.md declares the same. Install fails if
the major versions disagree (`CABOC_E_SPEC_MAJOR_MISMATCH`); a minor
mismatch is a warning.

## 13. References

- `STANDARDS_NAMING.md` §4 — alias identifier shapes.
- `STANDARDS_ALIASES.md` — how `<alias>` is resolved at run time.
- `STANDARDS_RELEASES.md` §5 — spec versioning.
- D20 / D28 from the Repoos vision decision log — the same algorithm
  was validated as a skill resolver; we reuse it for routines.
