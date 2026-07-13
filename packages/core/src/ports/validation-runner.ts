import type { ValidationResult } from "@gcah/shared";

export interface ValidationRunner {
  runRequired(): Promise<ValidationResult[]>;
}
