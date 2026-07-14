import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

const binPath = join(process.cwd(), "apps", "cli", "dist", "src", "bin.js");

if (existsSync(binPath)) {
  chmodSync(binPath, 0o755);
}
