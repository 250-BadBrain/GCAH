import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface LocalValidationCommand {
  id: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}

export interface ResolvedLocalValidation {
  profile: string;
  command: LocalValidationCommand | null;
  summary: string;
  diagnostics: string[];
}

export function isAllowedLocalValidation(value: string): boolean {
  return value === "auto" || value === "none" || value === "pnpm-test";
}

export async function resolveLocalValidation(profile: string | undefined, workspacePath: string): Promise<ResolvedLocalValidation> {
  const selected = profile ?? "auto";
  if (selected === "none") {
    return { profile: selected, command: null, summary: "validation disabled", diagnostics: ["No automatic correctness checks will run."] };
  }
  if (selected === "pnpm-test") {
    return { profile: selected, command: command("pnpm", ["test"]), summary: "pnpm test", diagnostics: [] };
  }
  if (selected !== "auto") {
    return { profile: selected, command: null, summary: "unsupported validation profile", diagnostics: [`Unsupported validation profile: ${selected}`] };
  }
  return detectValidation(workspacePath);
}

async function detectValidation(workspacePath: string): Promise<ResolvedLocalValidation> {
  const packageJson = await readPackageJson(workspacePath);
  if (packageJson?.scripts?.test !== undefined) {
    if (await exists(workspacePath, "pnpm-lock.yaml")) return detected(command("pnpm", ["test"]), "Node.js pnpm project");
    if (await exists(workspacePath, "package-lock.json")) return detected(command("npm", ["test"]), "Node.js npm project");
    if (await exists(workspacePath, "yarn.lock")) return detected(command("yarn", ["test"]), "Node.js yarn project");
    return detected(command("npm", ["test"]), "Node.js project with package.json test script");
  }
  if (await exists(workspacePath, "pytest.ini") || await exists(workspacePath, "pyproject.toml") || await exists(workspacePath, "requirements.txt")) {
    return detected(command("python", ["-m", "pytest"]), "Python pytest project");
  }
  if (await exists(workspacePath, "Cargo.toml")) return detected(command("cargo", ["test"]), "Rust Cargo project");
  if (await exists(workspacePath, "go.mod")) return detected(command("go", ["test", "./..."]), "Go module");
  return {
    profile: "auto",
    command: null,
    summary: "no validation command detected",
    diagnostics: ["No supported project-native validation command was detected; continuing with validation disabled."]
  };
}

function detected(commandValue: LocalValidationCommand, kind: string): ResolvedLocalValidation {
  return {
    profile: "auto",
    command: commandValue,
    summary: `${commandValue.executable} ${commandValue.args.join(" ")}`.trim(),
    diagnostics: [`Detected ${kind}.`]
  };
}

function command(executable: string, args: string[]): LocalValidationCommand {
  return { id: "test", executable, args, cwd: ".", timeoutMs: 30000 };
}

async function readPackageJson(workspacePath: string): Promise<{ scripts?: { test?: string } } | null> {
  try {
    const parsed = JSON.parse(await readFile(join(workspacePath, "package.json"), "utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const scripts = "scripts" in parsed ? (parsed as { scripts?: unknown }).scripts : undefined;
    if (typeof scripts !== "object" || scripts === null) return {};
    const test = "test" in scripts && typeof (scripts as { test?: unknown }).test === "string"
      ? (scripts as { test: string }).test
      : undefined;
    return { scripts: test === undefined ? {} : { test } };
  } catch {
    return null;
  }
}

async function exists(workspacePath: string, name: string): Promise<boolean> {
  try {
    await access(join(workspacePath, name));
    return true;
  } catch {
    return false;
  }
}
