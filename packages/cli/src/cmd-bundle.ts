// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { cwd, stderr, stdout } from "node:process";

/**
 * `caboc bundle <run-dir>` — assemble a deterministic .tar.gz of a run.
 *
 * Implements STANDARDS_OUTPUTS §8. Output: `<run-dir>.tar.gz` next to
 * the run dir. Deterministic flags (sorted, fixed mtime, ustar) so
 * re-bundling the same run produces a byte-identical archive.
 */
export async function run(args: string[]): Promise<number> {
	const target = args[0];
	if (!target) {
		stderr.write("caboc bundle: missing <run-dir>\n");
		return 1;
	}
	const runDir = resolve(cwd(), target);
	try {
		const s = await stat(runDir);
		if (!s.isDirectory()) throw new Error("not a dir");
	} catch {
		stderr.write(`caboc bundle: run dir not found: ${runDir}\n`);
		return 1;
	}
	const parent = dirname(runDir);
	const name = basename(runDir);
	const archive = `${runDir}.tar.gz`;

	// Deterministic flags: sorted entries, fixed mtime, ustar format,
	// numeric ids, no extended attrs. Same output across hosts.
	const tarArgs = [
		"--sort=name",
		"--mtime=@0",
		"--owner=0",
		"--group=0",
		"--numeric-owner",
		"--format=ustar",
		"-czf",
		archive,
		"-C",
		parent,
		name,
	];

	const code: number = await new Promise((resolveP) => {
		const ch = spawn("tar", tarArgs, { stdio: ["ignore", "ignore", "inherit"] });
		ch.on("close", (c) => resolveP(c ?? 1));
		ch.on("error", () => resolveP(1));
	});

	if (code !== 0) {
		stderr.write(`caboc bundle: tar exited with code ${code}\n`);
		return 1;
	}
	stdout.write(`${archive}\n`);
	return 0;
}
