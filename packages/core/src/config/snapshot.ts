import type { ConfigSnapshot } from "@gcah/shared";

import type { GcahConfig } from "./schema.js";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}

function stableHex(input: string): string {
  let hash = 0x811c9dc5;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  const chunk = (value: number): string => (value >>> 0).toString(16).padStart(8, "0");
  return Array.from({ length: 8 }, (_, index) => chunk(Math.imul(hash ^ index, 0x9e3779b1))).join("");
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createConfigSnapshot(config: GcahConfig): ConfigSnapshot {
  const canonical = JSON.stringify(sortValue(config));
  return deepFreeze({
    id: `config:${stableHex(canonical).slice(0, 16)}`,
    schemaVersion: 1,
    allowedWorkspaceRoots: [...config.allowedWorkspaceRoots],
    nonSensitiveConfig: structuredClone(config),
    contentHash: stableHex(canonical),
    createdAt: new Date(0).toISOString()
  });
}
