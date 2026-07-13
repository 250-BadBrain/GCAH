import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function writeAtomically(path: string, content: string): Promise<void> {
  const temp = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temp, content);
  await rename(temp, path);
}
