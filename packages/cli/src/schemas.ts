// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

/**
 * Frontmatter for a routine's WORKFLOW.md.
 *
 * Intentionally minimal for v0.1. No model names — those are runtime concerns,
 * not authoring concerns.
 */
export const WorkflowFrontmatter = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional(),
    inputs: z.record(z.unknown()).optional(),
    outputs: z.record(z.unknown()).optional(),
  })
  .strict();

export type WorkflowFrontmatter = z.infer<typeof WorkflowFrontmatter>;

/**
 * Frontmatter for an agent's `<name>.agent.md`.
 *
 * `model` is deliberately rejected — see denylist in cmd-lint. Agents declare
 * capability requirements, not concrete model identifiers.
 */
export const AgentFrontmatter = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
    inputs: z.record(z.unknown()).optional(),
    outputs: z.record(z.unknown()).optional(),
  })
  .strict();

export type AgentFrontmatter = z.infer<typeof AgentFrontmatter>;

/**
 * Lockfile pinning resolved references for reproducible runs.
 * v0.1 stub — populated by future `caboc lock`.
 */
export const RoutineLockfile = z
  .object({
    version: z.literal(1),
    routine: z.object({
      name: z.string(),
      version: z.string(),
    }),
    agents: z.record(
      z.object({
        path: z.string(),
        hash: z.string(),
      }),
    ),
  })
  .strict();

export type RoutineLockfile = z.infer<typeof RoutineLockfile>;
