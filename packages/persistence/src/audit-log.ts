import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface AuditRecord {
  type: string;
  summary: string;
}

export interface AuditLog {
  append(record: AuditRecord): Promise<void>;
}

export async function openAuditLog(input: { dataDir: string }): Promise<AuditLog> {
  await mkdir(input.dataDir, { recursive: true });
  const path = join(input.dataDir, "audit.jsonl");
  return {
    async append(record) {
      const sanitized = {
        type: record.type,
        summary: sanitize(record.summary)
      };
      await appendFile(path, `${JSON.stringify(sanitized)}\n`, "utf8");
    }
  };
}

function sanitize(value: string): string {
  return /(sk-[A-Za-z0-9_-]+|api[_-]?key\s*=|authorization:\s*bearer\s+|[A-Za-z]:[\\/]+Users[\\/]+|\/home\/)/iu.test(value)
    ? "[redacted]"
    : value.slice(0, 4096);
}
