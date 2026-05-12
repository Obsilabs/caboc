// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { stdout, stderr, cwd } from "node:process";
import { loadAliases, loadRoutinesLockfile } from "./load-aliases.js";

export async function run(_args: string[]): Promise<number> {
	const workspace = cwd();
	const lock = await loadRoutinesLockfile(workspace);
	const aliasCfg = await loadAliases(workspace);

	const aliases = aliasCfg.aliases ?? {};
	const aliasKeys = Object.keys(aliases).sort();
	if (aliasKeys.length > 0) {
		stdout.write(`# Aliases (from ${aliasCfg.source})\n`);
		for (const k of aliasKeys) {
			stdout.write(`  ${k.padEnd(24)} -> ${aliases[k]}\n`);
		}
		stdout.write("\n");
	}

	if (!lock || !lock.routines || Object.keys(lock.routines).length === 0) {
		if (aliasKeys.length === 0) {
			stderr.write("caboc list: nothing installed.\n");
			stderr.write("Run `caboc add <source>` to install a routine.\n");
		}
		return 0;
	}

	stdout.write("# Installed routines\n");
	const names = Object.keys(lock.routines).sort();
	for (const name of names) {
		const r = lock.routines[name]!;
		stdout.write(
			`  ${name.padEnd(24)} ${r.version.padEnd(10)} ${r.sha256.slice(0, 12)}…  ${r.source}${
				r.subpath ? `#${r.subpath}` : ""
			}\n`,
		);
	}
	return 0;
}
