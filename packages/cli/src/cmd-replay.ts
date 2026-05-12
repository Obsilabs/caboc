// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cwd, stderr, stdout } from "node:process";

/**
 * `caboc replay <run-dir>` — re-print the prompt the LLM-runtime should
 * be fed in order to re-execute the routine deterministically against
 * the same inputs.
 *
 * v0.2 minimal: this command prints the prompt + the path of the
 * inputs.json. Full transcript-hash-verified replay (where the skill
 * checks each agent turn against the stored transcript) is documented
 * in STANDARDS_DISTRIBUTION §6 and the SKILL.md, and is implemented in
 * the skill body itself — not in this CLI.
 */
export async function run(args: string[]): Promise<number> {
	const target = args[0];
	if (!target) {
		stderr.write("caboc replay: missing <run-dir>\n");
		return 1;
	}
	const runDir = resolve(cwd(), target);
	try {
		const s = await stat(runDir);
		if (!s.isDirectory()) throw new Error("not a dir");
	} catch {
		stderr.write(`caboc replay: run dir not found: ${runDir}\n`);
		return 1;
	}

	const inputsPath = join(runDir, "inputs.json");
	try {
		await readFile(inputsPath, "utf8");
	} catch {
		stderr.write(`caboc replay: inputs.json missing in ${runDir}\n`);
		return 1;
	}

	stdout.write("# CABOC Runtime — REPLAY\n\n");
	stdout.write(
		"Re-execute this routine against its frozen inputs.json.\n" +
			"The runtime should compare each agent turn against the prior\n" +
			"`transcript.ndjson` and fail with CABOC_E_REPLAY_DRIFT on mismatch\n" +
			"when running in `policies.sessions.transcriptReplayMode: hash_verified`.\n\n",
	);
	stdout.write(`- run dir:  ${runDir}\n`);
	stdout.write(`- inputs:   ${inputsPath}\n`);
	stdout.write(`- prior transcript: ${join(runDir, "transcript.ndjson")}\n\n`);
	stdout.write(
		"Start by reading the WORKFLOW.md referenced in the prior transcript and replay each step.\n",
	);
	return 0;
}
