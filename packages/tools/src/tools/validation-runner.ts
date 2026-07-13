import type { ValidationResult } from "@gcah/shared";
import type { ValidationRunner } from "@gcah/core";

import type { CommandRunner } from "../command/command-runner.js";
import type { CommandTemplate } from "../command/template.js";

export class CommandValidationRunner implements ValidationRunner {
  constructor(
    private readonly runner: CommandRunner,
    private readonly validators: Partial<Record<string, Omit<CommandTemplate, "id">>>
  ) {}

  async runRequired(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    for (const [kind, command] of Object.entries(this.validators)) {
      if (command === undefined) continue;
      const started = Date.now();
      const result = await this.runner.run(command);
      results.push({
        id: `validation:${kind}`,
        actionId: "action-pending",
        type: kind === "test" || kind === "lint" || kind === "typecheck" || kind === "build" ? kind : "custom",
        commandSnapshot: `${command.executable} ${command.args.join(" ")}`,
        result: result.status === "OK" ? "PASS" : "FAIL",
        failureCategory: result.status === "OK" ? null : "command_failed",
        failureFingerprint: result.status === "OK" ? null : result.summary,
        diagnosticSummary: result.summary,
        durationMs: Math.max(0, Date.now() - started),
        createdAt: new Date(0).toISOString()
      });
    }
    return results;
  }
}
