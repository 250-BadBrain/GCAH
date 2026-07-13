import { RunCommandArgsSchema } from "@gcah/shared";

import type { ToolRegistry } from "../gateway/tool-registry.js";
import type { CommandRunner } from "../command/command-runner.js";
import { matchCommandTemplate, type CommandTemplate } from "../command/template.js";

export interface RegisterCommandToolsOptions {
  registry: ToolRegistry;
  runner: CommandRunner;
  templates: CommandTemplate[];
  publicDemo: boolean;
}

export function registerCommandTools(options: RegisterCommandToolsOptions): void {
  options.registry.register({
    tool: "run_command",
    async execute(request, context) {
      if (context?.authorized !== true) return { status: "ERROR", summary: "GATEWAY_AUTHORIZATION_REQUIRED" };
      if (options.publicDemo) return { status: "ERROR", summary: "PUBLIC_DEMO_DENIED" };
      const parsed = RunCommandArgsSchema.safeParse(request.args);
      if (!parsed.success) return { status: "ERROR", summary: "INVALID_COMMAND_ARGS" };
      const matched = matchCommandTemplate(parsed.data, options.templates);
      if (!matched.ok) return { status: "ERROR", summary: matched.reason };
      return options.runner.run(parsed.data);
    }
  });
}
