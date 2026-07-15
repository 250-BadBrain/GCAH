import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("CI contract", () => {
  it("runs frozen offline verify and mechanism demo in GitLab and GitHub", async () => {
    const gitlab = await readFile(".gitlab-ci.yml", "utf8");
    const github = await readFile(".github/workflows/ci.yml", "utf8");

    expect(gitlab).toContain("unit-test:");
    for (const file of [gitlab, github]) {
      expect(file).toContain("pnpm install --frozen-lockfile");
      expect(file).toMatch(/pnpm verify[\s\S]*pnpm demo:mechanisms/u);
      expect(file).not.toContain("pnpm test");
      expect(file).not.toContain("GCAH_RUN_REAL_LLM_INTEGRATION");
    }
    expect(github).toContain("actions/setup-node");
    expect(github).toContain("pnpm/action-setup");
  });
});
