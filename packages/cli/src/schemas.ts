// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

/**
 * Shared sub-schemas.
 */
const IoSection = z
  .object({
    inputs: z.record(z.unknown()).optional(),
    outputs: z.record(z.unknown()).optional(),
  })
  .partial()
  .strict();

const BudgetSection = z
  .object({
    tokens: z.number().int().nonnegative().optional(),
    wall_minutes: z.number().int().nonnegative().optional(),
    money_usd: z.number().nonnegative().optional(),
  })
  .partial()
  .strict();

const SessionSection = z
  .object({
    capability: z
      .enum(["reasoning", "classification", "structured_extraction", "vision"])
      .optional(),
    tier: z.enum(["fast", "balanced", "deep"]).optional(),
    allowed_modes: z.array(z.enum(["fresh", "continuous", "fork"])).optional(),
  })
  .partial()
  .strict();

/**
 * Frontmatter for a routine's `WORKFLOW.md`.
 *
 * Mirrors `docs/norms/STANDARDS_ROUTINES.md` §2.
 */
export const WorkflowFrontmatter = z
  .object({
    workflow: z.string().min(1),
    version: z.string().min(1),
    spec_version: z.string().min(1).optional(),
    description: z.string().optional(),
    namespace: z.string().optional(),
    owner: z.string().optional(),
    io: IoSection.optional(),
    budget: BudgetSection.optional(),
    triggers: z.array(z.record(z.unknown())).optional(),
    imports: z.array(z.record(z.unknown())).optional(),
    attestation: z.record(z.unknown()).optional(),
    memory: z.record(z.unknown()).optional(),
    trust: z.record(z.unknown()).optional(),
    invariants: z.array(z.unknown()).optional(),
    // v0.2 additions
    hitl_schemas: z.record(z.unknown()).optional(),
    provider_roles: z.record(z.unknown()).optional(),
  })
  .strict();

export type WorkflowFrontmatter = z.infer<typeof WorkflowFrontmatter>;

/**
 * Frontmatter for an agent's `<name>.agent.md`.
 *
 * Mirrors `docs/norms/STANDARDS_ROUTINES.md` §4.
 */
export const AgentFrontmatter = z
  .object({
    agent: z.string().min(1),
    version: z.string().min(1),
    spec_version: z.string().min(1).optional(),
    description: z.string().optional(),
    session: SessionSection.optional(),
    io: IoSection.optional(),
    imports: z
      .object({
        skills: z.array(z.unknown()).optional(),
        mcp: z.array(z.unknown()).optional(),
        capabilities: z.array(z.unknown()).optional(),
      })
      .partial()
      .strict()
      .optional(),
    // v0.2 additions
    provider_role: z.string().min(1).optional(),
    scratch_dirs: z
      .array(z.union([z.string(), z.record(z.unknown())]))
      .optional(),
    schema_ref: z.string().optional(),
  })
  .strict();

export type AgentFrontmatter = z.infer<typeof AgentFrontmatter>;

/**
 * Workspace-level `routines.lock`. Mirrors `STANDARDS_DISTRIBUTION.md` §5.
 *
 * Records every routine installed via `caboc add`. Keyed by alias.
 */
export const RoutinesLockfile = z
  .object({
    lockfile_version: z.literal(1),
    spec_version: z.string(),
    routines: z.record(
      z.object({
        source: z.string(),
        ref: z.string(),
        subpath: z.string().nullable().optional(),
        sha256: z.string().length(64),
        version: z.string(),
        fetched_at: z.string(),
      }),
    ),
  })
  .strict();

export type RoutinesLockfile = z.infer<typeof RoutinesLockfile>;

/**
 * Alias config. Mirrors `STANDARDS_ALIASES.md` §3.
 *
 * Lives at workspace root in `caboc.config.json` OR under the `caboc:` key in
 * `package.json` (the two are mutually exclusive).
 */
export const AliasesConfig = z
  .object({
    aliases: z.record(z.string()).default({}),
    run: z
      .object({
        fetchOnMiss: z.boolean().default(false),
      })
      .partial()
      .strict()
      .optional(),
  })
  .strict();

export type AliasesConfig = z.infer<typeof AliasesConfig>;

const ALIAS_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Throw on invalid alias identifier shape (STANDARDS_ALIASES §4). */
export function validateAliasId(name: string): void {
  if (!ALIAS_ID.test(name)) {
    throw new Error(
      `CABOC_E_ALIAS_INVALID: '${name}' — alias must be kebab-case (a-z, 0-9, -), 1-40 chars, start with a letter or digit`,
    );
  }
  if (
    name.startsWith("gh:") ||
    name.startsWith("gl:") ||
    name.startsWith("bb:") ||
    name.includes("github.com") ||
    name.includes("/")
  ) {
    throw new Error(
      `CABOC_E_ALIAS_INVALID: '${name}' — alias must not look like a source spec`,
    );
  }
}
