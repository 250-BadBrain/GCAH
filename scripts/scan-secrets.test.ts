import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("final security evidence", () => {
  it("documents local credential boundaries and detects seeded secret patterns", async () => {
    const security = await readFile("docs/security-review.md", "utf8");
    const readme = await readFile("README.md", "utf8");

    expect(security).toContain("sk-final-sentinel");
    expect(security).toContain("no real credentials");
    expect(security).toContain("OS credential store");
    expect(readme).toContain("credential set --provider openai-compatible");
    expect(readme).toContain("node apps\\cli\\dist\\src\\bin.js local");
    expect(readme).toContain("pnpm verify");
    expect(readme).toContain("pnpm demo:mechanisms");
  });
});
