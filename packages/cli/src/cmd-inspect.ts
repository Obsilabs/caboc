// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { readFile, stat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { stdout, stderr, cwd } from "node:process";

interface TranscriptEvent {
  kind?: string;
  ts?: string | number;
  step?: string;
  duration_ms?: number;
  [k: string]: unknown;
}

function truncate(s: string, n = 800): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}\n… [truncated, ${s.length - n} chars omitted]`;
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    await stat(path);
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function run(args: string[]): Promise<number> {
  const dirArg = args[0];
  if (!dirArg) {
    stderr.write("caboc inspect: missing <run-dir>\n");
    stderr.write("usage: caboc inspect <run-dir>\n");
    return 1;
  }
  const runDir = resolve(cwd(), dirArg);
  try {
    const s = await stat(runDir);
    if (!s.isDirectory()) throw new Error("not a directory");
  } catch {
    stderr.write(`caboc inspect: run dir not found: ${runDir}\n`);
    return 1;
  }

  stdout.write(`Run: ${relative(cwd(), runDir) || runDir}\n`);
  stdout.write("─".repeat(60) + "\n");

  // --- transcript.ndjson
  const transcriptPath = join(runDir, "transcript.ndjson");
  const transcriptRaw = await readIfExists(transcriptPath);
  if (transcriptRaw === null) {
    stdout.write("transcript.ndjson: (not found)\n\n");
  } else {
    const events: TranscriptEvent[] = [];
    const parseErrors: { line: number; err: string }[] = [];
    const lines = transcriptRaw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      try {
        events.push(JSON.parse(line) as TranscriptEvent);
      } catch (e) {
        parseErrors.push({ line: i + 1, err: (e as Error).message });
      }
    }

    const counts = new Map<string, number>();
    const stepStarts = new Map<string, number>();
    const stepDurations: { step: string; ms: number }[] = [];
    const failures: TranscriptEvent[] = [];
    const repairs: TranscriptEvent[] = [];

    for (const ev of events) {
      const kind = ev.kind ?? "<unknown>";
      counts.set(kind, (counts.get(kind) ?? 0) + 1);

      if (kind === "step.start" && typeof ev.step === "string" && ev.ts) {
        stepStarts.set(ev.step, Date.parse(String(ev.ts)) || Number(ev.ts) || 0);
      }
      if (kind === "step.end" && typeof ev.step === "string") {
        if (typeof ev.duration_ms === "number") {
          stepDurations.push({ step: ev.step, ms: ev.duration_ms });
        } else if (ev.ts && stepStarts.has(ev.step)) {
          const start = stepStarts.get(ev.step)!;
          const end = Date.parse(String(ev.ts)) || Number(ev.ts) || 0;
          if (end > start) stepDurations.push({ step: ev.step, ms: end - start });
        }
      }
      if (kind === "assertion.failed") failures.push(ev);
      if (kind === "agent.repair") repairs.push(ev);
    }

    stdout.write(`Events: ${events.length}\n`);
    for (const [kind, n] of [...counts.entries()].sort()) {
      stdout.write(`  ${kind.padEnd(20)} ${n}\n`);
    }

    if (stepDurations.length > 0) {
      stdout.write("\nStep durations:\n");
      for (const { step, ms } of stepDurations) {
        stdout.write(`  ${step.padEnd(30)} ${ms} ms\n`);
      }
    }

    if (repairs.length > 0) {
      stdout.write(`\nagent.repair events (${repairs.length}):\n`);
      for (const ev of repairs) {
        stdout.write(`  ${JSON.stringify(ev)}\n`);
      }
    }
    if (failures.length > 0) {
      stdout.write(`\nassertion.failed events (${failures.length}):\n`);
      for (const ev of failures) {
        stdout.write(`  ${JSON.stringify(ev)}\n`);
      }
    }
    if (parseErrors.length > 0) {
      stdout.write(
        `\ntranscript parse errors (${parseErrors.length}): first at line ${parseErrors[0]?.line}\n`,
      );
    }
    stdout.write("\n");
  }

  // --- outputs.json
  const outputsPath = join(runDir, "outputs.json");
  const outputsRaw = await readIfExists(outputsPath);
  if (outputsRaw === null) {
    stdout.write("outputs.json: (not found)\n");
  } else {
    let outputs: unknown;
    try {
      outputs = JSON.parse(outputsRaw);
    } catch {
      outputs = undefined;
    }
    if (
      outputs &&
      typeof outputs === "object" &&
      "summary_md" in (outputs as Record<string, unknown>) &&
      typeof (outputs as Record<string, unknown>).summary_md === "string"
    ) {
      stdout.write("summary_md:\n");
      stdout.write(
        truncate((outputs as Record<string, unknown>).summary_md as string),
      );
      stdout.write("\n");
    } else {
      stdout.write("outputs.json:\n");
      stdout.write(truncate(outputsRaw));
      stdout.write("\n");
    }
  }

  return 0;
}
