import type { ToolRequest, ValidationResult } from "@gcah/shared";

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

  async validate(request: ToolRequest): Promise<ValidationOutcome> {
    if (!MUTATION_TOOLS.has(request.tool)) {
      return { required: false, readyToComplete: true, results: [] };
    }
    const results = (await this.runner.runRequired()).map((result) => {
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
      readyToComplete: results.length > 0 && results.every((result) => result.result === "PASS" || result.result === "SKIPPED"),
      results
    };
  }
}
