import { describe, expect, it } from "vitest";

import { matchCommandTemplate } from "../src/index.js";

describe("command templates", () => {
  const templates = [
    { id: "test", executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }
  ];

  it("matches exact executable and args and rejects shell metacharacters or undeclared args", () => {
    expect(matchCommandTemplate({ executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }, templates)).toMatchObject({
      ok: true,
      templateId: "test"
    });
    expect(matchCommandTemplate({ executable: "pnpm", args: ["test", "&&", "rm"], cwd: ".", timeoutMs: 1000 }, templates)).toMatchObject({ ok: false });
    expect(matchCommandTemplate({ executable: "pnpm", args: ["install"], cwd: ".", timeoutMs: 1000 }, templates)).toMatchObject({ ok: false });
    expect(matchCommandTemplate({ executable: "pnpm", args: ["test"], cwd: "../outside", timeoutMs: 1000 }, templates)).toMatchObject({ ok: false });
  });
});
