import type { CredentialStore } from "@gcah/credentials";

import { fail, ok, type CliResult } from "./output.js";

export type LocalApprovalDecision = "approve_once" | "approve_session" | "reject";

export interface EmbeddedLocalSessionOptions {
  workspacePath: string;
  baseUrl: string;
  model: string;
  task: string;
  dataDir?: string;
  validation?: string;
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
    validationCommand?: { id: string; executable: string; args: string[]; cwd: string; timeoutMs: number };
  }): Promise<InjectableApp>;
  decideApproval?(input: { runId: string; actionId: string; summary: string }): Promise<LocalApprovalDecision>;
}

export function createPromptApprovalDecider(
  promptLine: (label: string) => Promise<string>
): (input: { runId: string; actionId: string; summary: string }) => Promise<LocalApprovalDecision> {
  return async (input) => {
    const answer = (await promptLine(`Approval required for ${input.actionId}. approve once/session/reject? [o/s/r]`)).trim().toLowerCase();
    if (answer === "o" || answer === "once" || answer === "approve" || answer === "approve once") return "approve_once";
    if (answer === "s" || answer === "session" || answer === "approve session") return "approve_session";
    return "reject";
  };
}

export async function runEmbeddedLocalSession(options: EmbeddedLocalSessionOptions, deps: EmbeddedLocalSessionDeps): Promise<CliResult> {
  const command = validationCommand(options.validation);
  const app = await deps.createApp({
    dataDir: options.dataDir ?? ".gcah",
    credentialStore: deps.credentialStore,
    baseUrl: options.baseUrl,
    model: options.model,
    allowedWorkspaceRoots: [options.workspacePath],
    ...(command === undefined ? {} : { validationCommand: command })
  });
  try {
    const workspace = await app.inject({ method: "POST", url: "/api/workspaces", payload: { path: options.workspacePath } });
    if (workspace.statusCode >= 300) return fail("local workspace registration failed\n");
    const submitted = await app.inject({ method: "POST", url: "/api/runs", payload: { workspacePath: options.workspacePath, task: options.task } });
    if (submitted.statusCode >= 300) return fail("local run submit failed\n");
    const run = parseRun(submitted.json());
    if (run === null) return fail("local run submit failed\n");
    let events = await app.inject({ method: "GET", url: `/api/runs/${run.id}/events?cursor=0` });
    if (events.statusCode >= 300) return fail("local event fetch failed\n");
    const approval = findApproval(run.id, events.json());
    if (run.status === "WAITING_APPROVAL" && approval !== null && deps.decideApproval !== undefined) {
      const decision = await deps.decideApproval(approval);
      const approved = await app.inject({
        method: "POST",
        url: `/api/runs/${run.id}/approvals/${approval.actionId}`,
        payload: { decision, reason: "local interactive approval" }
      });
      if (approved.statusCode >= 300) return fail("local approval failed\n");
      const resumed = parseRun(approved.json()) ?? run;
      events = await app.inject({ method: "GET", url: `/api/runs/${run.id}/events?cursor=0` });
      if (events.statusCode >= 300) return fail("local event fetch failed\n");
      return ok(renderLocalRun(resumed, events.json()));
    }
    return ok(renderLocalRun(run, events.json()));
  } finally {
    await app.close();
  }
}

function renderLocalRun(run: { id: string; status: string; stopReason: string | null }, eventsBody: unknown): string {
  const events = parseEvents(eventsBody);
  const lines = [`Run ${run.id} ${run.status}${run.stopReason === null ? "" : ` stop=${run.stopReason}`}`];
  for (const event of events) lines.push(`[${event.type}] ${event.summary}`);
  return `${lines.join("\n")}\n`;
}

function parseRun(value: unknown): { id: string; status: string; stopReason: string | null } | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.status !== "string") return null;
  return { id: value.id, status: value.status, stopReason: typeof value.stopReason === "string" ? value.stopReason : null };
}

function parseEvents(value: unknown): Array<{ type: string; summary: string; relatedEntityId: string | null }> {
  if (!isRecord(value) || !Array.isArray(value.events)) return [];
  return value.events.flatMap((event) =>
    isRecord(event) && typeof event.type === "string" && typeof event.summary === "string"
      ? [{ type: event.type, summary: event.summary, relatedEntityId: typeof event.relatedEntityId === "string" ? event.relatedEntityId : null }]
      : []
  );
}

function findApproval(runId: string, value: unknown): { runId: string; actionId: string; summary: string } | null {
  const event = parseEvents(value).find((candidate) => candidate.type === "approval.required");
  if (event === undefined) return null;
  const actionId = event.relatedEntityId ?? event.summary.match(/action:[^\s]+/u)?.[0] ?? null;
  return actionId === null ? null : { runId, actionId, summary: event.summary };
}

function validationCommand(validation: string | undefined): { id: string; executable: string; args: string[]; cwd: string; timeoutMs: number } | undefined {
  if (validation === "pnpm-test") return { id: "test", executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 30000 };
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
