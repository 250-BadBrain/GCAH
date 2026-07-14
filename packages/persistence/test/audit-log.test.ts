import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { openAuditLog } from "../src/index.js";

describe("audit log", () => {
  it("appends sanitized structured records without plaintext secrets", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "gcah-audit-"));
    const audit = await openAuditLog({ dataDir });

    await audit.append({ type: "tool.result", summary: "secret sk-test E:/Users/AAA/file" });
    await audit.append({ type: "run.completed", summary: "done" });

    const text = await readFile(join(dataDir, "audit.jsonl"), "utf8");
    expect(text).toContain("\"run.completed\"");
    expect(text).not.toContain("sk-test");
    expect(text).not.toContain("E:/Users");
  });
});
