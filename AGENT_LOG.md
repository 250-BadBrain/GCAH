## 2026-07-09 — SPEC-001

- Superpowers skill: brainstorming
- Agent: OpenAI Codex
- Goal: define GCAH product boundary and architecture
- Context:
  - docs/course/AI4SE_Final_Project_通用要求.md
  - docs/course/AI4SE_Final_Project_A_Coding_Agent_Harness.md
- Key decisions:
  - TypeScript / Node.js / React
  - governance-driven feedback loop as main contribution
  - Mock LLM for default tests
  - public demo restricted to fixed workspace and Mock LLM
- Human intervention:
  - clarified LocalExecutor is not an OS sandbox
  - added FinishAction protocol
  - restricted memory writes and interrupted-run recovery
- Result:
  - SPEC.md completed and reviewed
- Commit: <你的 commit hash>
- Lesson:
  - deterministic boundaries must be stated precisely enough to become tests

## 2026-07-12 — CS-001

- Scope: Gate CS cold-start validation, attempt 1
- Agent: DeepSeek V4 Flash
- Evidence:
  - `docs/evidence/cold-start/2026-07-12-attempt-1-invalid-main-worktree.md`
  - `docs/evidence/cold-start/2026-07-12-attempt-1-main-status.txt`
- Result:
  - Invalid. The attempt wrote implementation artifacts into the main worktree instead of a disposable worktree.
- Human intervention:
  - Identified untracked implementation files in the main worktree status.
  - Rejected the attempt as cold-start evidence.
  - Ensured the cold-start code was not merged, copied, cherry-picked, or reused.
- Decision:
  - Gate CS evidence must come only from a disposable worktree. Cold-start implementation artifacts are always discarded.

## 2026-07-12 — CS-002

- Scope: Gate CS cold-start validation, attempt 2
- Agent: DeepSeek V4 Flash
- Base commit: `3b04048a3bf95a05e1d9c2ac975fab75fa42566d`
- Branch/worktree: `cold-start/spec-validation` at `E:/Desktop/GCAH-cold-start`
- Duration: about 7 minutes within the 2-hour timebox
- Evidence:
  - `docs/evidence/cold-start/attempt-2-valid-report.md`
  - `docs/evidence/cold-start/attempt-2-verify-output.txt`
  - `docs/evidence/cold-start/attempt-2-status.txt`
  - `docs/evidence/cold-start/attempt-2-environment.txt`
- Result:
  - Valid disposable-worktree cold-start. T01a, T01b, T02a, T02b, and T02c were attempted and reported complete.
  - `pnpm verify` passed with 7 test files and 47 tests.
- Findings:
  - SPEC needed explicit `Step.status`, Zod 4 version expectations, supported tool-name enum handling, rationale as untrusted plain text, and required/optional/nullable entity constraints.
  - PLAN needed Gate CS precedence over formal closeout steps, a no-commit/no-doc-update rule during cold-start, sharper T01a/T01b boundaries, pnpm build-script allowlisting, T02 parent acceptance audit, and schema ownership for `ToolRequestSchema`, `ToolResultSchema`, and complete entities.
  - The cold-start agent made assumptions after encountering ambiguity instead of strictly pausing, so the pause-on-ambiguity rule remains mandatory.
- Decision:
  - Cold-start code was fully discarded and is not part of formal implementation.

## 2026-07-12 - S01

- Scope: Credential-store backend spike for Windows native validation and cross-platform assessment.
- Agent: OpenAI Codex
- Branch/worktree: `spike/credential-store` at `E:/Desktop/GCAH-spike-credential`
- Base commit: `be52022e7d341a58d0986a161b19b3f9353c8826`
- Evidence:
  - `.spikes/credential-store/README.md`
  - `.spikes/credential-store/package.json`
  - `.spikes/credential-store/probe-cross-keychain.mjs`
  - `.spikes/credential-store/pnpm-lock.yaml`
  - `docs/spikes/credential-store.md`
- Commands:
  - `pnpm install`
  - `pnpm probe`
  - `cmdkey /list | Select-String -Pattern "GCAH-S01-spike"`
  - `pnpm list --depth 1`
  - `pnpm audit --audit-level moderate`
- Result:
  - Windows native probe passed for set, get, status-by-presence, update, clear, and sentinel cleanup.
  - `cross-keychain` selected `native-windows` with Native DPAPI bindings.
  - Probe found no sentinel plaintext in the disposable probe directory or keyring data/config roots.
  - `cmdkey /list` showed no remaining `GCAH-S01-spike` item after cleanup.
  - Docker was unavailable on this host; macOS Keychain and Linux Secret Service are documented as only documentation verification.
- Decision:
  - Recommend `cross-keychain@1.1.0` for T19, wrapped by a GCAH adapter that explicitly allows only OS-backed backends and rejects `file`, `null`, and unknown backends.
  - Do not begin formal CredentialStore implementation in S01.
