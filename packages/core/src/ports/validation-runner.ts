import type { ConfigSnapshot, ValidationResult } from "@gcah/shared";

export interface ValidationRunner {
  runValidator(validatorId: string, configSnapshot: ConfigSnapshot): Promise<ValidationResult>;
}
