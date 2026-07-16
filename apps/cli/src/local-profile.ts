import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export interface LocalProfile {
  workspacePath: string;
  baseUrl: string;
  model: string;
}

export interface LocalProfileStore {
  load(): Promise<LocalProfile | null>;
  save(profile: LocalProfile): Promise<void>;
}

export function createFileLocalProfileStore(path = join(homedir(), ".gcah", "local-profile.json")): LocalProfileStore {
  return {
    async load() {
      try {
        const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
        if (!isLocalProfile(parsed)) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    async save(profile) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
    }
  };
}

function isLocalProfile(value: unknown): value is LocalProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.workspacePath === "string"
    && typeof record.baseUrl === "string"
    && typeof record.model === "string";
}
