import { describe, expect, it } from "vitest";

import { CommandRunner, registerCommandTools } from "../src/index.js";

describe("run_command tool", () => {
  it("dispatches configured commands with shell false", async () => {
    const runner = new CommandRunner(async (request) => ({
      status: "OK",
      summary: `${request.executable} ${request.args.join(" ")} shell:${String(request.shell)}`
    }));
    registerCommandTools({
      registry: runner.registry,
      runner,
      templates: [{ id: "test", executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }],
      publicDemo: false
    });

    await expect(runner.execute({
      tool: "run_command",
      args: { executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }
    })).resolves.toEqual({
      status: "OK",
      summary: "pnpm test shell:false"
    });
  });

  it("rejects undeclared commands and public demo execution", async () => {
    const runner = new CommandRunner(async () => ({ status: "OK", summary: "bad" }));
    registerCommandTools({ registry: runner.registry, runner, templates: [], publicDemo: true });
    await expect(runner.execute({
      tool: "run_command",
      args: { executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 1000 }
    })).resolves.toMatchObject({ status: "ERROR" });
  });
});
