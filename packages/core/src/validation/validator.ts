import type { ConfigSnapshot, ToolRequest, ValidationResult } from "@gcah/shared";

import type { ValidationRunner } from "../ports/validation-runner.js";
import { classifyFailure } from "./classifier.js";
import { fingerprintFailure } from "./fingerprint.js";

const MUTATION_TOOLS = new Set<ToolRequest["tool"]>(["write", "patch", "delete", "run_command"]);

export interface ValidationOutcome {
  required: boolean;
  readyToComplete: boolean;
  results: ValidationResult[];
}

export class ValidationService {
  constructor(private readonly runner: ValidationRunner) {}

  async validate(request: ToolRequest, configSnapshot: ConfigSnapshot): Promise<ValidationOutcome> {
    if (!MUTATION_TOOLS.has(request.tool)) {
      return { required: false, readyToComplete: true, results: [] };
    }
    const requiredValidators = readRequiredValidators(configSnapshot);
    const results = (await Promise.all(requiredValidators.map((validatorId) => this.runner.runValidator(validatorId, configSnapshot)))).map((result) => {
      if (result.result === "PASS" || result.result === "SKIPPED") return result;
      const diagnostic = result.diagnosticSummary ?? result.failureCategory ?? result.result;
      return {
        ...result,
        failureCategory: classifyFailure(diagnostic).category,
        failureFingerprint: fingerprintFailure(diagnostic)
      };
    });
    return {
      required: true,
      readyToComplete: results.every((result) => result.result === "PASS" || result.result === "SKIPPED"),
      results
    };
  }
}

function readRequiredValidators(configSnapshot: ConfigSnapshot): string[] {
  const config = configSnapshot.nonSensitiveConfig as { validation?: { required?: unknown } };
  const required = config.validation?.required;
  return Array.isArray(required) ? required.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
}
