// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep, posix } from "node:path";

const SKIP = new Set([".git", "node_modules", "runs", ".cache", ".DS_Store"]);

async function walk(root: string, dir: string, out: string[]): Promise<void> {
	const entries = await readdir(dir, { withFileTypes: true });
	for (const e of entries) {
		if (SKIP.has(e.name)) continue;
		const abs = join(dir, e.name);
		if (e.isDirectory()) {
			await walk(root, abs, out);
		} else if (e.isFile()) {
			out.push(relative(root, abs).split(sep).join(posix.sep));
		}
	}
}

/**
 * Hash a routine directory per STANDARDS_DISTRIBUTION.md §4.
 *
 * For each file (sorted): `<rel-path>\x00<file-bytes>\x00` with line endings
 * normalized to LF. Returns lowercase hex sha256.
 */
export async function hashTree(root: string): Promise<string> {
	const stats = await stat(root);
	if (!stats.isDirectory()) {
		throw new Error(`hashTree: not a directory: ${root}`);
	}
	const files: string[] = [];
	await walk(root, root, files);
	files.sort();

	const h = createHash("sha256");
	const NUL = Buffer.from([0]);
	for (const rel of files) {
		const abs = join(root, ...rel.split(posix.sep));
		const raw = await readFile(abs);
		const normalized = Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"));
		h.update(Buffer.from(rel, "utf8"));
		h.update(NUL);
		h.update(normalized);
		h.update(NUL);
	}
	return h.digest("hex");
}
