# Spike S01 Credential Store Report

Date: 2026-07-12
Workspace: `E:/Desktop/GCAH-spike-credential`
Branch: `spike/credential-store`
Base commit: `be52022e7d341a58d0986a161b19b3f9353c8826`

## Decision

Recommendation: adopt `cross-keychain@1.1.0` as the T19 OS credential-store dependency, wrapped by a narrow GCAH `CredentialStore` adapter.

This is recommended only with an explicit adapter guard: GCAH must allow OS-backed backends and reject `file` and `null`. The upstream library supports encrypted file and null backends as fallbacks/configured backends; GCAH must not silently downgrade to either one because SPEC requires no plaintext or file fallback for API keys.

## Candidate Libraries And Versions

| Candidate | Version checked | Result |
|---|---:|---|
| `cross-keychain` | `1.1.0` | Recommended with adapter restrictions. Maintained recently, TypeScript types included, Node engine `>=18`, uses `@napi-rs/keyring` optional native package and CLI fallbacks. |
| `@napi-rs/keyring` | `1.3.0` | Viable lower-level native binding. Prefer using through `cross-keychain` unless GCAH later needs direct backend control. |
| `keytar` | `7.9.0` | Rejected as default. Last package version is from 2022; SPEC explicitly says not to make the years-old `keytar` the default. |

Sources checked:

- npm metadata via `npm view cross-keychain ...`: `cross-keychain@1.1.0`, published 2025-10-07, repository `https://github.com/magarcia/cross-keychain`.
- npm metadata via `npm view @napi-rs/keyring ...`: `@napi-rs/keyring@1.3.0`, published 2026-04-30, repository `https://github.com/Brooooooklyn/keyring-node`.
- npm metadata via `npm view keytar ...`: `keytar@7.9.0`, version date 2022-02-17, repository `https://github.com/atom/node-keytar`.
- Installed package README and `dist/index.d.ts` in `.spikes/credential-store/node_modules/cross-keychain`.

## Tested Environment

| Item | Value |
|---|---|
| OS/runtime | Windows native, `process.platform = win32`, `process.arch = x64` |
| Node.js | `v22.19.0` |
| pnpm | `11.5.0` |
| npm | `10.9.3` |
| Docker | Not available: `docker` command not found |
| Probe path | `.spikes/credential-store` |
| Sentinel | One-time generated value, never a real API key; probe output records only lengths and redacted markers |

## Probe Implementation

Created disposable probe files:

- `.spikes/credential-store/package.json`
- `.spikes/credential-store/README.md`
- `.spikes/credential-store/probe-cross-keychain.mjs`
- `.spikes/credential-store/pnpm-lock.yaml`

The probe imports `cross-keychain` and `@napi-rs/keyring`; generates a random sentinel and account name; checks status before set via `getPassword(...) === null`; runs `setPassword`, `getPassword`, update by second `setPassword`, `deletePassword`, and post-clear `getPassword`; records `diagnose()` and `listBackends()`; checks unknown backend error behavior; simulates a missing native backend import error; scans the probe directory and `cross-keychain` data/config roots for the sentinel; and performs best-effort cleanup on failure.

## Commands And Results

Initial gate:

```powershell
git rev-parse --show-toplevel
# E:/Desktop/GCAH-spike-credential

git branch --show-current
# spike/credential-store

git rev-parse HEAD
# be52022e7d341a58d0986a161b19b3f9353c8826

git status --short
# <empty>
```

Environment:

```powershell
node --version
# v22.19.0

pnpm --version
# 11.5.0

npm --version
# 10.9.3

docker --version
# command not found
```

Install and probe:

```powershell
cd .spikes/credential-store
pnpm install
# dependencies:
# + @napi-rs/keyring 1.3.0
# + cross-keychain 1.1.0

pnpm probe
# ok: true
```

Important `pnpm probe` results:

```json
{
  "platform": "win32",
  "arch": "x64",
  "operations": [
    { "step": "status-before-set", "ok": true, "returned": null },
    { "step": "set", "ok": true },
    { "step": "get-after-set", "ok": true, "matched": true, "length": 54 },
    { "step": "status-after-set", "ok": true, "returned": "<redacted>" },
    { "step": "update", "ok": true, "matched": true, "length": 62 },
    { "step": "clear", "ok": true, "deleteReturn": null, "getAfterClear": null },
    { "step": "sentinel-cleanup", "ok": true },
    { "step": "unknown-backend-error", "ok": true },
    { "step": "backend-unavailable-simulation", "ok": true }
  ],
  "backends": [
    { "id": "native-windows", "name": "Native Windows Credential Manager", "priority": 10 },
    { "id": "windows", "name": "Windows Credential Manager", "priority": 5 },
    { "id": "file", "name": "Encrypted file storage (AES-256-GCM)", "priority": 0.5 },
    { "id": "null", "name": "Null keyring", "priority": -1 }
  ],
  "diagnoseAfterSet": {
    "name": "Native Windows Credential Manager",
    "id": "native-windows",
    "priority": 10,
    "implementation": "Native DPAPI bindings",
    "fallbackAvailable": true
  },
  "plaintextMatches": [],
  "ok": true
}
```

Cleanup verification:

```powershell
cmdkey /list | Select-String -Pattern "GCAH-S01-spike"
# <empty>
```

Dependency and audit checks:

```powershell
pnpm list --depth 1
# cross-keychain@1.1.0
# @napi-rs/keyring@1.3.0
# platform optional packages include darwin, linux, win32, freebsd variants

pnpm audit --audit-level moderate
# No known vulnerabilities found
```

## Windows Credential Manager Findings

Windows native testing passed.

- `cross-keychain` selected `native-windows`.
- `diagnose()` reported `Native Windows Credential Manager` and `Native DPAPI bindings`.
- `set` stored the sentinel.
- `get` returned the exact sentinel.
- `status` can be implemented as a metadata-only GCAH check by calling `getPassword` and returning only existence/source/updated timestamp known to GCAH, never the value.
- `update` works by calling `setPassword` again for the same service/account.
- `clear` removed the item; subsequent `getPassword` returned `null`.
- `cmdkey /list` showed no remaining `GCAH-S01-spike` item after cleanup.
- No sentinel plaintext was found in the probe directory or keyring data/config roots.

## Backend Unavailable And Failure Behavior

Observed:

- `useBackend("definitely-not-a-backend")` throws with message `Backend definitely-not-a-backend is not available`.
- A simulated native import failure throws a normal `Error`.
- `cross-keychain` exports typed errors including `KeyringError`, `NoKeyringError`, `InitError`, `PasswordSetError`, `PasswordDeleteError`, and `KeyringLockedError`.
- Upstream backend selection can include `file` and `null`, and README documents automatic fallback behavior.

Required GCAH strategy:

- On startup or first credential operation, call `diagnose()` or `getKeyring().diagnose()` and validate the backend id.
- Allow only:
  - Windows: `native-windows` or `windows`
  - macOS: `native-macos` or `macos`
  - Linux desktop: `native-linux` or `secret-service`
- Reject `file`, `null`, and unknown backends with a `CredentialBackendUnavailable` error.
- Never call `disable()`.
- Never configure `TS_KEYRING_BACKEND=file`, `TS_KEYRING_BACKEND=null`, `KEYRING_PROPERTY_FILE_PATH`, or `KEYRING_FILE_MASTER_KEY`.
- Never fallback to `.env` unless the user explicitly enables the `.env` source, and keep that source visibly separate from the OS credential store.

## macOS Keychain Support

Status: only documentation verification; not tested on this machine.

`cross-keychain` package documentation and type definitions describe:

- `native-macos`: native macOS Keychain through `@napi-rs/keyring` and Security.framework bindings.
- `macos`: CLI fallback using the `security` command.
- Explicit account parameter is required for native macOS backend.
- Optional darwin native packages exist in the lockfile:
  - `@napi-rs/keyring-darwin-arm64@1.3.0`
  - `@napi-rs/keyring-darwin-x64@1.3.0`

Risk:

- CLI fallback can place secrets at a process-boundary risk described by upstream documentation. Prefer `native-macos`; accept `macos` only if the project decides the fallback is acceptable for local development.

## Linux Secret Service Support

Status: only documentation verification; not tested on this machine and Docker is unavailable.

`cross-keychain` package documentation and type definitions describe:

- `native-linux`: native Freedesktop Secret Service through `@napi-rs/keyring`.
- `secret-service`: CLI fallback using `secret-tool`.
- Secret Service requires a working desktop keyring/session such as GNOME Keyring or KWallet.
- Optional Linux packages exist in the lockfile for glibc and musl on multiple architectures, including:
  - `@napi-rs/keyring-linux-x64-gnu@1.3.0`
  - `@napi-rs/keyring-linux-x64-musl@1.3.0`
  - `@napi-rs/keyring-linux-arm64-gnu@1.3.0`
  - `@napi-rs/keyring-linux-arm64-musl@1.3.0`

Risk:

- Linux server containers usually lack a user Secret Service session and D-Bus keyring. GCAH should treat this as backend unavailable and require explicit environment/CI secret source configuration if needed.

## Docker Behavior

Docker was not available on this Windows machine, so no container run was performed.

Expected behavior based on package docs and Linux platform requirements:

- A plain Linux `amd64` container is unlikely to have Secret Service/D-Bus/keyring unlocked by default.
- The adapter must return explicit backend-unavailable status in Docker when no OS-backed credential store is available.
- It must not auto-create file backend secrets inside `/root/.local/share/keyring`, `/home/node/.local/share/keyring`, the workspace, or `/data`.
- Public demo mode must not accept user API keys.

## Native Modules, Install Scripts, And Packaging

- `cross-keychain@1.1.0` has Node engine `>=18`.
- It depends on `@inquirer/prompts` and `meow`; it declares `@napi-rs/keyring` as an optional dependency.
- `@napi-rs/keyring@1.3.0` has prebuilt optional packages for Windows, macOS, Linux glibc/musl, FreeBSD, and several CPU architectures.
- The installed package did not require a local Rust/native compile during this Windows probe.
- pnpm installed optional native packages into the lockfile; production packaging must keep optional dependencies available for target platforms.
- For bundled/server packaging, avoid tree-shaking away optional native packages.
- For CI/container installs, use `pnpm install --frozen-lockfile`; if pnpm build-script allowlisting is used later, include only required native/build packages explicitly.

## Recommended T19 Adapter Boundary

Recommended public interface:

```ts
type CredentialProvider = "openai-compatible";

type CredentialStatus =
  | { available: true; provider: CredentialProvider; source: "os"; backend: string; updatedAt: string | null }
  | { available: false; provider: CredentialProvider; source: "os"; reason: "missing" | "backend-unavailable" };

interface CredentialStore {
  status(provider: CredentialProvider): Promise<CredentialStatus>;
  set(provider: CredentialProvider, secret: string): Promise<void>;
  update(provider: CredentialProvider, secret: string): Promise<void>;
  clear(provider: CredentialProvider): Promise<void>;
  withCredential<T>(provider: CredentialProvider, callback: (secret: string) => Promise<T>): Promise<T>;
}
```

Adapter rules:

- Use a deterministic service name such as `gcah.llm` and account name per provider.
- Validate backend before every operation or cache validation only after a successful `diagnose()`.
- Map `getPassword(...) === null` to missing status.
- Implement `set` and `update` with `setPassword`.
- Implement `clear` with `deletePassword`; treat missing delete as idempotent success for CLI ergonomics only if no secret is returned or logged.
- Expose plaintext only inside `withCredential` callback.
- Do not return plaintext from `status`.
- Do not store plaintext in config, events, SQLite, logs, errors, or browser state.
- Sanitize error messages before showing them to CLI/WebUI.

## Known Platform Limits

- Windows: `getCredential(service)` without explicit account is not supported by the native backend; GCAH should always use explicit account.
- macOS: only documentation verification here; native and CLI backends require real macOS validation before claiming support.
- Linux desktop: only documentation verification here; Secret Service depends on desktop session and keyring availability.
- Linux Docker/headless: expected unavailable unless a Secret Service session is deliberately provided.
- Automatic file/null backend fallback is incompatible with GCAH's default OS credential-store requirement.
- JavaScript cannot guarantee secret memory zeroization; the enforceable guarantee is callback scoping, no persistence, no serialization, and minimized copies.

## Explicit Failure Strategy

GCAH should fail closed:

- Missing credential: return status `available: false, reason: "missing"` and guide hidden CLI input.
- Unsupported backend id: throw/report `CredentialBackendUnavailable`.
- `file` or `null` backend selected: throw/report `CredentialBackendUnavailable` and include a safe message explaining that OS credential storage is unavailable.
- Backend locked/unavailable/native error: throw/report `CredentialBackendUnavailable` or `CredentialBackendLocked` if the upstream error is clearly lock-related.
- Never fallback from OS store to file storage.
- Never write a plaintext credential file.
- Never include the secret or sentinel in serialized error details.

## Unverified Items

- macOS Keychain lifecycle behavior: only documentation verification.
- Linux Secret Service lifecycle behavior: only documentation verification.
- Linux `amd64` Docker runtime behavior: Docker unavailable locally.
- Windows fallback PowerShell backend behavior when native `@napi-rs/keyring` is absent: not fully exercised; only native Windows was actually used.
- GUI inspection of Windows Credential Manager: not performed; command-line cleanup check via `cmdkey /list` was performed.
