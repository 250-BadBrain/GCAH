export interface CommandTemplate {
  id: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}

export type CommandMatch =
  | { ok: true; templateId: string; template: CommandTemplate }
  | { ok: false; reason: "METACHARACTER" | "NO_TEMPLATE" | "EXTERNAL_CWD" | "TIMEOUT" };

function hasMetacharacter(values: string[]): boolean {
  return values.some((value) => /[;&|`$<>]/u.test(value));
}

export function matchCommandTemplate(request: Omit<CommandTemplate, "id">, templates: CommandTemplate[]): CommandMatch {
  if (hasMetacharacter([request.executable, ...request.args])) return { ok: false, reason: "METACHARACTER" };
  if (request.cwd.includes("..") || request.cwd.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(request.cwd)) {
    return { ok: false, reason: "EXTERNAL_CWD" };
  }
  const template = templates.find((candidate) =>
    candidate.executable === request.executable
    && candidate.cwd === request.cwd
    && candidate.timeoutMs >= request.timeoutMs
    && candidate.args.length === request.args.length
    && candidate.args.every((arg, index) => arg === request.args[index])
  );
  if (template === undefined) return { ok: false, reason: "NO_TEMPLATE" };
  return { ok: true, templateId: template.id, template };
}
