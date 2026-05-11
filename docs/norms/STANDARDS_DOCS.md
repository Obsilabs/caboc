# STANDARDS_DOCS — Documentation conventions

> Status: draft v0.1
> Scope: every markdown file in every CABOC repo.

## 1. Why this exists

Documentation is the product surface for an OSS project. Bad docs sink
adoption. We hold docs to the same review bar as source code.

## 2. File layout

```
/README.md                      project intro + quickstart
/CONTRIBUTING.md                contributor onboarding
/SECURITY.md                    vuln disclosure
/CODE_OF_CONDUCT.md             community conduct
/AGENTS.md                      AI-assistant guidance
/docs/norms/                    conventions (this folder)
/packages/<pkg>/README.md       package-level docs (mandatory)
/examples/<NN>-<slug>/README.md per-example doc (mandatory)
/skills/<name>/README.md        per-skill doc (mandatory)
```

Every package and every example **must** have a `README.md`.

## 3. Headings

- ATX style only (`# Title`, never underline style).
- One `#` (H1) per file at the top — the file title.
- Heading levels skip none (do not jump from `##` to `####`).
- Sentence-case headings (`## Why this exists`, not `## Why This Exists`).

## 4. Code blocks

- Always fenced with a language tag: ` ```ts `, ` ```bash `, ` ```json `,
  ` ```yaml `, ` ```caboc `.
- Use `text` for shell output blocks where pasting back is not intended.
- Indent multi-line examples with 2 spaces inside code (no tabs in
  markdown bodies, even though TypeScript uses tabs).

## 5. Links

- Use angle-bracket form for bare URLs: `<https://example.com>`.
- Inline links for prose: `[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)`.
- Relative links for in-repo references: `[STANDARDS_NAMING](./STANDARDS_NAMING.md)`.
- A CI link checker (e.g. `lychee`) runs on every PR and fails on a
  broken link.

## 6. Tables

- Always include a header row.
- Align columns with single spaces; do not pad with extra spaces (Biome
  does not format markdown but readers should).
- Wide tables: prefer a `<details>` block or split into multiple
  tables.

## 7. READMEs

Minimum sections for `packages/<pkg>/README.md`:

1. **What** — one paragraph.
2. **Install** — one line.
3. **Usage** — minimum one runnable example.
4. **API** — if applicable, link to generated docs.
5. **Conventions** — link to `docs/norms/`.
6. **License** — `Apache-2.0`.

Minimum sections for `examples/<NN>-<slug>/README.md`:

1. **What** — one paragraph describing the routine.
2. **Why this example** — one paragraph (what gap it fills, what
   pattern it illustrates).
3. **Run** — copy-pasteable steps.
4. **Expected outputs** — link to `__fixtures__/expected-outputs.json`.

## 8. Style

- Active voice. "The CLI emits a transcript", not "A transcript is
  emitted".
- Present tense. "The agent classifies the ticket", not "will classify".
- Concrete over abstract. Show a snippet whenever you describe a
  behaviour.
- Length: a top-level README is ≤ 200 lines. If it grows, split into
  `docs/`.

## 9. Build-time assertion

A markdown linter (`markdownlint` or equivalent) runs in CI with rules:

- `MD003` headings = ATX only.
- `MD041` first line = H1.
- `MD025` only one H1 per file.
- `MD040` fenced blocks must declare a language.
- Custom rule: no LLM model literals (mirrors the source denylist).

## 10. No marketing fluff

Words like "extensive", "seamless", "blazing fast", "world-class",
"powerful" are banned. State what the thing does in concrete terms.
