// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd, stderr, stdout } from "node:process";
import type { RoutinesLockfile } from "./schemas.js";

export async function run(args: string[]): Promise<number> {
	const alias = args[0];
	if (!alias) {
		stderr.write("caboc remove: missing <alias>\n");
		return 1;
	}
	const workspace = cwd();
	const lockPath = join(workspace, "routines.lock");
	let lock: RoutinesLockfile;
	try {
		lock = JSON.parse(await readFile(lockPath, "utf8")) as RoutinesLockfile;
	} catch {
		stderr.write("caboc remove: routines.lock not found — nothing to remove\n");
		return 1;
	}
	if (!lock.routines || !(alias in lock.routines)) {
		stderr.write(`caboc remove: alias '${alias}' not found in lockfile\n`);
		return 1;
	}
	delete lock.routines[alias];
	await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
	await rm(join(workspace, "routines", alias), { recursive: true, force: true });
	stdout.write(`caboc: removed ${alias}\n`);
	return 0;
}
