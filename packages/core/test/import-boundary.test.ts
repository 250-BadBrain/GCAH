import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const forbiddenImports = [
  "@gcah/tools",
  "@gcah/persistence",
  "@gcah/credentials",
  "@gcah/llm",
  "apps/server",
  "apps/worker"
] as const;

describe("core import boundary", () => {
  it("keeps AgentLoop and loop helpers independent from adapter packages", async () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const files = [
      "agent-loop.ts",
      "completion-gate.ts",
      "context-builder.ts"
    ];
    for (const file of files) {
      const text = await readFile(join(root, "..", "src", "loop", file), "utf8");
      for (const forbidden of forbiddenImports) {
        expect(text, `${file} must not import ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
