// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Parse a source spec per STANDARDS_DISTRIBUTION.md §2.
 *
 * Recognized forms:
 *   - `gh:org/repo` / `gh:org/repo@ref` / `gh:org/repo#subpath` / `gh:org/repo@ref#subpath`
 *   - `github.com/org/repo` (and the same with @ref / #subpath)
 *   - `gitlab.com/...` (same family)
 *   - `https://host/path.git`
 *   - `git+ssh://git@host/org/repo.git`
 *   - `./path` or `/path` → local
 */

export type SourceSpec =
	| {
			kind: "local";
			path: string;
	  }
	| {
			kind: "git";
			origin: string; // full clone URL
			host: string;
			repoSlug: string;
			ref?: string;
			subpath?: string;
			raw: string;
	  };

export class SourceParseError extends Error {
	constructor(
		readonly raw: string,
		message: string,
	) {
		super(`CABOC_E_SOURCE_UNRECOGNIZED: ${message} (input: ${raw})`);
		this.name = "SourceParseError";
	}
}

const KNOWN_HOSTS = new Set(["github.com", "gitlab.com", "bitbucket.org"]);

export function parseSourceSpec(raw: string): SourceSpec {
	if (!raw || typeof raw !== "string") {
		throw new SourceParseError(String(raw), "empty source");
	}

	// Local paths.
	if (raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("/")) {
		return { kind: "local", path: raw };
	}

	// gh: shorthand
	let body = raw;
	let host = "github.com";
	if (body.startsWith("gh:")) {
		body = body.slice(3);
	} else if (body.startsWith("gl:")) {
		body = body.slice(3);
		host = "gitlab.com";
	} else if (body.startsWith("bb:")) {
		body = body.slice(3);
		host = "bitbucket.org";
	} else if (body.startsWith("https://") || body.startsWith("git+ssh://")) {
		return parseFullUrl(raw);
	} else {
		// Host-prefixed form: `github.com/org/repo...`
		const slash = body.indexOf("/");
		if (slash < 0) {
			throw new SourceParseError(raw, "expected `host/org/repo` or `gh:org/repo`");
		}
		const hostPart = body.slice(0, slash);
		if (!KNOWN_HOSTS.has(hostPart)) {
			throw new SourceParseError(raw, `unknown host '${hostPart}'`);
		}
		host = hostPart;
		body = body.slice(slash + 1);
	}

	const { repoSlug, ref, subpath } = splitRepoSlugRefSubpath(body, raw);
	const origin = `https://${host}/${repoSlug}.git`;
	const out: SourceSpec = { kind: "git", origin, host, repoSlug, raw };
	if (ref !== undefined) out.ref = ref;
	if (subpath !== undefined) out.subpath = subpath;
	return out;
}

function splitRepoSlugRefSubpath(
	body: string,
	raw: string,
): { repoSlug: string; ref: string | undefined; subpath: string | undefined } {
	let rest = body;
	let subpath: string | undefined;
	const hashIdx = rest.indexOf("#");
	if (hashIdx >= 0) {
		subpath = rest.slice(hashIdx + 1) || undefined;
		rest = rest.slice(0, hashIdx);
	}
	let ref: string | undefined;
	const atIdx = rest.indexOf("@");
	if (atIdx >= 0) {
		ref = rest.slice(atIdx + 1) || undefined;
		rest = rest.slice(0, atIdx);
	}
	if (!rest.includes("/")) {
		throw new SourceParseError(raw, "expected `org/repo` after host or shorthand");
	}
	const parts = rest.split("/");
	if (parts.length < 2) {
		throw new SourceParseError(raw, "expected at least `org/repo`");
	}
	// Repo slug is org/repo only (no deeper path segments — those go in subpath).
	const repoSlug = `${parts[0]}/${parts[1]}`;
	const tailSubpath = parts.slice(2).join("/");
	if (tailSubpath) {
		// Allow `host/org/repo/sub/path` as sugar for `host/org/repo#sub/path`.
		subpath = subpath ? `${tailSubpath}/${subpath}` : tailSubpath;
	}
	return { repoSlug, ref, subpath };
}

function parseFullUrl(raw: string): SourceSpec {
	// https://host/org/repo.git[@ref][#subpath]   OR   git+ssh://git@host/...
	let body = raw;
	let subpath: string | undefined;
	const hashIdx = body.indexOf("#");
	if (hashIdx >= 0) {
		subpath = body.slice(hashIdx + 1) || undefined;
		body = body.slice(0, hashIdx);
	}
	let ref: string | undefined;
	// Be careful: `@` appears in `git+ssh://git@host/...`. Only treat the LAST
	// `@` after the last `/` as a ref separator.
	const lastSlash = body.lastIndexOf("/");
	const refAt = body.indexOf("@", lastSlash + 1);
	if (refAt > 0) {
		ref = body.slice(refAt + 1) || undefined;
		body = body.slice(0, refAt);
	}
	const trimmed = body.replace(/\.git$/, "");
	// Extract host + slug for display.
	const m = /^(?:https:\/\/|git\+ssh:\/\/[^/]+\/)?([^/]+)\/(.+)$/.exec(trimmed);
	const host = m ? m[1]! : "unknown";
	const repoSlug = m ? m[2]! : trimmed;
	const out: SourceSpec = {
		kind: "git",
		origin: body.endsWith(".git") ? body : `${body}.git`,
		host,
		repoSlug,
		raw,
	};
	if (ref !== undefined) out.ref = ref;
	if (subpath !== undefined) out.subpath = subpath;
	return out;
}

/** Derive a default alias slug from a source spec. */
export function deriveAlias(spec: SourceSpec): string {
	if (spec.kind === "local") {
		const parts = spec.path.split(/[/\\]+/).filter((p) => p && p !== "." && p !== "..");
		const last = parts[parts.length - 1] ?? "routine";
		return slugify(last);
	}
	if (spec.subpath) {
		const tail = spec.subpath.split("/").filter(Boolean).pop() ?? "routine";
		return slugify(tail);
	}
	const tail = spec.repoSlug.split("/").pop() ?? "routine";
	return slugify(tail);
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40)
		|| "routine";
}
