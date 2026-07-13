import { createHash } from "node:crypto";

import type { SupportedToolName } from "@gcah/shared";

import type { NormalizedAction } from "../decision.js";

export interface HashableAction {
  tool: NormalizedAction["tool"];
  args: NormalizedAction["args"];
  normalizedSummary: string;
}

export interface ScopeHashInput {
  tool: SupportedToolName;
  pathScope: string | null;
  commandTemplate: string | null;
  riskCategory: string;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)])
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function normalizeActionForHash(action: NormalizedAction): HashableAction {
  return {
    tool: action.tool,
    args: action.args,
    normalizedSummary: action.normalizedSummary
  };
}

export function normalizedActionHash(action: NormalizedAction): string {
  return sha256(normalizeActionForHash(action));
}

export function scopeHash(input: ScopeHashInput): string {
  return sha256(input);
}
