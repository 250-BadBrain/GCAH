import { describe, expect, it } from "vitest";

import { DemoExecutor } from "../src/executor/demo-executor.js";

describe("DemoExecutor", () => {
  it("returns preset outcomes and rejects shell, install, and network tools without spawning", async () => {
    const executor = new DemoExecutor({
      "read:{}": { status: "OK", summary: "preset read" }
    });

    await expect(executor.execute({ tool: "read", args: {} })).resolves.toEqual({ status: "OK", summary: "preset read" });
    for (const request of [
      { tool: "run_command" as const, args: { command: "pnpm install" } },
      { tool: "run_validation" as const, args: { validator: "test" } },
      { tool: "memory_search" as const, args: { query: "https://example.com" } }
    ]) {
      await expect(executor.execute(request)).resolves.toEqual({ status: "ERROR", summary: "public demo capability denied" });
    }
  });
});
