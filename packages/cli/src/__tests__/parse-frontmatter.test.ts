// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { parseFrontmatterString } from "../parse-frontmatter.js";

describe("parseFrontmatterString", () => {
  it("parses a well-formed file", () => {
    const src = `---
name: foo
version: 1.0.0
---

# body

Hello world.
`;
    const { frontmatter, body } = parseFrontmatterString(src);
    expect(frontmatter).toEqual({ name: "foo", version: "1.0.0" });
    expect(body).toContain("# body");
    expect(body).toContain("Hello world.");
  });

  it("returns null frontmatter when none is present", () => {
    const src = "# just markdown\n\nno frontmatter here.\n";
    const { frontmatter, body } = parseFrontmatterString(src);
    expect(frontmatter).toBeNull();
    expect(body).toBe(src);
  });

  it("throws when the closing --- is missing", () => {
    const src = `---
name: foo
version: 1.0.0

# body without closing fence
`;
    expect(() => parseFrontmatterString(src)).toThrow(/missing closing/i);
  });

  it("throws on invalid YAML", () => {
    const src = `---
name: foo
  bad: [unclosed
---

body
`;
    expect(() => parseFrontmatterString(src)).toThrow(/invalid YAML/i);
  });

  it("normalizes CRLF line endings", () => {
    const src = "---\r\nname: foo\r\nversion: 1.0.0\r\n---\r\n\r\nbody\r\n";
    const { frontmatter, body } = parseFrontmatterString(src);
    expect(frontmatter).toEqual({ name: "foo", version: "1.0.0" });
    expect(body.trim()).toBe("body");
  });
});
