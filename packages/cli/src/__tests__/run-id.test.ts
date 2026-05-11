// SPDX-FileCopyrightText: 2026 CABOC contributors
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { genRunId, RUN_ID_REGEX } from "../run-id.js";

describe("genRunId", () => {
  it("matches YYYYMMDD-HHmmss-<6 [a-z0-9]>", () => {
    const id = genRunId();
    expect(id).toMatch(RUN_ID_REGEX);
  });

  it("encodes the supplied date", () => {
    // 2026-01-02T03:04:05Z
    const id = genRunId(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)));
    expect(id.startsWith("20260102-030405-")).toBe(true);
    expect(id).toMatch(RUN_ID_REGEX);
  });

  it("produces unique ids in rapid succession", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(genRunId());
    // Same-second timestamps share prefix; the 6-hex suffix must keep them apart.
    expect(ids.size).toBe(50);
  });
});
