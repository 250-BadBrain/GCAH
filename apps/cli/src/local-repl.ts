import type { CredentialStore } from "@gcah/credentials";

import type { InjectableApp, LocalApprovalDecision } from "./local-session.js";
import { ok, type CliResult } from "./output.js";
import { resolveLocalValidation, type LocalValidationCommand } from "./validation-profile.js";

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
    validationCommand?: LocalValidationCommand | null;
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
  validation: string;
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
    validation: options.validation ?? "auto",
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
  const resolved = await resolveLocalValidation(state.validation, state.workspacePath);
  return deps.createApp({
    dataDir: options.dataDir ?? ".gcah",
    credentialStore: deps.credentialStore,
    baseUrl: state.baseUrl,
    model: state.model,
    allowedWorkspaceRoots: [state.workspacePath],
    validationCommand: resolved.command
  });
}

async function recreateApp(options: LocalReplOptions, deps: LocalReplDeps, state: ReplState, runtime: ReplRuntime): Promise<void> {
  await runtime.app.close();
  runtime.app = await createWorkspaceApp(options, deps, state);
}

async function handleCommand(input: string, state: ReplState, runtime: ReplRuntime, options: LocalReplOptions, deps: LocalReplDeps): Promise<{ lines: string[]; exit: boolean }> {
  const [command, ...args] = input.split(/\s+/u);
  if (command === "/exit" || command === "/quit") return { lines: ["bye"], exit: true };
  if (command === "/help") {
    return { lines: helpLines(args[0]), exit: false };
  }
  if (command === "/status") {
    return {
      lines: [
        "Status:",
        `  workspace:  ${state.workspacePath}`,
        `  base-url:   ${state.baseUrl}`,
        `  model:      ${state.model}`,
        `  validation: ${state.validation}`,
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
    return { lines: [`model=${state.model}`, ...await registerWorkspaceOnlyOnFailure(runtime.app, state.workspacePath)], exit: false };
  }
  if (command === "/base-url") {
    const baseUrl = args.join(" ");
    if (baseUrl === "") return { lines: ["usage: /base-url <url>"], exit: false };
    state.baseUrl = baseUrl;
    state.currentRunId = null;
    await deps.profileStore?.save(profile(state));
    await recreateApp(options, deps, state, runtime);
    return { lines: [`base-url=${state.baseUrl}`, ...await registerWorkspaceOnlyOnFailure(runtime.app, state.workspacePath)], exit: false };
  }
  if (command === "/validation") {
    const validation = args[0] ?? "";
    if (validation === "status") {
      const resolved = await resolveLocalValidation(state.validation, state.workspacePath);
      return {
        lines: [
          "Validation:",
          `  profile: ${state.validation}`,
          `  command: ${resolved.command === null ? "none" : `${resolved.command.executable} ${resolved.command.args.join(" ")}`.trim()}`,
          ...resolved.diagnostics.map((line) => `  note: ${line}`)
        ],
        exit: false
      };
    }
    if (validation !== "auto" && validation !== "none") return { lines: ["unsupported validation; allowed: auto, none, status"], exit: false };
    state.validation = validation;
    state.currentRunId = null;
    await deps.profileStore?.save(profile(state));
    await recreateApp(options, deps, state, runtime);
    return { lines: [`validation=${validation}`, ...await registerWorkspaceOnlyOnFailure(runtime.app, state.workspacePath)], exit: false };
  }
  if (command === "/credential") {
    return { lines: await credentialCommand(args[0], deps), exit: false };
  }
  if (command === "/events") {
    const runId = args[0] ?? state.currentRunId;
    if (runId === null) return { lines: ["no run selected"], exit: false };
    const response = await runtime.app.inject({ method: "GET", url: `/api/runs/${runId}/events?cursor=0` });
    return { lines: response.statusCode >= 300 ? ["event fetch failed"] : renderEvents(parseEvents(response.json())), exit: false };
  }
  if (command === "/clear") return { lines: ["\u001b[2J\u001b[H"], exit: false };
  return { lines: [`unknown command: ${command}`], exit: false };
}

function helpLines(topic: string | undefined): string[] {
  if (topic === undefined) return [
    "Commands:",
    "  /help [command]       Show command help.",
    "  /status               Show current session settings.",
    "  /workspace ...        Manage the active workspace.",
    "  /model ...            Manage the model name.",
    "  /base-url ...         Manage the OpenAI-compatible endpoint.",
    "  /validation ...       Manage automatic validation.",
    "  /credential ...       Manage the provider key.",
    "  /events ...           Show a run timeline.",
    "  /clear                Clear the terminal screen.",
    "  /exit, /quit          Exit the local session."
  ];
  const normalized = topic.startsWith("/") ? topic : `/${topic}`;
  if (normalized === "/help") return [
    "Command:",
    "  /help [command]",
    "Description:",
    "  Show the top-level command list or detailed help for one command."
  ];
  if (normalized === "/status") return [
    "Command:",
    "  /status",
    "Description:",
    "  Show workspace, base URL, model, validation profile, and active run."
  ];
  if (normalized === "/workspace") return [
    "Workspace commands:",
    "  /workspace <path>     Switch workspace and save it to the local profile."
  ];
  if (normalized === "/model") return [
    "Model commands:",
    "  /model <name>         Change model for future runs."
  ];
  if (normalized === "/base-url") return [
    "Base URL commands:",
    "  /base-url <url>       Change OpenAI-compatible endpoint for future runs."
  ];
  if (normalized === "/validation") return [
    "Validation commands:",
    "  /validation auto      Auto-detect a project-native validation command.",
    "  /validation none      Disable automatic correctness checks.",
    "  /validation status    Show the resolved validation command."
  ];
  if (normalized === "/credential") return [
    "Credential commands:",
    "  /credential status    Check whether the provider key is configured.",
    "  /credential set       Store the provider key with hidden input.",
    "  /credential update    Replace the provider key with hidden input.",
    "  /credential clear     Clear the stored provider key."
  ];
  if (normalized === "/events") return [
    "Events commands:",
    "  /events [run-id]      Show the current or selected run timeline."
  ];
  if (normalized === "/clear") return [
    "Command:",
    "  /clear",
    "Description:",
    "  Clear the terminal screen."
  ];
  if (normalized === "/exit" || normalized === "/quit") return [
    "Command:",
    "  /exit, /quit",
    "Description:",
    "  Exit the local session."
  ];
  return [`unsupported command: ${topic}`];
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
  let events = await fetchEvents(app, run.id);
  const lines: string[] = [];
  if (run.status === "WAITING_APPROVAL") {
    const approval = findApproval(events);
    if (approval !== null) {
      const promptLines = approvalPromptLines(approval, events);
      const decision = await promptApproval(promptLine, promptLines);
      const approved = await app.inject({
        method: "POST",
        url: `/api/runs/${run.id}/approvals/${approval}`,
        payload: { decision, reason: "local repl approval" }
      });
      if (approved.statusCode >= 300) return [...lines, formatApprovalFailure(approved.json())];
      run = parseRun(approved.json()) ?? run;
      lines.push(`Approval: ${decision}`);
      events = await fetchEvents(app, run.id);
    }
  }
  return [...lines, ...renderRunSummary(run, events)];
}

function formatApprovalFailure(body: unknown): string {
  const detail = safeSummary(body);
  if (detail.includes("NETWORK_ERROR")) {
    return "approval failed: model request failed after approval (network, timeout, or invalid provider response). Try again or switch to a more stable model.";
  }
  if (detail.includes("PROTOCOL_ERROR")) {
    return "approval failed: model returned a response that did not match the required action JSON protocol. Try a coding-oriented model or a narrower prompt.";
  }
  return `approval failed: ${detail}`;
}

async function registerWorkspace(app: InjectableApp, path: string): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/api/workspaces", payload: { path } });
  if (response.statusCode >= 300) return `workspace registration failed: ${safeSummary(response.json())}`;
  return `workspace=${path}`;
}

async function registerWorkspaceOnlyOnFailure(app: InjectableApp, path: string): Promise<string[]> {
  const result = await registerWorkspace(app, path);
  return result.startsWith("workspace registration failed:") ? [result] : [];
}

async function fetchEvents(app: InjectableApp, runId: string): Promise<RunEventView[] | null> {
  const response = await app.inject({ method: "GET", url: `/api/runs/${runId}/events?cursor=0` });
  if (response.statusCode >= 300) return null;
  return parseEvents(response.json());
}

interface RunEventView {
  type: string;
  summary: string;
  relatedEntityId: string | null;
}

function parseEvents(value: unknown): RunEventView[] {
  if (!isRecord(value) || !Array.isArray(value.events)) return [];
  return value.events.flatMap((event) =>
    isRecord(event) && typeof event.type === "string" && typeof event.summary === "string"
      ? [{ type: event.type, summary: event.summary, relatedEntityId: typeof event.relatedEntityId === "string" ? event.relatedEntityId : null }]
      : []
  );
}

function renderEvents(events: RunEventView[] | null): string[] {
  if (events === null) return ["event fetch failed"];
  return events.flatMap((event) => {
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

async function promptApproval(promptLine: (label: string) => Promise<string>, details: string[]): Promise<LocalApprovalDecision> {
  const answer = (await promptLine(`${details.join("\n")}\nChoose approval [o=once, s=session, r=reject]`)).trim().toLowerCase();
  if (answer === "o" || answer === "once") return "approve_once";
  if (answer === "s" || answer === "session") return "approve_session";
  return "reject";
}

function findApproval(events: RunEventView[] | null): string | null {
  const event = events === null ? undefined : lastWhere(events, (candidate) => candidate.type === "approval.required");
  if (event === undefined) return null;
  return event.relatedEntityId ?? event.summary.match(/action:[^\s\]]+/u)?.[0] ?? null;
}

function approvalPromptLines(_actionId: string, events: RunEventView[] | null): string[] {
  const prior = events ?? [];
  const action = lastWhere(prior, (event) => event.type === "action.proposed");
  const actionName = action?.summary.replace(/ action$/u, "") ?? "action";
  return [
    `Approval required: ${actionName}`,
    approvalHint(actionName),
    "[o] approve once   [s] approve similar actions in this run   [r] reject"
  ];
}

function approvalHint(actionName: string): string {
  if (actionName === "write" || actionName === "patch" || actionName === "delete") return "This may change files in the selected workspace.";
  if (actionName === "run_validation") return "This may run the configured validation command.";
  if (actionName === "run_command" || actionName === "shell") return "This may run an allowlisted local command.";
  return "This action needs your permission before it can run.";
}

function renderRunSummary(run: { id: string; status: string; stopReason: string | null }, events: RunEventView[] | null): string[] {
  if (events === null) return [`Run ${run.id} ${run.status}${run.stopReason === null ? "" : ` stop=${run.stopReason}`}`, "Could not load run events."];
  const actions = events.filter((event) => event.type === "action.proposed").map((event) => event.summary.replace(/ action$/u, ""));
  const patched = events.filter((event) => event.type === "tool.result" && event.summary.startsWith("patched ")).map((event) => event.summary);
  const validation = lastWhere(events, (event) => event.type === "validation.pass" || event.type === "validation.fail");
  const completed = lastWhere(events, (event) => event.type === "run.completed");
  const stopped = lastWhere(events, (event) => event.type === "run.stopped" || event.type === "run.failed");
  const lines = [`Run ${run.id} ${run.status}${run.stopReason === null ? "" : ` stop=${run.stopReason}`}`];
  if (patched.length > 0) lines.push(`Changed: ${[...new Set(patched)].join(", ")}`);
  if (validation !== undefined) lines.push(validation.type === "validation.pass" ? `Validation: ${clipOneLine(validation.summary)}` : `Validation failed: ${clipOneLine(validation.summary)}`);
  if (completed !== undefined) lines.push(`Agent: ${clipOneLine(completed.summary)}`);
  if (stopped !== undefined && completed === undefined && run.stopReason !== "BUDGET_EXHAUSTED") lines.push(`Stopped: ${clipOneLine(stopped.summary)}`);
  if (run.stopReason === "BUDGET_EXHAUSTED") lines.push("Stopped: local step limit reached before completion");
  if (actions.length > 0) lines.push(`Actions: ${summarizeActions(actions)}`);
  if (run.status === "COMPLETED" || run.stopReason === "COMPLETED") {
    lines.push("Summary: completed");
  } else if (run.stopReason === "BUDGET_EXHAUSTED") {
    lines.push("Summary: step limit reached; retry with a narrower task or continue with another prompt.");
  } else {
    lines.push(`Summary: ${run.status}${run.stopReason === null ? "" : ` ${run.stopReason}`}`);
  }
  lines.push(`Details: /events ${run.id}`);
  return lines;
}

function summarizeActions(actions: string[]): string {
  const counts = new Map<string, number>();
  for (const action of actions) counts.set(action, (counts.get(action) ?? 0) + 1);
  return [...counts.entries()].map(([action, count]) => count === 1 ? action : `${action} x${count}`).join(", ");
}

function lastWhere<T>(items: T[], predicate: (item: T) => boolean): T | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) return item;
  }
  return undefined;
}

function parseRun(value: unknown): { id: string; status: string; stopReason: string | null } | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.status !== "string") return null;
  return { id: value.id, status: value.status, stopReason: typeof value.stopReason === "string" ? value.stopReason : null };
}

function profile(state: ReplState): { workspacePath: string; baseUrl: string; model: string; validation?: string } {
  return { workspacePath: state.workspacePath, baseUrl: state.baseUrl, model: state.model, validation: state.validation };
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
