---
workflow: article_forge
version: 0.1.0
spec_version: caboc-llm/0.2.0
description: |
  Research-driven article and dossier generation pipeline. Scout →
  decompose into a targeted research matrix → editorial planner →
  HITL checkpoint → parallel collector → writer → feedback loop on
  research gaps (bounded at 3 rounds) → structural reviewer → output
  index + chapter files. Inspired by the obsigraph facet-article-forge
  graph; ported to caboc-llm/0.2.0 grammar.

io:
  inputs:
    subject: { type: string }
    style_preset:
      enum: [scientifique, actualité, exploratoire, créatif, business, pédagogique]
      default: pédagogique
    editorial_intent: { type: string, default: "Article détaillé et accessible" }
    depth: { enum: [article, dossier, livre], default: article }
    output_filename: { type: string, default: "article-output" }
  outputs:
    index_md:
      type: file
      path: "outputs/index.md"
      content_type: text/markdown
    chapters:
      type: file_array
      path_pattern: "outputs/chapters/*.md"
      content_type: text/markdown
      order_by: lex
      min_count: 1
    metadata: { type: object }
    review_report: { type: string, maxLength: 8000 }
    loops_used: { type: integer, minimum: 0, maximum: 3 }
    chapter_count: { type: integer, minimum: 1 }

hitl_schemas:
  checkpoint:
    type: object
    required: [action]
    properties:
      action: { type: string, enum: [approve, modify, restart, timeout] }
      feedback: { type: string, maxLength: 4000 }
      revisions:
        type: array
        items: { type: string, maxLength: 800 }
        maxItems: 16

budget:
  tokens: 200000
  wall_minutes: 30
---

# Article Forge

PROCEDURE.

  STEP scout NON_DETERMINISTIC.
    DESCRIPTION. "Quick recon: list sub-themes, suggest the best style, identify open questions."
    USE AGENT scout SESSION fresh WITH inputs={
      subject: subject,
      requested_style: style_preset,
      editorial_intent: editorial_intent,
      depth: depth
    }.
    OUTPUT scout_out.
  END STEP.

  STEP decompose NON_DETERMINISTIC.
    DESCRIPTION. "Build a targeted research matrix (sub-theme × angle cells)."
    USE AGENT decompose SESSION fresh WITH inputs={
      subject: subject,
      style_preset: scout_out.suggested_style,
      depth: depth,
      scout_report: scout_out.report,
      sub_themes: scout_out.sub_themes
    }.
    OUTPUT decomp_out.
  END STEP.

  STEP editorial_planner NON_DETERMINISTIC.
    DESCRIPTION. "Narrative skeleton: table of contents, fil conducteur, chapter briefs."
    USE AGENT editorial_planner SESSION fresh WITH inputs={
      subject: subject,
      style_preset: scout_out.suggested_style,
      editorial_intent: editorial_intent,
      depth: depth,
      scout_report: scout_out.report,
      research_matrix: decomp_out.cells
    }.
    OUTPUT plan_out.
  END STEP.

  STEP checkpoint HITL.
    PROMPT TO role=editor WITH context={
      editorial_plan: plan_out.editorial_plan,
      research_cell_count: decomp_out.cells.length,
      suggested_style: scout_out.suggested_style
    }.
    AWAIT decision FROM human WITHIN 7 DAYS
      ROUTE {
        approve -> step.collect,
        modify -> step.editorial_planner,
        restart -> step.scout
      }
      ON_TIMEOUT escalate TO senior-editor.
  END STEP.

  STEP collect NON_DETERMINISTIC.
    DESCRIPTION. "Research every cell of the matrix in parallel, capped at 8 in flight."
    LET cells := decomp_out.cells.
    FOR_EACH cell IN cells PARALLEL CONCURRENCY=8
      COLLECT INTO research_results: Array<object>
      DO
        STEP research_cell NON_DETERMINISTIC.
          USE AGENT collector SESSION fresh WITH inputs={
            cell: cell,
            subject: subject,
            style_preset: scout_out.suggested_style
          }.
          OUTPUT cell_out.
        END STEP.
    END FOR_EACH.
  END STEP.

  STEP write_and_iterate NON_DETERMINISTIC.
    DESCRIPTION. "Writer + feedback loop. Writes chapters; on gaps, patches the matrix and re-collects."
    LET loop_count := 0.
    LET satisfied := false.
    LET current_research := research_results.
    LET patch_results := [].
    LET total_gaps_patched := 0.

    LOOP UNTIL satisfied OR loop_count >= 3 MAX_ITERATIONS 3 DO
      SET loop_count := loop_count + 1.

      STEP write_pass NON_DETERMINISTIC.
        USE AGENT writer SESSION fresh WITH inputs={
          subject: subject,
          editorial_plan: plan_out.editorial_plan,
          style_preset: scout_out.suggested_style,
          editorial_intent: editorial_intent,
          depth: depth,
          collected_research: current_research,
          loop_count: loop_count
        }.
        OUTPUT writer_out.
      END STEP.

      IF writer_out.gaps.length = 0 OR loop_count >= 3 THEN
        SET satisfied := true.
      ELSE
        STEP patch_matrix NON_DETERMINISTIC.
          USE AGENT gap_patcher SESSION fresh WITH inputs={
            gaps: writer_out.gaps,
            style_preset: scout_out.suggested_style,
            subject: subject
          }.
          OUTPUT patch_out.
        END STEP.

        STEP recollect NON_DETERMINISTIC.
          FOR_EACH cell IN patch_out.new_cells PARALLEL CONCURRENCY=8
            COLLECT INTO patch_iter_results: Array<object>
            DO
              STEP research_patch_cell NON_DETERMINISTIC.
                USE AGENT collector SESSION fresh WITH inputs={
                  cell: cell,
                  subject: subject,
                  style_preset: scout_out.suggested_style
                }.
                OUTPUT cell_out.
              END STEP.
          END FOR_EACH.
          SET current_research := MERGE(current_research, patch_iter_results).
          SET patch_results := MERGE(patch_results, patch_iter_results).
          SET total_gaps_patched := total_gaps_patched + patch_iter_results.length.
        END STEP.
      END IF.
    END LOOP.
  END STEP.

  STEP review_structure NON_DETERMINISTIC.
    DESCRIPTION. "Structural editor pass for coherence and narrative flow."
    USE AGENT reviewer_structure SESSION fresh WITH inputs={
      editorial_plan: plan_out.editorial_plan,
      chapters: writer_out.chapters
    }.
    OUTPUT review_out.
  END STEP.

  STEP finalize NON_DETERMINISTIC.
    DESCRIPTION. "Persist file outputs + emit contract outputs."
    EMIT loops_used := loop_count.
    EMIT chapter_count := review_out.final_chapters.length.
    EMIT review_report := review_out.report_md.
    EMIT metadata := {
      subject: subject,
      style: scout_out.suggested_style,
      depth: depth,
      cells_collected: research_results.length,
      gaps_patched: total_gaps_patched,
      generated_at: NOW()
    }.
    -- Writer + reviewer write `outputs/index.md` and `outputs/chapters/NN-<slug>.md`
    -- directly via their `scratch_dirs:` permission (cf. STANDARDS_OUTPUTS §6).
    -- The runtime indexes the file outputs into outputs.json at run end.
  END STEP.

END PROCEDURE.

END WORKFLOW.
