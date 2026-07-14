import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI package bin", () => {
  it("points to emitted JavaScript", async () => {
    const tsc = join(import.meta.dirname, "..", "..", "..", "node_modules", "typescript", "bin", "tsc");
    await execFileAsync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
      cwd: join(import.meta.dirname, "..")
    });
    const packageJson = (await import("../package.json", { with: { type: "json" } })).default;
    expect(packageJson.bin.gcah).toBe("./dist/src/bin.js");
    await expect(access(join(import.meta.dirname, "..", "dist", "src", "bin.js"))).resolves.toBeUndefined();
    await expect(execFileAsync(process.execPath, [join(import.meta.dirname, "..", "dist", "src", "bin.js"), "server", "start"])).resolves.toMatchObject({
      stdout: "server start: use @gcah/server composition root\n"
    });
  });
});
