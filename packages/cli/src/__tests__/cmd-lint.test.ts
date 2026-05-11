// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run as lintRun } from "../cmd-lint.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "__fixtures__");

interface Captured {
  stdout: string;
  stderr: string;
}

async function captureLint(args: string[]): Promise<{ code: number; out: Captured }> {
  const captured: Captured = { stdout: "", stderr: "" };
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  // Cast through unknown — we are replacing a Node stream method with a test spy.
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    captured.stdout += s;
    return true;
  };
  (process.stderr as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    captured.stderr += s;
    return true;
  };
  try {
    const code = await lintRun(args);
    return { code, out: captured };
  } finally {
    (process.stdout as unknown as { write: typeof origOut }).write = origOut;
    (process.stderr as unknown as { write: typeof origErr }).write = origErr;
  }
}

describe("cmd-lint", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "caboc-lint-"));
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("passes a valid routine", async () => {
    const { code, out } = await captureLint([join(FIXTURES, "valid-routine")]);
    expect(out.stderr).toBe("");
    expect(out.stdout).toContain("✓");
    expect(code).toBe(0);
  });

  it("fails when an agent body contains a model-name literal (claude-)", async () => {
    const { code, out } = await captureLint([join(FIXTURES, "bad-model-name")]);
    expect(code).toBe(1);
    expect(out.stderr).toMatch(/model-name literal/i);
    expect(out.stderr).toMatch(/claude-/);
  });

  it("fails when USE AGENT refers to a nonexistent agent", async () => {
    // Build a routine inline: a valid agent named 'echo' but the workflow
    // references 'missing'.
    const routineDir = join(tmpRoot, "broken");
    await mkdir(join(routineDir, "agents"), { recursive: true });
    await writeFile(
      join(routineDir, "WORKFLOW.md"),
      `---
name: broken
version: 0.1.0
---

# PROCEDURE

1. USE AGENT missing SESSION fresh WITH inputs={}.
`,
      "utf8",
    );
    await writeFile(
      join(routineDir, "agents", "echo.agent.md"),
      `---
name: echo
description: present but not the one referenced
---

body
`,
      "utf8",
    );

    const { code, out } = await captureLint([routineDir]);
    expect(code).toBe(1);
    expect(out.stderr).toMatch(/USE AGENT 'missing'/);
    expect(out.stderr).toMatch(/agents\/missing\.agent\.md/);
  });

  it("fails when the routine directory does not exist", async () => {
    const { code, out } = await captureLint([join(tmpRoot, "does-not-exist")]);
    expect(code).toBe(1);
    expect(out.stderr).toMatch(/not a directory/);
  });
});
