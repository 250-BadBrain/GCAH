import type { CredentialStore } from "@gcah/credentials";

import type { InjectableApp, LocalApprovalDecision } from "./local-session.js";
import { ok, type CliResult } from "./output.js";

export interface LocalReplOptions {
  workspacePath: string;
  baseUrl: string;
  model: string;
  validation?: string;
  dataDir?: string;
}

export interface LocalReplProfileStore {
  save(profile: { workspacePath: string; baseUrl: string; model: string; validation?: string }): Promise<void>;
}

export interface LocalReplDeps {
  credentialStore: CredentialStore;
  createApp(input: {
    dataDir: string;
    credentialStore: CredentialStore;
    baseUrl: string;
    model: string;
    allowedWorkspaceRoots: string[];
    validationCommand?: { id: string; executable: string; args: string[]; cwd: string; timeoutMs: number };
  }): Promise<InjectableApp>;
  promptLine(label: string): Promise<string>;
  promptSecret?: () => Promise<string>;
  writeLine?(line: string): void;
  profileStore?: LocalReplProfileStore;
}

interface ReplState {
  workspacePath: string;
  baseUrl: string;
  model: string;
  validation: string | undefined;
  currentRunId: string | null;
}

interface ReplRuntime {
  app: InjectableApp;
}

export async function runLocalRepl(options: LocalReplOptions, deps: LocalReplDeps): Promise<CliResult> {
  const state: ReplState = {
    workspacePath: options.workspacePath,
    baseUrl: options.baseUrl,
    model: options.model,
    validation: options.validation,
    currentRunId: null
  };
  const runtime: ReplRuntime = { app: await createWorkspaceApp(options, deps, state) };
  const lines: string[] = [];
  const emit = (line: string): void => {
    lines.push(line);
    deps.writeLine?.(line);
  };
  emit("GCAH local interactive session");
  emit("Type /help for commands. Type /exit to quit.");
  try {
    emit(await registerWorkspace(runtime.app, state.workspacePath));
    while (true) {
      const input = (await deps.promptLine("gcah>")).trim();
      if (input === "") continue;
      if (input.startsWith("/")) {
        const result = await handleCommand(input, state, runtime, options, deps);
        for (const line of result.lines) emit(line);
        if (result.exit) break;
        continue;
      }
      for (const line of await runTask(runtime.app, state, input, deps.promptLine)) emit(line);
    }
  } finally {
    await runtime.app.close();
  }
  return deps.writeLine === undefined ? ok(`${lines.join("\n")}\n`) : ok("");
}

async function createWorkspaceApp(options: LocalReplOptions, deps: LocalReplDeps, state: ReplState): Promise<InjectableApp> {
  const command = validationCommand(state.validation);
  return deps.createApp({
    dataDir: options.dataDir ?? ".gcah",
    credentialStore: deps.credentialStore,
    baseUrl: state.baseUrl,
    model: state.model,
    allowedWorkspaceRoots: [state.workspacePath],
    ...(command === undefined ? {} : { validationCommand: command })
  });
}

async function recreateApp(options: LocalReplOptions, deps: LocalReplDeps, state: ReplState, runtime: ReplRuntime): Promise<void> {
  await runtime.app.close();
  runtime.app = await createWorkspaceApp(options, deps, state);
}

async function handleCommand(input: string, state: ReplState, runtime: ReplRuntime, options: LocalReplOptions, deps: LocalReplDeps): Promise<{ lines: string[]; exit: boolean }> {
  const [command, ...args] = input.split(/\s+/u);
  if (command === "/exit" || command === "/quit") return { lines: ["bye"], exit: true };
  if (command === "/help" && args[0] === "credential") {
    return {
      lines: [
        "Credential commands:",
        "  /credential status    Check whether the provider key is configured.",
        "  /credential set       Store the provider key with hidden input.",
        "  /credential update    Replace the provider key with hidden input.",
        "  /credential clear     Clear the stored provider key."
      ],
      exit: false
    };
  }
  if (command === "/help") {
    return {
      lines: [
        "Commands:",
        "  /help                 Show this help.",
        "  /help credential      Show credential command details.",
        "  /status               Show workspace, model, validation, and current run.",
        "  /workspace <path>     Switch workspace and save it to the local profile.",
        "  /model <name>         Change model for future runs.",
        "  /base-url <url>       Change OpenAI-compatible endpoint for future runs.",
        "  /validation pnpm-test Use the pnpm test validation preset.",
        "  /credential ...       Manage the provider key. See /help credential.",
        "  /events [run-id]      Show the current or selected run timeline.",
        "  /clear                Clear the terminal screen.",
        "  /exit, /quit          Exit the local session."
      ],
      exit: false
    };
  }
  if (command === "/status") {
    return {
      lines: [
        "Status:",
        `  workspace:  ${state.workspacePath}`,
        `  base-url:   ${state.baseUrl}`,
        `  model:      ${state.model}`,
        `  validation: ${state.validation ?? "none"}`,
        `  active run: ${state.currentRunId ?? "none"}`
      ],
      exit: false
    };
  }
  if (command === "/workspace") {
    const path = args.join(" ");
    if (path === "") return { lines: ["usage: /workspace <path>"], exit: false };
    state.workspacePath = path;
    state.currentRunId = null;
    await deps.profileStore?.save(profile(state));
    await recreateApp(options, deps, state, runtime);
    return { lines: [await registerWorkspace(runtime.app, state.workspacePath)], exit: false };
  }
  if (command === "/model") {
    const model = args.join(" ");
    if (model === "") return { lines: ["usage: /model <name>"], exit: false };
    state.model = model;
    state.currentRunId = null;
    await deps.profileStore?.save(profile(state));
    await recreateApp(options, deps, state, runtime);
    const registered = await registerWorkspace(runtime.app, state.workspacePath);
    return { lines: [`model=${state.model}`, registered], exit: false };
  }
  if (command === "/base-url") {
    const baseUrl = args.join(" ");
    if (baseUrl === "") return { lines: ["usage: /base-url <url>"], exit: false };
    state.baseUrl = baseUrl;
    state.currentRunId = null;
    await deps.profileStore?.save(profile(state));
    await recreateApp(options, deps, state, runtime);
    const registered = await registerWorkspace(runtime.app, state.workspacePath);
    return { lines: [`base-url=${state.baseUrl}`, registered], exit: false };
  }
  if (command === "/validation") {
    const validation = args[0] ?? "";
    if (validation !== "pnpm-test") return { lines: ["unsupported validation; allowed: pnpm-test"], exit: false };
    state.validation = validation;
    state.currentRunId = null;
    await deps.profileStore?.save(profile(state));
    await recreateApp(options, deps, state, runtime);
    const registered = await registerWorkspace(runtime.app, state.workspacePath);
    return { lines: [`validation=${validation}`, registered], exit: false };
  }
  if (command === "/credential") {
    return { lines: await credentialCommand(args[0], deps), exit: false };
  }
  if (command === "/events") {
    const runId = args[0] ?? state.currentRunId;
    if (runId === null) return { lines: ["no run selected"], exit: false };
    const response = await runtime.app.inject({ method: "GET", url: `/api/runs/${runId}/events?cursor=0` });
    return { lines: response.statusCode >= 300 ? ["event fetch failed"] : renderEvents(response.json()), exit: false };
  }
  if (command === "/clear") return { lines: ["\u001b[2J\u001b[H"], exit: false };
  return { lines: [`unknown command: ${command}`], exit: false };
}

async function credentialCommand(command: string | undefined, deps: LocalReplDeps): Promise<string[]> {
  if (command === "status") {
    try {
      const status = await deps.credentialStore.status("openai-compatible");
      if (!status.available && status.reason === "backend-unavailable") return ["credential: backend unavailable"];
      if (!status.available) return ["credential: missing"];
      return [`credential: configured backend=${status.backend}`];
    } catch {
      return ["credential: backend unavailable"];
    }
  }
  if (command === "set" || command === "update") {
    if (deps.promptSecret === undefined) return ["credential: hidden input unavailable"];
    const secret = await deps.promptSecret();
    if (secret === "") return ["credential: empty secret ignored"];
    if (command === "set") {
      await deps.credentialStore.set("openai-compatible", secret);
      return ["credential: stored"];
    }
    await deps.credentialStore.update("openai-compatible", secret);
    return ["credential: updated"];
  }
  if (command === "clear") {
    await deps.credentialStore.clear("openai-compatible");
    return ["credential: cleared"];
  }
  return ["usage: /credential status|set|update|clear"];
}

async function runTask(app: InjectableApp, state: ReplState, task: string, promptLine: (label: string) => Promise<string>): Promise<string[]> {
  const submitted = await app.inject({ method: "POST", url: "/api/runs", payload: { workspacePath: state.workspacePath, task } });
  if (submitted.statusCode >= 300) return [`run submit failed: ${safeSummary(submitted.json())}`];
  let run = parseRun(submitted.json());
  if (run === null) return ["run submit failed: malformed response"];
  state.currentRunId = run.id;
  const lines = [`Run ${run.id} ${run.status}${run.stopReason === null ? "" : ` stop=${run.stopReason}`}`];
  lines.push(...await fetchRenderedEvents(app, run.id));
  if (run.status === "WAITING_APPROVAL") {
    const approval = findApproval(lines);
    if (approval !== null) {
      const decision = await promptApproval(promptLine);
      const approved = await app.inject({
        method: "POST",
        url: `/api/runs/${run.id}/approvals/${approval}`,
        payload: { decision, reason: "local repl approval" }
      });
      if (approved.statusCode >= 300) return [...lines, `approval failed: ${safeSummary(approved.json())}`];
      run = parseRun(approved.json()) ?? run;
      lines.push(`approval ${decision}`);
      lines.push(`Run ${run.id} ${run.status}${run.stopReason === null ? "" : ` stop=${run.stopReason}`}`);
      lines.push(...await fetchRenderedEvents(app, run.id));
    }
  }
  lines.push(summaryFor(run, lines));
  return lines;
}

async function registerWorkspace(app: InjectableApp, path: string): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/api/workspaces", payload: { path } });
  if (response.statusCode >= 300) return `workspace registration failed: ${safeSummary(response.json())}`;
  return `workspace=${path}`;
}

async function fetchRenderedEvents(app: InjectableApp, runId: string): Promise<string[]> {
  const events = await app.inject({ method: "GET", url: `/api/runs/${runId}/events?cursor=0` });
  if (events.statusCode >= 300) return ["event fetch failed"];
  return renderEvents(events.json());
}

function renderEvents(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.events)) return [];
  return value.events.flatMap((event) => {
    if (!isRecord(event) || typeof event.type !== "string" || typeof event.summary !== "string") return [];
    const rendered = renderEvent(event.type, event.summary);
    return rendered === null ? [] : [rendered];
  });
}

function renderEvent(type: string, summary: string): string | null {
  const safe = safeText(summary);
  if (type === "run.started") return `Task: ${clipOneLine(safe)}`;
  if (type === "action.proposed") return `Action: ${safe.replace(/ action$/u, "")}`;
  if (type === "governance.decision") return safe.includes("DENY") || safe.includes("REQUIRE_APPROVAL") ? `Governance: ${clipOneLine(safe)}` : null;
  if (type === "approval.required") return `Approval required: ${clipOneLine(safe)}`;
  if (type === "approval.approved") return "Approval: approved";
  if (type === "approval.rejected") return "Approval: rejected";
  if (type === "validation.pass") return `Validation: ${clipOneLine(safe)}`;
  if (type === "validation.fail") return `Validation failed: ${clipOneLine(safe)}`;
  if (type === "finish.blocked") return `Finish blocked: ${clipOneLine(safe)}`;
  if (type === "run.completed") return `Agent: ${clipOneLine(safe)}`;
  if (type === "run.failed") return `Run failed: ${clipOneLine(safe)}`;
  if (type === "run.stopped") return `Run stopped: ${clipOneLine(safe)}`;
  if (type === "tool.result") return renderToolResult(safe);
  return `${type}: ${clipOneLine(safe)}`;
}

function renderToolResult(summary: string): string {
  if (summary.startsWith("sha256=")) {
    return "Tool: read file";
  }
  if (summary === "command passed") return "Tool: validation command passed";
  if (summary.startsWith("command failed")) return `Tool: validation command failed (${summary})`;
  if (summary.startsWith("patched ")) return `Tool: ${summary}`;
  if (summary.startsWith("REQUIRE_APPROVAL")) return `Tool: ${summary}`;
  return `Tool: ${clipOneLine(summary)}`;
}

async function promptApproval(promptLine: (label: string) => Promise<string>): Promise<LocalApprovalDecision> {
  const answer = (await promptLine("approve once [o], approve session [s], reject [r]:")).trim().toLowerCase();
  if (answer === "o" || answer === "once") return "approve_once";
  if (answer === "s" || answer === "session") return "approve_session";
  return "reject";
}

function findApproval(lines: string[]): string | null {
  const joined = lines.join("\n");
  return joined.match(/action:[^\s\]]+/u)?.[0] ?? null;
}

function summaryFor(run: { status: string; stopReason: string | null }, lines: string[]): string {
  const last = [...lines].reverse().find((line: string) => line.startsWith("Tool:") || line.startsWith("Validation"));
  if (run.status === "COMPLETED" || run.stopReason === "COMPLETED") return "summary: completed";
  if (run.stopReason === "BUDGET_EXHAUSTED") return `summary: budget exhausted${last === undefined ? "" : `; last=${last}`}`;
  if (run.stopReason === "UNFIXABLE_FAILURE") return `summary: model or tool protocol failed${last === undefined ? "" : `; last=${last}`}`;
  return `summary: ${run.status}${run.stopReason === null ? "" : ` ${run.stopReason}`}`;
}

function parseRun(value: unknown): { id: string; status: string; stopReason: string | null } | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.status !== "string") return null;
  return { id: value.id, status: value.status, stopReason: typeof value.stopReason === "string" ? value.stopReason : null };
}

function validationCommand(validation: string | undefined): { id: string; executable: string; args: string[]; cwd: string; timeoutMs: number } | undefined {
  if (validation === "pnpm-test") return { id: "test", executable: "pnpm", args: ["test"], cwd: ".", timeoutMs: 30000 };
  return undefined;
}

function profile(state: ReplState): { workspacePath: string; baseUrl: string; model: string; validation?: string } {
  return { workspacePath: state.workspacePath, baseUrl: state.baseUrl, model: state.model, ...(state.validation === undefined ? {} : { validation: state.validation }) };
}

function safeSummary(value: unknown): string {
  return clip(safeText(JSON.stringify(value)));
}

function safeText(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/gu, "<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gu, "Bearer <redacted>")
    .replace(/api[_-]?key\s*=\s*[^\s]+/giu, "<redacted>");
}

function clip(value: string): string {
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

function clipOneLine(value: string): string {
  return clip(value.replace(/\s+/gu, " ").trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
