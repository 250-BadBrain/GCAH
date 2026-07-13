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

## 2026-07-13 - S02

- Scope: Cloudflare-only hosting feasibility spike for public demo deployment.
- Agent: OpenAI Codex
- Branch/worktree: `spike/hosting` at `E:/Desktop/GCAH-spike-hosting`
- Base commit: `c90233373a6937af164017b636aae2b1c590a7d6`
- Evidence:
  - `.spikes/hosting/README.md`
  - `.spikes/hosting/worker-sse-shape.ts`
  - `.spikes/hosting/cloudflare-topology-notes.md`
  - `docs/spikes/hosting.md`
- Commands:
  - `git rev-parse --show-toplevel`
  - `git branch --show-current`
  - `git rev-parse HEAD`
  - `git status --short`
  - `rg -n "S02|hosting|Cloudflare|Docker|OCI|public demo|Pages|Workers|SQLite|SSE|T26|T27" PLAN.md SPEC.md`
- Result:
  - React + Vite frontend is feasible on Cloudflare Pages.
  - Backend is feasible on Cloudflare Workers if implemented as a Fetch API Worker composition root.
  - Current Fastify + SQLite + Linux OCI public deployment assumption does not map directly to Cloudflare production.
  - SSE is feasible with Web Streams plus persisted cursor replay.
  - Cloudflare production needs D1 repositories and likely Durable Objects for coordination/live fan-out; local SQLite remains for local/Docker/self-hosted.
- Blocked external operations:
  - No Cloudflare deployment was attempted because login, account authorization, token creation, and possible DNS/domain operations require human confirmation.
- Decision:
  - Recommend Cloudflare Pages + Workers as the public demo topology, with D1 primary persistence, Durable Objects for coordination where needed, KV/R2 for narrower supporting roles.
  - Docker should remain for local development, tests, course distribution, and self-hosted fallback, not Cloudflare production deployment.
  - SPEC.md and PLAN.md should be revised before formal implementation proceeds.

## 2026-07-13 - Spike 结论回写

- Scope: write S01/S02 findings into architecture and implementation planning documents only; no T01–T27 implementation started.
- Files changed: `SPEC.md`, `PLAN.md`, `SPEC_PROCESS.md`, `AGENT_LOG.md` only.
- Credential decision:
  - Formal implementation uses `cross-keychain`, with the actual version locked by `pnpm-lock.yaml`.
  - `CredentialStore` validates the current backend, accepts only platform OS-store backend IDs, and rejects `file`, `null`, unknown, and unavailable backends without fallback.
  - Windows `native-windows` is the only runtime-tested credential backend; macOS, Linux, and Docker remain untested.
- Cloudflare decision:
  - Public production target is React + Vite on Pages, API/SSE on Workers, and relational persistence in D1, with optional Durable Objects for coordination/fan-out.
  - Fastify + SQLite and Docker remain a separate local/test/course/self-hosted path.
  - Core depends only on repository/service ports; KV/R2 cannot replace relational run/audit/event repositories.
- Plan decision:
  - Added Worker HTTP/SSE composition, D1 adapter/migration and SQLite/D1 contract parity, optional Durable Object coordination, Pages/Workers/Wrangler configuration, cursor replay, and public-demo API-key absence tests.
  - Split T26 Docker delivery from T27 Cloudflare delivery and retained Cloudflare login, tokens, deployment, custom domain, DNS, and HTTPS as manual human-authorized steps.
- External operations: no Cloudflare login, authorization, token creation, deployment, domain binding, DNS, or HTTPS operation was performed; S02 is not recorded as a real remote deployment.
- Spike artifacts: disposable spike code was deleted; original reports were not modified.
- Commit: none; awaiting human review.

## 2026-07-13 - PR-01 Approval

- Approval time: 2026-07-13 14:11:39 +08:00.
- Human decision:
  - Formal execution is approved for PR-01 `foundation-contracts` only.
  - Approved task scope is limited to PLAN PR-01: T01-T02 and their child tasks.
  - Later PR groups are not authorized by this approval.
- Branch/worktree:
  - Branch: `feat/foundation-contracts`
  - Worktree: `E:/Desktop/GCAH-foundation-contracts`
  - Baseline commit: `390c8da738431401086ea2205aada8cde3ab777d`
- Implementation status: not started by this approval-record update.
- Commit: none; awaiting human commit.

## 2026-07-13 - T01a

- Scope: PR-01 `foundation-contracts`, T01a minimal non-product workspace/test runner.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/foundation-contracts` at `E:/Desktop/GCAH-foundation-contracts`.
- Baseline commit: `f86c08d8570b7d048d6202dd8706f4c975a78e38`.
- Files added:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `pnpm-lock.yaml`
  - `.npmrc`
  - `vitest.workspace.ts`
  - `packages/shared/package.json`
- Red/green/refactor evidence:
  - T01a has no product red phase by plan; it is prerequisite scaffolding.
  - `pnpm install` generated the lockfile.
  - Initial pnpm warning showed `pnpm.onlyBuiltDependencies` in `package.json` is ignored by pnpm 11.
  - Moved the explicit empty build-script allowlist to `pnpm-workspace.yaml`.
  - `pnpm install --frozen-lockfile` exited 0.
  - `pnpm --filter @gcah/shared test -- --passWithNoTests` exited 0 with no test files found.
  - `rg -n "workspaceReady" .` found no source or test implementation, only existing planning/evidence text.
- External operations: npm metadata was checked for package versions; no real LLM, Cloudflare, credential, deployment, or secret operation was performed.
- Commit: `91ac7ea` (`chore: bootstrap shared test runner`).

## 2026-07-13 - T01b

- Scope: PR-01 `foundation-contracts`, T01b behavioral workspace smoke export and quality configuration.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/foundation-contracts` at `E:/Desktop/GCAH-foundation-contracts`.
- Baseline commit: `2e6f01ae3588f2204ddabb2aa49644d206349d98`.
- Files added/modified:
  - `packages/shared/src/index.ts`
  - `packages/shared/test/smoke.test.ts`
  - `packages/shared/tsconfig.json`
  - `tsconfig.base.json`
  - `tsconfig.json`
  - `eslint.config.js`
  - `package.json`
  - `pnpm-lock.yaml`
  - `PLAN.md`
  - `AGENT_LOG.md`
- Red evidence:
  - With `packages/shared/src/index.ts` as an empty module, `pnpm --filter @gcah/shared test` exited 1 because `workspaceReady` was absent and the assertion received `undefined`.
- Green evidence:
  - Added only `export const workspaceReady = true as const;`.
  - `pnpm --filter @gcah/shared test` exited 0.
- Refactor/verification evidence:
  - Added strict TypeScript, ESLint, package tsconfig, and root `lint`, `typecheck`, and `verify` scripts.
  - `pnpm peers check` first rejected `typescript@7.0.2` for `typescript-eslint@8.63.0`; changed to compatible `typescript@6.0.3`.
  - Prevented typecheck output from creating test artifacts by using `tsc --noEmit -p packages/shared/tsconfig.json --pretty false`.
  - `pnpm lint` exited 0.
  - `pnpm typecheck` exited 0.
  - `pnpm --filter @gcah/shared test` exited 0 with 1 test file and 1 test.
  - `pnpm verify` exited 0.
  - `pnpm install --frozen-lockfile` exited 0.
- External operations: npm metadata was checked for TypeScript/ESLint package versions; no real LLM, Cloudflare, credential, deployment, or secret operation was performed.
- Commit: `3f6b2c8` (`chore: add shared smoke quality checks`).
