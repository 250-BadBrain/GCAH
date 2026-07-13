import { describe, expect, it } from "vitest";

import { normalizedActionHash, normalizeActionForHash, scopeHash } from "../src/index.js";
import type { NormalizedAction } from "../src/index.js";

const action = (rationale: string): NormalizedAction => ({
  kind: "tool",
  tool: "write",
  args: { path: "src/app.ts", content: "new" },
  rationale,
  normalizedSummary: "write src/app.ts"
});

describe("approval hashes", () => {
  it("hashes trusted normalized fields and excludes rationale", () => {
    expect(normalizeActionForHash(action("one"))).toEqual({
      tool: "write",
      args: { path: "src/app.ts", content: "new" },
      normalizedSummary: "write src/app.ts"
    });
    expect(normalizedActionHash(action("one"))).toEqual(normalizedActionHash(action("two")));
    expect(normalizedActionHash(action("one"))).not.toEqual(normalizedActionHash({
      kind: "tool",
      tool: "write",
      args: { path: "src/other.ts", content: "new" },
      rationale: "one",
      normalizedSummary: "write src/app.ts"
    }));
  });

  it("binds scope hashes to tool, path, command, and risk category", () => {
    const first = scopeHash({ tool: "write", pathScope: "src/app.ts", commandTemplate: null, riskCategory: "mutation" });
    const second = scopeHash({ tool: "write", pathScope: "src/other.ts", commandTemplate: null, riskCategory: "mutation" });
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).not.toEqual(second);
  });
});
