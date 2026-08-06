# GCAH

GCAH is a local command-line Coding Agent Harness. It runs on your machine, uses a local workspace that you explicitly select, stores API keys in the operating-system credential store, and drives the self-implemented AgentLoop through the CLI.

## Project Overview

The project implements a coding-agent harness rather than a prompt-only wrapper. The harness includes:

- a self-owned AgentLoop;
- structured LLM action parsing;
- governance and approval checks before tool execution;
- workspace path fencing;
- read, patch, write, shell-template, and validation tools;
- validation feedback returned to the next LLM round;
- SQLite-backed local persistence;
- a local CLI and REST/SSE server;
- a mock-LLM mechanism demo for deterministic tests;
- an OpenAI-compatible provider adapter for real local use.

## Install And Build

Run from the repository root:

```powershell
cd E:\Desktop\GCAH
pnpm install --frozen-lockfile
pnpm build
```

Optional local verification:

```powershell
pnpm verify
pnpm demo:mechanisms
```

## Windows Release Package

Build the Windows x64 release folder locally:

```powershell
pnpm package:win
```

The generated folder is:

```text
release\gcah-windows-x64
```

The folder contains `Start GCAH.cmd`, `gcah.exe`, a bundled Node runtime, the deployed CLI app, `README-windows.txt`, and `SHA256SUMS.txt`. Compress this folder manually if you want a zip for the GitHub Release page. Double-clicking `Start GCAH.cmd` starts the interactive local agent and keeps the window open if startup fails. Users configure and check API keys inside `gcah>:` with `/credential set` and `/credential status`. The release package is for local command-line use and does not perform online deployment.

## Safe Credential Setup

Use an OpenAI-compatible provider key, such as the course platform key. The key is entered with hidden input and is not written to config files.

```powershell
node apps\cli\dist\src\bin.js credential set --provider openai-compatible
node apps\cli\dist\src\bin.js credential status --provider openai-compatible
```

Update or clear it later:

```powershell
node apps\cli\dist\src\bin.js credential update --provider openai-compatible
node apps\cli\dist\src\bin.js credential clear --provider openai-compatible
```

`status` reports whether a credential is configured, but never prints the key.

## Interactive CLI Use

Start the local interactive agent:

```powershell
node apps\cli\dist\src\bin.js local
```

At the `gcah>:` prompt, configure the local workspace, provider endpoint, model, and validation preset:

```text
/workspace E:\path\to\your-project
/base-url https://your-openai-compatible-provider.example/v1
/model DeepSeek-V3
/validation auto
```

Then type a normal coding task:

```text
阅读 README.md 和 src/calculator.ts，使用 patch 修复 calculator 模块。修改后运行验证并结束。
```

Useful REPL commands:

```text
/help
/status
/credential set
/credential status
/credential update
/credential clear
/workspace <path>
/base-url <url>
/model <name>
/validation auto
/validation none
/validation status
/events [run-id]
/clear
/exit
```

## One-Shot CLI Use

For scripts or quick tests, pass all options in one command:

```powershell
node apps\cli\dist\src\bin.js local `
  --workspace E:\path\to\your-project `
  --base-url https://your-openai-compatible-provider.example/v1 `
  --model DeepSeek-V3 `
  --validation auto `
  --task "修复失败的测试"
```

## Lower-Level Server And CLI Flow

The interactive command is recommended. If you want to inspect the local server flow directly, start the server:

```powershell
node apps\cli\dist\src\bin.js server start --mode local --llm openai-compatible --base-url <OPENAI_COMPATIBLE_BASE_URL> --model <MODEL_NAME> --data-dir .gcah
```

In another terminal:

```powershell
node apps\cli\dist\src\bin.js workspace add --path E:\path\to\project
node apps\cli\dist\src\bin.js run submit --workspace E:\path\to\project --task "修复失败的测试"
node apps\cli\dist\src\bin.js run status <run-id>
node apps\cli\dist\src\bin.js run events <run-id>
node apps\cli\dist\src\bin.js approval list <run-id>
node apps\cli\dist\src\bin.js approval approve-once <run-id> <action-id> --reason "reviewed"
```

## Workspace Requirements

The selected workspace must be a real local directory. `--validation auto` detects project-native checks such as `pnpm test`, `npm test`, `yarn test`, `python -m pytest`, `cargo test`, or `go test ./...` when matching project files are present. `--validation none` disables automatic correctness checks. GCAH canonicalizes the workspace path, applies a workspace fence, and only runs governed tool actions inside the selected workspace.

## Safety Boundaries

- API keys must be configured only through `credential set/update`; do not pass keys as command-line arguments.
- The local profile stores non-secret settings only: workspace, base URL, model, and validation preference.
- Mutating actions are governed before execution; risky actions can require approval.
- Validation orchestrates the selected project's own checks; it is not a universal proof of correctness.
- `auto` is the recommended validation profile. `none` is available for small or untested projects.
- Real LLM calls are manual local actions controlled by your own provider key.
- The local runtime database is stored in `.gcah/`; it is ignored by Git and must not be committed.

## Directory Structure

```text
apps/cli          command-line interface and local REPL
apps/server       local REST/SSE composition root
apps/webui        local web UI package
packages/core     AgentLoop and core ports
packages/llm      Mock LLM and OpenAI-compatible adapter
packages/tools    governed tool implementations
packages/governance policy, approval, budget, and safety checks
packages/persistence SQLite and in-memory repositories
packages/credentials OS credential store integration
docs/submission   final course documents
docs/course       original course requirement files
```

## Troubleshooting

- If `/validation status` reports `command: none`, no supported project-native check was detected. Use `/validation none` intentionally, or add a project test command such as `package.json` plus `test`, `pytest`, `Cargo.toml`, or `go.mod`.
- If validation says `command failed 1`, run the resolved command from `/validation status` in the target workspace, then fix the reported project error.
- If the run reports `PROTOCOL_ERROR`, the provider returned an invalid tool/finish response. Retry with a coder model or a stricter task prompt.
- If the provider reports a network error, confirm the base URL, model name, provider quota, and local network connection.
