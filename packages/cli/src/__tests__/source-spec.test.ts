// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { deriveAlias, parseSourceSpec, SourceParseError } from "../source-spec.js";

describe("parseSourceSpec", () => {
	it("parses gh: shorthand", () => {
		const s = parseSourceSpec("gh:Obsilabs/caboc");
		expect(s.kind).toBe("git");
		if (s.kind !== "git") return;
		expect(s.host).toBe("github.com");
		expect(s.repoSlug).toBe("Obsilabs/caboc");
		expect(s.ref).toBeUndefined();
		expect(s.subpath).toBeUndefined();
	});

	it("parses gh: with @ref and #subpath", () => {
		const s = parseSourceSpec("gh:Obsilabs/caboc@v0.1.1#examples/01-commit-message");
		if (s.kind !== "git") throw new Error("expected git");
		expect(s.ref).toBe("v0.1.1");
		expect(s.subpath).toBe("examples/01-commit-message");
	});

	it("parses github.com host form", () => {
		const s = parseSourceSpec("github.com/acme/routines#bug-triage");
		if (s.kind !== "git") throw new Error("expected git");
		expect(s.host).toBe("github.com");
		expect(s.repoSlug).toBe("acme/routines");
		expect(s.subpath).toBe("bug-triage");
	});

	it("accepts host/org/repo/path as sugar for #path", () => {
		const s = parseSourceSpec("github.com/acme/routines/examples/foo");
		if (s.kind !== "git") throw new Error("expected git");
		expect(s.subpath).toBe("examples/foo");
	});

	it("rejects unknown host", () => {
		expect(() => parseSourceSpec("evil.example/foo/bar")).toThrowError(SourceParseError);
	});

	it("returns local kind for relative paths", () => {
		const s = parseSourceSpec("./examples/01-commit-message");
		expect(s.kind).toBe("local");
	});

	it("parses https URL with ref + subpath", () => {
		const s = parseSourceSpec("https://example.com/acme/routines.git@main#sub");
		if (s.kind !== "git") throw new Error("expected git");
		expect(s.ref).toBe("main");
		expect(s.subpath).toBe("sub");
	});
});

describe("deriveAlias", () => {
	it("uses last subpath segment when subpath present", () => {
		const s = parseSourceSpec("gh:Obsilabs/caboc#examples/02-changelog-from-commits");
		expect(deriveAlias(s)).toBe("02-changelog-from-commits");
	});

	it("uses repo name when no subpath", () => {
		const s = parseSourceSpec("gh:acme/cool-routine");
		expect(deriveAlias(s)).toBe("cool-routine");
	});
});
