import { access, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI package bin", () => {
  it("points to emitted JavaScript", async () => {
    const tsc = join(import.meta.dirname, "..", "..", "..", "node_modules", "typescript", "bin", "tsc");
    const markExecutable = join(import.meta.dirname, "..", "..", "..", "scripts", "mark-cli-bin-executable.mjs");
    await execFileAsync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
      cwd: join(import.meta.dirname, "..")
    });
    await execFileAsync(process.execPath, [markExecutable], {
      cwd: join(import.meta.dirname, "..", "..", "..")
    });
    const packageJson = (await import("../package.json", { with: { type: "json" } })).default;
    const binPath = join(import.meta.dirname, "..", "dist", "src", "bin.js");
    expect(packageJson.bin.gcah).toBe("./dist/src/bin.js");
    await expect(access(binPath)).resolves.toBeUndefined();
    if (process.platform !== "win32") {
      expect((await stat(binPath)).mode & 0o111).not.toBe(0);
    }
    const executable = process.platform === "win32" ? process.execPath : binPath;
    const args = process.platform === "win32" ? [binPath, "server", "start"] : ["server", "start"];
    await expect(execFileAsync(executable, args)).resolves.toMatchObject({
      stdout: "server start: use @gcah/server composition root\n"
    });
  });
});
