# GCAH

## Verification

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm demo:mechanisms
pnpm build
```

## Browser Demo

```powershell
pnpm demo:web
```

Open `http://127.0.0.1:4173` after the command prints the local address. The demo is mock-only and uses fixed public-demo scenarios; it does not accept API keys, arbitrary workspaces, shell commands, dependency installation, uploads, or external network access.

## Local Production Mode With An OpenAI-Compatible Provider

Build first:

```powershell
pnpm install --frozen-lockfile
pnpm build
```

Store the provider key in the OS credential store. The prompt hides input and `status` never prints the key:

```powershell
node apps/cli/dist/src/bin.js credential set --provider openai-compatible
node apps/cli/dist/src/bin.js credential status --provider openai-compatible
node apps/cli/dist/src/bin.js credential update --provider openai-compatible
node apps/cli/dist/src/bin.js credential clear --provider openai-compatible
```

Start the local production server from the workspace root you intend to allow, or pass a controlled data directory:

```powershell
node apps/cli/dist/src/bin.js server start --mode local --llm openai-compatible --base-url <OPENAI_COMPATIBLE_BASE_URL> --model <MODEL_NAME> --data-dir .gcah
```

In another terminal, register the workspace and submit a task:

```powershell
node apps/cli/dist/src/bin.js workspace add --path E:\path\to\project
node apps/cli/dist/src/bin.js run submit --workspace E:\path\to\project --task "修复失败的测试"
node apps/cli/dist/src/bin.js run status <run-id>
node apps/cli/dist/src/bin.js run events <run-id>
node apps/cli/dist/src/bin.js approval list <run-id>
node apps/cli/dist/src/bin.js approval approve-once <run-id> <action-id> --reason "reviewed"
```

The API key is only exposed inside `CredentialStore -> CredentialResolver -> OpenAiCompatibleLlmClient` while constructing the provider request. It must not be placed in config files, command-line arguments, workspace files, SQLite, events, logs, REST responses, SSE, or browser state. The default credential source is the OS credential store; plaintext environment or `.env` fallback is not enabled by the local production composition.

Known limits: real LLM smoke tests are manual because they can call paid external services. CI uses a local fake OpenAI-compatible endpoint and sentinel credentials instead.

Cloudflare login, Wrangler login, DNS, HTTPS, remote migrations, remote pushes, releases, and real credentials are not automated.
