import type { WorkspaceFencePort } from "../ports/workspace-fence.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { ConfigSchema, type GcahConfig } from "./schema.js";

export interface LoadConfigInput {
  workspaceRoot: string;
  cliOverrides: Record<string, unknown>;
  environmentMetadata: Record<string, unknown>;
  workspaceFence: WorkspaceFencePort;
  projectConfigText?: string;
}

function parseScalar(value: string): unknown {
  if (/^\d+$/u.test(value)) return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  const list = value.match(/^\[(.*)\]$/u);
  if (list !== null) return (list[1] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  return value;
}

function parseProjectYaml(text: string): Record<string, unknown> {
  if (/apiKey|secret|token/iu.test(text)) throw new Error("secret fields are not allowed in config");
  const output: Record<string, unknown> = {};
  let section: string | null = null;
  for (const rawLine of text.split(/\r?\n/u)) {
    if (rawLine.trim().length === 0) continue;
    const top = rawLine.match(/^([A-Za-z][A-Za-z0-9_]*):(?:\s*(.*))?$/u);
    if (top !== null) {
      const key = top[1];
      if (key === undefined) throw new Error("invalid config key");
      const value = top[2];
      section = key;
      output[key] = value === undefined || value === "" ? {} : parseScalar(value);
      continue;
    }
    const child = rawLine.match(/^\s{2}([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/u);
    if (child !== null && section !== null) {
      const key = child[1];
      const value = child[2] ?? "";
      if (key === undefined) throw new Error("invalid config key");
      const container = output[section];
      if (container === null || typeof container !== "object" || Array.isArray(container)) throw new Error(`invalid section ${section}`);
      (container as Record<string, unknown>)[key] = parseScalar(value);
      continue;
    }
    throw new Error(`unknown config syntax: ${rawLine}`);
  }
  return output;
}

function mergeConfig(base: GcahConfig, ...overrides: Array<Record<string, unknown>>): Record<string, unknown> {
  const merged: Record<string, unknown> = structuredClone(base);
  for (const override of overrides) {
    for (const [key, value] of Object.entries(override)) {
      if (value !== null && typeof value === "object" && !Array.isArray(value) && typeof merged[key] === "object" && merged[key] !== null && !Array.isArray(merged[key])) {
        merged[key] = { ...(merged[key] as Record<string, unknown>), ...value };
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

export async function loadConfig(input: LoadConfigInput): Promise<GcahConfig> {
  const workspace = await input.workspaceFence.validateWorkspace();
  if (!workspace.ok) throw new Error(`workspace rejected: ${workspace.message}`);

  const project = input.projectConfigText === undefined ? {} : parseProjectYaml(input.projectConfigText);

  const config = ConfigSchema.parse(mergeConfig(DEFAULT_CONFIG, project, input.cliOverrides, {
    llm: { provider: typeof input.environmentMetadata.llmProvider === "string" ? input.environmentMetadata.llmProvider : DEFAULT_CONFIG.llm.provider },
    allowedWorkspaceRoots: [input.workspaceRoot]
  }));

  for (const validator of config.validation.required) {
    if (!(validator in config.commands)) throw new Error(`missing validation command for ${validator}`);
  }
  return config;
}
