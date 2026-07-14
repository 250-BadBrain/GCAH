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

## 2026-07-13 - T04

- Scope: PR-02 `core-domain`, T04 run/action state machines and interruption policy.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/core-domain` at `E:/Desktop/GCAH-core-domain`.
- Baseline commit: `144386c`.
- Red evidence:
  - `pnpm --filter @gcah/core test -- run-machine action-machine` exited 1 because state transition functions were not implemented.
- Green evidence:
  - Added `transitionRun`, `transitionAction`, `interruptRun`, `cloneInterruptedRunAsPending`, and `TransitionError`.
  - Added deterministic tests for terminal reason mapping, idempotent transition IDs, illegal transitions, and clone-only interruption.
  - Focused core tests exited 0.
- Refactor/verification evidence:
  - `pnpm verify` exited 0 with 12 files and 26 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `415782b` (`feat: add core state machines`).

## 2026-07-13 - T06

- Scope: PR-02 `core-domain`, T06 budgets, usage accounting, and deterministic stop details.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/core-domain` at `E:/Desktop/GCAH-core-domain`.
- Baseline commit: `116a67c`.
- Red evidence:
  - `pnpm --filter @gcah/core test -- budget failure-window` exited 1 because `BudgetTracker` and `FailureWindow` were not implemented.
- Green evidence:
  - Added `BudgetTracker`, `FailureWindow`, and `ProtocolRetries`.
  - Covered round, token, elapsed-time, repeated-failure, protocol-retry, and missing-usage behavior.
  - Focused core tests exited 0.
- Refactor/verification evidence:
  - `pnpm verify` exited 0 with 14 files and 30 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `7e7b98e` (`feat: add budget tracking`).

## 2026-07-13 - PR-02 Review Fixes

- Scope: PR-02 independent review findings for T03, T04, and T06.
- Agent: OpenAI Codex.
- Reviewers:
  - Spec compliance reviewer: `019f5b2a-2c05-7e93-838d-16455cfc3e94`.
  - Code quality/security reviewer: `019f5b2a-8dee-7672-a6dd-399ad4ed6b51`.
- Findings addressed:
  - Added `StepRepository` and `ActionRepository` to core repository ports and in-memory persistence.
  - In-memory repositories now reject duplicate step sequence numbers per run and expose action persistence by step.
  - `UnitOfWork.transaction()` now snapshots and rolls back in-memory state, including event cursor assignment, when work fails.
  - Added repository-backed active-run interruption and run-id clone path.
  - Budget missing usage now returns a cost-accounting warning event request and does not increment token usage.
  - Repeated failure and protocol retry stops now carry deterministic details; budget snapshots track repeated failures.
  - `BUDGET_EXHAUSTED` run transitions now require and carry `BudgetStopDetail`.
  - Follow-up fix `ac05506` adds a real `RunRepository.listActive()` contract/adapter for repository-backed interruption, treats `null` LLM usage as unavailable, and persists run/action transition IDs through shared entity state so idempotency survives clone-safe repository reads.
- Regression evidence:
  - Added focused failing tests before implementation for repositories, transaction rollback, interruption/clone, missing usage warning, repeated/protocol details, and budget stop detail.
  - After fixes, `pnpm --filter @gcah/persistence test` exited 0.
  - After fixes, `pnpm --filter @gcah/core test -- run-machine budget` exited 0.
  - `pnpm verify` exited 0 with 14 files and 34 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Final re-verification evidence:
  - `pnpm verify` exited 0 with 14 files and 35 tests after `ac05506`.
  - `pnpm build` exited 0 after `ac05506`.
  - `git diff --check` exited 0 after `ac05506`.
- Final independent review evidence:
  - Spec compliance re-reviewer `019f5b43-dfa1-77c0-820b-beaa68f1c638`: PASS.
  - Code quality/security re-reviewer `019f5b44-0dfd-7cb1-af16-ee2d97c24ddf`: PASS.
- Generated output: removed package `dist` directories after build validation.
- Commits: `5ccf1cf` (`fix: complete core domain review gaps`), `ac05506` (`fix: resolve core domain review blockers`).

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
- Commit: `adc7ad3` (`feat: add core port contracts`).

## 2026-07-13 - T05

- Scope: PR-03 `safety-governance`, T05 workspace roots, real paths, overlap, traversal, and symlink safety.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/safety-governance` at `E:/Desktop/GCAH-safety-governance`.
- Baseline commit: `ae4f7d7`.
- Red evidence:
  - `pnpm --filter @gcah/governance test -- workspace-fence` exited 1 because `packages/governance/src/index.ts` did not exist.
- Green evidence:
  - Added `@gcah/governance` package and `createWorkspaceFence` with injected filesystem support.
  - Covered allowed workspace resolution, disallowed roots, protected-root parent/child/equal overlap, traversal, absolute external paths, symlink-like realpath escape, and nearest-existing-parent checks for new targets.
  - `pnpm --filter @gcah/governance test -- workspace-fence` exited 0 with 1 file and 5 tests.
- Refactor/verification evidence:
  - Added `@types/node` as a normal dev dependency for Node fs/path type coverage.
  - Added governance to root build/typecheck scripts and TypeScript references.
  - `pnpm lint` exited 0.
  - `pnpm typecheck` exited 0.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `22e70ed` (`feat: add workspace fence`).

## 2026-07-13 - T07

- Scope: PR-03 `safety-governance`, T07 deterministic three-level governance.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/safety-governance` at `E:/Desktop/GCAH-safety-governance`.
- Baseline commit: `35ffe89`.
- Red evidence:
  - `pnpm --filter @gcah/governance test -- governance patch-risk public-demo-policy` exited 1 because `createGovernanceEngine` and `assessPatchRisk` were not exported.
- Green evidence:
  - Added governance decisions with stable `ALLOW`, `REQUIRE_APPROVAL`, and `DENY` rule IDs, risk categories, and explanations.
  - Added patch-risk classification for small, large, lockfile, CI, and config paths.
  - Added public-demo hard-deny rules for shell commands and workspace mutations.
  - Focused governance tests exited 0 with 3 files and 5 tests.
- Refactor/verification evidence:
  - Governance remains dependent only on `@gcah/shared`.
  - `pnpm verify` exited 0 with 18 files and 45 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `9ca6187` (`feat: add deterministic governance engine`).

## 2026-07-13 - T08

- Scope: PR-03 `safety-governance`, T08 approval requests, session grants, scope hashes, expiry, and rejection feedback.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/safety-governance` at `E:/Desktop/GCAH-safety-governance`.
- Baseline commit: `2650c92`.
- Red evidence:
  - `pnpm --filter @gcah/governance test -- approval` exited 1 because approval hashing and `ApprovalService` were not exported.
- Green evidence:
  - Added canonical action normalization/hash and scope hash helpers that exclude rationale.
  - Added pure `ApprovalService` request/approve/reject/authorize flow with run, action hash, scope hash, risk category, and round-expiry binding.
  - Covered parameter drift, wrong run, expiry, duplicate rejection idempotency, one rejection feedback, and repeated denied-class `APPROVAL_REJECTED`.
  - Focused approval tests exited 0 with 2 files and 4 tests.
- Refactor/verification evidence:
  - Approval logic remains pure in `@gcah/governance` and imports no core state machine.
  - `pnpm verify` exited 0 with 20 files and 49 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `1c4814d` (`feat: add approval grants`).

## 2026-07-13 - PR-03 Review Fixes

- Scope: PR-03 independent review findings for T05, T07, and T08.
- Agent: OpenAI Codex.
- Reviewers:
  - Spec compliance reviewer: `019f5b9c-408f-7e93-a7b6-7b52baa71398`.
  - Code quality/security reviewer: `019f5b9c-7dc7-7823-997b-68603672fbd9`.
- Findings addressed:
  - Added guardrail-path DENY coverage and implementation.
  - Added Windows root-relative and UNC path escape DENY coverage and implementation.
  - Added path-qualified/suffixed elevation executable DENY coverage and implementation.
  - Fixed approval grant lookup so an earlier stale/partial grant cannot block a later valid grant.
- Regression evidence:
  - Added focused failing tests before implementation for guardrail/path/elevation and later-valid-grant cases.
  - `pnpm --filter @gcah/governance test -- governance approval-service` exited 0 with 2 files and 6 tests after fixes.
  - `pnpm verify` exited 0 with 20 files and 50 tests after fixes.
  - `pnpm build` exited 0 after fixes.
  - `git diff --check` exited 0 after fixes.
- Generated output: removed package `dist` directories after build validation.
- Commit: `08698c0` (`fix: resolve governance review blockers`).

## 2026-07-13 - PR-03 Final Review

- Scope: PR-03 `safety-governance` final review after fixes.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/safety-governance` at `E:/Desktop/GCAH-safety-governance`.
- Final review evidence:
  - Spec compliance re-reviewer `019f5ba3-1164-7712-a720-2601e3f22d1c`: PASS.
  - Code quality/security re-reviewer `019f5ba3-4a52-7a81-886d-2783439635d0`: PASS.
- Commit under review: `5f6e94e` (`docs: record governance review fixes`).

## 2026-07-13 - T09

- Scope: PR-04 `governed-tools`, T09 executor ports and mandatory governance ToolGateway.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/governed-tools` at `E:/Desktop/GCAH-governed-tools`.
- Baseline commit: `be3d2fd`.
- Red evidence:
  - `pnpm --filter @gcah/tools test -- tool-gateway` exited 1 because `packages/tools/src/index.ts` did not exist.
- Green evidence:
  - Added `@gcah/tools`, `ToolRegistry`, executor port, fake executor, and `createToolGateway`.
  - Gateway validates args, normalizes actions, asks governance, rechecks approvals for risky actions, persists action/decision inside `UnitOfWork`, and only dispatches after persistence succeeds.
  - Focused gateway tests exited 0 with 1 file and 3 tests.
- Refactor/verification evidence:
  - Added tools package to root build/typecheck scripts and workspace graph.
  - `pnpm verify` exited 0 with 21 files and 53 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `e046b0f` (`feat: add governed tool gateway`).

## 2026-07-13 - T10

- Scope: PR-04 `governed-tools`, T10 list/read, bounded output, and safe LocalExecutor file access.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/governed-tools` at `E:/Desktop/GCAH-governed-tools`.
- Baseline commit: `62d17d8`.
- Red evidence:
  - `pnpm --filter @gcah/tools test -- read-tools local-executor` exited 1 because `LocalExecutor`, `registerReadTools`, and `boundOutput` were not exported.
- Green evidence:
  - Added `LocalExecutor`, bounded output helper, and list/read tool registration.
  - Read-only tools resolve targets through the workspace fence, sort list output deterministically, cap output, return stable boundary errors, and never mark validation required.
  - Focused read/local-executor tests exited 0 with 2 files and 3 tests.
- Refactor/verification evidence:
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm verify` exited 0 with 23 files and 56 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `260ae6b` (`feat: add read-only local tools`).

## 2026-07-13 - T11

- Scope: PR-04 `governed-tools`, T11 patch/write/delete with stale-base and mutation semantics.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/governed-tools` at `E:/Desktop/GCAH-governed-tools`.
- Baseline commit: `258665f`.
- Red evidence:
  - `pnpm --filter @gcah/tools test -- patch write-delete` exited 1 because `registerMutationTools` was not exported.
- Green evidence:
  - Added file hashing, one-file unified diff application, atomic sibling writes, create-only write, explicit delete, and mutation registration.
  - Covered successful patch, stale base no-op, create-only write, delete, and validation-required marking after successful mutation.
  - Focused mutation tests exited 0 with 2 files and 4 tests.
- Refactor/verification evidence:
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm verify` exited 0 with 25 files and 60 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `3a6bec5` (`feat: add mutation file tools`).

## 2026-07-13 - T12

- Scope: PR-04 `governed-tools`, T12 structured run_command and independent run_validation dispatch.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/governed-tools` at `E:/Desktop/GCAH-governed-tools`.
- Baseline commit: `cbb11b6`.
- Red evidence:
  - `pnpm --filter @gcah/tools test -- command` exited 1 because command template matching and `CommandRunner` were not exported.
- Green evidence:
  - Added exact command-template matching, direct runner dispatch with `shell:false`, public-demo command denial, and validator-ID-only run_validation routing.
  - Focused command and run-validation tests exited 0 with 3 files and 4 tests.
- Refactor/verification evidence:
  - `pnpm verify` exited 0 with 28 files and 64 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `4c8185a` (`feat: add structured command tools`).

## 2026-07-13 - PR-04 Review Fixes

- Scope: PR-04 independent review findings for T09-T12.
- Agent: OpenAI Codex.
- Reviewers:
  - Spec compliance reviewer: `019f5bb7-f9d8-7241-ad5c-540dee1ad29b`.
  - Code quality/security reviewer: `019f5bb8-3eb0-7670-9335-7884b7c7753b`.
- Findings addressed:
  - Removed raw `LocalExecutor`, command runner, and tool registration exports from the public package index to avoid public bypass paths.
  - Added execution context so mutation and command tools reject calls that do not come through `ToolGateway`.
  - Updated tests to execute tools via `createToolGateway`, preserving governance/persistence-before-effect ordering.
  - Added `CommandValidationRunner` implementing the core `ValidationRunner` port.
  - ToolGateway now maps thrown tool errors to stable summaries without stack output.
- Regression evidence:
  - Focused PR-04 tests exited 0 with 8 files and 14 tests after fixes.
  - `pnpm verify` exited 0 with 28 files and 64 tests after fixes.
  - `pnpm build` exited 0 after fixes.
  - `git diff --check` exited 0 after fixes.
- Generated output: removed package `dist` directories after build validation.
- Commit: `4ad1e16` (`fix: close tool execution bypasses`).

## 2026-07-13 - PR-04 Final Review

- Scope: PR-04 `governed-tools` final review after fixes.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/governed-tools` at `E:/Desktop/GCAH-governed-tools`.
- Final review evidence:
  - Spec compliance re-reviewer `019f5bc0-a526-7c41-a328-4c2615959534`: PASS.
  - Code quality/security re-reviewer `019f5bc0-db1f-74a2-82d6-17cdbb99da92`: PASS.
- Commit under review: `29ccefb` (`docs: record tool review fixes`).

## 2026-07-13 - T13

- Scope: PR-05 `feedback-memory`, T13 validation orchestration, failure classification, fingerprints, and feedback.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/feedback-memory` at `E:/Desktop/GCAH-feedback-memory`.
- Baseline commit: `4ef1191`.
- Red evidence:
  - `pnpm --filter @gcah/core test -- validation failure-classifier fingerprint` exited 1 because classifier, fingerprint, `ValidationService`, and `FeedbackQueue` were not exported.
- Green evidence:
  - Added deterministic failure classifier, stable fingerprint normalization, validation trigger service, and one-shot feedback queue.
  - Covered mutation-triggered validation, read-only skip, equivalent failure fingerprinting, repairability categories, and objective feedback consumption.
  - Focused validation tests exited 0 with 3 files and 4 tests.
- Refactor/verification evidence:
  - `pnpm typecheck` exited 0.
  - `pnpm verify` exited 0 with 31 files and 68 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `71f1efc` (`feat: add validation feedback services`).

## 2026-07-13 - T14

- Scope: PR-05 `feedback-memory`, T14 configuration loading, validation, merge order, and immutable snapshots.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/feedback-memory` at `E:/Desktop/GCAH-feedback-memory`.
- Baseline commit: `fdd61a4`.
- Red evidence:
  - `pnpm --filter @gcah/core test -- config` exited 1 because `loadConfig` and `createConfigSnapshot` were not exported.
- Green evidence:
  - Added strict config schema, defaults, data-only project config parser, explicit merge order, injected workspace fence validation, immutable non-sensitive snapshots, and stable content hash.
  - Config parsing rejects unknown fields, secret fields, invalid budgets, bad workspaces, and missing required validation commands.
  - Focused config tests exited 0 with 1 file and 2 tests.
- Refactor/verification evidence:
  - Core config loader consumes config text as data and does not import concrete filesystem/fence adapters.
  - `pnpm typecheck` exited 0.
  - `pnpm verify` exited 0 with 32 files and 70 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `ddfd7ff` (`feat: add core configuration snapshots`).

## 2026-07-13 - T15

- Scope: PR-05 `feedback-memory`, T15 bounded memory writes and keyword/tag retrieval.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/feedback-memory` at `E:/Desktop/GCAH-feedback-memory`.
- Baseline commit: `d98cb8b`.
- Red evidence:
  - `pnpm --filter @gcah/core test -- memory` exited 1 because `MemoryService` was not exported.
- Green evidence:
  - Added authorized memory constructors for project conventions, approval summaries, and failure summaries; LLM-origin writes are rejected.
  - Added deterministic keyword/tag retrieval with workspace isolation, count/character budgets, and non-authoritative approval text.
  - Focused memory tests exited 0 with 1 file and 2 tests.
- Refactor/verification evidence:
  - `pnpm typecheck` exited 0.
  - `pnpm verify` exited 0 with 33 files and 72 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Generated output: removed package `dist` directories after build validation.
- Commit: `4b209b5` (`feat: add bounded memory service`).

## 2026-07-13 - PR-05 Review Fixes

- Scope: PR-05 `feedback-memory`, review fixes for T13-T15.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/feedback-memory` at `E:/Desktop/GCAH-feedback-memory`.
- Baseline commit: `2b86eac`.
- Review findings addressed:
  - T13 validation now consumes immutable `ConfigSnapshot.validation.required` and calls `ValidationRunner.runValidator(validatorId, configSnapshot)`.
  - T14 config preserves allowed-root precedence, includes risk thresholds in immutable snapshots, rejects secret-like accepted config/CLI values, and uses deterministic SHA-256 content hashes.
  - T15 memory retrieval enforces `charBudget` across the returned result set.
- Regression evidence:
  - Red tests reproduced the validation port mismatch, allowed-root/risk-threshold gaps, secret-like config acceptance, and per-entry memory budget behavior before fixes.
  - `pnpm --filter @gcah/core test -- config memory validation ports` exited 0 with 4 files and 10 tests.
  - `pnpm --filter @gcah/tools test -- run-validation` exited 0 with 1 file and 1 test.
  - `pnpm verify` exited 0 with 33 files and 75 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Initial review evidence:
  - Spec compliance reviewer `019f5bd9-2506-7773-955e-3020d85d9fe3`: FAIL with T13/T14/T15 findings.
  - Code quality/security reviewer `019f5bdb-13fb-7892-a73b-9ac6fe15ea6f`: FAIL with config secret/hash and memory budget findings.
  - Additional reviewer `019f5bd9-8844-7400-9b46-54238728f2d2` flagged completion gating in T16 scope; this remains assigned to PR-06 T16 completion gate.
- Re-review evidence:
  - Spec compliance re-reviewer `019f5be2-6644-7360-8c1e-618dc0d692d9`: PASS.
  - Code quality/security re-reviewer `019f5be2-eb9f-73f2-b43c-c17f7dac76e0`: PASS.
- Commit: `e1d0252` (`fix: address feedback memory review findings`).

## 2026-07-13 - PR-05 Final Verification

- Scope: PR-05 `feedback-memory` final pre-merge gate.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/feedback-memory` at `E:/Desktop/GCAH-feedback-memory`.
- Verification evidence:
  - `pnpm verify` exited 0 with 33 files and 75 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Final commit under review: `e1d0252` (`fix: address feedback memory review findings`).

## 2026-07-13 - T16a

- Scope: PR-06 `harness-loop`, T16a LlmClient and scripted MockLlmClient.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/harness-loop` at `E:/Desktop/GCAH-harness-loop`.
- Baseline commit: `e39e861`.
- Red evidence:
  - `pnpm --filter @gcah/llm test` exited 1 because `packages/llm/src/index.ts` and `MockLlmClient` did not exist.
- Green evidence:
  - Added `@gcah/llm` package with `MockLlmClient` implementing core `LlmClientPort`, deterministic script sequencing, request capture, and explicit script-exhaustion error.
  - Added package TS/build config and included `packages/llm` in root `typecheck` and `build` scripts.
  - Focused LLM test exited 0 with 1 file and 1 test.
- Refactor/verification evidence:
  - `pnpm typecheck` exited 0.
  - `pnpm build` exited 0.
  - Removed package `dist` directories after build validation.
- Commit: `1248ec6` (`feat: add scripted mock llm client`).

## 2026-07-13 - T16b

- Scope: PR-06 `harness-loop`, T16b context builder, protocol retry, and completion gate.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/harness-loop` at `E:/Desktop/GCAH-harness-loop`.
- Baseline commit: `eafa751`.
- Red evidence:
  - `pnpm --filter @gcah/core test -- context-builder completion-gate` exited 1 because `buildLoopContext`, `evaluateCompletion`, and `parseAgentResponse` were not exported.
- Green evidence:
  - Added bounded loop context construction from task, immutable config snapshot, budget state, latest feedback, and non-authoritative memory.
  - Added pure completion gate blocking FinishAction on pending approval, missing/failed validation, or budget stop.
  - Added protocol parsing through `AgentResponseSchema` with bounded retry/stop decisions via `BudgetTracker`.
  - Focused core tests exited 0 with 2 files and 3 tests.
- Refactor/verification evidence:
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
- Commit: `1529c59` (`feat: add loop context and completion gates`).

## 2026-07-13 - T16c

- Scope: PR-06 `harness-loop`, T16c serial agent-loop orchestration.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/harness-loop` at `E:/Desktop/GCAH-harness-loop`.
- Baseline commit: `0224a73`.
- Red evidence:
  - Initial focused test failed for an invalid test-only persistence import; after replacing it with an injected fake `UnitOfWork`, `pnpm --filter @gcah/core test -- agent-loop` exited 1 because `AgentLoop` was not exported.
- Green evidence:
  - Added `AgentLoop.start/continueAfterApproval/cancel` using only injected core ports and repositories.
  - Loop creates serial steps, parses every LLM response, persists proposed actions before tool effects, routes tools through `ToolGatewayPort`, runs validation for mutations, feeds validation failures back once, blocks FinishAction until validation passes, and stops on injected tool-gateway denial.
  - Added import-boundary test proving core loop files do not import `@gcah/tools`, `@gcah/persistence`, `@gcah/credentials`, `@gcah/llm`, or server/worker paths.
  - Focused core loop tests exited 0 with 4 files and 7 tests.
- Refactor/verification evidence:
  - `pnpm verify` exited 0 with 38 files and 83 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
  - Removed package `dist` directories after build validation.
- Commit: `4207e6a` (`feat: add serial agent loop`), plus boundary test `e697991` (`test: add core loop import boundary`).

## 2026-07-13 - T16c Budget Regression Fix

- Scope: PR-06 `harness-loop`, T16c budget stop handling.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/harness-loop` at `E:/Desktop/GCAH-harness-loop`.
- Baseline commit: `1514e15`.
- Red evidence:
  - Added token-budget regression test; `pnpm --filter @gcah/core test -- agent-loop` exited 1 because the loop completed after usage exceeded `maxTokens`.
- Green evidence:
  - `AgentLoop` now applies `BudgetTracker.recordUsage` results, persists budget usage to the Run, emits usage-unavailable events, and stops immediately on token exhaustion.
  - Focused loop tests exited 0 with 4 files and 8 tests.
- Verification evidence:
  - `pnpm verify` exited 0 with 38 files and 84 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Commit: `9cd2582` (`fix: enforce loop token budget`).

## 2026-07-13 - PR-06 Review Fixes

- Scope: PR-06 `harness-loop`, review fixes for T16.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/harness-loop` at `E:/Desktop/GCAH-harness-loop`.
- Baseline commit: `500a582`.
- Review findings addressed:
  - Added elapsed budget enforcement in the loop.
  - Persisted FinishAction before run completion.
  - Added injected approval pause/continue/reject path without importing governance adapters.
  - Converted injected port exceptions into terminal failed runs with safe failure events.
  - Redacted sensitive tool/validation output before event persistence.
- Regression evidence:
  - Red tests reproduced elapsed-budget bypass, missing finish action persistence, unreachable approval pause/continue, active runs after port exceptions, and unredacted tool output events.
  - Focused loop tests exited 0 with 4 files and 13 tests.
  - `pnpm verify` exited 0 with 38 files and 89 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Initial review evidence:
  - Spec compliance reviewer `019f5c08-6744-7471-88e6-f48cbe5c4d20`: FAIL with approval, elapsed-budget, and finish-action persistence findings.
  - Code quality/security reviewer `019f5c08-9f0e-7070-a5c0-109a9d7a8f9b`: FAIL with elapsed-budget, port-exception, and tool-output redaction findings.
- Commit: `0d81c9d` (`fix: close harness loop review gaps`).

## 2026-07-13 - PR-06 Re-review Fixes

- Scope: PR-06 `harness-loop`, second review fixes for T16.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/harness-loop` at `E:/Desktop/GCAH-harness-loop`.
- Baseline commit: `52f444f`.
- Re-review findings addressed:
  - Added elapsed-budget checks after LLM, tool, and validation work.
  - Added approval rejection feedback-once path so the LLM can choose a safe alternative.
  - Preserved paused validation state across approval continuation.
  - Failed runs terminally when injected ports throw during approval resume.
- Regression evidence:
  - Red tests reproduced post-work elapsed bypass, immediate approval-rejection stop, approval resume validation bypass, and resume-time port exception active-run leak.
  - Focused loop tests exited 0 with 5 files and 19 tests.
  - `pnpm verify` exited 0 with 38 files and 93 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Re-review evidence before this fix:
  - Spec compliance re-reviewer `019f5c11-a2e7-7180-92ca-e7eba0d22f22`: FAIL with post-work elapsed and approval rejection feedback findings.
  - Code quality/security re-reviewer `019f5c11-eb32-7a61-95a1-671969455c15`: FAIL with post-work elapsed, approval validation state, and resume exception findings.
- Commit: `8a8ec51` (`fix: handle approval resume edge cases`).

## 2026-07-13 - PR-06 Final Quality Fix

- Scope: PR-06 `harness-loop`, final quality re-review fix.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/harness-loop` at `E:/Desktop/GCAH-harness-loop`.
- Baseline commit: `575e076`.
- Finding addressed:
  - Approval `consumeApproval` port exceptions now terminally fail the waiting run.
- Regression evidence:
  - Red test reproduced `WAITING_APPROVAL` run left active when approval consumption threw.
  - Focused loop tests exited 0 with 5 files and 20 tests.
  - `pnpm verify` exited 0 with 38 files and 94 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Review evidence before this fix:
  - Spec compliance final re-reviewer `019f5c1b-4174-7da1-aad5-d228b9dd6013`: PASS.
  - Code quality/security final re-reviewer `019f5c1b-8b6a-7030-b834-918028d63409`: FAIL with approval consumption exception finding.
- Commit: `0cfec9b` (`fix: fail approval consumption errors`).

## 2026-07-13 - PR-06 Final Review

- Scope: PR-06 `harness-loop` final review after fixes.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/harness-loop` at `E:/Desktop/GCAH-harness-loop`.
- Final review evidence:
  - Spec compliance final re-reviewer `019f5c1b-4174-7da1-aad5-d228b9dd6013`: PASS.
  - Code quality/security final re-reviewer `019f5c21-93e5-7db3-8cf7-804973c77ce4`: PASS.
- Verification evidence:
  - `pnpm verify` exited 0 with 38 files and 94 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Final commit under review: `0e9c215` (`docs: record final harness quality fix`).

## 2026-07-13 - T17

- Scope: PR-07 `persistence-server`, T17 SQLite repositories and append-only audit persistence.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/persistence-server` at `E:/Desktop/GCAH-persistence-server`.
- Baseline commit: `a51e0de`.
- Red evidence:
  - `pnpm --filter @gcah/persistence test` exited 1 because `openSqliteRepositories` and `openAuditLog` were not exported.
- Green evidence:
  - Added shared repository contract and ran it against in-memory and SQLite adapters.
  - Added Node built-in `node:sqlite` repository adapter with schema migration, active-run and step-sequence constraints, transactional rollback, monotonic event cursors, config and memory storage, and close support.
  - Added append-only JSONL audit log with secret/path redaction.
  - Focused persistence tests exited 0 with 3 files and 11 tests.
- Refactor/verification evidence:
  - Persistence package explicitly enables Node types because SQLite/audit are Node adapters.
  - No new package dependency or build-script allowlist entry was added.
  - `pnpm verify` exited 0 with 40 files and 101 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
  - Removed package `dist` directories after build validation.
- Commit: `7a84c99` (`feat: add sqlite persistence adapter`).

## 2026-07-13 - T18a

- Scope: PR-07 `persistence-server`, T18a Fastify composition and REST run APIs.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/persistence-server` at `E:/Desktop/GCAH-persistence-server`.
- Baseline commit: `d1c835e`.
- Red evidence:
  - `pnpm --filter @gcah/server test -- runs` exited 1 because `createServerApp` and the server package entry did not exist.
- Green evidence:
  - Added `apps/server` workspace package with Fastify 5.10.0, TS config, and root build/typecheck inclusion.
  - Added health, create run, get run, cancel run, and clone interrupted run routes using injected `UnitOfWork` and core state transitions.
  - Added schema-error handling that rejects invalid create-run requests without creating a Run.
  - Focused server run tests exited 0 with 1 file and 2 tests.
- Refactor/verification evidence:
  - Added `apps/*` to pnpm workspace and locked Fastify without adding build-script allowlist entries.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
  - Removed package `dist` directories after build validation.
- Commit: `a0088a3` (`feat: add local server run routes`).

## 2026-07-13 - T18b

- Scope: PR-07 `persistence-server`, T18b local/self-hosted cookie auth and CSRF/Origin checks.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/persistence-server` at `E:/Desktop/GCAH-persistence-server`.
- Baseline commit: `d095d25`.
- Red evidence:
  - `pnpm --filter @gcah/server test -- auth` exited 1 because unauthenticated mutations were accepted and the auth session route did not set cookies.
- Green evidence:
  - Added injected `AdminTokenStore` boundary, no-body admin-token session route, HttpOnly/SameSite session cookie, CSRF token header, same-origin mutation enforcement, and optional Secure cookie flag.
  - Focused server auth/run tests exited 0 with 2 files and 4 tests.
- Refactor/verification evidence:
  - Admin token plaintext is read only from request headers in the authentication comparison boundary and is not serialized in route responses.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
  - Removed package `dist` directories after build validation.
- Commit: `ac22440` (`feat: add server cookie auth`).

## 2026-07-13 - T18c

- Scope: PR-07 `persistence-server`, T18c persisted SSE replay and interruption startup handling.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/persistence-server` at `E:/Desktop/GCAH-persistence-server`.
- Baseline commit: `8cf1be7`.
- Red evidence:
  - `pnpm --filter @gcah/server test -- sse restart` exited 1 because event replay routes and startup interruption helper were missing.
- Green evidence:
  - Added committed event JSON replay with cursor and SSE replay honoring `Last-Event-ID`.
  - Added startup helper that marks active runs interrupted without resuming execution.
  - Focused server tests exited 0 with 4 files and 6 tests.
- Refactor/verification evidence:
  - SSE publishes only events already persisted in the repository.
  - `pnpm verify` exited 0 with 44 files and 107 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
  - Removed package `dist` directories after build validation.
- Commit: `2e85678` (`feat: add server event replay`).

## 2026-07-14 - T18a/T18b completion gap fix

- Scope: PR-07 `persistence-server`, T18a REST approval/config/credential-status routes and T18b REST read protection.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/persistence-server` at `E:/Desktop/GCAH-persistence-server`.
- Baseline commit: `c24d65b`.
- Red evidence:
  - `pnpm --filter @gcah/server test -- approvals-config` exited 1 because approval, config-status, and credential-status routes returned 404.
  - `pnpm --filter @gcah/server test -- auth` exited 1 because authenticated REST reads were not required.
- Green evidence:
  - Added shared non-sensitive config and credential-status DTOs.
  - Added approval-decision recording route that validates shared DTO input and persists a safe committed event.
  - Added config-status and credential-status routes that return injected non-secret status only.
  - Tightened server auth so all REST routes require a session while CSRF/Origin checks remain scoped to mutations.
  - Focused server tests exited 0 with 5 files and 10 tests.
- Refactor/verification evidence:
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `git diff --check` exited 0 with line-ending warnings only.
- Commit: `28c23eb` (`fix: complete server REST surface`).

## 2026-07-14 - PR-07 Review Fixes

- Scope: PR-07 `persistence-server`, fixes after independent spec and quality/security reviews.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/persistence-server` at `E:/Desktop/GCAH-persistence-server`.
- Baseline commit: `14b8da2`.
- Reviewer evidence:
  - Spec compliance reviewer `019f5e7a-c751-7ae3-9c7f-3549c8e684b8` reported blocking issues in verification, run/event transactionality, SSE live streaming, approval binding, and SQLite relational constraints.
  - Code quality/security reviewer `019f5e7a-db72-7341-a928-5c69321c7ea2` reported matching issues plus workspace-boundary validation at the server boundary.
- Red evidence:
  - Added regression tests for failed run-created event rollback, approval missing/non-pending action rejection, live SSE delivery after replay, orphan repository state rejection, SQLite active-run database index, and injected workspace validation.
  - `pnpm --filter @gcah/server test -- runs approvals-config sse` exited 1 for missing transaction/approval/live SSE behavior.
  - `pnpm --filter @gcah/persistence test` exited 1 for orphan rows and missing active-run database index.
- Green evidence:
  - Wrapped run creation and creation-event append in one `UnitOfWork.transaction`.
  - Added publish-after-commit SSE subscribers with cleanup and test-only idle timeout.
  - Bound approval decisions to existing runs, existing actions, and `WAITING_APPROVAL` status before persisting committed events.
  - Added injected workspace boundary validation before run creation.
  - Added in-memory referential checks and SQLite foreign keys plus active-run partial unique index.
  - `pnpm --filter @gcah/server test` exited 0 with 5 files and 14 tests.
  - `pnpm --filter @gcah/persistence test` exited 0 with 3 files and 14 tests.
- Refactor/verification evidence:
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
  - `git diff --check` exited 0 with line-ending warnings only.
- Commit: `d102d15` (`fix: address persistence server review findings`).

## 2026-07-14 - PR-07 Final Review

- Scope: PR-07 `persistence-server` final review after fixes.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/persistence-server` at `E:/Desktop/GCAH-persistence-server`.
- Final review evidence:
  - Spec compliance re-reviewer `019f5ebf-bd6a-7220-9545-5725a60a269f`: PASS.
  - Code quality/security re-reviewer `019f5ebf-d193-7040-a0f0-1e5568c50f04`: PASS.
- Verification evidence:
  - `pnpm verify` exited 0 with 45 files and 118 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0.
- Final commit under review: `b1f8561` (`docs: record persistence server review fixes`).

## 2026-07-14 - T19

- Scope: PR-08 `credentials-llm-cli`, T19 standalone credentials package and secret-isolation contract.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/credentials-llm-cli` at `E:/Desktop/GCAH-credentials-llm-cli`.
- Baseline commit: `9b93256`.
- Red evidence:
  - `pnpm --filter @gcah/credentials test` exited 1 because `packages/credentials/src/index.ts` and credential ports/resolver did not exist.
- Green evidence:
  - Added `@gcah/credentials` workspace package and locked `cross-keychain@1.1.0` per S01.
  - Added backend allowlist validation for Windows/macOS/Linux OS backends and fail-closed rejection of `file`, `null`, and unknown backends.
  - Added callback-scoped `CredentialStore`, `CredentialResolver` precedence OS store -> explicitly enabled environment -> explicitly enabled dotenv, and credential-backed `AdminTokenStore`.
  - Added secret-isolation tests proving status and serialized errors do not include sentinel plaintext.
  - `pnpm --filter @gcah/credentials test` exited 0 with 4 files and 7 tests.
- Refactor/verification evidence:
  - Real `cross-keychain` access is isolated behind `createOsKeychainBackend`; tests use fake backends and do not read/write real credentials.
  - `.env` and `.env.*` were already ignored; no `.gitignore` change was required.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
- Commit: `583d56d` (`feat: add credential store`).

## 2026-07-14 - T20

- Scope: PR-08 `credentials-llm-cli`, T20 OpenAI-compatible single-call adapter.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/credentials-llm-cli` at `E:/Desktop/GCAH-credentials-llm-cli`.
- Baseline commit: `6ed36c9`.
- Red evidence:
  - `pnpm --filter @gcah/llm test -- openai-compatible` exited 1 because `OpenAiCompatibleLlmClient` was not exported/implemented.
- Green evidence:
  - Added fake-transport OpenAI-compatible Chat Completions adapter implementing core `LlmClientPort`.
  - Added callback-scoped credential resolution so the API key is placed only in the outbound Authorization header and not in request body/domain DTOs.
  - Added usage mapping, missing-usage preservation, and stable rate-limit/network/protocol errors without provider message/key leakage.
  - Added manual integration script gated by `GCAH_RUN_REAL_LLM_INTEGRATION=1` and documentation; it is not part of default CI.
  - `pnpm --filter @gcah/llm test -- openai-compatible` exited 0 with 1 file and 4 tests.
  - `pnpm --filter @gcah/llm test` exited 0 with 2 files and 5 tests.
- Refactor/verification evidence:
  - `@gcah/llm` imports only the credential resolver type from `@gcah/credentials`, not concrete OS backends.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0 after adding `scripts/*.ts` to the existing ESLint default project allowlist.
- Commit: `9c23e83` (`feat: add openai compatible llm adapter`).

## 2026-07-14 - T21

- Scope: PR-08 `credentials-llm-cli`, T21 CLI run/status/approval/config/credential/server commands.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/credentials-llm-cli` at `E:/Desktop/GCAH-credentials-llm-cli`.
- Baseline commit: `90477da`.
- Red evidence:
  - `pnpm --filter @gcah/cli test` exited 1 because `apps/cli/src/main.ts` and CLI commands did not exist.
- Green evidence:
  - Added `@gcah/cli` workspace package, root build/typecheck inclusion, and thin injected HTTP transport client.
  - Added run submit/status/cancel/clone commands using shared DTO validation.
  - Added approval list/approve-once/approve-session/reject and config status commands as DTO-only calls with no local policy calculation.
  - Added credential status/set/update/clear commands using hidden-input callback and injected `CredentialStore`; outputs never echo secret sentinels.
  - Added server start guidance command and backend-unavailable credential status handling.
  - `pnpm --filter @gcah/cli test` exited 0 with 5 files and 6 tests.
- Refactor/verification evidence:
  - CLI output uses shared sanitization for secret-shaped text.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
- Commit: `6d552d0` (`feat: add cli commands`).

## 2026-07-14 - PR-08 Review Fixes

- Scope: PR-08 `credentials-llm-cli`, fixes after independent spec and quality/security reviews.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/credentials-llm-cli` at `E:/Desktop/GCAH-credentials-llm-cli`.
- Baseline commit: `5479883`.
- Reviewer evidence:
  - Spec compliance reviewer `019f5fbf-773d-7f72-a8c0-9b5731b4ec2d` reported backend exception fail-closed gaps and missing default HTTP client behavior.
  - Code quality/security reviewer `019f5fbf-8b63-7741-bb20-4fd894bbbfdf` reported missing real hidden-input path and executable CLI entrypoint.
- Red evidence:
  - Added regression tests for backend `diagnose()` exceptions containing a secret sentinel, fetch-backed default transport, no-echo hidden input, and executable entrypoint wiring.
  - Focused credentials/CLI tests exited 1 before implementation for these missing behaviors.
- Green evidence:
  - Mapped backend diagnostic failures to safe `CredentialBackendUnavailableError("unknown")`.
  - Added fetch-backed CLI transport using `GCAH_SERVER_URL` or local default.
  - Added hidden-input prompt helper and `runMain`/`bin.ts` executable entrypoint with `gcah` package bin.
  - Focused credentials and CLI review-fix tests exited 0.
- Refactor/verification evidence:
  - `pnpm --filter @gcah/credentials test` exited 0 with 4 files and 8 tests.
  - `pnpm --filter @gcah/cli test` exited 0 with 7 files and 9 tests.
  - `pnpm typecheck` exited 0.
  - `pnpm lint` exited 0.
- Commit: `e6987d6` (`fix: address credentials cli review findings`).

## 2026-07-14 - PR-08 Re-review Fixes

- Scope: PR-08 `credentials-llm-cli`, fixes after first re-review.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/credentials-llm-cli` at `E:/Desktop/GCAH-credentials-llm-cli`.
- Baseline commit: `6050a96`.
- Reviewer evidence:
  - Spec re-reviewer `019f6042-53c8-77d2-9493-735399c3464d` reported backend operation error leakage, default hidden input echo, and non-runnable CLI bin.
  - Code quality/security re-reviewer `019f6042-6815-7ce1-8f2a-419aabffa775` reported the same three blocking issues.
- Red evidence:
  - Added regression tests for backend `getPassword`/`setPassword`/`deletePassword` failures containing a sentinel, raw-mode hidden input, and CLI bin pointing to emitted JavaScript.
  - Focused credentials/CLI tests exited 1 before implementation for these missing behaviors.
- Green evidence:
  - Wrapped credential backend operation failures as safe `CredentialBackendUnavailableError` and converted status read failures to backend-unavailable status.
  - Updated hidden input to enable raw mode during the read and restore it afterward.
  - Updated CLI package bin to `dist/src/bin.js` and CLI build config to emit JavaScript.
  - Focused regression tests exited 0.
- Refactor/verification evidence:
  - `pnpm verify` exited 0 with 58 files and 142 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0 with line-ending warnings only.
- Commit: `4b1c91d` (`fix: close credentials cli re-review gaps`).

## 2026-07-14 - PR-08 Final Re-review Fixes

- Scope: PR-08 `credentials-llm-cli`, fixes after second re-review.
- Agent: OpenAI Codex.
- Branch/worktree: `feat/credentials-llm-cli` at `E:/Desktop/GCAH-credentials-llm-cli`.
- Baseline commit: `c61a055`.
- Reviewer evidence:
  - Spec re-reviewer `019f604e-6325-7733-812a-045ac174c6fb` reported that the emitted CLI bin loaded workspace TypeScript exports at runtime and that hidden input consumed only the first raw keypress chunk.
  - Code quality/security re-reviewer `019f604e-7759-7e10-b01f-34c645d91d62` reported the same hidden-input chunk handling gap.
- Red evidence:
  - Added regression tests for multi-chunk raw-mode input with backspace handling and for executing `apps/cli/dist/src/bin.js server start` after a clean CLI build.
  - Focused CLI tests exited 1 before implementation because `execFile` could not build/run the emitted bin path from a clean test run.
- Green evidence:
  - Added chunk-wise raw-mode line reading until Enter/Ctrl-C and restored the prior terminal raw-mode state after prompting.
  - Removed CLI top-level runtime imports of workspace TypeScript-only exports; credential keychain loading is now deferred to credential commands.
  - Updated the credential package export/build path for runtime JavaScript consumers.
  - `node apps/cli/dist/src/bin.js server start` exited 0 and printed the server composition-root guidance.
- Refactor/verification evidence:
  - `pnpm --filter @gcah/cli test -- hidden-input bin` exited 0 with 2 files and 5 tests.
  - `pnpm --filter @gcah/credentials test -- credential-store` exited 0 with 1 file and 5 tests.
  - `pnpm verify` exited 0 with 58 files and 143 tests.
  - `pnpm build` exited 0.
  - `git diff --check` exited 0 with line-ending warnings only.
- Commit: `1fb645c` (`fix: make cli runtime executable`).
