// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { AliasesConfig, validateAliasId, type RoutinesLockfile } from "./schemas.js";

export type ResolvedAliasConfig = {
	aliases: Record<string, string>;
	fetchOnMiss: boolean;
	source: "caboc.config.json" | "package.json" | "none";
};

/**
 * Load alias config per STANDARDS_ALIASES §3.
 *
 * Looks for caboc.config.json then package.json `caboc:` field. Errors with
 * CABOC_E_ALIAS_CONFIG_DUPLICATED if both are present.
 */
export async function loadAliases(workspace: string): Promise<ResolvedAliasConfig> {
	const cabocPath = join(workspace, "caboc.config.json");
	const pkgPath = join(workspace, "package.json");

	const cabocExists = await fileExists(cabocPath);
	let pkgCabocPresent = false;
	let pkgCabocRaw: unknown = null;

	if (await fileExists(pkgPath)) {
		try {
			const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as Record<string, unknown>;
			if (pkg && typeof pkg === "object" && "caboc" in pkg) {
				pkgCabocPresent = true;
				pkgCabocRaw = pkg["caboc"];
			}
		} catch {
			// ignore unparseable package.json — not our problem here.
		}
	}

	if (cabocExists && pkgCabocPresent) {
		throw new Error(
			"CABOC_E_ALIAS_CONFIG_DUPLICATED: define aliases in caboc.config.json OR package.json#caboc — not both",
		);
	}

	let raw: unknown = null;
	let source: ResolvedAliasConfig["source"] = "none";
	if (cabocExists) {
		raw = JSON.parse(await readFile(cabocPath, "utf8"));
		source = "caboc.config.json";
	} else if (pkgCabocPresent) {
		raw = pkgCabocRaw;
		source = "package.json";
	} else {
		return { aliases: {}, fetchOnMiss: false, source };
	}

	const parsed = AliasesConfig.safeParse(raw);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const msg = issue ? `${issue.path.join(".")}: ${issue.message}` : "shape error";
		throw new Error(`CABOC_E_ALIAS_CONFIG_INVALID: ${msg}`);
	}

	const aliases = parsed.data.aliases ?? {};
	for (const name of Object.keys(aliases)) {
		validateAliasId(name);
	}
	return {
		aliases,
		fetchOnMiss: parsed.data.run?.fetchOnMiss ?? false,
		source,
	};
}

/**
 * Load the workspace `routines.lock` if present. Returns null when missing.
 * The runtime never fetches from network — the lockfile is authoritative.
 */
export async function loadRoutinesLockfile(
	workspace: string,
): Promise<RoutinesLockfile | null> {
	const path = join(workspace, "routines.lock");
	if (!(await fileExists(path))) return null;
	const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
	// Trust the file shape; full validation happens in caboc add/install.
	return raw as RoutinesLockfile;
}

async function fileExists(p: string): Promise<boolean> {
	try {
		const s = await stat(p);
		return s.isFile();
	} catch {
		return false;
	}
}
