# STANDARDS_ALIASES — Aliases + `caboc run` resolution

> Status: draft v0.1
> Scope: how `caboc run` resolves an argument to a routine directory.

## 1. Why this exists

A routine should be runnable by short name once installed:

```
caboc run commit-msg --inputs /tmp/input.json
```

Not by full URL or long relative path. The alias mechanism + a
deterministic resolution order keeps the surface short while keeping
reproducibility.

## 2. Resolution precedence (`caboc run <arg>`)

The CLI tries these in order; the first that resolves wins.

1. **Explicit local path.** If `<arg>` starts with `.`, `/`, or
   contains a `/` AND points to an existing directory with
   `WORKFLOW.md`, use it. No alias lookup.

2. **Lockfile entry.** If `routines.lock.routines[<arg>]` exists,
   resolve to `routines/<arg>/` in the workspace.

3. **Alias config.** If `caboc.config.json.aliases[<arg>]` or
   `package.json.caboc.aliases[<arg>]` is set, resolve through it.
   The alias target can be:
   - a relative path (`./examples/02-changelog-from-commits`)
   - a source spec (`gh:Obsilabs/caboc#examples/02-changelog-from-commits@v0.1.1`)
   - another alias (one level of indirection max; cycles → error)

4. **Bare slug.** If `<arg>` matches a directory under `routines/` or
   `examples/`, use that directory.

5. **Remote spec.** If `<arg>` matches a source pattern from
   `STANDARDS_DISTRIBUTION.md` §2 (e.g. `github.com/<org>/<repo>`),
   the behaviour depends on the runtime mode (see §6).

6. Otherwise → `CABOC_E_ROUTINE_NOT_FOUND` with the precedence list
   printed.

## 3. Alias config file

Either `caboc.config.json` at the workspace root:

```json
{
  "aliases": {
    "commit-msg": "gh:Obsilabs/caboc#examples/01-commit-message@v0.1.1",
    "changelog": "gh:Obsilabs/caboc#examples/02-changelog-from-commits@v0.1.1",
    "triage": "gh:acme/internal-routines#bug-triage@^1.2",
    "local-notes": "./examples/07-meeting-notes-actions"
  }
}
```

…or, equivalent, the `caboc` key in `package.json`:

```json
{
  "caboc": {
    "aliases": {
      "commit-msg": "gh:Obsilabs/caboc#examples/01-commit-message@v0.1.1"
    }
  }
}
```

The two locations are mutually exclusive per workspace. `caboc lint`
errors with `CABOC_E_ALIAS_CONFIG_DUPLICATED` if both exist.

## 4. Alias identifier shape

- Kebab-case (`a-z`, `0-9`, `-`).
- Starts with a letter OR digit (digits allowed so ordinal-prefix
  slugs like `02-changelog-from-commits` can be aliases too).
- 1–40 chars.
- No path separators, no `@`, no `#`, no `:`.
- Reserved: identifiers that look like a source spec (`gh:...`,
  `github.com/...`) are rejected at config load.

Valid: `commit-msg`, `release-notes`, `pr-review`, `02-changelog-from-commits`.
Invalid: `Commit-Msg` (case), `pr_review` (underscore), `gh:foo`,
`-leading-dash`.

## 5. Version pinning inside an alias target

The target string may carry `@<ref>` and `#<subpath>` per
`STANDARDS_DISTRIBUTION.md` §2.

- `@<semver>` → exact tag pin. Resolved once at `caboc add` and frozen
  in the lockfile.
- `@^<semver>` → caret range. Resolved each `caboc update`. Lockfile
  stores the resolved commit SHA.
- `@<branch>` → tracking. Resolved each `caboc update` against the
  current branch tip. Discouraged outside development; lint warning.
- `@<sha>` → immutable. Bypasses TOFU.

If no `@` is provided the default branch tip is used at first
`caboc add` and pinned thereafter.

## 6. Runtime modes

### 6.1 v0.1.x — local-only

Step 5 of §2 (remote spec resolution at run time) **always fails**.
`caboc run` only runs routines that are already on disk.

To run a remote routine: `caboc add <source>` first, then
`caboc run <alias>`.

Rationale: predictability + lockfile integrity. CI runs the same
routine the developer signed off on.

### 6.2 v0.3+ — optional fetch on miss

If the workspace has `caboc.config.json.run.fetchOnMiss: true`
(default `false`), a step-5 miss triggers an interactive TOFU prompt
that runs `caboc add` automatically before executing.

The `--no-fetch` flag forces v0.1 behaviour even with `fetchOnMiss`
enabled.

The `--frozen` flag refuses any implicit install (CI default).

## 7. Programmatic API surface

```
caboc add <source-or-alias-target> [--name <alias>] [--frozen]
caboc remove <alias>
caboc list
caboc update [<alias>...]
caboc run <alias-or-path> --inputs <path>
caboc run gh:org/repo --inputs <path>   # v0.3+ only
```

`caboc add` without `--name` derives the alias from the routine
slug, sanitized per §4. Collisions prompt for a different name.

## 8. Resolution telemetry

When `caboc run` resolves, it prints (to stderr only, not the prompt):

```
caboc: resolved 'commit-msg' → routines/commit-msg (sha256:abcd…)
```

so users can verify which version executed. The exact prompt streamed
to stdout (consumed by the LLM runtime) is unaffected.

## 9. Lockfile-first guarantee

For any alias that points to a remote source, the lockfile is the
source of truth at run time. If the source has rotated, the lockfile
keeps the original SHA. `caboc update <alias>` is the only path that
mutates the lockfile.

## 10. References

- `STANDARDS_NAMING.md` §4 — identifier shapes.
- `STANDARDS_DISTRIBUTION.md` — source spec syntax + lockfile format.
- `STANDARDS_RELEASES.md` §5 — spec versioning.
