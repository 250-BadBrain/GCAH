import type { CredentialStore } from "@gcah/credentials";

import { fail, ok, type CliResult } from "./output.js";

export interface EmbeddedLocalSessionOptions {
  workspacePath: string;
  baseUrl: string;
  model: string;
  task: string;
  dataDir?: string;
}

export interface InjectableApp {
  inject(request: { method: "GET" | "POST"; url: string; payload?: unknown }): Promise<{ statusCode: number; json(): unknown }>;
  close(): Promise<void>;
}

export interface EmbeddedLocalSessionDeps {
  credentialStore: CredentialStore;
  createApp(input: {
    dataDir: string;
    credentialStore: CredentialStore;
    baseUrl: string;
    model: string;
    allowedWorkspaceRoots: string[];
  }): Promise<InjectableApp>;
}

export async function runEmbeddedLocalSession(options: EmbeddedLocalSessionOptions, deps: EmbeddedLocalSessionDeps): Promise<CliResult> {
  const app = await deps.createApp({
    dataDir: options.dataDir ?? ".gcah",
    credentialStore: deps.credentialStore,
    baseUrl: options.baseUrl,
    model: options.model,
    allowedWorkspaceRoots: [options.workspacePath]
  });
  try {
    const workspace = await app.inject({ method: "POST", url: "/api/workspaces", payload: { path: options.workspacePath } });
    if (workspace.statusCode >= 300) return fail("local workspace registration failed\n");
    const submitted = await app.inject({ method: "POST", url: "/api/runs", payload: { workspacePath: options.workspacePath, task: options.task } });
    if (submitted.statusCode >= 300) return fail("local run submit failed\n");
    const run = parseRun(submitted.json());
    if (run === null) return fail("local run submit failed\n");
    const events = await app.inject({ method: "GET", url: `/api/runs/${run.id}/events?cursor=0` });
    if (events.statusCode >= 300) return fail("local event fetch failed\n");
    return ok(renderLocalRun(run, events.json()));
  } finally {
    await app.close();
  }
}

function renderLocalRun(run: { id: string; status: string }, eventsBody: unknown): string {
  const events = parseEvents(eventsBody);
  const lines = [`Run ${run.id} ${run.status}`];
  for (const event of events) lines.push(`[${event.type}] ${event.summary}`);
  return `${lines.join("\n")}\n`;
}

function parseRun(value: unknown): { id: string; status: string } | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.status !== "string") return null;
  return { id: value.id, status: value.status };
}

function parseEvents(value: unknown): Array<{ type: string; summary: string }> {
  if (!isRecord(value) || !Array.isArray(value.events)) return [];
  return value.events.flatMap((event) =>
    isRecord(event) && typeof event.type === "string" && typeof event.summary === "string"
      ? [{ type: event.type, summary: event.summary }]
      : []
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
