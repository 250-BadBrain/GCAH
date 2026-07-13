import { describe, expect, it } from "vitest";

import { CommandRunner, registerValidationTool } from "../src/index.js";

describe("run_validation tool", () => {
  it("routes validator IDs to configured commands without accepting executable overrides", async () => {
    const runner = new CommandRunner(async (request) => ({ status: "OK", summary: request.executable }));
    registerValidationTool({
      registry: runner.registry,
      runner,
      validators: {
        test: { executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }
      }
    });

    await expect(runner.execute({ tool: "run_validation", args: { kind: "test" } })).resolves.toEqual({
      status: "OK",
      summary: "pnpm"
    });
    await expect(runner.execute({ tool: "run_validation", args: { kind: "custom", executable: "rm" } })).resolves.toMatchObject({
      status: "ERROR"
    });
  });
});
