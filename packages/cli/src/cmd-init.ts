// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { stdout, stderr, cwd } from "node:process";

const WORKFLOW_TEMPLATE = (name: string) => `---
name: ${name}
version: 0.1.0
description: TODO — describe what this routine does.
inputs:
  topic:
    type: string
    description: Subject to process.
outputs:
  summary_md:
    type: string
    description: Markdown summary of the result.
---

# PROCEDURE

1. Greet the operator and read \`inputs.topic\`.
2. USE AGENT echo SESSION fresh WITH inputs={ "topic": <inputs.topic> }.
3. Emit \`outputs.summary_md\` from the agent's reply.
`;

const AGENT_TEMPLATE = `---
name: echo
description: Minimal sample agent — echoes its input back as markdown.
capabilities:
  - text.generation
inputs:
  topic:
    type: string
outputs:
  summary_md:
    type: string
---

You are a friendly echo agent. When given \`topic\`, reply with a short markdown
paragraph that restates the topic in your own words. Do not add anything else.
`;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function run(args: string[]): Promise<number> {
  const name = args[0];
  if (!name) {
    stderr.write("caboc init: missing <routine-name>\n");
    stderr.write("usage: caboc init <routine-name>\n");
    return 1;
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
    stderr.write(
      `caboc init: invalid routine name '${name}' — use [a-z0-9][a-z0-9_-]*\n`,
    );
    return 1;
  }

  const root = resolve(cwd(), "routines", name);
  if (await exists(root)) {
    stderr.write(`caboc init: routine already exists at ${root}\n`);
    return 1;
  }

  await mkdir(join(root, "agents"), { recursive: true });
  await writeFile(join(root, "WORKFLOW.md"), WORKFLOW_TEMPLATE(name), "utf8");
  await writeFile(join(root, "agents", "echo.agent.md"), AGENT_TEMPLATE, "utf8");

  stdout.write(`✓ created routine at ${root}\n`);
  stdout.write(`  - WORKFLOW.md\n`);
  stdout.write(`  - agents/echo.agent.md\n`);
  stdout.write(`\nnext: caboc lint ${join("routines", name)}\n`);
  return 0;
}
