import { RunValidationArgsSchema } from "@gcah/shared";

import type { ToolRegistry } from "../gateway/tool-registry.js";
import type { CommandRunner } from "../command/command-runner.js";
import type { CommandTemplate } from "../command/template.js";

export interface RegisterValidationToolOptions {
  registry: ToolRegistry;
  runner: CommandRunner;
  validators: Partial<Record<string, Omit<CommandTemplate, "id">>>;
}

export function registerValidationTool(options: RegisterValidationToolOptions): void {
  options.registry.register({
    tool: "run_validation",
    async execute(request) {
      const parsed = RunValidationArgsSchema.safeParse(request.args);
      if (!parsed.success) return { status: "ERROR", summary: "INVALID_VALIDATION_ARGS" };
      const command = options.validators[parsed.data.kind];
      if (command === undefined) return { status: "ERROR", summary: "UNKNOWN_VALIDATOR" };
      return options.runner.run(command);
    }
  });
}
