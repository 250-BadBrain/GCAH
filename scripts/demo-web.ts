import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createDemoWebApp } from "../apps/server/src/demo-web-app.js";

const launcherDir = dirname(fileURLToPath(import.meta.url));
const root = findRepoRoot(launcherDir);
const distDir = join(root, "apps", "webui", "dist");

async function main(): Promise<void> {
  if (!existsSync(join(distDir, "index.html"))) {
    await run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--filter", "@gcah/webui", "build"]);
  }
  const app = await createDemoWebApp({ distDir });
  const host = "127.0.0.1";
  const port = 4173;
  await app.listen({ host, port });
  process.stdout.write(`GCAH demo web running at http://${host}:${port}\n`);
}

function findRepoRoot(start: string): string {
  let current = start;
  for (let index = 0; index < 8; index += 1) {
    const packageJson = join(current, "package.json");
    if (existsSync(packageJson)) {
      const manifest = JSON.parse(readFileSync(packageJson, "utf8")) as { name?: string };
      if (manifest.name === "gcah") return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("Could not locate GCAH repository root.");
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

await main();
