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

## 2026-07-13 - T02a

- Scope: PR-01 `foundation-contracts`, T02a status, StopReason, and entity schemas.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/foundation-contracts` at `E:/Desktop/GCAH-foundation-contracts`.
- Baseline commit: `7705b3a5b4ba1fbaf0cb32e6fd39bc78de4f6c01`.
- Files added/modified:
  - `packages/shared/src/status.ts`
  - `packages/shared/src/entities.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/test/status.test.ts`
  - `packages/shared/test/entities.test.ts`
  - `package.json`
  - `pnpm-lock.yaml`
  - `PLAN.md`
  - `AGENT_LOG.md`
- Red evidence:
  - `pnpm --filter @gcah/shared test -- status entities` exited 1 because `../src/status.js` and `../src/entities.js` did not exist.
- Green evidence:
  - Added Zod 4 schemas for SPEC status enums, stop mappings, budget usage/detail, and persisted entity contracts.
  - Added no-secret-field assertions across exported entity schemas.
  - `pnpm --filter @gcah/shared test -- status entities` exited 0 with 2 files and 4 tests.
- Refactor/verification evidence:
  - Added `zod@4.4.3` as a locked runtime dependency.
  - `pnpm --filter @gcah/shared test` exited 0 with 3 files and 5 tests.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm verify` exited 0.
  - `pnpm install --frozen-lockfile` exited 0.
  - `git diff --check` exited 0.
- External operations: npm metadata was checked for Zod version; no real LLM, Cloudflare, credential, deployment, or secret operation was performed.
- Commit: `fe9553a` (`feat: add shared entity status schemas`).

## 2026-07-13 - T02b

- Scope: PR-01 `foundation-contracts`, T02b AgentResponse and tool argument schemas.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/foundation-contracts` at `E:/Desktop/GCAH-foundation-contracts`.
- Baseline commit: `536381bc0e0adf6d34614e7113b56ed791cedf07`.
- Files added/modified:
  - `packages/shared/src/agent-response.ts`
  - `packages/shared/src/tool-contracts.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/test/agent-response.test.ts`
  - `packages/shared/test/tool-contracts.test.ts`
  - `PLAN.md`
  - `AGENT_LOG.md`
- Red evidence:
  - `pnpm --filter @gcah/shared test -- agent-response tool-contracts` exited 1 because `../src/agent-response.js` and `../src/tool-contracts.js` did not exist.
- Green evidence:
  - Added strict `ToolAction | FinishAction` parsing, supported tool enum, per-tool argument schemas, structured command args, `ToolRequestSchema`, and tool result export.
  - `pnpm --filter @gcah/shared test -- agent-response tool-contracts` exited 0 with 2 files and 6 tests.
- Refactor/verification evidence:
  - `pnpm --filter @gcah/shared test` exited 0 with 5 files and 11 tests.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm verify` exited 0.
  - `pnpm install --frozen-lockfile` exited 0.
  - `git diff --check` exited 0.
- External operations: none beyond local test/typecheck/lint/install verification; no real LLM, Cloudflare, credential, deployment, or secret operation was performed.
- Commit: `7397339` (`feat: add agent response tool contracts`).

## 2026-07-13 - T02c

- Scope: PR-01 `foundation-contracts`, T02c safe display, event, and API schemas.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/foundation-contracts` at `E:/Desktop/GCAH-foundation-contracts`.
- Baseline commit: `0356158090870ee2a0fc36165f6dfc3bf1f4e625`.
- Files added/modified:
  - `packages/shared/src/safe-display.ts`
  - `packages/shared/src/events.ts`
  - `packages/shared/src/api-contracts.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/test/safe-display.test.ts`
  - `packages/shared/test/events.test.ts`
  - `packages/shared/test/api-contracts.test.ts`
  - `PLAN.md`
  - `AGENT_LOG.md`
- Red evidence:
  - `pnpm --filter @gcah/shared test -- safe-display events api-contracts` exited 1 because the three target modules did not exist.
- Green evidence:
  - Added deterministic rationale escaping/redaction/truncation.
  - Added event cursor parsing and event schema export.
  - Added strict run, approval, event-response API DTO schemas that reject unknown secret-shaped fields.
  - `pnpm --filter @gcah/shared test -- safe-display events api-contracts` exited 0 with 3 files and 4 tests.
- Refactor/verification evidence:
  - `pnpm --filter @gcah/shared test` exited 0 with 8 files and 15 tests.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm verify` exited 0.
  - `pnpm install --frozen-lockfile` exited 0.
  - `git diff --check` exited 0.
- External operations: none beyond local verification; no real LLM, Cloudflare, credential, deployment, or secret operation was performed.
- Commit: `5107713` (`feat: add shared display api event contracts`).

## 2026-07-13 - PR-01 Build Script Acceptance

- Scope: PR-01 `foundation-contracts` build verification gap.
- Agent: OpenAI Codex.
- Red evidence:
  - `pnpm build` exited 1 because no `build` script existed.
- Green evidence:
  - Added root `build` script and `packages/shared/tsconfig.build.json` for declaration-only shared package output.
  - `pnpm build` exited 0.
  - `pnpm verify` exited 0.
- Generated output: removed `packages/shared/dist` after validation; it remains ignored build output.
- Commit: `5440937` (`chore: add shared build script`).

## 2026-07-13 - PR-01 Review Fixes

- Scope: PR-01 independent review findings for T02 schemas.
- Agent: OpenAI Codex.
- Reviewers:
  - Spec compliance reviewer: `019f5a58-7724-71d0-8b69-825ff049bd22`.
  - Code quality/security reviewer: `019f5a58-b090-7311-96dc-639d67b40227`.
- Findings addressed:
  - `BudgetStopDetailSchema` now uses SPEC fields `kind`, `limit`, `used`, `remaining`, and `observedAtStep`.
  - `RunSchema` now rejects terminal status/stopReason mismatches and requires `BudgetStopDetail` for `BUDGET_EXHAUSTED`.
  - Persisted `ActionSchema` now uses `displayRationale` instead of raw `rationale`.
  - `AgentResponseSchema` now validates `args` according to the selected supported tool.
  - `ToolResultSchema` now enforces bounded stdout/stderr and rejects obvious unredacted `sk-` sentinels.
- Regression evidence:
  - Added focused failing tests before implementation; `pnpm --filter @gcah/shared test -- entities agent-response tool-contracts` exited 1 with the expected review issues.
  - After fixes, `pnpm --filter @gcah/shared test -- entities agent-response tool-contracts` exited 0.
  - `pnpm verify` exited 0 with 8 files and 18 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed `packages/shared/dist` after build validation.
- Commit: `d20a88c` (`fix: harden shared contracts after review`).

## 2026-07-13 - PR-01 Re-review Fixes

- Scope: PR-01 second quality/security review findings.
- Agent: OpenAI Codex.
- Reviewer:
  - Code quality/security re-reviewer: `019f5a62-6051-7870-bf91-545f267f4fd3`.
- Findings addressed:
  - `ActionSchema` now enforces the `tool` vs `finish` discriminator shape: supported tool name and null finish summary for tool actions; null tool name, non-empty finish summary, and empty args for finish actions.
  - `ToolResultSchema` now rejects additional obvious output leakage patterns including `api_key=`, `Authorization: Bearer`, Windows user-home paths, and POSIX `/home/` paths.
- Regression evidence:
  - Added focused failing tests before implementation; `pnpm --filter @gcah/shared test -- entities` exited 1 for the expected action-shape and leakage gaps.
  - After fixes, `pnpm --filter @gcah/shared test -- entities` exited 0.
  - `pnpm verify` exited 0 with 8 files and 19 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed `packages/shared/dist` after build validation.
- Commit: `9f010eb` (`fix: enforce persisted action and output safety`).

## 2026-07-13 - PR-01 Final Review Fixes

- Scope: PR-01 final independent review findings.
- Agent: OpenAI Codex.
- Reviewers:
  - Spec compliance final reviewer: `019f5a6e-10c0-7c22-ae1c-6dd4a921d3f8`.
  - Code quality/security final reviewer: `019f5a6e-4b4f-7c81-ae35-c7017e1ec636`.
- Findings addressed:
  - Persisted `ActionSchema` now validates tool `args` according to the selected `toolName`, matching the strict tool parameter schemas.
  - `SessionGrantSchema.toolName` now uses the supported tool enum instead of an arbitrary string.
- Regression evidence:
  - Added focused failing tests before implementation; `pnpm --filter @gcah/shared test -- entities` exited 1 for invalid persisted tool args and unknown grant tools.
  - After fixes, `pnpm --filter @gcah/shared test -- entities` exited 0.
  - `pnpm verify` exited 0 with 8 files and 20 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed `packages/shared/dist` after build validation.
- Commit: `b9c5fb7` (`fix: require strict persisted action args`).

## 2026-07-13 - PR-01 Summary Leakage Review Fix

- Scope: PR-01 final quality/security review finding for persisted/display summary leakage.
- Agent: OpenAI Codex.
- Reviewer:
  - Code quality/security final reviewer: `019f5a9f-2545-7bc0-b91b-14482aacb328`.
- Finding addressed:
  - Persisted and API display summary fields now reject obvious credential/path leakage patterns, matching the existing stdout/stderr safety boundary.
  - Covered fields include `ToolResultSchema.sideEffectSummary`, `ValidationResultSchema.diagnosticSummary`, persisted event/memory/feedback summaries, and `EventDtoSchema.summary`.
- Regression evidence:
  - Added focused failing tests before implementation; `pnpm --filter @gcah/shared test -- entities api-contracts` exited 1 for summary leakage.
  - After fixes, `pnpm --filter @gcah/shared test -- entities api-contracts` exited 0.
  - `pnpm verify` exited 0 with 8 files and 20 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed `packages/shared/dist` after build validation.
- Commit: `a172b3a` (`fix: reject summary leakage in shared schemas`).

## 2026-07-13 - PR-01 Final Scoped Review Pass

- Scope: final scoped verification of the persisted/display summary leakage High finding.
- Reviewers:
  - Spec compliance scoped verifier: `019f5ab3-38ae-7340-bea2-e8c6a6e0a5b2` (`PASS`).
  - Code quality/security scoped verifier: `019f5ab3-70ee-7112-836a-b587b44adbc7` (`PASS`).
- Verified surfaces:
  - `ToolResultSchema.sideEffectSummary`
  - `ValidationResultSchema.diagnosticSummary`
  - `FeedbackSchema.summary`
  - `MemoryEntrySchema.summary`
  - `RunEventSchema.summary`
  - `EventDtoSchema.summary`
- Verification:
  - Both reviewers directly inspected code/tests and confirmed the prior High finding is resolved.
  - No reviewer edits were performed.
- Commit: `aae97da` (`docs: record PR-01 final review pass`).

## 2026-07-13 - Rolling Authorization PR-02 through PR-10

- Approval time: 2026-07-13 17:16:10 +08:00.
- Human decision:
  - PR-01 `foundation-contracts` is complete and merged.
  - Continuous rolling execution is approved for PR-02 through PR-10.
  - Approved task scope is PLAN T03 through T27.
  - Each PR must still be independently implemented, tested, reviewed, merged, and cleaned up.
  - After one PR completes successfully, the next PR may start automatically without a separate per-PR approval.
  - External deployment, real credentials, remote push/release, Cloudflare login/resources, DNS/domain/HTTPS changes, paid operations, and other explicitly restricted external actions remain outside this authorization.
  - Mandatory pause conditions still apply.
- Current continuation point: PR-02 `core-domain`.
- Main baseline: `b21607aea7310b961f427a727fd2f97faa2c02f6`.
- Commit: `adc7ad3` (`feat: add core port contracts`).

## 2026-07-13 - T03b

- Scope: PR-02 `core-domain`, T03b deterministic in-memory repositories.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/core-domain` at `E:/Desktop/GCAH-core-domain`.
- Baseline commit: `07b95d6`.
- Red evidence:
  - `pnpm --filter @gcah/persistence test` exited 1 because `packages/persistence/src/index.ts` did not exist.
- Green evidence:
  - Added `@gcah/persistence` package and `createInMemoryRepositories(clock)`.
  - Enforced one active run per workspace and monotonic per-run event cursors.
  - Added clone-safe run/config/memory/event storage and `UnitOfWork` facade.
  - `pnpm --filter @gcah/persistence test` exited 0.
- Refactor/verification evidence:
  - Added core package exports for workspace type resolution.
  - Included persistence in root typecheck/build scripts.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm verify` exited 0 with 10 files and 23 tests.
  - `pnpm build` exited 0.
  - `pnpm install --frozen-lockfile` exited 0.
  - `git diff --check` exited 0.
- Commit: `de920fe` (`feat: add in-memory repositories`).

## 2026-07-13 - T03a

- Scope: PR-02 `core-domain`, T03a core repository, UnitOfWork, and clock ports.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/core-domain` at `E:/Desktop/GCAH-core-domain`.
- Baseline commit: `ed20681`.
- Red evidence:
  - `pnpm --filter @gcah/core test -- ports` exited 1 because `packages/core/src/index.ts` did not exist.
- Green evidence:
  - Added `@gcah/core` package, port interfaces for repositories, clock, tool gateway, validation runner, workspace fence, and LLM client.
  - Added `SystemClock`.
  - `pnpm --filter @gcah/core test -- ports` exited 0.
- Refactor/verification evidence:
  - Added core tsconfig/build config and included core in root build/typecheck scripts.
  - Added shared package exports for workspace type resolution.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm verify` exited 0 with 9 files and 21 tests.
  - `pnpm build` exited 0.
  - `pnpm install --frozen-lockfile` exited 0.
  - `git diff --check` exited 0.
- Commit: pending follow-up hash record.
