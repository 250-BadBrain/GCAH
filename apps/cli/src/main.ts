import type { CredentialStore } from "@gcah/credentials";

import { createFetchTransport, defaultTransport, type CliTransport } from "./client.js";
import { createHiddenInputPrompt, createRawModeLineReader } from "./hidden-input.js";
import { createFileLocalProfileStore, type LocalProfile, type LocalProfileStore } from "./local-profile.js";
import { runEmbeddedLocalSession } from "./local-session.js";
import { fail, ok, sanitizeOutput, type CliResult } from "./output.js";

export { createFetchTransport, createHiddenInputPrompt, createRawModeLineReader, sanitizeOutput, type CliResult };
export type { CliTransport };

export interface RunCliDependencies {
  transport?: CliTransport;
  credentialStore?: CredentialStore;
  promptSecret?: () => Promise<string>;
  promptLine?: (label: string) => Promise<string>;
  localProfileStore?: LocalProfileStore;
  runLocalSession?: (options: LocalSessionOptions) => Promise<CliResult>;
}

export interface LocalSessionOptions {
  workspacePath: string;
  baseUrl: string;
  model: string;
  task?: string;
}

export async function runCli(args: readonly string[], deps: RunCliDependencies = {}): Promise<CliResult> {
  const transport = deps.transport ?? defaultTransport();
  const [group, command, ...rest] = args;
  try {
    if (group === "run") return runCommand(command, rest, transport);
    if (group === "workspace") return workspaceCommand(command, rest, transport);
    if (group === "approval") return approvalCommand(command, rest, transport);
    if (group === "config" && command === "status") return configStatus(transport);
    if (group === "credential") return credentialCommand(command, { ...deps, args: rest });
    if (group === "server" && command === "start") return serverStart(rest, deps);
    if (group === "local") return localCommand([command, ...rest].filter((value): value is string => value !== undefined), deps);
    return fail("unknown command\n");
  } catch {
    return fail("command failed\n");
  }
}

export async function runMain(args: readonly string[], deps: RunCliDependencies = {}): Promise<CliResult> {
  const result = await runCli(args, {
    promptSecret: createHiddenInputPrompt(),
    ...deps
  });
  return result;
}

async function localCommand(args: readonly string[], deps: RunCliDependencies): Promise<CliResult> {
  const profileStore = deps.localProfileStore ?? createFileLocalProfileStore();
  const profile = await profileStore.load();
  const prompt = deps.promptLine ?? defaultPromptLine;
  const workspacePath = option(args, "--workspace") ?? profile?.workspacePath ?? await prompt("Workspace");
  const baseUrl = option(args, "--base-url") ?? profile?.baseUrl ?? await prompt("Base URL");
  const model = option(args, "--model") ?? profile?.model ?? await prompt("Model");
  const task = option(args, "--task") ?? await prompt("Task");
  if (workspacePath === "" || baseUrl === "" || model === "") return fail("missing local options\n");
  await profileStore.save({ workspacePath, baseUrl, model });
  if (deps.runLocalSession !== undefined) return deps.runLocalSession({ workspacePath, baseUrl, model, task });
  return defaultLocalSession({ workspacePath, baseUrl, model, task }, deps);
}

async function defaultLocalSession(options: LocalSessionOptions, deps?: RunCliDependencies): Promise<CliResult> {
  if (options.task === undefined || options.task === "") return fail("missing local task\n");
  const store = deps?.credentialStore ?? await createDefaultCredentialStore();
  const { createLocalProductionApp } = await import("@gcah/server");
  return runEmbeddedLocalSession({ ...options, task: options.task }, {
    credentialStore: store,
    createApp: async (input) => createLocalProductionApp(input)
  });
}

const nullLocalProfileStore: LocalProfileStore = {
  async load() {
    return null;
  },
  async save() {}
};

async function defaultPromptLine(): Promise<string> {
  return "";
}

async function runCommand(command: string | undefined, args: readonly string[], transport: CliTransport): Promise<CliResult> {
  if (command === "submit") {
    const workspace = option(args, "--workspace");
    const task = option(args, "--task");
    if (workspace === null || task === null) return fail("missing run submit options\n");
    const response = await transport({ method: "POST", url: "/api/runs", body: { workspacePath: workspace, task } });
    const parsed = parseRunDto(response.body);
    if (response.status >= 300 || parsed === null) return fail("run submit failed\n");
    return ok(`${parsed.id}\n`);
  }
  const id = args[0];
  if (id === undefined) return fail("missing run id\n");
  const route = command === "status"
    ? { method: "GET" as const, url: `/api/runs/${id}` }
    : command === "events"
      ? { method: "GET" as const, url: `/api/runs/${id}/events?cursor=0` }
    : command === "cancel"
      ? { method: "POST" as const, url: `/api/runs/${id}/cancel` }
      : command === "clone"
        ? { method: "POST" as const, url: `/api/runs/${id}/clone` }
        : null;
  if (route === null) return fail("unknown run command\n");
  const response = await transport(route);
  if (command === "events") {
    const parsed = parseRunEventsResponse(response.body);
    if (response.status >= 300 || parsed === null) return fail("run command failed\n");
    return ok(parsed.events.map((event) => `${event.id} ${event.type} ${event.summary}`).join("\n") + "\n");
  }
  const parsed = parseRunDto(response.body);
  if (response.status >= 300 || parsed === null) return fail("run command failed\n");
  return ok(`${parsed.id} ${parsed.status}\n`);
}

async function workspaceCommand(command: string | undefined, args: readonly string[], transport: CliTransport): Promise<CliResult> {
  if (command !== "add") return fail("unknown workspace command\n");
  const path = option(args, "--path");
  if (path === null) return fail("missing workspace path\n");
  const response = await transport({ method: "POST", url: "/api/workspaces", body: { path } });
  if (response.status >= 300 || !isRecord(response.body) || typeof response.body.path !== "string") return fail("workspace add failed\n");
  return ok(`${response.body.path}\n`);
}

async function approvalCommand(command: string | undefined, args: readonly string[], transport: CliTransport): Promise<CliResult> {
  if (command === "list") {
    const runId = args[0];
    if (runId === undefined) return fail("missing run id\n");
    const response = await transport({ method: "GET", url: `/api/runs/${runId}/events?cursor=0` });
    const parsed = parseRunEventsResponse(response.body);
    if (response.status >= 300 || parsed === null) return fail("approval list failed\n");
    return ok(parsed.events.map((event) => `${event.id} ${event.type} ${event.summary}`).join("\n") + "\n");
  }
  const runId = args[0];
  const actionId = args[1];
  const reason = option(args, "--reason");
  if (runId === undefined || actionId === undefined || reason === null) return fail("missing approval options\n");
  const decision = command === "approve-once" ? "approve_once" : command === "approve-session" ? "approve_session" : command === "reject" ? "reject" : null;
  if (decision === null) return fail("unknown approval command\n");
  const response = await transport({ method: "POST", url: `/api/runs/${runId}/approvals/${actionId}`, body: { decision, reason } });
  if (response.status >= 300) return fail("approval command failed\n");
  return ok("recorded\n");
}

async function configStatus(transport: CliTransport): Promise<CliResult> {
  const response = await transport({ method: "GET", url: "/api/config/status" });
  const parsed = parseConfigStatusDto(response.body);
  if (response.status >= 300 || parsed === null) return fail("config status failed\n");
  return ok(`mode=${parsed.mode} llm=${parsed.llmProvider} publicDemo=${parsed.publicDemo}\n`);
}

async function credentialCommand(command: string | undefined, deps: RunCliDependencies & { args?: readonly string[] }): Promise<CliResult> {
  const provider = option(deps.args ?? [], "--provider") ?? "openai-compatible";
  if (provider !== "openai-compatible") return fail("unsupported credential provider\n", 2);
  const store = deps.credentialStore ?? await createDefaultCredentialStore();
  if (command === "status") {
    try {
      const status = await store.status("openai-compatible");
      if (!status.available && status.reason === "backend-unavailable") return fail("credential backend unavailable\n", 2);
      if (!status.available) return ok("openai-compatible missing\n");
      return ok(`openai-compatible configured backend=${status.backend}\n`);
    } catch {
      return fail("credential backend unavailable\n", 2);
    }
  }
  if (command === "set" || command === "update") {
    const prompt = deps.promptSecret ?? createHiddenInputPrompt();
    const secret = await prompt();
    if (command === "set") {
      await store.set("openai-compatible", secret);
      return ok("credential stored\n");
    }
    await store.update("openai-compatible", secret);
    return ok("credential updated\n");
  }
  if (command === "clear") {
    await store.clear("openai-compatible");
    return ok("credential cleared\n");
  }
  return fail(".env plaintext source requires explicit enablement\n", 2);
}

async function serverStart(args: readonly string[], deps: RunCliDependencies): Promise<CliResult> {
  const mode = option(args, "--mode") ?? "local";
  const llm = option(args, "--llm");
  const baseUrl = option(args, "--base-url");
  const model = option(args, "--model");
  const dataDir = option(args, "--data-dir") ?? ".gcah";
  const port = Number(option(args, "--port") ?? "8787");
  if (mode !== "local" || llm !== "openai-compatible" || baseUrl === null || model === null || !Number.isInteger(port)) {
    return fail("missing server start options\n");
  }
  const store = deps.credentialStore ?? await createDefaultCredentialStore();
  const { createLocalProductionApp } = await import("@gcah/server");
  const app = await createLocalProductionApp({
    dataDir,
    credentialStore: store,
    baseUrl,
    model,
    allowedWorkspaceRoots: [process.cwd()]
  });
  await app.listen({ host: "127.0.0.1", port });
  return ok(`server listening http://127.0.0.1:${port}\n`);
}

async function createDefaultCredentialStore(): Promise<CredentialStore> {
  const { createCredentialStore, createOsKeychainBackend } = await import("@gcah/credentials");
  return createCredentialStore({ backend: createOsKeychainBackend() });
}

interface RunDto {
  id: string;
  status: string;
}

interface RunEventsResponse {
  events: Array<{ id: string; type: string; summary: string }>;
}

interface ConfigStatusDto {
  mode: string;
  llmProvider: string;
  publicDemo: boolean;
}

function parseRunDto(value: unknown): RunDto | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.status !== "string") return null;
  return { id: value.id, status: value.status };
}

function parseRunEventsResponse(value: unknown): RunEventsResponse | null {
  if (!isRecord(value) || !Array.isArray(value.events)) return null;
  const events = value.events.map((event) => {
    if (!isRecord(event) || typeof event.id !== "string" || typeof event.type !== "string" || typeof event.summary !== "string") return null;
    return { id: event.id, type: event.type, summary: event.summary };
  });
  if (events.some((event) => event === null)) return null;
  return { events: events as RunEventsResponse["events"] };
}

function parseConfigStatusDto(value: unknown): ConfigStatusDto | null {
  if (!isRecord(value) || typeof value.mode !== "string" || typeof value.llmProvider !== "string" || typeof value.publicDemo !== "boolean") return null;
  return { mode: value.mode, llmProvider: value.llmProvider, publicDemo: value.publicDemo };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function option(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  return value ?? null;
}
