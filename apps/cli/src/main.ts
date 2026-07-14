import { createOsKeychainBackend, createCredentialStore, type CredentialStore } from "@gcah/credentials";
import { ConfigStatusDtoSchema, CredentialStatusDtoSchema, RunDtoSchema, RunEventsResponseSchema } from "@gcah/shared";

import { createFetchTransport, defaultTransport, type CliTransport } from "./client.js";
import { createHiddenInputPrompt } from "./hidden-input.js";
import { fail, ok, sanitizeOutput, type CliResult } from "./output.js";

export { createFetchTransport, createHiddenInputPrompt, sanitizeOutput, type CliResult };
export type { CliTransport };

export interface RunCliDependencies {
  transport?: CliTransport;
  credentialStore?: CredentialStore;
  promptSecret?: () => Promise<string>;
}

export async function runCli(args: readonly string[], deps: RunCliDependencies = {}): Promise<CliResult> {
  const transport = deps.transport ?? defaultTransport();
  const [group, command, ...rest] = args;
  try {
    if (group === "run") return runCommand(command, rest, transport);
    if (group === "approval") return approvalCommand(command, rest, transport);
    if (group === "config" && command === "status") return configStatus(transport);
    if (group === "credential") return credentialCommand(command, deps);
    if (group === "server" && command === "start") return ok("server start: use @gcah/server composition root\n");
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

async function runCommand(command: string | undefined, args: readonly string[], transport: CliTransport): Promise<CliResult> {
  if (command === "submit") {
    const workspace = option(args, "--workspace");
    const task = option(args, "--task");
    if (workspace === null || task === null) return fail("missing run submit options\n");
    const response = await transport({ method: "POST", url: "/api/runs", body: { workspacePath: workspace, task } });
    const parsed = RunDtoSchema.safeParse(response.body);
    if (response.status >= 300 || !parsed.success) return fail("run submit failed\n");
    return ok(`${parsed.data.id}\n`);
  }
  const id = args[0];
  if (id === undefined) return fail("missing run id\n");
  const route = command === "status"
    ? { method: "GET" as const, url: `/api/runs/${id}` }
    : command === "cancel"
      ? { method: "POST" as const, url: `/api/runs/${id}/cancel` }
      : command === "clone"
        ? { method: "POST" as const, url: `/api/runs/${id}/clone` }
        : null;
  if (route === null) return fail("unknown run command\n");
  const response = await transport(route);
  const parsed = RunDtoSchema.safeParse(response.body);
  if (response.status >= 300 || !parsed.success) return fail("run command failed\n");
  return ok(`${parsed.data.id} ${parsed.data.status}\n`);
}

async function approvalCommand(command: string | undefined, args: readonly string[], transport: CliTransport): Promise<CliResult> {
  if (command === "list") {
    const runId = args[0];
    if (runId === undefined) return fail("missing run id\n");
    const response = await transport({ method: "GET", url: `/api/runs/${runId}/events?cursor=0` });
    const parsed = RunEventsResponseSchema.safeParse(response.body);
    if (response.status >= 300 || !parsed.success) return fail("approval list failed\n");
    return ok(parsed.data.events.map((event) => `${event.id} ${event.type} ${event.summary}`).join("\n") + "\n");
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
  const parsed = ConfigStatusDtoSchema.safeParse(response.body);
  if (response.status >= 300 || !parsed.success) return fail("config status failed\n");
  return ok(`mode=${parsed.data.mode} llm=${parsed.data.llmProvider} publicDemo=${parsed.data.publicDemo}\n`);
}

async function credentialCommand(command: string | undefined, deps: RunCliDependencies): Promise<CliResult> {
  const store = deps.credentialStore ?? createCredentialStore({ backend: createOsKeychainBackend() });
  if (command === "status") {
    try {
      const status = await store.status("openai-compatible");
      const httpStatus = CredentialStatusDtoSchema.safeParse({
        backend: status.available ? "available" : status.reason === "backend-unavailable" ? "unavailable" : "available",
        providers: [{ provider: "openai-compatible", configured: status.available }]
      });
      void httpStatus;
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

function option(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  return value ?? null;
}
