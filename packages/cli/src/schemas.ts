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
  })
  .strict();

export type AgentFrontmatter = z.infer<typeof AgentFrontmatter>;

/**
 * Lockfile pinning resolved references for reproducible runs.
 * v0.1 stub — populated by future `caboc lock`.
 */
export const RoutineLockfile = z
  .object({
    lockfile_version: z.literal(1),
    routine_version: z.string(),
    spec_version: z.string(),
    workflow_sha256: z.string().length(64),
    agents: z.record(
      z.object({
        sha256: z.string().length(64),
        version: z.string(),
      }),
    ),
  })
  .strict();

export type RoutineLockfile = z.infer<typeof RoutineLockfile>;
