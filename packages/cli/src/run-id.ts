// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "node:crypto";

/**
 * Generate a run identifier of the form `YYYYMMDD-HHmmss-<6 [a-z0-9]>`.
 *
 * Sortable lexicographically by start time and unique enough for local-only
 * directory names. Not a security token — just a label.
 */
export function genRunId(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear().toString().padStart(4, "0");
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const hh = now.getUTCHours().toString().padStart(2, "0");
  const mi = now.getUTCMinutes().toString().padStart(2, "0");
  const ss = now.getUTCSeconds().toString().padStart(2, "0");
  const suffix = randomBytes(3).toString("hex"); // 6 hex chars, [a-f0-9]
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}-${suffix}`;
}

export const RUN_ID_REGEX = /^\d{8}-\d{6}-[a-z0-9]{6}$/;
