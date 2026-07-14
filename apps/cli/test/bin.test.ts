import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CLI package bin", () => {
  it("points to emitted JavaScript", async () => {
    const packageJson = (await import("../package.json", { with: { type: "json" } })).default;
    expect(packageJson.bin.gcah).toBe("./dist/src/bin.js");
    await expect(access(join(import.meta.dirname, "..", "dist", "src", "bin.js"))).resolves.toBeUndefined();
  });
});
