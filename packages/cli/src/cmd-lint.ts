// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, relative, basename } from "node:path";
import { stdout, stderr, cwd } from "node:process";
import { parseFrontmatterString } from "./parse-frontmatter.js";
import { WorkflowFrontmatter, AgentFrontmatter } from "./schemas.js";

const MODEL_NAME_DENYLIST = [
  "claude-",
  "gpt-",
  "gemini-",
  "mistral-",
  "llama-",
];

// `USE AGENT <ref> [SESSION ...] WITH inputs=...` — captures the ref.
const USE_AGENT_RE = /\bUSE\s+AGENT\s+([A-Za-z0-9._-]+)/g;

interface LintFinding {
  file: string;
  line: number;
  message: string;
}

function scanForDenylist(
  text: string,
  filePath: string,
  findings: LintFinding[],
): void {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lower = line.toLowerCase();
    for (const term of MODEL_NAME_DENYLIST) {
      const idx = lower.indexOf(term);
      if (idx !== -1) {
        findings.push({
          file: filePath,
          line: i + 1,
          message: `model-name literal '${term}...' is forbidden in routine source (col ${idx + 1})`,
        });
      }
    }
  }
}

async function listAgentFiles(agentsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(agentsDir);
    return entries.filter((e) => e.endsWith(".agent.md"));
  } catch {
    return [];
  }
}

function agentRefToFilename(ref: string): string {
  return `${ref}.agent.md`;
}

export async function run(args: string[]): Promise<number> {
  const dirArg = args[0];
  if (!dirArg) {
    stderr.write("caboc lint: missing <routine-dir>\n");
    stderr.write("usage: caboc lint <routine-dir>\n");
    return 1;
  }
  const routineDir = resolve(cwd(), dirArg);

  let dirStat;
  try {
    dirStat = await stat(routineDir);
  } catch {
    stderr.write(`caboc lint: not a directory: ${routineDir}\n`);
    return 1;
  }
  if (!dirStat.isDirectory()) {
    stderr.write(`caboc lint: not a directory: ${routineDir}\n`);
    return 1;
  }

  const findings: LintFinding[] = [];
  const passes: string[] = [];

  // --- WORKFLOW.md
  const workflowPath = join(routineDir, "WORKFLOW.md");
  let workflowBody = "";
  try {
    const src = await readFile(workflowPath, "utf8");
    let parsed;
    try {
      parsed = parseFrontmatterString(src);
    } catch (e) {
      findings.push({
        file: workflowPath,
        line: 1,
        message: (e as Error).message,
      });
      parsed = { frontmatter: null, body: src };
    }
    workflowBody = parsed.body;

    const result = WorkflowFrontmatter.safeParse(parsed.frontmatter);
    if (result.success) {
      passes.push("WORKFLOW.md frontmatter is valid");
    } else {
      for (const issue of result.error.issues) {
        findings.push({
          file: workflowPath,
          line: 1,
          message: `frontmatter ${issue.path.join(".") || "<root>"}: ${issue.message}`,
        });
      }
    }
    scanForDenylist(src, workflowPath, findings);
  } catch {
    findings.push({
      file: workflowPath,
      line: 0,
      message: "WORKFLOW.md not found",
    });
  }

  // --- agents/*.agent.md
  const agentsDir = join(routineDir, "agents");
  const agentFiles = await listAgentFiles(agentsDir);
  if (agentFiles.length === 0) {
    findings.push({
      file: agentsDir,
      line: 0,
      message: "no agents/*.agent.md files found",
    });
  }

  const knownAgentRefs = new Set<string>();
  for (const file of agentFiles) {
    const full = join(agentsDir, file);
    const ref = basename(file, ".agent.md");
    knownAgentRefs.add(ref);

    const src = await readFile(full, "utf8");
    let parsed;
    try {
      parsed = parseFrontmatterString(src);
    } catch (e) {
      findings.push({ file: full, line: 1, message: (e as Error).message });
      parsed = { frontmatter: null, body: src };
    }
    const result = AgentFrontmatter.safeParse(parsed.frontmatter);
    if (result.success) {
      passes.push(`agents/${file} frontmatter is valid`);
    } else {
      for (const issue of result.error.issues) {
        findings.push({
          file: full,
          line: 1,
          message: `frontmatter ${issue.path.join(".") || "<root>"}: ${issue.message}`,
        });
      }
    }
    scanForDenylist(src, full, findings);
  }

  // --- USE AGENT resolution
  if (workflowBody) {
    const bodyLines = workflowBody.split(/\r?\n/);
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];
      if (!line) continue;
      USE_AGENT_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = USE_AGENT_RE.exec(line)) !== null) {
        const ref = m[1];
        if (!ref) continue;
        if (!knownAgentRefs.has(ref)) {
          findings.push({
            file: workflowPath,
            line: i + 1,
            message: `USE AGENT '${ref}' has no matching agents/${agentRefToFilename(ref)}`,
          });
        }
      }
    }
    passes.push("USE AGENT references resolved");
  }

  // --- emit
  for (const p of passes) stdout.write(`✓ ${p}\n`);
  for (const f of findings) {
    const rel = relative(cwd(), f.file) || f.file;
    stderr.write(`✗ ${rel}:${f.line} — ${f.message}\n`);
  }

  return findings.length === 0 ? 0 : 1;
}
