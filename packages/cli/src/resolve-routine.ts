// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { loadAliases, loadRoutinesLockfile } from "./load-aliases.js";

/**
 * Resolve a `caboc run <arg>` argument to a local routine directory.
 *
 * Implements the six-step precedence from STANDARDS_ALIASES.md §2:
 *   1. Explicit local path with WORKFLOW.md
 *   2. Lockfile entry (`routines.lock`)
 *   3. Alias config (`caboc.config.json` or `package.json#caboc`)
 *   4. Bare slug under `routines/` or `examples/`
 *   5. Remote spec — deferred to v0.3 (returns CABOC_E_REMOTE_RUN_NOT_SUPPORTED)
 *   6. Not found
 *
 * Alias targets resolve to another arg (one level of indirection max).
 */

export type ResolveResult =
	| { kind: "local"; dir: string; via: ResolveSource }
	| { kind: "error"; code: string; message: string };

export type ResolveSource =
	| { source: "path" }
	| { source: "lockfile"; alias: string }
	| { source: "alias"; alias: string; target: string }
	| { source: "bare-slug"; under: "routines" | "examples" };

const REMOTE_RE = /^(?:gh|gl|bb):|^github\.com\/|^gitlab\.com\/|^bitbucket\.org\/|^https?:\/\/|^git\+ssh:\/\//;

export async function resolveRoutine(
	arg: string,
	workspace: string,
	opts: { followAlias?: boolean } = {},
): Promise<ResolveResult> {
	const followAlias = opts.followAlias ?? true;

	// 1. Explicit local path
	if (looksLikePath(arg)) {
		const abs = isAbsolute(arg) ? arg : resolve(workspace, arg);
		if (await isRoutineDir(abs)) {
			return { kind: "local", dir: abs, via: { source: "path" } };
		}
	}

	// 2. Lockfile entry
	const lock = await loadRoutinesLockfile(workspace);
	if (lock && lock.routines && arg in lock.routines) {
		const dir = join(workspace, "routines", arg);
		if (await isRoutineDir(dir)) {
			return { kind: "local", dir, via: { source: "lockfile", alias: arg } };
		}
		return {
			kind: "error",
			code: "CABOC_E_LOCKFILE_BROKEN",
			message: `lockfile lists '${arg}' but routines/${arg}/WORKFLOW.md is missing — run \`caboc install\``,
		};
	}

	// 3. Alias config
	const aliasCfg = await loadAliases(workspace);
	if (arg in aliasCfg.aliases) {
		const target = aliasCfg.aliases[arg]!;
		if (!followAlias) {
			return {
				kind: "error",
				code: "CABOC_E_ALIAS_CYCLE",
				message: `alias cycle through '${arg}'`,
			};
		}
		// One level of indirection allowed.
		return resolveRoutine(target, workspace, { followAlias: false }).then((r) => {
			if (r.kind === "local") {
				return { kind: "local", dir: r.dir, via: { source: "alias", alias: arg, target } };
			}
			return r;
		});
	}

	// 4. Bare slug under routines/ or examples/
	if (isBareSlug(arg)) {
		for (const under of ["routines", "examples"] as const) {
			const dir = join(workspace, under, arg);
			if (await isRoutineDir(dir)) {
				return { kind: "local", dir, via: { source: "bare-slug", under } };
			}
		}
	}

	// 5. Remote spec — v0.3+ feature, deferred
	if (REMOTE_RE.test(arg)) {
		return {
			kind: "error",
			code: "CABOC_E_REMOTE_RUN_NOT_SUPPORTED",
			message: `'${arg}' is a remote spec; run \`caboc add ${arg}\` first, then \`caboc run <alias>\``,
		};
	}

	// 6. Not found
	return {
		kind: "error",
		code: "CABOC_E_ROUTINE_NOT_FOUND",
		message: `'${arg}' did not match a local path, lockfile entry, alias, or bare slug under routines/ or examples/`,
	};
}

function looksLikePath(s: string): boolean {
	return s.startsWith("./") || s.startsWith("../") || s.startsWith("/") || s.includes("/");
}

function isBareSlug(s: string): boolean {
	return /^[a-z][a-z0-9-_]*$/.test(s);
}

async function isRoutineDir(dir: string): Promise<boolean> {
	try {
		const s = await stat(join(dir, "WORKFLOW.md"));
		return s.isFile();
	} catch {
		return false;
	}
}
