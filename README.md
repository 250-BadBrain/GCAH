# GCAH

GCAH is a local command-line Coding Agent Harness. It runs on your machine, uses a local workspace that you explicitly select, stores API keys in the operating-system credential store, and drives the self-implemented AgentLoop through the CLI.

## 1. Install And Build

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

Build a Windows x64 release package for GitHub Releases:

```powershell
pnpm package:win
```

The generated asset is:

```text
release\gcah-windows-x64.zip
```

Upload that zip file to the GitHub Release page. The zip contains `gcah.exe`, a bundled Node runtime, the deployed CLI app, a Windows README, and SHA-256 checksums. Double-clicking `gcah.exe` starts the interactive local agent. Users configure and check API keys inside `gcah>:` with `/credential set` and `/credential status`.

## 2. Store Your API Key Safely

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

## 3. Start The Interactive Agent

```powershell
node apps\cli\dist\src\bin.js local
```

At the `gcah>:` prompt, configure the local workspace, model endpoint, model, and validation preset:

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

## 4. One-Shot CLI Mode

For scripts or quick tests, pass all options in one command:

```powershell
node apps\cli\dist\src\bin.js local `
  --workspace E:\path\to\your-project `
  --base-url https://your-openai-compatible-provider.example/v1 `
  --model DeepSeek-V3 `
  --validation auto `
  --task "修复失败的测试"
```

## 5. Workspace Requirements

The selected workspace must be a real local directory. `--validation auto` detects project-native checks such as `pnpm test`, `npm test`, `yarn test`, `python -m pytest`, `cargo test`, or `go test ./...` when matching project files are present. `--validation none` disables automatic correctness checks. GCAH canonicalizes the workspace path, applies a workspace fence, and only runs governed tool actions inside the selected workspace.

## 6. Safety Boundaries

- API keys must be configured only through `credential set/update`; do not pass keys as command-line arguments.
- The local profile stores non-secret settings only: workspace, base URL, model, and validation preference.
- Mutating actions are governed before execution; risky actions can require approval.
- Validation orchestrates the selected project's own checks; it is not a universal proof of correctness.
- `auto` is the recommended validation profile. `none` is available for small or untested projects.
- Real LLM calls are manual local actions controlled by your own provider key.

## 7. Submission Documents

Submission documents are collected under [`docs/submission/`](docs/submission/):

- [`README.md`](docs/submission/README.md)
- [`SPEC.md`](docs/submission/SPEC.md)
- [`PLAN.md`](docs/submission/PLAN.md)
- [`SPEC_PROCESS.md`](docs/submission/SPEC_PROCESS.md)
- [`AGENT_LOG.md`](docs/submission/AGENT_LOG.md)
- [`REFLECTION.md`](docs/submission/REFLECTION.md)
- [`DELIVERABLES.md`](docs/submission/DELIVERABLES.md)
