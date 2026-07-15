import type { ValidationRunner } from "@gcah/core";
import type { ConfigSnapshot, ValidationResult } from "@gcah/shared";

export interface DemoValidationPreset {
  result: ValidationResult["result"];
  diagnosticSummary: string | null;
}

export class DemoValidationRunner implements ValidationRunner {
  constructor(private readonly presets: Partial<Record<string, DemoValidationPreset>> = {}) {}

  async runValidator(validatorId: string, configSnapshot: ConfigSnapshot): Promise<ValidationResult> {
    void configSnapshot;
    const preset = this.presets[validatorId] ?? {
      result: "PASS" as const,
      diagnosticSummary: "public demo preset passed"
    };
    return {
      id: `demo-validation:${validatorId}`,
      actionId: "demo-action",
      type: validatorId === "test" || validatorId === "lint" || validatorId === "typecheck" || validatorId === "build" ? validatorId : "custom",
      commandSnapshot: `demo:${validatorId}`,
      result: preset.result,
      failureCategory: preset.result === "PASS" ? null : "demo_preset",
      failureFingerprint: preset.result === "PASS" ? null : preset.diagnosticSummary,
      diagnosticSummary: preset.diagnosticSummary,
      durationMs: 0,
      createdAt: new Date(0).toISOString()
    };
  }
}
