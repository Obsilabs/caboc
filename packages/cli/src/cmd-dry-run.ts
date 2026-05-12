// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cwd, stderr, stdout } from "node:process";
import { resolveRoutine } from "./resolve-routine.js";

/**
 * `caboc dry-run <alias|routine-dir>` — static analysis of a routine.
 *
 * Counts steps + agents + USE TOOL calls + nested FOR_EACH PARALLEL
 * fanouts + INVOKE WORKFLOW depth. No execution. Lets an author see
 * how many subagent spawns a run would imply before paying for them.
 */
export async function run(args: string[]): Promise<number> {
	const target = args[0];
	if (!target) {
		stderr.write("caboc dry-run: missing <alias|routine-dir>\n");
		return 1;
	}

	const resolution = await resolveRoutine(target, cwd());
	if (resolution.kind === "error") {
		stderr.write(`caboc dry-run: ${resolution.code}: ${resolution.message}\n`);
		return 1;
	}
	const routineDir = resolve(resolution.dir);

	try {
		await stat(join(routineDir, "WORKFLOW.md"));
	} catch {
		stderr.write(`caboc dry-run: WORKFLOW.md missing in ${routineDir}\n`);
		return 1;
	}

	const wf = await readFile(join(routineDir, "WORKFLOW.md"), "utf8");
	const counts = countConstructs(wf);

	stdout.write(`# CABOC dry-run — ${routineDir}\n\n`);
	stdout.write(`Steps total:           ${counts.steps}\n`);
	stdout.write(`STEP DETERMINISTIC:    ${counts.deterministic}\n`);
	stdout.write(`STEP NON_DETERMINISTIC: ${counts.nonDeterministic}\n`);
	stdout.write(`STEP HITL:             ${counts.hitl}\n`);
	stdout.write(`USE AGENT calls:       ${counts.agentCalls}\n`);
	stdout.write(`USE TOOL calls:        ${counts.toolCalls}\n`);
	stdout.write(`PARALLEL blocks:       ${counts.parallel}\n`);
	stdout.write(`FOR_EACH (sequential): ${counts.forEachSeq}\n`);
	stdout.write(`FOR_EACH PARALLEL:     ${counts.forEachParallel}\n`);
	stdout.write(`LOOP UNTIL / WHILE:    ${counts.loops}\n`);
	stdout.write(`INVOKE WORKFLOW:       ${counts.invokeWorkflow}\n`);
	stdout.write(`PROMPT TO:             ${counts.promptTo}\n`);
	stdout.write(`AWAIT FROM human:      ${counts.awaitHuman}\n`);
	stdout.write("\n");
	stdout.write(
		"This is a static count. PARALLEL CONCURRENCY values are runtime knobs;\n" +
			"actual subagent spawns depend on the size of the collection at runtime.\n",
	);
	return 0;
}

function countConstructs(wf: string): {
	steps: number;
	deterministic: number;
	nonDeterministic: number;
	hitl: number;
	agentCalls: number;
	toolCalls: number;
	parallel: number;
	forEachSeq: number;
	forEachParallel: number;
	loops: number;
	invokeWorkflow: number;
	promptTo: number;
	awaitHuman: number;
} {
	const steps = (wf.match(/^\s*STEP\s+\S+\s+/gm) ?? []).length;
	const deterministic = (wf.match(/^\s*STEP\s+\S+\s+[^.]*\bDETERMINISTIC\b/gm) ?? []).length;
	const nonDeterministic = (wf.match(/\bNON_DETERMINISTIC\b/g) ?? []).length;
	const hitl = (wf.match(/\bHITL\b/g) ?? []).length;
	const agentCalls = (wf.match(/\bUSE\s+AGENT\b/g) ?? []).length;
	const toolCalls = (wf.match(/\bUSE\s+TOOL\b/g) ?? []).length;
	const parallel = (wf.match(/^\s*PARALLEL\s+JOIN_POLICY/gm) ?? []).length;
	const forEachSeq =
		(wf.match(/^\s*FOR_EACH\s+\S+\s+IN\b/gm) ?? []).length -
		(wf.match(/^\s*FOR_EACH\s+\S+\s+IN\s+[^.]*\bPARALLEL\b/gm) ?? []).length;
	const forEachParallel = (wf.match(/^\s*FOR_EACH\s+\S+\s+IN\s+[^.]*\bPARALLEL\b/gm) ?? []).length;
	const loops = (wf.match(/^\s*LOOP\s+(UNTIL|WHILE)\b/gm) ?? []).length;
	const invokeWorkflow = (wf.match(/\bINVOKE\s+WORKFLOW\b/g) ?? []).length;
	const promptTo = (wf.match(/^\s*PROMPT\s+TO\b/gm) ?? []).length;
	const awaitHuman = (wf.match(/^\s*AWAIT\s+\S+\s+FROM\s+human\b/gm) ?? []).length;
	return {
		steps,
		deterministic,
		nonDeterministic,
		hitl,
		agentCalls,
		toolCalls,
		parallel,
		forEachSeq,
		forEachParallel,
		loops,
		invokeWorkflow,
		promptTo,
		awaitHuman,
	};
}
