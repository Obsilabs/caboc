# STANDARDS_LICENSING — License, attribution, and third-party policy

> Status: draft v0.1
> Scope: every public CABOC package + repo + binary artefact.

## 1. Why this exists

License compliance is non-negotiable. A single GPL or AGPL transitive
dependency contaminates the entire Apache 2.0 distribution. A missing
NOTICE attribution is an Apache violation. Discipline here is a hard
constraint, not a preference.

## 2. Project license

**Apache License 2.0** for every public package, every public repo, and
every binary artefact distributed by the CABOC project.

- Full text in `LICENSE` at the repo root.
- Verbatim copy from <https://www.apache.org/licenses/LICENSE-2.0.txt>.
- Never modify, paraphrase, or summarize the license text.
- File name exactly `LICENSE` (no extension, no `.txt`).

## 3. NOTICE file

`NOTICE` at the repo root contains:

```
CABOC — Common AI Business Oriented Convention
Copyright 2026-present CABOC contributors.

This product is licensed under the Apache License, Version 2.0.
See LICENSE for the full text.

Portions of this software include third-party software. See
THIRD_PARTY_NOTICES.md for full attribution.
```

Rules:

- File name exactly `NOTICE` (no extension).
- Updated when a third-party with NOTICE-required attribution is added.
- Never deleted from a release artefact (Apache 2.0 §4.4).

## 4. SPDX headers — REUSE 3.3 compliance

CABOC adopts the **REUSE Specification 3.3** (<https://reuse.software/spec/>)
verbatim. REUSE provides a machine-checkable contract for license +
copyright metadata across every file.

### 4.1 Per-file header — TypeScript

Every TypeScript source file (excluding generated) starts with:

```ts
// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0
```

- Two lines, in this order.
- No multi-line ASCII-art license blocks.
- Generated files (`*.d.ts`, build outputs) covered by `REUSE.toml`.

### 4.2 Per-file header — Markdown

Markdown files inside `docs/` and routine sources do not require an
inline header; coverage is provided by `REUSE.toml` at the repo root.

### 4.3 REUSE.toml

A `REUSE.toml` at the repo root declares the default copyright and
license for any file not carrying an inline header.

## 5. Third-party dependencies

### 5.1 Permitted licenses for runtime deps

- Apache-2.0
- MIT
- BSD-2-Clause, BSD-3-Clause
- ISC
- 0BSD, Unlicense, CC0-1.0 (for assets)

### 5.2 Forbidden runtime deps

- GPL-*, AGPL-*, LGPL-* (any version)
- Source-available licenses pretending to be OSS (BSL, SSPL,
  Confluent Community License, etc.)
- Unlicensed code with no SPDX identifier

`pnpm-licenses` (or equivalent) runs in CI and fails the build on a
forbidden license in the runtime dependency graph.

### 5.3 Dev-only deps

Build tools and test-only packages may carry any OSI-approved license
as long as they do not ship in the published artefacts.

## 6. Trademarks

"CABOC" is reserved for the project itself. Community packages must
follow the `caboc-<kind>-<slug>` unscoped pattern (see
`STANDARDS_NAMING.md` §2.4) to avoid trademark confusion.

## 7. Anti-pattern: license switch

We commit publicly to **Apache 2.0 perpetuity** on every published
artefact. No future license switch to BSL / SSPL / "fair source" /
"server-side public license". A re-license requires a unanimous vote of
the steering committee + 90 days notice + a fork-friendly migration
path. This commitment is binding on the project regardless of
ownership change.
