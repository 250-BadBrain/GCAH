import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { resetDemoWorkspace } from "../src/demo-workspace.js";

describe("demo workspace reset", () => {
  it("copies a fixed template into a disposable workspace", async () => {
    const root = join(tmpdir(), `gcah-demo-${Date.now()}`);
    const template = join(root, "template");
    const target = join(root, "run");
    await mkdir(join(template, "src"), { recursive: true });
    await writeFile(join(template, "README.md"), "fixed demo");
    await writeFile(join(template, "src", "example.ts"), "export const demo = true;\n");

    const result = await resetDemoWorkspace({ templateDir: template, targetDir: target });

    expect(result.rootPath).toBe(target);
    expect(await readFile(join(target, "README.md"), "utf8")).toBe("fixed demo");
    expect(await readFile(join(target, "src", "example.ts"), "utf8")).toContain("demo");
  });
});
