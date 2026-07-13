import type { ConfigSnapshot, ValidationResult } from "@gcah/shared";
import type { ValidationRunner } from "@gcah/core";

import type { CommandRunner } from "../command/command-runner.js";
import type { CommandTemplate } from "../command/template.js";

export class CommandValidationRunner implements ValidationRunner {
  constructor(
    private readonly runner: CommandRunner,
    private readonly validators: Partial<Record<string, Omit<CommandTemplate, "id">>>
  ) {}

  async runValidator(validatorId: string, configSnapshot: ConfigSnapshot): Promise<ValidationResult> {
    const command = commandForValidator(validatorId, configSnapshot) ?? this.validators[validatorId];
    if (command === undefined) {
      return validationResult(validatorId, null, {
        status: "ERROR",
        summary: `No configured validator command for ${validatorId}`
      }, 0);
    }
    const started = Date.now();
    const result = await this.runner.run(command);
    return validationResult(validatorId, command, result, Math.max(0, Date.now() - started));
  }
}

function commandForValidator(validatorId: string, configSnapshot: ConfigSnapshot): Omit<CommandTemplate, "id"> | undefined {
  const config = configSnapshot.nonSensitiveConfig as { commands?: Record<string, unknown> };
  const value = config.commands?.[validatorId];
  if (typeof value === "string") return parseCommandString(value);
  if (value !== null && typeof value === "object") {
    const candidate = value as Partial<Omit<CommandTemplate, "id">>;
    if (typeof candidate.executable === "string" && Array.isArray(candidate.args) && candidate.args.every((arg) => typeof arg === "string")) {
      return {
        executable: candidate.executable,
        args: candidate.args,
        cwd: typeof candidate.cwd === "string" ? candidate.cwd : ".",
        timeoutMs: typeof candidate.timeoutMs === "number" ? candidate.timeoutMs : 60000
      };
    }
  }
  return undefined;
}

function parseCommandString(value: string): Omit<CommandTemplate, "id"> | undefined {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  const [executable, ...args] = parts;
  if (executable === undefined) return undefined;
  return { executable, args, cwd: ".", timeoutMs: 60000 };
}

function validationResult(
  validatorId: string,
  command: Omit<CommandTemplate, "id"> | null,
  result: { status: "OK" | "ERROR"; summary: string },
  durationMs: number
): ValidationResult {
  return {
    id: `validation:${validatorId}`,
    actionId: "action-pending",
    type: validatorId === "test" || validatorId === "lint" || validatorId === "typecheck" || validatorId === "build" ? validatorId : "custom",
    commandSnapshot: command === null ? validatorId : `${command.executable} ${command.args.join(" ")}`.trim(),
    result: result.status === "OK" ? "PASS" : "FAIL",
    failureCategory: result.status === "OK" ? null : "command_failed",
    failureFingerprint: result.status === "OK" ? null : result.summary,
    diagnosticSummary: result.summary,
    durationMs,
    createdAt: new Date(0).toISOString()
  };
}
