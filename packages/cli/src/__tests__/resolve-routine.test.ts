// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRoutine } from "../resolve-routine.js";

async function makeWs(): Promise<string> {
	return mkdtemp(join(tmpdir(), "caboc-resolve-"));
}

async function makeRoutine(ws: string, rel: string): Promise<string> {
	const dir = join(ws, rel);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "WORKFLOW.md"), "---\nworkflow: x\nversion: 0.1.0\n---\n");
	return dir;
}

describe("resolveRoutine", () => {
	it("resolves an explicit local path", async () => {
		const ws = await makeWs();
		const r = await makeRoutine(ws, "examples/foo");
		const got = await resolveRoutine("./examples/foo", ws);
		expect(got.kind).toBe("local");
		if (got.kind !== "local") return;
		expect(got.dir).toBe(r);
		expect(got.via.source).toBe("path");
	});

	it("resolves a bare slug under examples/", async () => {
		const ws = await makeWs();
		await makeRoutine(ws, "examples/bar");
		const got = await resolveRoutine("bar", ws);
		expect(got.kind).toBe("local");
		if (got.kind !== "local") return;
		expect(got.via.source).toBe("bare-slug");
	});

	it("resolves a bare slug under routines/", async () => {
		const ws = await makeWs();
		await makeRoutine(ws, "routines/baz");
		const got = await resolveRoutine("baz", ws);
		expect(got.kind).toBe("local");
		if (got.kind !== "local") return;
		expect(got.via.source).toBe("bare-slug");
	});

	it("resolves via caboc.config.json alias", async () => {
		const ws = await makeWs();
		await makeRoutine(ws, "examples/aliased");
		await writeFile(
			join(ws, "caboc.config.json"),
			JSON.stringify({ aliases: { mine: "./examples/aliased" } }),
		);
		const got = await resolveRoutine("mine", ws);
		expect(got.kind).toBe("local");
		if (got.kind !== "local") return;
		expect(got.via.source).toBe("alias");
	});

	it("returns CABOC_E_REMOTE_RUN_NOT_SUPPORTED for remote specs", async () => {
		const ws = await makeWs();
		const got = await resolveRoutine("gh:org/repo", ws);
		expect(got.kind).toBe("error");
		if (got.kind !== "error") return;
		expect(got.code).toBe("CABOC_E_REMOTE_RUN_NOT_SUPPORTED");
	});

	it("returns CABOC_E_ROUTINE_NOT_FOUND for unknown bare slug", async () => {
		const ws = await makeWs();
		const got = await resolveRoutine("does-not-exist", ws);
		expect(got.kind).toBe("error");
		if (got.kind !== "error") return;
		expect(got.code).toBe("CABOC_E_ROUTINE_NOT_FOUND");
	});

	it("rejects duplicated alias config", async () => {
		const ws = await makeWs();
		await writeFile(join(ws, "caboc.config.json"), JSON.stringify({ aliases: {} }));
		await writeFile(join(ws, "package.json"), JSON.stringify({ caboc: { aliases: {} } }));
		await expect(resolveRoutine("anything", ws)).rejects.toThrow(/CABOC_E_ALIAS_CONFIG_DUPLICATED/);
	});
});
