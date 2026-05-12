# article_forge — shared schema reference

> Status: draft v0.1
> Scope: shared JSON-schema fragments used by the
> `11-article-forge` routine's agents. Each agent's frontmatter
> references one of these shapes by name in its `schema_ref:` field.
> License: Apache-2.0.

This document is informational. The authoritative schemas live inline
in each agent's frontmatter `io.outputs`. This file is the
shared-vocabulary reference for humans reading the routine: it shows
the cross-agent contracts in one place.

## ScoutReport

The scout agent's output. Frames the run for every downstream agent.

```json
{
  "$id": "ScoutReport",
  "type": "object",
  "required": ["report", "sub_themes", "suggested_style", "style_reasoning"],
  "properties": {
    "report":          { "type": "string", "maxLength": 6000 },
    "sub_themes": {
      "type": "array",
      "items": { "type": "string", "maxLength": 200 },
      "minItems": 3,
      "maxItems": 12
    },
    "suggested_style": {
      "enum": ["scientifique", "actualité", "exploratoire",
               "créatif", "business", "pédagogique"]
    },
    "style_reasoning": { "type": "string", "maxLength": 400 },
    "open_questions": {
      "type": "array",
      "items": { "type": "string", "maxLength": 300 },
      "maxItems": 8
    }
  }
}
```

## ResearchCell

The unit of work the collector picks up. The matrix is `Array<ResearchCell>`.

```json
{
  "$id": "ResearchCell",
  "type": "object",
  "required": ["id", "sub_theme", "angle", "priority"],
  "properties": {
    "id":        { "type": "string", "pattern": "^cell-(patch-)?[a-z0-9-]+$" },
    "sub_theme": { "type": "string", "maxLength": 200 },
    "angle":     { "type": "string", "maxLength": 240 },
    "priority":  { "enum": ["must", "should", "optional"] },
    "rationale": { "type": "string", "maxLength": 400 }
  }
}
```

## ResearchMatrix

```json
{
  "$id": "ResearchMatrix",
  "type": "object",
  "required": ["cells"],
  "properties": {
    "cells": {
      "type": "array",
      "minItems": 3,
      "maxItems": 32,
      "items": { "$ref": "ResearchCell" }
    }
  }
}
```

## ResearchMatrixPatch

The gap-patcher's output. Cells use the `cell-patch-` prefix.

```json
{
  "$id": "ResearchMatrixPatch",
  "type": "object",
  "required": ["new_cells"],
  "properties": {
    "new_cells": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": { "$ref": "ResearchCell" }
    }
  }
}
```

## ChapterBrief

One entry of `editorial_plan.chapter_briefs`.

```json
{
  "$id": "ChapterBrief",
  "type": "object",
  "required": ["slug", "summary", "covers_cells"],
  "properties": {
    "slug":    { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "summary": { "type": "string", "maxLength": 800 },
    "key_questions": {
      "type": "array",
      "items": { "type": "string", "maxLength": 300 },
      "maxItems": 6
    },
    "covers_cells": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    }
  }
}
```

## EditorialPlan

The editorial_planner's output.

```json
{
  "$id": "EditorialPlan",
  "type": "object",
  "required": ["fil_conducteur", "table_of_contents", "chapter_briefs"],
  "properties": {
    "fil_conducteur": { "type": "string", "maxLength": 1200 },
    "table_of_contents": {
      "type": "array",
      "minItems": 1,
      "maxItems": 16,
      "items": {
        "type": "object",
        "required": ["order", "slug", "title"],
        "properties": {
          "order": { "type": "integer", "minimum": 1 },
          "slug":  { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "title": { "type": "string", "maxLength": 160 }
        }
      }
    },
    "chapter_briefs": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "ChapterBrief" }
    }
  }
}
```

## CollectorResult

One iteration of the parallel `FOR_EACH cell IN matrix.cells`.

```json
{
  "$id": "CollectorResult",
  "type": "object",
  "required": ["cell_id", "sub_theme", "angle", "findings_md",
               "key_points", "confidence"],
  "properties": {
    "cell_id":     { "type": "string" },
    "sub_theme":   { "type": "string" },
    "angle":       { "type": "string" },
    "findings_md": { "type": "string", "maxLength": 4000 },
    "key_points": {
      "type": "array",
      "items": { "type": "string", "maxLength": 400 },
      "minItems": 1,
      "maxItems": 10
    },
    "uncertainty": {
      "type": "array",
      "items": { "type": "string", "maxLength": 300 },
      "maxItems": 6
    },
    "confidence":  { "enum": ["low", "medium", "high"] }
  }
}
```

## Chapter

A single chapter pointer (paths relative to run dir).

```json
{
  "$id": "Chapter",
  "type": "object",
  "required": ["slug", "title", "path", "order"],
  "properties": {
    "slug":       { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "title":      { "type": "string", "maxLength": 160 },
    "path":       { "type": "string" },
    "order":      { "type": "integer", "minimum": 1 },
    "word_count": { "type": "integer", "minimum": 0 },
    "status":     { "enum": ["unchanged", "revised", "rewritten"] }
  }
}
```

## WriterOutput

```json
{
  "$id": "WriterOutput",
  "type": "object",
  "required": ["chapters", "gaps", "index_md"],
  "properties": {
    "chapters": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "Chapter" }
    },
    "gaps": {
      "type": "array",
      "items": { "type": "string", "maxLength": 200 },
      "maxItems": 10
    },
    "index_md": { "type": "string", "maxLength": 6000 }
  }
}
```

## ReviewerOutput

```json
{
  "$id": "ReviewerOutput",
  "type": "object",
  "required": ["final_chapters", "report_md", "verdict"],
  "properties": {
    "final_chapters": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "Chapter" }
    },
    "report_md": { "type": "string", "maxLength": 8000 },
    "verdict":   { "enum": ["ship", "ship_with_caveats", "needs_rework"] }
  }
}
```

## Cross-references

- `WORKFLOW.md` — `io.outputs` declares `index_md` as `type: file`,
  `chapters` as `type: file_array` with `path_pattern: outputs/chapters/*.md`.
- `agents/writer.agent.md` — declares `scratch_dirs: [{ name: chapters }]`
  and is the agent that writes both the chapter files and `index.md`.
- `agents/reviewer_structure.agent.md` — declares the same scratch dir
  and is permitted to revise chapter files in place.
- `docs/norms/STANDARDS_OUTPUTS.md` — full spec for file/file_array
  outputs and scratch sandboxing.
- `docs/norms/STANDARDS_PROVIDER_ROLES.md` — `provider_role` field
  resolution semantics; the 8 roles used here are declared in
  `caboc.config.json`.
