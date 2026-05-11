// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { stdout, stderr, cwd } from "node:process";
import { genRunId } from "./run-id.js";

function parseArgs(args: string[]): { dir?: string; inputs?: string } {
  const out: { dir?: string; inputs?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--inputs" || a === "-i") {
      out.inputs = args[++i];
    } else if (a && !a.startsWith("-") && !out.dir) {
      out.dir = a;
    }
  }
  return out;
}

const PROMPT_HEADER = `# CABOC Runtime Instructions

You are the execution loop for a CABOC routine. CABOC routines are markdown
files: a WORKFLOW.md defines a PROCEDURE that may invoke agents via
\`USE AGENT <ref> [SESSION fresh|continuous|fork] WITH inputs={...}.\`. Agents
are sibling \`agents/<ref>.agent.md\` files with their own system prompts.

Execute the PROCEDURE step by step. For each USE AGENT line:
  1. Load the agent's system prompt from its file.
  2. Apply the requested SESSION mode (fresh = new context; continuous = same
     thread; fork = branch from current thread).
  3. Pass the resolved \`inputs\` JSON.
  4. Record the agent reply.

Emit a transcript at \`<run-dir>/transcript.ndjson\` (one JSON event per line,
kinds: \`step.start\`, \`step.end\`, \`agent.start\`, \`agent.end\`,
\`agent.repair\`, \`assertion.passed\`, \`assertion.failed\`).
Write final outputs as JSON to \`<run-dir>/outputs.json\`, and persistent state
to \`<run-dir>/state.json\`.

Tools are out of scope for this version. Do not invoke any tools beyond the
agents listed in the routine directory.
`;

function relSafe(p: string): string {
  const r = relative(cwd(), p);
  return r === "" ? "." : r;
}

export async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  if (!parsed.dir) {
    stderr.write("caboc run: missing <routine-dir>\n");
    stderr.write("usage: caboc run <routine-dir> --inputs <inputs.json>\n");
    return 1;
  }
  if (!parsed.inputs) {
    stderr.write("caboc run: missing --inputs <path>\n");
    return 1;
  }

  const routineDir = resolve(cwd(), parsed.dir);
  const inputsPath = resolve(cwd(), parsed.inputs);

  try {
    const s = await stat(routineDir);
    if (!s.isDirectory()) throw new Error("not a directory");
  } catch {
    stderr.write(`caboc run: routine dir not found: ${routineDir}\n`);
    return 1;
  }

  // Read the supplied inputs file and validate it parses as JSON.
  let inputsRaw: string;
  try {
    inputsRaw = await readFile(inputsPath, "utf8");
  } catch {
    stderr.write(`caboc run: inputs file not found: ${inputsPath}\n`);
    return 1;
  }
  try {
    JSON.parse(inputsRaw);
  } catch (e) {
    stderr.write(
      `caboc run: --inputs is not valid JSON — ${(e as Error).message}\n`,
    );
    return 1;
  }

  // Create runs/<run-id>/ and copy inputs into it.
  const runId = genRunId();
  const runDir = join(routineDir, "runs", runId);
  await mkdir(runDir, { recursive: true });
  const runInputsPath = join(runDir, "inputs.json");
  await writeFile(runInputsPath, inputsRaw, "utf8");

  const workflowPath = join(routineDir, "WORKFLOW.md");
  const agentsDir = join(routineDir, "agents");

  // Emit the prompt to stdout. The user pipes this into an LLM runtime.
  stdout.write(PROMPT_HEADER);
  stdout.write("\n");
  stdout.write("## This run\n\n");
  stdout.write(`- routine dir: \`${relSafe(routineDir)}\`\n`);
  stdout.write(`- workflow:    \`${relSafe(workflowPath)}\`\n`);
  stdout.write(`- agents dir:  \`${relSafe(agentsDir)}\`\n`);
  stdout.write(`- run dir:     \`${relSafe(runDir)}\`\n`);
  stdout.write(`- inputs:      \`${relSafe(runInputsPath)}\`\n`);
  stdout.write(`- run id:      \`${runId}\`\n`);
  stdout.write("\n");
  stdout.write(
    "Start by reading the WORKFLOW.md file referenced above, then proceed.\n",
  );

  // Status info goes to stderr so the prompt on stdout stays clean for piping.
  stderr.write(`\ncaboc: prepared run ${runId} at ${relSafe(runDir)}\n`);
  return 0;
}
