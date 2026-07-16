import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createFileLocalProfileStore } from "../src/local-profile.js";

describe("local profile", () => {
  it("persists local agent defaults without credential material", async () => {
    const root = await mkdtemp(join(tmpdir(), "gcah-profile-"));
    const profilePath = join(root, "local-profile.json");
    const store = createFileLocalProfileStore(profilePath);

    await store.save({ workspacePath: "E:/project", baseUrl: "https://gateway.example/v1", model: "Qwen-Coder", validation: "pnpm-test" });

    await expect(store.load()).resolves.toEqual({ workspacePath: "E:/project", baseUrl: "https://gateway.example/v1", model: "Qwen-Coder", validation: "pnpm-test" });
    const raw = await readFile(profilePath, "utf8");
    expect(raw).not.toContain("sk-");
    expect(raw).not.toMatch(/api[_-]?key/iu);
  });
});
