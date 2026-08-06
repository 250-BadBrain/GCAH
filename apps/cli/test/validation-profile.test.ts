import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { isAllowedLocalValidation, resolveLocalValidation } from "../src/validation-profile.js";

async function workspace(): Promise<string> {
  const path = join(tmpdir(), `gcah-validation-${randomUUID()}`);
  await mkdir(path, { recursive: true });
  return path;
}

describe("local validation profiles", () => {
  it("allows auto, none, and pnpm-test profiles only", () => {
    expect(isAllowedLocalValidation("auto")).toBe(true);
    expect(isAllowedLocalValidation("none")).toBe(true);
    expect(isAllowedLocalValidation("pnpm-test")).toBe(true);
    expect(isAllowedLocalValidation("pytest")).toBe(false);
  });

  it("resolves none to explicit no-validation", async () => {
    const resolved = await resolveLocalValidation("none", await workspace());

    expect(resolved.command).toBeNull();
    expect(resolved.summary).toBe("validation disabled");
  });

  it("keeps pnpm-test as an explicit command template", async () => {
    const resolved = await resolveLocalValidation("pnpm-test", await workspace());

    expect(resolved.command).toEqual({ id: "test", executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 30000 });
    expect(resolved.summary).toBe("pnpm test");
  });

  it("auto-detects pnpm, npm, python, rust, and go validation commands", async () => {
    const pnpm = await workspace();
    await writeFile(join(pnpm, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }));
    await writeFile(join(pnpm, "pnpm-lock.yaml"), "");
    await expect(resolveLocalValidation("auto", pnpm)).resolves.toMatchObject({ command: { executable: "pnpm", args: ["test"] } });

    const npm = await workspace();
    await writeFile(join(npm, "package.json"), JSON.stringify({ scripts: { test: "node test.js" } }));
    await writeFile(join(npm, "package-lock.json"), "{}");
    await expect(resolveLocalValidation("auto", npm)).resolves.toMatchObject({ command: { executable: "npm", args: ["test"] } });

    const python = await workspace();
    await writeFile(join(python, "pyproject.toml"), "[tool.pytest.ini_options]\n");
    await expect(resolveLocalValidation("auto", python)).resolves.toMatchObject({ command: { executable: "python", args: ["-m", "pytest"] } });

    const rust = await workspace();
    await writeFile(join(rust, "Cargo.toml"), "[package]\nname='demo'\n");
    await expect(resolveLocalValidation("auto", rust)).resolves.toMatchObject({ command: { executable: "cargo", args: ["test"] } });

    const go = await workspace();
    await writeFile(join(go, "go.mod"), "module demo\n");
    await expect(resolveLocalValidation("auto", go)).resolves.toMatchObject({ command: { executable: "go", args: ["test", "./..."] } });
  });

  it("auto falls back to explicit no-validation when no project-native check is detected", async () => {
    const resolved = await resolveLocalValidation("auto", await workspace());

    expect(resolved.command).toBeNull();
    expect(resolved.summary).toBe("no validation command detected");
    expect(resolved.diagnostics.join(" ")).toContain("validation disabled");
  });
});
