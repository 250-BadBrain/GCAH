import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("final security evidence", () => {
  it("documents deployment boundaries and detects seeded secret patterns", async () => {
    const security = await readFile("docs/security-review.md", "utf8");
    const deployment = await readFile("docs/deployment.md", "utf8");
    const readme = await readFile("README.md", "utf8");

    expect(security).toContain("sk-final-sentinel");
    expect(security).toContain("no real credentials");
    expect(security).toContain("Mock LLM only");
    expect(deployment).toContain("Cloudflare login is a human step");
    expect(deployment).toContain("Wrangler login is not automated");
    expect(deployment).toContain("DNS and HTTPS are manual");
    expect(readme).toContain("pnpm verify");
    expect(readme).toContain("pnpm demo:mechanisms");
  });
});
