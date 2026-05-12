// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashTree } from "../hash-tree.js";

describe("hashTree", () => {
	it("returns the same hash for the same content", async () => {
		const a = await mkdtemp(join(tmpdir(), "caboc-hash-a-"));
		const b = await mkdtemp(join(tmpdir(), "caboc-hash-b-"));
		await writeFile(join(a, "WORKFLOW.md"), "hello\n");
		await mkdir(join(a, "agents"), { recursive: true });
		await writeFile(join(a, "agents", "x.agent.md"), "agent\n");
		await writeFile(join(b, "WORKFLOW.md"), "hello\n");
		await mkdir(join(b, "agents"), { recursive: true });
		await writeFile(join(b, "agents", "x.agent.md"), "agent\n");
		const ha = await hashTree(a);
		const hb = await hashTree(b);
		expect(ha).toBe(hb);
		expect(ha).toHaveLength(64);
	});

	it("differs when content differs", async () => {
		const a = await mkdtemp(join(tmpdir(), "caboc-hash-c-"));
		const b = await mkdtemp(join(tmpdir(), "caboc-hash-d-"));
		await writeFile(join(a, "WORKFLOW.md"), "hello\n");
		await writeFile(join(b, "WORKFLOW.md"), "world\n");
		const ha = await hashTree(a);
		const hb = await hashTree(b);
		expect(ha).not.toBe(hb);
	});

	it("normalizes line endings to LF", async () => {
		const a = await mkdtemp(join(tmpdir(), "caboc-hash-e-"));
		const b = await mkdtemp(join(tmpdir(), "caboc-hash-f-"));
		await writeFile(join(a, "WORKFLOW.md"), "hello\n");
		await writeFile(join(b, "WORKFLOW.md"), "hello\r\n");
		const ha = await hashTree(a);
		const hb = await hashTree(b);
		expect(ha).toBe(hb);
	});

	it("excludes runs/ and node_modules/", async () => {
		const a = await mkdtemp(join(tmpdir(), "caboc-hash-g-"));
		const b = await mkdtemp(join(tmpdir(), "caboc-hash-h-"));
		await writeFile(join(a, "WORKFLOW.md"), "x\n");
		await mkdir(join(a, "runs", "run1"), { recursive: true });
		await writeFile(join(a, "runs", "run1", "inputs.json"), "{}\n");
		await writeFile(join(b, "WORKFLOW.md"), "x\n");
		const ha = await hashTree(a);
		const hb = await hashTree(b);
		expect(ha).toBe(hb);
	});
});
