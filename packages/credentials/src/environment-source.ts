import type { CredentialProvider } from "./store.js";

export type SecretSourceValues = Partial<Record<"OPENAI_COMPATIBLE_API_KEY" | "GCAH_ADMIN_TOKEN", string>>;

export interface PlaintextSource {
  enabled: boolean;
  values: SecretSourceValues;
}

const variableByProvider: Record<CredentialProvider, keyof SecretSourceValues> = {
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
  "admin-token": "GCAH_ADMIN_TOKEN"
};

export function readPlaintextSource(source: PlaintextSource, provider: CredentialProvider): string | null {
  if (!source.enabled) return null;
  const value = source.values[variableByProvider[provider]];
  return value === undefined || value.length === 0 ? null : value;
}
