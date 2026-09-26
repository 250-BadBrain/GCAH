import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseRoot = join(root, "release");
const packageDir = join(releaseRoot, "gcah-windows-x64");
const appDir = join(packageDir, "app");
const runtimeDir = join(packageDir, "runtime");
const exePath = join(packageDir, "gcah.exe");
const cmdPath = join(packageDir, "Start GCAH.cmd");
const zipPath = join(releaseRoot, "gcah-windows-x64.zip");
const sumsPath = join(packageDir, "SHA256SUMS.txt");

rmSync(packageDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(packageDir, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });

execFileSync("pnpm", ["--config.node-linker=hoisted", "--filter", "@gcah/cli", "deploy", appDir, "--legacy", "--prod", "--frozen-lockfile"], {
  cwd: root,
  env: { ...process.env, CI: "true" },
  stdio: "inherit",
  shell: process.platform === "win32"
});

assertNoLinks(appDir);
rmSync(join(appDir, "src"), { recursive: true, force: true });
rmSync(join(appDir, "test"), { recursive: true, force: true });
copyFileSync(process.execPath, join(runtimeDir, "node.exe"));

const launcherSourcePath = join(packageDir, "gcah-launcher.cs");
writeFileSync(launcherSourcePath, launcherCs(), "utf8");

execFileSync("powershell", [
  "-NoProfile",
  "-Command",
  `Add-Type -TypeDefinition (Get-Content -Raw '${launcherSourcePath}') -OutputAssembly '${exePath}' -OutputType ConsoleApplication`
], { cwd: root, stdio: "inherit" });
rmSync(launcherSourcePath, { force: true });

writeFileSync(cmdPath, `@echo off
cd /d "%~dp0"
gcah.exe local
if errorlevel 1 (
  echo.
  echo GCAH exited with an error. Press any key to close this window.
  pause >nul
)
`, "utf8");

writeFileSync(join(packageDir, "README-windows.txt"), `GCAH Windows x64 release

Double-click "Start GCAH.cmd" to start the interactive local agent. You can also run gcah.exe from PowerShell.

Preferred usage:

  1. Double-click Start GCAH.cmd, or run .\\gcah.exe from PowerShell.
  2. Configure credentials and model settings inside gcah>.

Inside gcah>:

  /credential set
  /credential status
  /workspace E:\\path\\to\\your-project
  /base-url https://your-openai-compatible-provider.example/v1
  /model DeepSeek-V3
  /validation auto
  Fix the failing tests.

One-shot example:

  .\\gcah.exe local --workspace E:\\path\\to\\your-project --base-url https://your-openai-compatible-provider.example/v1 --model DeepSeek-V3 --validation auto --task "Fix the failing tests"

Notes:

  - This package includes its own Node runtime.
  - API keys are stored through the operating-system credential store.
  - Do not pass API keys as command-line arguments.
  - /validation auto detects common project checks; /validation none disables automatic correctness checks.
  - Running gcah.exe without arguments is the same as running gcah.exe local.
  - Start GCAH.cmd keeps the window open if startup fails, so errors are visible.
  - The release executable is intended as a launcher; configure/check credentials from inside gcah> with /credential commands.
  - This release is for local command-line use; it does not perform online deployment.
`, "utf8");

writeFileSync(sumsPath, [
  `${sha256(exePath)}  ${basename(exePath)}`,
  `${sha256(cmdPath)}  ${basename(cmdPath)}`,
  `${sha256(join(runtimeDir, "node.exe"))}  runtime/node.exe`
].join("\n") + "\n", "utf8");

verifyRelocatedPackage();

if (process.argv.includes("--zip")) {
  execFileSync("tar", ["-a", "-cf", zipPath, "-C", packageDir, "."], { cwd: root, stdio: "inherit" });
  console.log(`Created ${zipPath}`);
} else {
  console.log(`Created ${packageDir}`);
  console.log("Zip creation skipped; compress the release folder manually or run this script with --zip.");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertNoLinks(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    const stats = lstatSync(entryPath);
    if (stats.isSymbolicLink()) throw new Error(`Release package contains a link: ${entryPath}`);
    if (stats.isDirectory()) assertNoLinks(entryPath);
  }
}

function materializeRootDependencies(nodeModulesDir) {
  materializeDependencies(nodeModulesDir, nodeModulesDir, new Set());
  materializeDependencies(join(nodeModulesDir, ".pnpm", "node_modules"), nodeModulesDir, new Set());
  rmSync(join(nodeModulesDir, ".pnpm"), { recursive: true, force: true });
  rmSync(join(nodeModulesDir, ".bin"), { recursive: true, force: true });

  function materializeDependencies(sourceDir, targetDir, ancestors) {
    if (!existsSync(sourceDir)) return;
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      if (entry.name === ".pnpm" || entry.name === ".bin") continue;
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(targetDir, entry.name);
      if (!statSync(sourcePath).isDirectory()) {
        copyFileSync(sourcePath, targetPath);
        continue;
      }
      if (entry.name.startsWith("@") && lstatSync(sourcePath).isDirectory()) {
        for (const scopedEntry of readdirSync(sourcePath, { withFileTypes: true })) {
          materializePackage(join(sourcePath, scopedEntry.name), join(targetPath, scopedEntry.name), ancestors);
        }
        continue;
      }
      materializePackage(sourcePath, targetPath, ancestors);
    }
  }

  function materializePackage(sourceLinkPath, targetPath, ancestors) {
    const sourcePath = realpathSync(sourceLinkPath);
    if (ancestors.has(sourcePath)) return;
    const nextAncestors = new Set([...ancestors, sourcePath]);
    if (resolve(sourcePath) === resolve(targetPath)) {
      materializeDependencies(join(sourcePath, "node_modules"), join(targetPath, "node_modules"), nextAncestors);
      return;
    }
    rmSync(targetPath, { recursive: true, force: true });
    copyPackage(sourcePath, targetPath, nextAncestors);
    const virtualDependencies = virtualDependencyDirectory(sourcePath);
    if (virtualDependencies !== null) {
      materializeDependencies(virtualDependencies, join(targetPath, "node_modules"), nextAncestors);
    }
  }

  function virtualDependencyDirectory(packagePath) {
    if (!/[\\/]\.pnpm[\\/]/u.test(packagePath)) return null;
    const parent = dirname(packagePath);
    return basename(parent).startsWith("@") ? dirname(parent) : parent;
  }

  function copyPackage(source, target, ancestors) {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      if (entry.name === "test") continue;
      const sourcePath = join(source, entry.name);
      const targetPath = join(target, entry.name);
      if (entry.name === "node_modules" && entry.isDirectory()) {
        materializeDependencies(sourcePath, targetPath, ancestors);
      } else if (entry.isDirectory()) {
        copyPackage(sourcePath, targetPath, ancestors);
      } else {
        copyFileSync(sourcePath, targetPath);
      }
    }
  }
}

function verifyRelocatedPackage() {
  const verificationRoot = mkdtempSync(join(tmpdir(), "gcah-release-"));
  const relocatedPackage = join(verificationRoot, "moved-package");
  try {
    cpSync(packageDir, relocatedPackage, { recursive: true, dereference: true });
    assertNoLinks(join(relocatedPackage, "app"));
    execFileSync(join(relocatedPackage, "runtime", "node.exe"), [
      "--input-type=module",
      "--eval",
      "await import('@gcah/credentials'); await import('@gcah/server');"
    ], { cwd: join(relocatedPackage, "app"), stdio: "inherit" });
    execFileSync(join(relocatedPackage, "gcah.exe"), ["credential", "status"], {
      cwd: relocatedPackage,
      stdio: "inherit"
    });
    const smokeWorkspace = join(verificationRoot, "workspace");
    mkdirSync(smokeWorkspace);
    const smoke = spawnSync(join(relocatedPackage, "gcah.exe"), [
      "local",
      "--workspace", smokeWorkspace,
      "--base-url", "http://127.0.0.1:1",
      "--model", "release-smoke",
      "--validation", "none",
      "--task", "release dependency smoke test"
    ], { cwd: relocatedPackage, encoding: "utf8" });
    if (smoke.error !== undefined) throw smoke.error;
    const smokeOutput = `${smoke.stdout ?? ""}${smoke.stderr ?? ""}`;
    if (/ERR_MODULE_NOT_FOUND|Cannot find module/u.test(smokeOutput)) {
      throw new Error(`Release local-session smoke test could not load a runtime module:\n${smokeOutput}`);
    }
  } finally {
    rmSync(verificationRoot, { recursive: true, force: true });
  }
}

function launcherCs() {
  return String.raw`
using System;
using System.Diagnostics;
using System.IO;
using System.Text;

public static class GcahLauncher
{
    public static int Main(string[] args)
    {
        string exeDir = AppDomain.CurrentDomain.BaseDirectory;
        string node = Path.Combine(exeDir, "runtime", "node.exe");
        string script = Path.Combine(exeDir, "app", "dist", "src", "bin.js");

        if (!File.Exists(node))
        {
            Console.Error.WriteLine("Missing bundled runtime: " + node);
            return 1;
        }
        if (!File.Exists(script))
        {
            Console.Error.WriteLine("Missing GCAH CLI entry: " + script);
            return 1;
        }

        var psi = new ProcessStartInfo();
        psi.FileName = node;
        string[] effectiveArgs = args.Length == 0 ? new string[] { "local" } : args;
        psi.Arguments = Quote(script) + BuildArguments(effectiveArgs);
        psi.UseShellExecute = false;

        using (var process = Process.Start(psi))
        {
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    private static string BuildArguments(string[] args)
    {
        if (args.Length == 0) return "";
        var builder = new StringBuilder();
        foreach (string arg in args)
        {
            builder.Append(" ");
            builder.Append(Quote(arg));
        }
        return builder.ToString();
    }

    private static string Quote(string value)
    {
        if (value.Length == 0) return "\"\"";
        bool needsQuotes = value.IndexOfAny(new char[] { ' ', '\t', '\n', '\r', '"' }) >= 0;
        if (!needsQuotes) return value;

        var builder = new StringBuilder();
        builder.Append('"');
        int backslashes = 0;
        foreach (char ch in value)
        {
            if (ch == '\\')
            {
                backslashes++;
                continue;
            }
            if (ch == '"')
            {
                builder.Append('\\', backslashes * 2 + 1);
                builder.Append('"');
                backslashes = 0;
                continue;
            }
            if (backslashes > 0)
            {
                builder.Append('\\', backslashes);
                backslashes = 0;
            }
            builder.Append(ch);
        }
        if (backslashes > 0) builder.Append('\\', backslashes * 2);
        builder.Append('"');
        return builder.ToString();
    }
}
`;
}
