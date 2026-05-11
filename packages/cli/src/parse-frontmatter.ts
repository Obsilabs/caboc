// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

export interface ParsedMarkdown {
  frontmatter: unknown;
  body: string;
}

/**
 * Split a markdown file into YAML frontmatter and body.
 *
 * Format:
 *   ---
 *   <yaml>
 *   ---
 *   <body...>
 *
 * Throws when the opening `---` is present but the closing `---` is missing,
 * or when the YAML fails to parse. Files without any frontmatter return
 * `{ frontmatter: null, body: <whole-file> }`.
 */
export function parseFrontmatterString(source: string): ParsedMarkdown {
  // Normalize line endings so the regex works on Windows-authored files.
  const text = source.replace(/\r\n/g, "\n");

  if (!text.startsWith("---\n") && text !== "---" && !text.startsWith("---\r")) {
    return { frontmatter: null, body: text };
  }

  // Strip the opening `---\n` and find the next `\n---` on its own line.
  const afterOpen = text.slice(4);
  const closeMatch = afterOpen.match(/\n---(\n|$)/);
  if (!closeMatch || closeMatch.index === undefined) {
    throw new Error("frontmatter: missing closing '---' delimiter");
  }

  const yamlText = afterOpen.slice(0, closeMatch.index);
  const body = afterOpen.slice(closeMatch.index + closeMatch[0].length);

  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`frontmatter: invalid YAML — ${msg}`);
  }

  return { frontmatter: parsed ?? {}, body };
}

export async function parseFrontmatterFile(path: string): Promise<ParsedMarkdown> {
  const source = await readFile(path, "utf8");
  return parseFrontmatterString(source);
}
