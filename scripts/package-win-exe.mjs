import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseRoot = join(root, "release");
const packageDir = join(releaseRoot, "gcah-windows-x64");
const appDir = join(packageDir, "app");
const runtimeDir = join(packageDir, "runtime");
const exePath = join(packageDir, "gcah.exe");
const zipPath = join(releaseRoot, "gcah-windows-x64.zip");
const sumsPath = join(packageDir, "SHA256SUMS.txt");

rmSync(packageDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(packageDir, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });

execFileSync("pnpm", ["--filter", "@gcah/cli", "deploy", appDir, "--legacy", "--frozen-lockfile"], {
  cwd: root,
  env: { ...process.env, CI: "true" },
  stdio: "inherit",
  shell: process.platform === "win32"
});

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

writeFileSync(join(packageDir, "README-windows.txt"), `GCAH Windows x64 release

Double-click gcah.exe to start the interactive local agent.

Preferred usage:

  1. Double-click gcah.exe, or run .\\gcah.exe from PowerShell.
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
  - The release executable is intended as a launcher; configure/check credentials from inside gcah> with /credential commands.
  - This release is for local command-line use; it does not perform online deployment.
`, "utf8");

writeFileSync(sumsPath, [
  `${sha256(exePath)}  ${basename(exePath)}`,
  `${sha256(join(runtimeDir, "node.exe"))}  runtime/node.exe`
].join("\n") + "\n", "utf8");

execFileSync("powershell", [
  "-NoProfile",
  "-Command",
  `Compress-Archive -Path '${packageDir}\\*' -DestinationPath '${zipPath}' -Force`
], { cwd: root, stdio: "inherit" });

console.log(`Created ${zipPath}`);

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
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
