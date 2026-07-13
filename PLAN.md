# Guarded Coding Agent Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Cold-start validation is an isolated specification experiment and must not be reused as formal implementation.

**Goal:** Build a lightweight, self-authored coding-agent harness whose deterministic governance and validation feedback loop controls every model-proposed action.

**Architecture:** A pnpm TypeScript workspace separates shared runtime schemas, the dependency-injected harness core, LLM adapters, governed tools, persistence, HTTP adapters, CLI, and React WebUI. Fastify is the local/Docker/self-hosted composition root; Cloudflare production uses Pages plus an independent Worker composition root backed by D1 and optionally Durable Objects. The core owns framework-neutral behavior through ports; CLI and WebUI are clients.

**Tech Stack:** Node.js LTS, TypeScript, pnpm workspace, Zod 4, Vitest, Fastify, Cloudflare Workers/D1/Durable Objects, SQLite, React, Vite, Cloudflare Pages/Wrangler, Docker/OCI, GitLab CI, GitHub Actions.

## Global Constraints

- `SPEC.md` is the sole product specification. If a task cannot be completed deterministically from it and this plan, stop and ask; do not guess.
- Formal implementation begins only after plan approval, isolated cold-start validation, cold-start documentation/revisions, and the two adapter/platform spikes.
- Gate CS rules override any formal child-task closeout steps. During cold-start, do not update `PLAN.md` or `AGENT_LOG.md`, do not commit, and do not record formal task hashes inside the disposable worktree; those steps apply only to formal implementation tasks after Gate CS is complete.
- Use TDD for every formal task: add a focused failing test, run it and observe the expected red failure, add the minimum implementation, rerun to green, then refactor while green.
- Default `pnpm test`, `pnpm verify`, and `pnpm demo:mechanisms` must not access the network, require an API key, or call a real LLM.
- The core must not use LangChain AgentExecutor, AutoGen, CrewAI, LlamaIndex agent, or another SDK-provided agent runner.
- All authority, tool dispatch, state transitions, and approval checks remain server-side. WebUI is only an observation and approval client.
- S01 credential evidence covers Windows `native-windows` only. macOS, Linux, and Docker credential backends are untested and must not be described as verified support.
- `LocalExecutor` is not an OS sandbox. Public demo denies command execution, network, dependency installation, real LLM calls, and user credentials.
- Public demo has no API-key input, transport, or storage path and binds only Mock LLM; it contains no real LLM adapter.
- Core depends only on repository and service ports and never imports SQLite, D1, Fastify, Worker, or Cloudflare bindings.
- Events are persisted before SSE publication; both Fastify and Worker adapters support cursor replay and client disconnect recovery.
- Cloudflare login, authorization, token configuration, deployment, custom-domain binding, DNS, and HTTPS activation are manual human-authorized steps.
- Secret plaintext may exist only briefly at three explicit boundaries: CLI hidden input → `CredentialStore`, `CredentialStore`/`AdminTokenStore` authentication operations, and `CredentialResolver` → LLM adapter call. It must never enter a domain object, config/config snapshot, repository, SQLite, event, audit/log record, workspace, browser state, or serialized error. JavaScript cannot guarantee memory zeroization; the enforceable promise is to minimize lifetime/scope, avoid copies, and prevent persistence/serialization/logging.
- Commit the pnpm lockfile; CI installs with a frozen lockfile. Record material security-dependency changes in `AGENT_LOG.md`.
- Package-manager build scripts must be controlled by an explicit allowlist committed in workspace configuration. Interactive build-script approval is not part of CI or formal task execution.
- One active Run per workspace; Steps within a Run execute serially. Interrupted Runs are never resumed or replayed in place.

---

## 1. File and module map

| Area | Paths | Responsibility |
|---|---|---|
| Workspace | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `vitest.workspace.ts` | Reproducible scripts and shared quality configuration |
| Shared contracts | `packages/shared/src/**` | Zod schemas, entities, statuses, tool/API/event contracts, safe display strings |
| Core | `packages/core/src/**` | Run/action state machines, budgets, loop orchestration, feedback scheduling, and all inward-facing ports including `ToolGatewayPort`, repository ports, `Clock`, `ValidationRunner`, `WorkspaceFencePort`, and `LlmClientPort` |
| LLM | `packages/llm/src/**` | Implements core `LlmClientPort` with scripted mock and OpenAI-compatible single-call adapter |
| Credentials | `packages/credentials/src/**` | OS credential store, admin-token store, environment/`.env` sources, callback-scoped secret resolution |
| Governance | `packages/governance/src/**` | Workspace/path fence, three-level governance rules, approval state machine and hashes; depends only on `packages/shared` |
| Tools | `packages/tools/src/**` | Implements core `ToolGatewayPort`; tool registry, file tools, Local/Demo/Fake executors, structured commands; may depend on core ports, shared, and governance |
| Validation/memory | `packages/core/src/validation/**`, `packages/core/src/memory/**` | Immutable validation plans, classification, fingerprints, bounded retrieval |
| Persistence | `packages/persistence/src/**`, `apps/worker/src/persistence/**` | In-memory/SQLite and D1 repository adapters, migrations, transactions, audit append, shared contract tests |
| Local server | `apps/server/src/**` | Fastify REST/SSE composition root for local/Docker/self-hosted, auth, rate limits, startup interruption handling |
| Cloudflare API | `apps/worker/src/**` | Worker HTTP/SSE composition root, D1 bindings and migration, cursor replay, optional Durable Object coordination/fan-out |
| CLI | `apps/cli/src/**` | Server client, run/config/approval/credential commands, hidden secret input |
| WebUI | `apps/webui/src/**` | Timeline, validation and approval UI; no policy logic |
| Demo/deployment | `examples/demo-workspace/**`, `scripts/**`, `.github/workflows/**`, `.gitlab-ci.yml`, `Dockerfile`, `wrangler.jsonc`, `apps/webui/**` | Deterministic demo, CI, independent Docker and Cloudflare Pages/Workers delivery paths |

Interfaces flow inward: `shared` has no internal dependency; `governance` depends only on `shared`; `core` depends on `shared` and its own injected ports and never imports `tools`, `persistence`, `credentials`, `llm`, `server`, SQLite, D1, Fastify, Worker, or Cloudflare bindings; adapters implement ports. Fastify and Worker are separate composition roots; CLI/WebUI consume HTTP contracts only. KV/R2 are separate capability-specific ports and never substitute for relational run/audit/event repositories.

```text
shared
├── governance (shared only)
├── core domain + ports (shared only)
│   ├── persistence adapter -> implements repository ports
│   ├── llm adapter -> implements LlmClientPort
│   └── credentials adapter -> consumed only by composition/auth/LLM boundary
└── tools -> depends on shared + governance + core ports; implements ToolGatewayPort/ValidationRunner

server composition -> wires governance + core + tools + persistence + llm + credentials
CLI/WebUI -> shared HTTP contracts -> server
```

## 2. Dependency graph and delivery groups

```text
PLAN approval
  -> CS-01 one fresh agent, one disposable worktree, sequentially attempts T01 then T02
  -> CS-02 record findings; revise SPEC/PLAN/SPEC_PROCESS; discard the whole worktree
  -> S01 credential-store spike ----┐
  -> S02 hosting-platform spike ----┴-> formal implementation

T01 -> T02
T02 -> T03
T02 + T03 -> T04
T02 -> T05
T02 + T03 + T04 -> T06
T05 -> T07
T07 -> T08
T03 + T05 + T07 + T08 -> T09 -> T10
T07 + T08 + T10 -> T11
T04 + T08 + T09 + T10 + T11 -> T12
T04 + T06 -> T13
T02 + T03 -> T14
T02 + T03 + T13 -> T15
T03 + T04 + T06 + T13 + T14 + T15 -> T16
T03 + T16 -> T17
T09 + T12 + T14 + T16 + T17 -> T18
S01 + T02 -> T19
T02 + T19 -> T20
T18 + T19 + T20 -> T21
T02 + T18 -> T22
T07 + T18 + T22 -> T23
T16 + T18 + T23 -> T24 -> T25
S02 + T17 + T18 + T22 + T23 + T25 -> T26
S02 + T17 + T23 + T26 -> T27
```

Parallel opportunities after prerequisites:

- After T02: T03, T05, and S01-backed T19 can start independently once their stated gates are satisfied.
- After T03: T14 can proceed against a fake `WorkspaceFencePort`; after T04, T06 and T13 can proceed in parallel.
- After T08: T09 can begin because repository/UnitOfWork, governance, and approval ports now exist; T13/T14 remain independent.
- After T17: T18 can proceed while T19/T20 progress in their own PR group.
- After T18: WebUI T22 can overlap credential/LLM/CLI work; public demo T23 follows the WebUI/server contracts.
- T24 is the integrated mechanism demo; T25–T27 are serial release-evidence gates.

Worktree/PR groups are review-sized feature modules, not individual microsteps:

| PR group | Tasks | Branch/worktree suggestion |
|---|---|---|
| PR-01 foundation-contracts | T01–T02 | `feat/foundation-contracts` |
| PR-02 core-domain | T03–T04, T06 | `feat/core-domain` |
| PR-03 safety-governance | T05, T07–T08 | `feat/safety-governance` |
| PR-04 governed-tools | T09–T12 | `feat/governed-tools` |
| PR-05 feedback-memory | T13–T15 | `feat/feedback-memory` |
| PR-06 harness-loop | T16 | `feat/harness-loop` |
| PR-07 persistence-server | T17–T18 | `feat/persistence-server` |
| PR-08 credentials-llm-cli | T19–T21 | `feat/credentials-llm-cli` |
| PR-09 web-public-demo | T22–T23 | `feat/web-public-demo` |
| PR-10 release-evidence | T24–T27 | `feat/release-evidence` |

### Atomic child-task decomposition for oversized tasks

The child IDs below are the executable fresh-subagent units. Each belongs to its parent's PR/worktree, updates `PLAN.md` and `AGENT_LOG.md`, and receives compliance review before quality review. Gate CS is the only exception: its disposable implementation attempts these child scopes for evidence but must not update `PLAN.md`/`AGENT_LOG.md`, commit, or record task hashes. Every numbered step is intended to take 2–5 minutes; if a step cannot be completed in that interval, stop at a coherent edit and continue as the next checkbox without expanding scope.

#### T01a — Minimal non-product workspace/test runner

**Goal:** Make Vitest start for `@gcah/shared` without adding product behavior. **Dependencies:** Gate CS/S01/S02 for formal work; none inside PR-01. **Files:** root/shared manifests, `pnpm-workspace.yaml`, `vitest.workspace.ts`, `.npmrc`, empty shared test configuration listed by T01. **Red:** Not applicable to product behavior; this is prerequisite scaffolding and must end with a successful no-test/pass-with-no-tests runner invocation. **Expected implementation:** Only package-manager and test-runner wiring. T01a must not create `workspaceReady`, behavior tests, shared domain schemas, or any product behavior.

- [ ] Add root `package.json` with pinned pnpm and workspace scripts.
- [ ] Add `pnpm-workspace.yaml` and `packages/shared/package.json`.
- [ ] Add minimal `vitest.workspace.ts` plus shared test script.
- [ ] Configure pnpm build-script handling with an explicit allowlist for required native/build packages; do not rely on interactive `pnpm approve-builds` during CI or formal task execution.
- [ ] Install once to generate `pnpm-lock.yaml`.
- [ ] Run `pnpm --filter @gcah/shared test -- --passWithNoTests`; expect exit 0.
- [ ] Update `PLAN.md`/`AGENT_LOG.md`, commit, and record hash.

**Refactor/verification:** Remove unused config; run frozen install. **Done:** Runner starts; no `workspaceReady` source/test exists. **Parallel:** No. **Status:** Complete. **Commit:** `91ac7ea` (`chore: bootstrap shared test runner`).

#### T01b — Behavioral workspace smoke export

**Goal:** Establish the first real red-green-refactor cycle and remaining quality configuration. **Dependencies:** T01a. **Files:** `packages/shared/test/smoke.test.ts`, `packages/shared/src/index.ts`, `tsconfig.base.json`, `eslint.config.js`, package TS configs, root scripts. **First red:** Import missing `workspaceReady`; Vitest must fail only on missing export/module member. **Expected implementation:** One constant export plus lint/typecheck/verify wiring. T01b owns creation of `packages/shared/src/index.ts`; if the file does not yet exist, first create an empty export file so the behavioral red is specifically the missing `workspaceReady` export, not a module-resolution failure.

- [ ] Create `packages/shared/src/index.ts` as an empty module if T01a did not create it.
- [ ] Add the exact smoke test shown in T01.
- [ ] Run `pnpm --filter @gcah/shared test`; confirm missing-export red.
- [ ] Add `workspaceReady = true` export.
- [ ] Rerun package test; expect green.
- [ ] Add TS/ESLint/verify config and run lint/typecheck/verify.
- [ ] Refactor duplicated config, update logs/status, commit, record hash.

**Done:** T01 acceptance holds. **Parallel:** No. **Status:** Complete. **Commit:** `3f6b2c8` (`chore: add shared smoke quality checks`).

#### T02a — Status, StopReason, and entity schemas

**Goal:** Define SPEC §6 entities and exact status/stop mappings. **Dependencies:** T01b. **Files:** `packages/shared/src/status.ts`, `entities.ts`, tests `status.test.ts`, `entities.test.ts`. **First red:** Imports missing enums/schemas; mapping assertions cannot compile. **Expected implementation:** Zod 4 schemas and derived types without secret fields, including `StepStatus` and explicit required/optional/nullable constraints for every core entity.

- [ ] Add enum/mapping tests for every Run/Step/Action status and StopReason.
- [ ] Run `pnpm --filter @gcah/shared test -- status entities`; confirm missing exports.
- [ ] Add minimal status and complete SPEC §6 entity schemas using Zod 4 APIs.
- [ ] Rerun focused tests to green.
- [ ] Refactor shared IDs/timestamps and add no-API-key plus required/optional/nullable schema assertions.
- [ ] Run package test/typecheck; update logs/status; commit and record hash.

**Done:** Exact entity/status contracts pass, including `StepStatus`, all SPEC §6 entities, and required/optional/nullable assertions. **Parallel:** No. **Status:** Complete. **Commit:** `fe9553a` (`feat: add shared entity status schemas`).

#### T02b — AgentResponse and tool argument schemas

**Goal:** Strictly parse `ToolAction | FinishAction`, `ToolRequestSchema`, `ToolResultSchema`, and all tool arguments. **Dependencies:** T02a. **Files:** `packages/shared/src/agent-response.ts`, `tool-contracts.ts`; tests `agent-response.test.ts`, `tool-contracts.test.ts`. **First red:** Free-form strings, malformed discriminators, and unknown tool names are not yet rejected by a missing schema. **Expected implementation:** Strict Zod 4 discriminated union, supported tool-name enum, patch and structured-command contracts, normalized tool request envelope, and sanitized tool result envelope.

- [ ] Add valid ToolAction/FinishAction and invalid free-form/multi-action/unknown-tool tests.
- [ ] Run focused shared tests; confirm missing-schema red.
- [ ] Add minimal strict response schemas.
- [ ] Add per-tool argument tests plus `ToolRequestSchema` and `ToolResultSchema` tests and minimal schemas.
- [ ] Rerun to green; refactor bounded primitives and exports.
- [ ] Run package test/typecheck; update logs/status; commit and record hash.

**Done:** Only one registered structured action can parse, and normalized tool requests/results are tested and exported. **Parallel:** No. **Status:** Complete. **Commit:** `7397339` (`feat: add agent response tool contracts`).

#### T02c — Safe display, event, and API schemas

**Goal:** Complete shared display/event/HTTP contracts and rationale isolation. **Dependencies:** T02b. **Files:** `packages/shared/src/safe-display.ts`, `events.ts`, `api-contracts.ts`, `index.ts`; corresponding shared tests. **First red:** Hostile markup/secret/path sentinels remain unsanitized. **Expected implementation:** Deterministic limit, escape, redaction, event cursor, and DTO schemas.

- [ ] Add rationale truncation/escape/redaction tests.
- [ ] Run focused tests; confirm unsanitized/missing-function red.
- [ ] Implement minimal `sanitizeRationale`.
- [ ] Add event/API schema tests and minimal implementations.
- [ ] Refactor shared bounded-string helpers; rerun package tests.
- [ ] Update logs/status; commit and record hash.

**Done:** T02 acceptance holds and rationale is excluded from hashable data. **Parallel:** No. **Status:** Complete. **Commit:** `5107713` (`feat: add shared display api event contracts`).

#### T03a — Core repository, UnitOfWork, and clock ports

**Goal:** Define every inward-facing core port before any adapter. **Dependencies:** T02c. **Files:** core manifests, `packages/core/src/ports/repositories.ts`, `clock.ts`, `tool-gateway.ts`, `validation-runner.ts`, `workspace-fence.ts`, `llm-client.ts`, `index.ts`, `packages/core/test/ports.test.ts`. **First red:** Fake port conformance test cannot import interfaces/helpers. **Expected implementation:** Domain-facing ports only, including atomic proposal/decision/event persistence, `ToolGatewayPort`, `ValidationRunner`, `WorkspaceFencePort`, and `LlmClientPort`.

- [ ] Add compile/runtime fake-port contract test.
- [ ] Run `pnpm --filter @gcah/core test -- ports`; confirm missing exports.
- [ ] Add minimal repository, `UnitOfWork`, `Clock`, `ToolGatewayPort`, `ValidationRunner`, `WorkspaceFencePort`, and `LlmClientPort` contracts.
- [ ] Add `SystemClock`; rerun tests.
- [ ] Refactor port method names for one responsibility; typecheck.
- [ ] Update logs/status; commit and record hash.

**Done:** Adapters can be built without core importing persistence. **Parallel:** No. **Status:** Complete. **Commit:** `adc7ad3` (`feat: add core port contracts`).

#### T03b — Deterministic in-memory repositories

**Goal:** Implement all T03a ports with required uniqueness and cursor invariants. **Dependencies:** T03a. **Files:** persistence manifests, `packages/persistence/src/in-memory.ts`, `index.ts`, `packages/persistence/test/in-memory.test.ts`. **First red:** One-active-Run, serial Step, and cursor tests fail against absent adapter. **Expected implementation:** Clone-safe maps and atomic UnitOfWork.

- [ ] Add invariant tests using fake clock.
- [ ] Run `pnpm --filter @gcah/persistence test`; confirm missing adapter red.
- [ ] Add minimal maps/indexes and atomic writes.
- [ ] Rerun focused tests to green.
- [ ] Refactor clone/index helpers and add deterministic reset.
- [ ] Run package test/typecheck; update logs/status; commit and record hash.

**Done:** T03 acceptance holds. **Parallel:** No. **Status:** Complete. **Commit:** `de920fe` (`feat: add in-memory repositories`).

#### T16a — LlmClient and scripted MockLlmClient

**Goal:** Implement deterministic single-response scripts and request capture against the core-owned client port. **Dependencies:** T02c and T03a. **Files:** LLM manifests, `packages/llm/src/mock-client.ts`, `errors.ts`, `index.ts`, `packages/llm/test/mock-client.test.ts`. **First red:** Script sequencing/request capture imports are missing. **Expected implementation:** Offline `MockLlmClient` implementing core `LlmClientPort`; no duplicate client port in `packages/llm`.

- [x] Add response sequencing and exhaustion tests.
- [x] Run `pnpm --filter @gcah/llm test`; confirm missing-client red.
- [x] Import core `LlmClientPort` and add only the minimal scripted queue implementation.
- [x] Rerun tests; add usage/missing-usage case.
- [x] Refactor immutable request capture; typecheck.
- [x] Update logs/status; commit and record hash.

**Done:** Mock is deterministic and makes no network call. **Parallel:** Yes after T02c. **Status:** Complete. **Commit:** `1248ec6` (`feat: add scripted mock llm client`).

#### T16b — Context builder, protocol retry, and completion gate

**Goal:** Build bounded context and decide whether a response may proceed or complete. **Dependencies:** T04, T06, T13–T15, T16a. **Files:** `packages/core/src/loop/context-builder.ts`, `completion-gate.ts`; tests `context-builder.test.ts`, `completion-gate.test.ts`. **First red:** Over-budget memory/protocol errors/unvalidated FinishAction are not handled. **Expected implementation:** Pure context and completion decisions.

- [x] Add bounded-context and FinishAction rejection tests.
- [x] Run focused core tests; confirm missing-function red.
- [x] Implement minimal context selection and completion gate.
- [x] Add protocol retry/missing-usage warning assertions.
- [x] Refactor pure decision types; rerun tests/typecheck.
- [x] Update logs/status; commit and record hash.

**Done:** FinishAction cannot bypass approval/failure/validation/budget gates. **Parallel:** No. **Status:** Complete. **Commit:** `1529c59` (`feat: add loop context and completion gates`).

#### T16c — Serial agent-loop orchestration

**Goal:** Integrate only injected core ports into one serial, persisted-before-effect loop. **Dependencies:** T03a and T16b. **Files:** `packages/core/src/loop/agent-loop.ts`, `packages/core/test/agent-loop.test.ts`. **First red:** Scripted end-to-end loop scenario has no orchestrator. **Expected implementation:** One Step/action at a time through injected `LlmClientPort`, `ToolGatewayPort`, `ValidationRunner`, repositories, and clock; core imports no governance or adapter package.

- [x] Add dangerous-action and feedback-correction loop tests.
- [x] Run focused test; confirm missing-loop red.
- [x] Implement one ToolAction iteration by calling injected `ToolGatewayPort`; preserve persist-before-effect ordering.
- [x] Add approval pause/reject and FinishAction branches.
- [x] Refactor pure planning from effects; run core/LLM tests and verify.
- [x] Update logs/status; commit and record hash.

**Done:** T16 acceptance holds offline. **Parallel:** No. **Status:** Complete. **Commit:** `4207e6a` (`feat: add serial agent loop`), boundary test `e697991` (`test: add core loop import boundary`).

#### T18a — Fastify composition and REST run/approval APIs

**Goal:** Expose schema-validated run, status, cancel, clone, approval, config, credential-status, and health routes. **Dependencies:** T09, T12, T14, T16c, and T17. **Files:** server manifests, `app.ts`, `composition.ts`, run/approval/config/credential/health routes and tests listed by T18. **First red:** Fastify injection returns missing routes. **Expected implementation:** Thin handlers calling server-side services only; composition injects governance/tools/persistence adapters into core ports.

- [x] Add health and create/status Run injection tests.
- [x] Run `pnpm --filter @gcah/server test -- runs`; confirm route-not-found red.
- [x] Add app/composition and minimal routes.
- [x] Add approval/cancel/clone/schema-error tests and handlers.
- [x] Refactor common error envelopes; rerun server tests/typecheck.
- [x] Update logs/status; commit and record hash.

**Done:** REST authority remains in core. **Parallel:** No. **Status:** Complete. **Commit:** `a0088a3` (`feat: add local server run routes`).

#### T18b — Local/self-hosted cookie auth and CSRF/Origin checks

**Goal:** Protect REST with injected admin-token storage and same-origin cookies. **Dependencies:** T18a. **Files:** `apps/server/src/auth/admin-auth.ts`, `csrf.ts`, `apps/server/test/auth.test.ts`. **First red:** Missing/wrong token and cross-origin mutations are accepted. **Expected implementation:** HttpOnly/SameSite cookie, explicit Secret mode, CSRF/Origin enforcement; plaintext admin tokens exist only inside the `AdminTokenStore`/authentication comparison boundary and never in domain/events/logs/serialized errors.

- [ ] Add unauthorized and cross-origin failing tests.
- [ ] Run focused auth test; observe security red.
- [ ] Add minimal auth hook and fake `AdminTokenStore` port.
- [ ] Add secure-cookie/self-hosted Secret cases; rerun green.
- [ ] Refactor auth error paths; typecheck.
- [ ] Update logs/status; commit and record hash.

**Done:** Browser-readable storage never receives bearer/admin token. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T18c — Persisted SSE replay and interruption startup handling

**Goal:** Stream only committed events and interrupt active Runs without replay. **Dependencies:** T18b. **Files:** `apps/server/src/routes/events.ts`, startup logic in `server.ts`, tests `sse.test.ts`, `restart.test.ts`. **First red:** Cursor reconnect/restart assertions fail. **Expected implementation:** `Last-Event-ID` replay and view/close/clone-only interruption.

- [ ] Add commit-before-publish and cursor replay tests.
- [ ] Run focused tests; confirm missing SSE red.
- [ ] Implement persisted query then live publish.
- [ ] Add startup interruption and no-resume/replay tests/implementation.
- [ ] Refactor subscriber cleanup; rerun server tests.
- [ ] Update logs/status; commit and record hash.

**Done:** T18 acceptance holds. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T21a — CLI HTTP client and run lifecycle commands

**Goal:** Submit/status/cancel/clone Runs through shared DTOs. **Dependencies:** T18c. **Files:** CLI manifests, `src/client.ts`, `main.ts`, `commands/run.ts`, `status.ts`, tests `run.test.ts`, `output.test.ts`. **First red:** Command invocation cannot reach fake server or print Run ID. **Expected implementation:** Thin HTTP client and canonical status formatter.

- [ ] Add fake-server submit/status tests.
- [ ] Run `pnpm --filter @gcah/cli test -- run`; confirm missing-command red.
- [ ] Add minimal parser/client/run commands.
- [ ] Add cancel/clone/output tests and implementation.
- [ ] Refactor shared formatter; rerun CLI tests/typecheck.
- [ ] Update logs/status; commit and record hash.

**Done:** Run lifecycle commands pass. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T21b — CLI approval and configuration commands

**Goal:** Support once/session approval, rejection reason, and non-sensitive config status. **Dependencies:** T21a and T08 HTTP contracts. **Files:** `apps/cli/src/commands/approval.ts`, `config.ts`, tests `approval.test.ts`, `config.test.ts`. **First red:** Approval scope/status output commands are absent. **Expected implementation:** DTO-only calls with no local policy.

- [ ] Add approval list/approve/reject tests.
- [ ] Run focused CLI tests; confirm missing-command red.
- [ ] Add minimal approval commands.
- [ ] Add config-status test/command.
- [ ] Refactor common option validation; rerun tests.
- [ ] Update logs/status; commit and record hash.

**Done:** CLI never calculates authorization. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T21c — CLI credential and server commands

**Goal:** Add hidden credential lifecycle and server-start UX. **Dependencies:** T19, T20, T21b. **Files:** `apps/cli/src/commands/credential.ts`, `server.ts`, `hidden-input.ts`, `apps/cli/test/credential.test.ts`, `server.test.ts`. **First red:** Captured output echoes sentinel or commands are missing. **Expected implementation:** No-echo input, status-only output, explicit `.env` warning.

- [ ] Add hidden-input/status non-exposure tests.
- [ ] Run focused tests; confirm missing/leaking red.
- [ ] Add minimal credential lifecycle commands.
- [ ] Add server-start/backend-unavailable tests and command.
- [ ] Refactor sanitized errors; run all CLI tests.
- [ ] Update logs/status; commit and record hash.

**Done:** T21 acceptance holds. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T22a — WebUI shell, Run list, timeline, and validation views

**Goal:** Render canonical status, event order, risk, pause guidance, and validation details. **Dependencies:** T18c. **Files:** WebUI manifests/config, `main.tsx`, `app.tsx`, API client, Run/timeline/validation/status components, CSS and tests listed by T22. **First red:** Component tests cannot render missing views. **Expected implementation:** Accessible observation-only components.

- [ ] Add Run/timeline/validation rendering tests.
- [ ] Run `pnpm --filter @gcah/webui test`; confirm missing-component red.
- [ ] Add minimal app and components.
- [ ] Add hostile-rationale-as-text and pause-guidance assertions.
- [ ] Refactor status styles/accessibility; run test/build.
- [ ] Update logs/status; commit and record hash.

**Done:** Observation views pass without policy logic. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T22b — WebUI approval controls and SSE reconnection

**Goal:** Submit once/session decisions and recover event gaps by cursor. **Dependencies:** T22a. **Files:** `apps/webui/src/api/sse.ts`, `components/ApprovalPanel.tsx`, their tests. **First red:** Approval submit and reconnect cursor expectations fail. **Expected implementation:** Same-origin EventSource plus REST approval calls.

- [ ] Add approval and cursor-reconnect tests.
- [ ] Run focused WebUI tests; confirm missing behavior red.
- [ ] Add minimal ApprovalPanel and SSE cursor tracking.
- [ ] Add missed-event fetch and duplicate-cursor tests.
- [ ] Refactor connection cleanup; run test/build.
- [ ] Update logs/status; commit and record hash.

**Done:** Browser remains a client, not an authority. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T22c — Fastify static hosting for local/Docker/self-hosted

**Goal:** Serve the built React app from one Fastify process only for local/Docker/self-hosted and preserve API/SSE routing; Cloudflare production uses Pages + Workers. **Dependencies:** T18c and T22b. **Files:** `apps/server/src/static-webui.ts`, `apps/server/src/app.ts`, `apps/server/test/static-webui.integration.test.ts`, `apps/webui/vite.config.ts`. **First red:** Local production-mode server returns 404 or intercepts `/api`/SSE. **Expected implementation:** Static asset plugin, non-API HTML fallback, cache policy, built-asset integration fixture.

- [ ] Build WebUI test fixture and add `/`, asset, SPA-route, API, and SSE assertions.
- [ ] Run `pnpm --filter @gcah/server test -- static-webui`; confirm 404/interception red.
- [ ] Add minimal static registration and index fallback excluding API/SSE paths.
- [ ] Add hashed-asset cache and missing-index error tests.
- [ ] Refactor route predicates; run WebUI build and server integration test.
- [ ] Update logs/status; commit and record hash.

**Done:** One Fastify process serves local/Docker/self-hosted UI/API/SSE correctly; no claim is made for Cloudflare production. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T26a — Reproducible Linux amd64 runtime image

**Goal:** Build and smoke-test the self-hosted/course single-container runtime locally. **Dependencies:** T17, T18c, T22c, T23, and T25. **Files:** `Dockerfile`, `.dockerignore`, `scripts/test-container-contract.test.ts`, root scripts project config. **First red:** Container-contract test cannot find image metadata/health/static app. **Expected implementation:** Multi-stage non-root runtime with `/data`, workspace mount, fixed demo, no secrets, and explicit credential-backend-unavailable behavior in headless environments.

- [ ] Add container metadata/health/sentinel contract test in root `scripts` Vitest project.
- [ ] Run `pnpm test -- --project scripts`; confirm missing-image-contract red.
- [ ] Add minimal multi-stage Dockerfile and ignore rules.
- [ ] Build `linux/amd64`, run health/UI smoke, rerun contract.
- [ ] Refactor layers/runtime permissions and rescan image.
- [ ] Update logs/status; commit and record hash.

**Done:** Local image acceptance passes. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T26b — Public registry publishing in both CI systems

**Goal:** Publish versioned Linux amd64 tags and record immutable digest. **Dependencies:** T26a and T25. **Files:** `.github/workflows/image.yml`, `.gitlab-ci.yml`, `scripts/test-ci-contract.ts`. **First red:** CI contract lacks buildx/platform/public-push/digest steps. **Expected implementation:** Registry auth only at CI boundary; anonymous pull verification.

- [ ] Extend CI-contract assertions for platform, tags, push, and digest artifact.
- [ ] Run scripts Vitest project; confirm missing-workflow red.
- [ ] Add minimal GitHub image workflow.
- [ ] Add equivalent GitLab image job.
- [ ] Refactor shared variables; run contract and anonymous pull check.
- [ ] Update logs/status; commit and record hash.

**Done:** T26 acceptance holds. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T27a — Public deployment and reproducible operator documentation

**Goal:** Deploy fixed public demo and document exact Windows/Docker/operator flows. **Dependencies:** S02, T23, T26b. **Files:** `deploy/public-demo.env.example`, `docs/deployment.md`, `README.md`, platform manifest only after documented PLAN revision if mandated. **First red:** Clean-room command/deployment checklist finds missing or mismatched commands. **Expected implementation:** Exact mounts, ports, credentials, rollback, LocalExecutor warning, interruption semantics, URLs/digest.

- [ ] Add a documentation contract checklist for required commands/sections.
- [ ] Run checklist; confirm missing-section red.
- [ ] Write minimal README build/run and deployment guide.
- [ ] Validate Pages/Workers/Wrangler configuration and D1 migration locally; reserve actual deployment for a separately authorized human step.
- [ ] Refactor commands to match executed commands; rerun clean-room smoke.
- [ ] Update logs/status; commit and record hash.

**Done:** Cloudflare artifacts and manual deployment/domain/HTTPS instructions are reproducible; reachability is accepted only after separately authorized deployment. **Parallel:** No. **Status:** Not started. **Commit:** — (record after execution).

#### T27b — Final security and acceptance evidence

**Goal:** Close every SPEC §10 criterion and all Critical/High security findings. **Dependencies:** T27a and all prior PRs. **Files:** `scripts/scan-secrets.test.ts`, `docs/security-review.md`, `README.md`, `AGENT_LOG.md`. **First red:** Seeded sentinel is not detected and acceptance evidence matrix is incomplete. **Expected implementation:** Automated sentinel scan plus recorded manual/automated checks across every boundary.

- [ ] Add seeded positive/negative secret-scanner tests to scripts Vitest project.
- [ ] Run scripts project; confirm missing-scanner red.
- [ ] Implement minimal scanner and rerun green.
- [ ] Execute path, command, approval, CSRF/SSE, rate, secret, interruption, lockfile, CI/image/demo checks.
- [ ] Fix and re-review every Critical/High finding; record evidence matrix.
- [ ] Run final verify/demo/scanner, update status/log, commit and record hash.

**Done:** T27 and SPEC acceptance hold with no unresolved Critical/High issue. **Parallel:** Final serial gate. **Status:** Not started. **Commit:** — (record after execution).

## 3. Pre-formal-development gates

### Gate CS: One-worktree sequential cold-start specification validation

**Goal:** Within a hard two-hour wall-clock timebox, prove that one different-type fresh agent can bootstrap T01 and begin the shared response protocol using only `SPEC.md` and `PLAN.md`, without allowing experimental code to contaminate formal development.

**Dependencies:** Human approval of this PLAN.

**Cold-start sequence:** The same fresh agent first attempts T01a then T01b, together constituting the complete T01 scope, and only then begins T02a/T02b/T02c in order in the same disposable worktree. T05 is not a cold-start candidate because it depends on T02 and cold-start artifacts cannot be reused outside this worktree. Completing all of T02 within the timebox is not required.

**Exact paths:** The disposable worktree may create only paths listed by T01 and T02. After findings are reviewed, the permanent branch is allowed and required to update exactly `SPEC.md`, `PLAN.md`, `SPEC_PROCESS.md`, and `AGENT_LOG.md`.

**Precedence:** Gate CS overrides all formal child-task closeout instructions. The fresh cold-start agent must not update `PLAN.md` or `AGENT_LOG.md`, must not commit, and must not record formal task hashes inside the disposable worktree. Those closeout steps resume only on the permanent branch when documenting cold-start findings.

- [ ] Create one disposable branch and one disposable worktree from the approved documentation commit.
- [ ] Start one different-type fresh agent with access only to repository `SPEC.md` and `PLAN.md`; do not pass chat history, memory, or explanations.
- [ ] Start a hard two-hour wall-clock timer when the fresh agent begins; the agent must stop immediately on ambiguity and ask rather than spend the timebox guessing.
- [ ] Instruct the agent to attempt T01a then T01b; only after both are attempted may it begin T02a, followed by later T02 children as time permits.
- [ ] At two hours, stop the experiment even if a test, T02 child, or refactor remains incomplete. Partial implementation and partial validation caused by timeout are valid cold-start evidence, not failure to follow the plan.
- [ ] During the disposable attempt, ignore formal task steps that say to update `PLAN.md`/`AGENT_LOG.md`, commit, or record hashes; capture findings in external evidence instead.
- [ ] Record in `SPEC_PROCESS.md`: questions and assumptions, blockers, interpretations that diverged from intent, actual versus expected output, validation results, and proposed SPEC/PLAN diffs.
- [ ] Do not merge, cherry-pick, copy, or otherwise reuse any cold-start test, source, lockfile, or generated artifact.
- [ ] Delete or mark the entire temporary worktree/branch abandoned; discard T01 and T02 together and reuse no file, diff, lockfile, test, or implementation.
- [ ] Apply only reviewed documentation corrections to `SPEC.md`, `PLAN.md`, `SPEC_PROCESS.md`, and `AGENT_LOG.md`, recording the timebox boundary and partial-result status, then obtain renewed human approval.

**Completion:** The sequential two-hour experiment—including partial T02 work if time expired—is documented, the whole disposable worktree is absent from the formal branch, all four permanent documentation/log files are updated and committed, and the revised plan is approved.

### Spike S01: Select the system credential-store backend

**Dependencies:** Gate CS complete and documentation revisions approved.

**PR/worktree:** Disposable `spike/credential-store`; findings-only commit on documentation branch.

**Exact paths:** Disposable probe under `.spikes/credential-store/**`; permanent report `docs/spikes/credential-store.md`; required decision entry in `AGENT_LOG.md`.

**Procedure:** Probe maintained `cross-keychain` first against Windows Credential Manager, document API shape and failure behavior, then assess macOS Keychain and Linux Secret Service as best-effort from primary documentation or available runners. Verify set/get/status/clear, unavailable-backend errors, and absence of plaintext fallback. Do not use a real course API key; use a disposable sentinel.

**Validation:** Run only the disposable probe's isolated command documented in its README; search its output and filesystem for the sentinel; delete the disposable worktree afterward.

**Completion:** `docs/spikes/credential-store.md` selects `cross-keychain`, records Windows-only runtime evidence, untested macOS/Linux/Docker status, allowed/rejected backends, packaging constraints, and fail-closed adapter design used by T19. Disposable code is deleted; only the report remains.

**Parallel:** Yes, with S02. **Status:** Findings complete; conclusion written back, no formal implementation started. **Commit:** —.

### Spike S02: Select the public hosting platform

**Dependencies:** Gate CS complete and documentation revisions approved.

**PR/worktree:** Disposable `spike/hosting`; findings-only worktree.

**Exact paths:** Disposable evidence under `.spikes/hosting/**`; permanent report `docs/spikes/hosting.md`; required decision entry in `AGENT_LOG.md`.

**Procedure:** Validate Cloudflare Pages for React + Vite, Workers for Fetch API/SSE, D1 for relational persistence, and optional Durable Objects for per-run coordination/fan-out. Do not log in, authorize, create tokens, deploy, or change domains/DNS during the spike.

**Validation:** Deploy and remove the placeholder service; verify HTTPS URL, Secret non-exposure, persistent mount semantics, and documented teardown.

**Completion:** `docs/spikes/hosting.md` records the Pages + Workers + D1 topology, optional Durable Objects, persistence/SSE boundaries, Docker's separate role, and manual authorization steps used by T26–T27. S02 performs no Cloudflare login, authorization, token creation, deployment, domain, DNS, or HTTPS operation and does not claim a real remote deployment. Disposable code is deleted; only the report remains.

**Parallel:** Yes, with S01. **Status:** Architecture findings complete; no remote deployment performed. **Commit:** —.

---

## 4. Formal TDD implementation tasks

### Task T01: Bootstrap the pnpm workspace and quality contract

**Goal:** Establish reproducible workspace scripts and an offline test/lint/typecheck baseline.

**Dependencies:** Gate CS, S01, and S02 complete; revised SPEC/PLAN approved.

**PR/worktree:** PR-01 / `feat/foundation-contracts`.

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.js`, `vitest.workspace.ts`, `.npmrc`, `.gitignore`, `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/test/smoke.test.ts`; modify `AGENT_LOG.md` only if a security-sensitive dependency decision requires a record.

**Expected implementation:** Pin the package manager and exact dependency versions in the lockfile; define `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm verify`; use frozen-lockfile-ready settings; control dependency build scripts through an explicit pnpm allowlist; exclude `.env`; export one smoke constant so all three quality tools have a real target.

**First failing test:** First create only the minimum non-product test runner/workspace scaffolding needed for Vitest to start successfully. Then add this behavioral test:

```ts
import { describe, expect, it } from "vitest";
import { workspaceReady } from "../src/index.js";
describe("workspace", () => it("exports the shared package", () => expect(workspaceReady).toBe(true)));
```

**Expected red:** `pnpm --filter @gcah/shared test` starts Vitest correctly and fails only because `workspaceReady` is not exported from `packages/shared/src/index.ts`. A missing `package.json`, missing runner, unresolved Vitest binary, or invalid configuration is scaffolding failure and does not count as the red phase.

**Minimum implementation:**

- [ ] Add the minimum root/shared manifests and Vitest workspace configuration, then run an empty/smoke runner invocation to prove Vitest starts; do not claim red yet.
- [ ] Ensure `packages/shared/src/index.ts` exists as an empty module, then add the test importing missing `workspaceReady` and run `pnpm --filter @gcah/shared test` to observe the intended missing-export failure.
- [ ] Add only `export const workspaceReady = true as const;` and rerun the focused package test to green.
- [ ] Add shared TS/ESLint configuration and root scripts where `verify` runs lint, typecheck, and test, with no network-bearing hooks.
- [ ] Run `pnpm install` once to create the lockfile with the explicit build-script allowlist, then verify `pnpm install --frozen-lockfile` makes no changes.

**Refactor:** Remove duplicated compiler/lint settings, ensure package exports use ESM consistently, and keep every script platform-neutral.

**Verification:** `pnpm --filter @gcah/shared test` → PASS; `pnpm lint` → exit 0; `pnpm typecheck` → exit 0; `pnpm verify` → exit 0; `pnpm install --frozen-lockfile` → no lockfile changes.

**Done:** Fresh Windows and Linux `amd64` environments can install from the lockfile and run all quality commands offline after dependency acquisition; `.env` is ignored.

**Parallel:** No, foundation task. **Status:** Not started. **Commit:** — (record after execution).

### Task T02: Define shared entities and strict AgentResponse schemas [COLD-START SEQUENCE AFTER T01]

**Goal:** Make all persisted entities, statuses, `ToolAction | FinishAction`, safe rationale, tool arguments, events, and HTTP DTOs runtime-validatable.

**Dependencies:** T01. In cold-start validation, the same fresh agent must complete disposable T01 first and then attempt disposable T02 in the same worktree; no simulation or cross-worktree reuse is allowed.

**PR/worktree:** PR-01 / `feat/foundation-contracts`.

**Files:** Create `packages/shared/src/status.ts`, `entities.ts`, `agent-response.ts`, `tool-contracts.ts`, `events.ts`, `api-contracts.ts`, `safe-display.ts`; modify `packages/shared/src/index.ts`; create tests `packages/shared/test/agent-response.test.ts`, `status.test.ts`, `entities.test.ts`, `safe-display.test.ts`, `tool-contracts.test.ts`, `events.test.ts`, `api-contracts.test.ts`.

**Interfaces:** Produces `AgentResponseSchema`, `ToolActionSchema`, `FinishActionSchema`, `RunStatus`, `StepStatus`, `ActionStatus`, `StopReason`, `BudgetStopDetail`, complete entity schemas from SPEC §6, `ToolRequestSchema`, `ToolResultSchema`, `RunEventSchema`, and `sanitizeRationale(input, policy)`. Ownership is fixed here: T02a owns all entity/status schemas, T02b owns `AgentResponseSchema`, per-tool argument schemas, `ToolRequestSchema`, and `ToolResultSchema`, and T02c owns safe display, event schemas, and HTTP DTO schemas.

**First failing test:**

```ts
expect(AgentResponseSchema.parse({kind:"tool",tool:"read",args:{path:"a.ts"},rationale:"inspect"}).kind).toBe("tool");
expect(() => AgentResponseSchema.parse({tool:"read",args:{path:"a.ts"},rationale:"inspect"})).toThrow();
expect(() => AgentResponseSchema.parse("please read a.ts")).toThrow();
```

Also assert the complete Run/Action enum sets, required `BudgetStopDetail` fields, patch triplet, structured command fields, output limits, and that sanitization limits length, escapes markup, and redacts configured secret/path sentinels.

**Expected red:** Imports/exports are missing; permissive natural language cannot yet be rejected by a schema.

**Minimum implementation:**

- [ ] Define exact Zod discriminators and derive TypeScript types from schemas.
- [ ] Add each SPEC entity/status, including `StepStatus`, with explicit required/optional/nullable constraints and without API-key plaintext fields.
- [ ] Define per-tool argument schemas, including `patch(path, baseSha256, unifiedDiff)` and `run_command(executable,args,cwd,timeout)`.
- [ ] Define `ToolRequestSchema` as the normalized request envelope consumed by governance/tool gateway, and `ToolResultSchema` as the sanitized result envelope persisted and returned to clients.
- [ ] Implement deterministic rationale truncation, escaping, credential redaction, and sensitive-path redaction; exclude rationale from hashable action data.
- [ ] Export stable DTO schemas for later server/CLI/WebUI use.
- [ ] Perform a parent acceptance audit before closing T02: verify every SPEC §6 entity, every status enum, `ToolRequestSchema`, `ToolResultSchema`, and every supported tool argument schema has at least one focused test and public export.

**Refactor:** Centralize bounded-string and identifier helpers; eliminate duplicated enum literals; preserve JSON-serializable contracts.

**Verification:** `pnpm --filter @gcah/shared test`; `pnpm lint`; `pnpm typecheck`.

**Done:** Invalid/free-form responses never produce an action; unknown tool names fail schema/protocol validation; every status/entity in SPEC §§3 and 6 validates with explicit required/optional/nullable semantics; `ToolRequestSchema`, `ToolResultSchema`, and all supported tool argument schemas are tested/exported; schemas contain no secret field; shared tests pass offline.

**Parallel:** Unlocks T03, T05, T09, and T14. **Status:** Not started. **Commit:** — (record after execution).

### Task T03: Define repository/clock ports and deterministic in-memory repositories

**Goal:** Provide dependency-injected persistence and time contracts with uniqueness, serial-step, event-cursor, and one-active-run invariants.

**Dependencies:** T02.

**PR/worktree:** PR-02 / `feat/core-domain`.

**Files:** Create `packages/core/package.json`, `tsconfig.json`, `src/ports/repositories.ts`, `src/ports/clock.ts`, `src/ports/tool-gateway.ts`, `src/ports/validation-runner.ts`, `src/ports/workspace-fence.ts`, `src/ports/llm-client.ts`, `src/index.ts`; create `packages/persistence/package.json`, `tsconfig.json`, `src/in-memory.ts`, `src/index.ts`; tests `packages/persistence/test/in-memory.test.ts` and `packages/core/test/ports.test.ts`.

**Interfaces:** Produces `RunRepository`, `ActionRepository`, `EventRepository`, `MemoryRepository`, `ConfigRepository`, `UnitOfWork`, `Clock`, `SystemClock`, `ToolGatewayPort`, `ValidationRunner`, `WorkspaceFencePort`, `LlmClientPort`, and `createInMemoryRepositories(clock)`.

**First failing test:** Create two active Runs for the same normalized workspace, append duplicate Step sequence numbers, and append events; expect the second active Run and duplicate sequence to reject while cursors return `[1,2]`.

**Expected red:** Repository ports/adapters do not exist and invariants cannot be enforced.

**Minimum implementation:** Define narrow repository methods; clone inputs/outputs to prevent mutation; enforce active-run and serial-step constraints atomically; assign monotonic event cursors only on successful writes; provide deterministic reset for tests.

**Refactor:** Extract shared map/index helpers without exposing storage internals; keep core independent of persistence package.

**Verification:** `pnpm --filter @gcah/persistence test`; `pnpm typecheck`; `pnpm lint`.

**Done:** In-memory repositories satisfy every invariant above and are the default test adapters.

**Parallel:** Yes, with T05/T09/T14 after T02. **Status:** Complete. **Commit:** `de920fe` (`feat: add in-memory repositories`), with review fix `ac05506` (`fix: resolve core domain review blockers`).

### Task T04: Implement Run/Action state machines and interruption policy

**Goal:** Encode legal state transitions, status/StopReason mapping, idempotency, cancellation, and non-resumable interruption.

**Dependencies:** T02–T03.

**PR/worktree:** PR-02 / `feat/core-domain`.

**Files:** Create `packages/core/src/state/run-machine.ts`, `action-machine.ts`, `transition-error.ts`; tests `packages/core/test/run-machine.test.ts`, `action-machine.test.ts`.

**Interfaces:** Produces `transitionRun(run,event)`, `transitionAction(action,event)`, `interruptActiveRuns(repositories,clock)`, and `cloneInterruptedRunAsPending(runId)` which copies only the original task/config reference, never actions.

**First failing test:** Assert `WAITING_APPROVAL` has no final reason, `COMPLETED` accepts only `COMPLETED`, `STOPPED` rejects `UNFIXABLE_FAILURE`, duplicate transition IDs are idempotent, and interrupted runs reject resume/replay.

**Expected red:** No transition functions or mapping enforcement exists.

**Minimum implementation:** Add exhaustive event unions and transition tables; persist transition IDs; map terminal statuses exactly as SPEC §6.2; support view/close/clone-only interruption behavior.

**Refactor:** Make illegal transitions return stable typed errors; use exhaustive `never` checks.

**Verification:** `pnpm --filter @gcah/core test -- run-machine action-machine`; `pnpm typecheck`; `pnpm lint`.

**Done:** Every legal and illegal transition has a deterministic test; no code path resumes or replays an interrupted action.

**Parallel:** No within PR-02; enables T13/T16. **Status:** Complete. **Commit:** `415782b` (`feat: add core state machines`).

### Task T05: Enforce workspace roots, real paths, overlap, traversal, and symlink safety

**Goal:** Reject any workspace or target path that escapes allowed roots or overlaps GCAH data, credential, or audit areas.

**Dependencies:** T02.

**PR/worktree:** PR-03 / `feat/safety-governance`.

**Files:** Create `packages/governance/package.json`, `tsconfig.json`, `src/path/workspace-fence.ts`, `src/path/path-error.ts`, `src/index.ts`; tests `packages/governance/test/workspace-fence.test.ts` and fixtures under `packages/governance/test/fixtures/path-cases/**` generated at test runtime.

**Interfaces:** Produces `createWorkspaceFence({allowedWorkspaceRoots,workspaceRoot,protectedRoots,fs})`, `validateWorkspace()`, `resolveExistingTarget(relativePath)`, and `resolveNewTarget(relativePath)`.

**First failing test:** In a temporary directory, assert acceptance under an allowed root and rejection of `..`, absolute external paths, a symlink to outside, an unallowed workspace, and parent/child/equal overlap with each protected root.

**Expected red:** Fence module is missing; naive path joining would permit escape or overlap.

**Minimum implementation:** Normalize platform paths; resolve allowed/workspace/protected real paths; use component-aware containment rather than string prefix; reject outside symlink targets; for new targets, realpath the nearest existing parent before containment checks.

**Refactor:** Inject the filesystem port for Windows/POSIX matrix tests; centralize case-sensitivity behavior without weakening real-path checks.

**Verification:** `pnpm --filter @gcah/governance test -- workspace-fence`; run on Windows native and Linux `amd64`; `pnpm typecheck`; `pnpm lint`.

**Done:** All path attacks and directory-overlap cases fail closed before tool execution.

**Parallel:** Yes, with T03/T09/T14 after T02. **Status:** Complete. **Commit:** `22e70ed` (`feat: add workspace fence`).

### Task T06: Implement budgets, usage accounting, and deterministic stop details

**Goal:** Enforce iteration, token, wall-clock, protocol-retry, and repeated-failure limits without treating missing token usage as zero.

**Dependencies:** T02, T03, and T04.

**PR/worktree:** PR-02 / `feat/core-domain`.

**Files:** Create `packages/core/src/budget/budget.ts`, `failure-window.ts`, `protocol-retries.ts`; tests `packages/core/test/budget.test.ts`, `failure-window.test.ts`.

**Interfaces:** Produces `BudgetTracker`, `BudgetCheck`, `recordUsage(usage | undefined)`, `recordFailureFingerprint(fingerprint)`, and `recordProtocolError()`.

**First failing test:** With a fake clock, independently exhaust every limit and assert exact `BudgetStopDetail`; pass missing usage and assert `usageUnavailable=true`, unchanged token total, warning event request, and continued enforcement by time/round limits.

**Expected red:** No accounting or stable stop detail exists.

**Minimum implementation:** Use immutable snapshots; check limits before each LLM/tool cycle; count protocol failures up to `maxProtocolRetries`; detect consecutive identical fingerprints; calculate nonnegative remaining values. When token budgeting is enabled but a response omits usage, set `usageUnavailable=true`, emit a cost-accounting warning, and never add an assumed zero. The Run may continue only under finite configured iteration and wall-clock hard limits; configuration must reject token-budget-enabled Runs that leave either fallback hard limit unbounded. The first reached iteration or wall-clock limit stops with `BUDGET_EXHAUSTED`; missing usage alone is not assigned a fabricated token exhaustion value.

**Refactor:** Share one limit-result constructor and inject clock; keep token accounting vendor-neutral.

**Verification:** `pnpm --filter @gcah/core test -- budget failure-window`; `pnpm typecheck`; `pnpm lint`.

**Done:** Each budget stops with the specified reason/detail; missing usage is visibly marked, never counted as zero, and can continue only while both finite iteration and wall-clock hard limits remain.

**Parallel:** Yes, with T13 after T04. **Status:** Complete. **Commit:** `7e7b98e` (`feat: add budget tracking`).

### Task T07: Implement deterministic three-level governance

**Goal:** Classify normalized actions as `ALLOW`, `REQUIRE_APPROVAL`, or `DENY` with stable rule IDs, risk categories, and explanations.

**Dependencies:** T05. Governance rules consume only shared normalized-action and policy-snapshot schemas; they do not import core budget/state modules.

**PR/worktree:** PR-03 / `feat/safety-governance`.

**Files:** Create `packages/governance/src/policy.ts`, `decision.ts`, `patch-risk.ts`, `public-demo-policy.ts`; tests `packages/governance/test/governance.test.ts`, `patch-risk.test.ts`, `public-demo-policy.test.ts`.

**Interfaces:** Produces `GovernanceEngine.decide(normalizedAction,policySnapshot,grants)` and `assessPatchRisk(...)`.

**First failing test:** Table-test safe reads and one-file small patches as ALLOW; overwrite/new/delete/large/config/lock/CI/network/dependency/Git/high-risk commands as REQUIRE_APPROVAL locally; path/credential/elevation/guardrail/audit violations as DENY; all commands/network/deps/real-LLM as DENY in public-demo.

**Expected red:** Governance engine is absent, so actions cannot be deterministically categorized.

**Minimum implementation:** Apply absolute DENY rules first; calculate patch file/line/size/sensitive-path thresholds; apply public-demo hard rules; return stable machine-readable rule data; never inspect rationale. Keep `@gcah/governance` dependent only on `@gcah/shared`; add a package-boundary assertion rejecting imports from core/tools/server/persistence.

**Refactor:** Convert policy ordering into explicit rule arrays with first-match evidence; add exhaustive coverage for every tool.

**Verification:** `pnpm --filter @gcah/governance test -- governance patch-risk public-demo-policy`; `pnpm typecheck`; `pnpm lint`.

**Done:** The complete SPEC risk matrix is table-tested and rationale changes never alter a decision.

**Parallel:** No; T08 depends on normalized decisions. **Status:** Complete. **Commit:** `9ca6187` (`feat: add deterministic governance engine`).

### Task T08: Implement approval requests, SessionGrant scope, hashes, expiry, and rejection feedback

**Goal:** Pause risky actions for informed approval and prevent approval replay or scope widening.

**Dependencies:** T07. The approval state machine is pure governance logic over shared schemas and does not import the core Run/Action state machine.

**PR/worktree:** PR-03 / `feat/safety-governance`.

**Files:** Create `packages/governance/src/approval/action-hash.ts`, `scope.ts`, `approval-service.ts`; tests `packages/governance/test/approval-service.test.ts`, `approval-hash.test.ts`.

**Interfaces:** Produces `normalizeActionForHash`, `normalizedActionHash`, `scopeHash`, `ApprovalService.request/approve/reject/authorize`, and one-time/session grant types.

**First failing test:** Approve an action, mutate args/path/command template/risk category, advance beyond expiry, and assert reapproval; reject once and assert one governance feedback, then repeat same denied class and assert `APPROVAL_REJECTED` with no tool execution.

**Expected red:** No hash-bound approval or expiry logic exists.

**Minimum implementation:** Canonically serialize trusted normalized fields only; exclude rationale; bind grants to tool, normalized path scope, command template, risk category, hash, run, and expiry round; re-hash immediately before dispatch; make duplicate approve/reject idempotent. Keep approval logic pure inside `@gcah/governance`, depending only on shared schemas and caller-supplied state.

**Refactor:** Isolate canonical JSON/hash utility; make rejection-feedback consumption atomic.

**Verification:** `pnpm --filter @gcah/governance test -- approval`; `pnpm typecheck`; `pnpm lint`.

**Done:** Parameter drift, expiry, wrong run, wrong scope, duplicate responses, and repeated denial are all deterministically covered.

**Parallel:** No; unlocks T12/T16. **Status:** Complete. **Commit:** `1c4814d` (`feat: add approval grants`).

### Task T09: Define executor ports and the mandatory governance ToolGateway

**Goal:** Ensure no registered tool has a public path around governance and authorization revalidation.

**Dependencies:** T03, T05, T07, and T08. T09 starts only after repository/`UnitOfWork`, governance, and approval interfaces exist.

**PR/worktree:** PR-04 / `feat/governed-tools`.

**Files:** Create `packages/tools/src/executor/executor.ts`, `fake-executor.ts`, `gateway/tool-registry.ts`, `gateway/tool-gateway.ts`; tests `packages/tools/test/tool-gateway.test.ts`.

**Interfaces:** Implements T03 `ToolGatewayPort` as `ToolGateway`; produces tools-local `Executor.execute(ExecutionRequest)`, `ToolDefinition`, and `ToolRegistry`; consumes T03 repository/`UnitOfWork` ports plus T07 `GovernanceEngine` and T08 `ApprovalService` from `@gcah/governance`. Tests inject fake core ports and fake governance/approval collaborators. No type or implementation is imported from tools back into core.

**First failing test:** Register a spy tool and assert schema validation, normalization, governance, approval re-hash, then execution order; assert DENY/WAITING_APPROVAL never call executor; assert persistence failure before dispatch prevents execution.

**Expected red:** Registry/gateway ports do not exist; direct execution cannot be prohibited.

**Minimum implementation:** Implement the already-defined core `ToolGatewayPort`; make tool implementations package-private behind registry; validate args; normalize paths/commands; persist proposal/decision through core repository ports/`UnitOfWork` before side effects; call governance and approval from the governance package; require ALLOW or valid grant; map exceptions to stable results without stacks.

**Refactor:** Separate pure preparation from side-effect dispatch and add an ordered trace fixture.

**Verification:** `pnpm --filter @gcah/tools test -- tool-gateway`; `pnpm typecheck`; `pnpm lint`.

**Done:** Tests prove every executor call has a persisted governance decision or valid approval and no bypass export exists.

**Parallel:** No before T03/T07/T08; after those dependencies it can run while T13?T15 proceed. T10 follows within PR. **Status:** Complete. **Commit:** `e046b0f` (`feat: add governed tool gateway`).

### Task T10: Implement list/read, bounded output, and safe LocalExecutor file access

**Goal:** Provide deterministic read-only workspace tools through the gateway.

**Dependencies:** T09.

**PR/worktree:** PR-04 / `feat/governed-tools`.

**Files:** Create `packages/tools/src/tools/list.ts`, `read.ts`, `output-limit.ts`, `executor/local-executor.ts`; tests `packages/tools/test/read-tools.test.ts`, `local-executor.test.ts`.

**Interfaces:** Registers `list` and `read`; implements file portions of `LocalExecutor`; returns unified `ToolResult` with elapsed time, truncation metadata, and side-effect summary `none`.

**First failing test:** List/read a temporary workspace, reject external/symlink paths, truncate oversized content without leaking remainder, and confirm no validation trigger is requested.

**Expected red:** File tools and bounded results are absent.

**Minimum implementation:** Resolve every target through workspace fence; use deterministic sort/order and encoding; enforce count/byte limits; describe errors using stable codes.

**Refactor:** Share bounded-output logic with later commands; document in type names that LocalExecutor is not an OS sandbox.

**Verification:** `pnpm --filter @gcah/tools test -- read-tools local-executor`; `pnpm typecheck`; `pnpm lint`.

**Done:** Read-only tools are bounded, fenced, audit-ready, and never request validation.

**Parallel:** No within PR-04. **Status:** Complete. **Commit:** `260ae6b` (`feat: add read-only local tools`).

### Task T11: Implement patch, write, and delete with stale-base and mutation semantics

**Goal:** Safely mutate workspace files while preferring patch and explicitly distinguishing create, overwrite, and delete.

**Dependencies:** T10 and T07–T08.

**PR/worktree:** PR-04 / `feat/governed-tools`.

**Files:** Create `packages/tools/src/tools/patch.ts`, `write.ts`, `delete.ts`, `unified-diff.ts`, `file-hash.ts`; tests `packages/tools/test/patch.test.ts`, `write-delete.test.ts`.

**Interfaces:** Registers `patch`, `write`, `delete`; produces mutation metadata `{changedPaths, mutationKind, validationRequired}` and `STALE_BASE`.

**First failing test:** Apply a valid diff; retry with wrong `baseSha256` and assert unchanged bytes plus `STALE_BASE`; reject empty-diff deletion; create only absent files; require a valid approval reference for overwrite/delete.

**Expected red:** Mutation tools and base-hash checks do not exist.

**Minimum implementation:** Hash current bytes immediately before apply; parse/apply one-file unified diff atomically; write through temporary sibling and rename; represent delete explicitly; emit validation-required only after successful mutation.

**Refactor:** Share atomic-file and hash helpers; keep governance outside tool bodies while enforcing executor preconditions such as base equality.

**Verification:** `pnpm --filter @gcah/tools test -- patch write-delete`; `pnpm typecheck`; `pnpm lint`.

**Done:** Stale patches never change files; overwrite/delete cannot execute without current authorization; successful mutations request validation.

**Parallel:** No within PR-04. **Status:** Complete. **Commit:** `3a6bec5` (`feat: add mutation file tools`).

### Task T12: Implement structured run_command and independent run_validation dispatch

**Goal:** Execute only immutable configured command templates without a system shell and keep validation unavailable as arbitrary LLM command execution.

**Dependencies:** T08–T11 and T04.

**PR/worktree:** PR-04 / `feat/governed-tools`.

**Files:** Create `packages/tools/src/command/template.ts`, `command-runner.ts`, `tools/run-command.ts`, `tools/run-validation.ts`; tests `packages/tools/test/command-template.test.ts`, `run-command.test.ts`, `run-validation.test.ts`.

**Interfaces:** `CommandRunner.run({executable,args,cwd,timeoutMs})`; template matcher consumes immutable `ConfigSnapshot`; tools supplies an adapter implementing core `ValidationRunner`; LLM-facing `run_validation` accepts a validator ID, not executable/args from LLM.

**First failing test:** Match an allowed executable/arg vector; reject metacharacters, undeclared args/templates, external cwd, timeout, and public-demo execution; verify spawn receives `shell:false`; verify LLM cannot override validator commands.

**Expected red:** No structured runner/template enforcement exists.

**Minimum implementation:** Exact-match executable and argument slots against config template; fence cwd; spawn directly with `shell:false`; cap time/output; kill on timeout; route validator IDs to snapshot commands only.

**Refactor:** Share subprocess result normalization and output limiting; retain a conspicuous LocalExecutor limitation comment and user-facing warning metadata.

**Verification:** `pnpm --filter @gcah/tools test -- command`; `pnpm typecheck`; `pnpm lint`.

**Done:** Tests prove system shell is never invoked, public demo cannot run commands, and LLM cannot alter validation commands.

**Parallel:** No; unlocks full loop. **Status:** Complete. **Commit:** `4c8185a` (`feat: add structured command tools`).

### Task T13: Implement validation orchestration, failure classification, fingerprints, and feedback

**Goal:** Turn configured test/lint/typecheck outcomes into stable objective feedback and stop unsafe automatic correction.

**Dependencies:** T04 and T06. Tests use a fake `ValidationRunner`; T12 later provides the production adapter without changing this task's dependency.

**PR/worktree:** PR-05 / `feat/feedback-memory`.

**Files:** Create `packages/core/src/validation/validator.ts`, `classifier.ts`, `fingerprint.ts`, `feedback.ts`; tests `packages/core/test/validation.test.ts`, `failure-classifier.test.ts`, `fingerprint.test.ts`.

**Interfaces:** Consumes T03 `ValidationRunner.runValidator(validatorId, configSnapshot)`; produces `ValidationService.validate(mutation,configSnapshot)`, `classifyFailure`, `fingerprintFailure`, and `FeedbackQueue.consumeOnce`; T12 later supplies the production runner while tests use a fake.

**First failing test:** Assert write/patch/dependency changes trigger required validators while list/read/memory_search do not; normalize timestamps from two equivalent failures to one fingerprint; classify assertion/lint/type as repairable and policy/infra/timeout/repeat as non-repairable.

**Expected red:** No trigger matrix, classifier, or stable fingerprint exists.

**Minimum implementation:** Select validator IDs from immutable snapshot; capture bounded results; parse stable codes/test IDs/file locations; remove volatile timestamps/paths; enqueue objective summaries once; block completion on missing/failed/timed-out required validation.

**Refactor:** Use classifier rule tables and golden fixtures; ensure feedback contains diagnosis/scope only, never generated fixes.

**Verification:** `pnpm --filter @gcah/core test -- validation failure-classifier fingerprint`; `pnpm typecheck`; `pnpm lint`.

**Done:** Equivalent failures share a fingerprint, trigger rules match SPEC, and completion readiness is objectively derivable.

**Parallel:** Yes, with T06 after T04. **Status:** Complete. **Commit:** `71f1efc` (`feat: add validation feedback services`), review fix `e1d0252` (`fix: address feedback memory review findings`).

### Task T14: Implement configuration loading, validation, merge order, and immutable snapshots

**Goal:** Load safe `.gcah/config.yaml` with defaults → project → CLI precedence and bind a hashed immutable snapshot to each Run without importing a concrete fence adapter.

**Dependencies:** T02 and T03. T14 consumes the core-defined `WorkspaceFencePort` with a fake in unit tests; server composition later injects the implementation from `@gcah/governance` created by T05.

**PR/worktree:** PR-05 / `feat/feedback-memory`.

**Files:** Create `packages/core/src/config/schema.ts`, `defaults.ts`, `loader.ts`, `snapshot.ts`; tests `packages/core/test/config.test.ts`, fixtures `packages/core/test/fixtures/config/**`.

**Interfaces:** Produces `loadConfig({workspace,cliOverrides,environmentMetadata,workspaceFence})` and `createConfigSnapshot(config)`; `workspaceFence` is the core `WorkspaceFencePort`; snapshot includes allowed roots, mode, budgets, validation and command templates, risk thresholds, non-secret LLM metadata, executor backend, schema version, hash.

**First failing test:** Verify precedence and immutable hash; reject unknown fields, illegal budgets, dangerous/overlapping roots, conflicting rules, an `apiKey` field, and missing required validation command.

**Expected red:** Config schema/loader is missing.

**Minimum implementation:** Strict Zod schema; YAML parsing as data only; explicit deep merge of allowed keys; invoke injected `WorkspaceFencePort` for workspace/protected roots; deep-freeze and hash canonical non-sensitive JSON. Do not import `@gcah/tools`; unit tests use a fake port and server integration uses `@gcah/governance`.

**Refactor:** Separate schema errors into field-addressable diagnostics; keep environment secret values outside inputs.

**Verification:** `pnpm --filter @gcah/core test -- config`; `pnpm typecheck`; `pnpm lint`.

**Done:** Snapshot cannot mutate after Run creation and no accepted config field can contain a secret.

**Parallel:** Yes, with T03/T09 after T02. **Status:** Complete. **Commit:** `ddfd7ff` (`feat: add core configuration snapshots`), review fix `e1d0252` (`fix: address feedback memory review findings`).

### Task T15: Implement bounded memory writes and keyword/tag retrieval

**Goal:** Store only project conventions, approval summaries, and classified failure summaries, then inject bounded relevant context without granting authority.

**Dependencies:** T02, T03, and T13.

**PR/worktree:** PR-05 / `feat/feedback-memory`.

**Files:** Create `packages/core/src/memory/memory-service.ts`, `retrieval.ts`, `memory-tool.ts`; tests `packages/core/test/memory.test.ts`.

**Interfaces:** Produces `MemoryService.addProjectConvention`, `recordApprovalSummary`, `recordFailureSummary`, `search({workspaceId,tags,keywords,limit,charBudget})`; registers read-only `memory_search`; no `memory_write` schema.

**First failing test:** Write each allowed source, reject an LLM-origin write, retrieve by keyword/tag under count/character budgets, isolate workspaces, and prove a historical approval is returned only as text—not a SessionGrant.

**Expected red:** Memory service/source controls are absent.

**Minimum implementation:** Require typed source constructors; tokenize normalized keywords; deterministic rank by exact tag/keyword then recency; truncate safely; emit summaries through injected repository.

**Refactor:** Keep ranking pure and storage-independent; remove any tool export capable of writing memory.

**Verification:** `pnpm --filter @gcah/core test -- memory`; `pnpm typecheck`; `pnpm lint`.

**Done:** Only three authorized sources can persist memory and retrieval is bounded, deterministic, and non-authoritative.

**Parallel:** Yes after T13; may proceed independently of server. **Status:** Complete. **Commit:** `4b209b5` (`feat: add bounded memory service`), review fix `e1d0252` (`fix: address feedback memory review findings`).

### Task T16: Implement MockLlmClient and the complete harness loop

**Goal:** Drive serial agent steps through protocol parsing, governance, approval, tools, validation, feedback, budgets, and safe completion.

**Dependencies:** T03, T04, T06, T13, T14, and T15. Concrete governance/tools/validation adapters are not dependencies; tests inject fakes for `ToolGatewayPort` and `ValidationRunner`.

**PR/worktree:** PR-06 / `feat/harness-loop`.

**Files:** Create `packages/llm/package.json`, `tsconfig.json`, `src/mock-client.ts`, `errors.ts`, `index.ts`; create `packages/core/src/loop/context-builder.ts`, `agent-loop.ts`, `completion-gate.ts`; tests `packages/llm/test/mock-client.test.ts`, `packages/core/test/agent-loop.test.ts`, `completion-gate.test.ts`.

**Interfaces:** Consumes T03 `LlmClientPort.complete(request): Promise<{response:unknown; usage?:TokenUsage}>` and `ToolGatewayPort`; `MockLlmClient(script)` implements the LLM port and records requests; `AgentLoop.start/continueAfterApproval/cancel` uses injected core ports only.

**First failing test:** Script: propose dangerous action → observe DENY/stop; mutate → validation fail → feedback → different patch → validation pass → FinishAction/COMPLETED; separately test protocol retries, approval pause/reject-once alternative, budgets, and FinishAction blocked before required validation.

**Expected red:** Mock client and orchestrating loop do not exist.

**Minimum implementation:** Build bounded context from task/config/memory/latest feedback; parse every response through `AgentResponseSchema`; create exactly one serial Step; persist before side effects; route ToolAction only through injected `ToolGatewayPort`; invoke injected validation capability only for mutations; consume feedback once; apply completion gate and stop checks. Add an import-boundary test proving `packages/core` has no import from `@gcah/tools`, `@gcah/persistence`, `@gcah/credentials`, `@gcah/llm`, or server paths.

**Refactor:** Split pure next-state planning from effects; keep HTTP/SQLite/vendor logic out; add event assertions that distinguish LLM proposal, decision, human action, tool result, and validation.

**Verification:** `pnpm --filter @gcah/llm test`; `pnpm --filter @gcah/core test -- agent-loop completion-gate`; `pnpm verify`.

**Done:** A scripted mock deterministically exercises every main-loop branch offline; code changes cannot complete without all required validation.

**Parallel:** No, integration point. **Status:** Complete. **Commit:** `4207e6a` (`feat: add serial agent loop`), boundary test `e697991` (`test: add core loop import boundary`), budget fix `9cd2582` (`fix: enforce loop token budget`), review fix `0d81c9d` (`fix: close harness loop review gaps`), re-review fix `8a8ec51` (`fix: handle approval resume edge cases`), final quality fix `0cfec9b` (`fix: fail approval consumption errors`).

### Task T17: Implement SQLite repositories and append-only audit persistence

**Goal:** Persist all non-sensitive state transactionally with the same behavior as in-memory adapters.

**Dependencies:** T03 and T16 contracts.

**PR/worktree:** PR-07 / `feat/persistence-server`.

**Files:** Create `packages/persistence/src/sqlite/database.ts`, `migrations/001-initial.sql`, `sqlite-repositories.ts`, `audit-log.ts`; tests `packages/persistence/test/repository-contract.ts`, `sqlite-repositories.test.ts`, `audit-log.test.ts`.

**Interfaces:** Implements all T03 repositories and `UnitOfWork`; exposes `openSqliteRepositories({dataDir,clock})` and append-only structured audit sink.

**First failing test:** Run the same repository contract suite against in-memory and temporary SQLite adapters; define the suite so T18d also runs it unchanged against D1. Force event write failure and assert transaction rollback plus no subsequent side-effect authorization; inspect schema/rows/log for a secret sentinel and expect no match.

**Expected red:** SQLite adapter/migration is missing.

**Minimum implementation:** Create normalized tables and uniqueness constraints; transactionally persist action/decision/event; allocate cursors monotonically; store sanitized summaries only; append audit records after committed state with explicit failure handling.

**Refactor:** Share repository contract tests; isolate SQL mapping from domain types; add migration-version check.

**Verification:** `pnpm --filter @gcah/persistence test`; `pnpm typecheck`; `pnpm lint`.

**Done:** In-memory and SQLite pass the shared contract suite, which is exported for D1 parity in T18d; database failure prevents side effects; no plaintext credential column/value exists.

**Parallel:** No within PR-07; T19 may proceed separately after S01. **Status:** Complete. **Commit:** `7a84c99` (`feat: add sqlite persistence adapter`).

### Task T18: Build the Fastify API, local/self-hosted auth, SSE, and restart behavior

**Goal:** Expose server-side run control and persisted event streaming without moving authority into clients.

**Dependencies:** T09, T12, T14, T16, and T17. Server is the composition root that injects governance, tools, validation, persistence, clock, and LLM adapters into core ports.

**PR/worktree:** PR-07 / `feat/persistence-server`.

**Files:** Create `apps/server/package.json`, `tsconfig.json`, `src/app.ts`, `server.ts`, `composition.ts`, `auth/admin-auth.ts`, `auth/csrf.ts`, routes `runs.ts`, `approvals.ts`, `events.ts`, `config.ts`, `credential-status.ts`, `health.ts`; tests `apps/server/test/auth.test.ts`, `runs.test.ts`, `approvals.test.ts`, `sse.test.ts`, `restart.test.ts`.

**Interfaces:** REST DTOs from shared package; same-origin HttpOnly/SameSite cookie; Origin/CSRF checks; SSE `Last-Event-ID` cursor replay after persisted events; defines an injected `AdminTokenStore` port tested with a fake and implemented by the credential adapter in T19.

**First failing test:** Reject missing/wrong auth and cross-origin mutations; create a Run and return ID; stream events only after repository commit; reconnect from cursor without gaps; simulate startup and mark active Runs INTERRUPTED with clone-not-resume behavior.

**Expected red:** Server/routes/auth/SSE do not exist.

**Minimum implementation:** Compose core/adapters once; local mode obtains a generated admin token through `AdminTokenStore`, self-hosted mode from explicit Secret; set secure cookie bootstrap flow; validate all input schemas; persist before publish; make SSE disconnect independent of core.

**Refactor:** Centralize error envelopes/auth hooks; keep route handlers thin and policy-free.

**Verification:** `pnpm --filter @gcah/server test`; `pnpm typecheck`; `pnpm lint`.

**Done:** API/SSE/auth/restart acceptance tests pass with fake credentials and no network beyond Fastify injection.

**Parallel:** After T17, can overlap T19/T22 preparation. **Status:** Not started. **Commit:** — (record after execution).

#### T18d — Cloudflare Worker HTTP/SSE composition root and D1 adapter

**Goal:** Add the independent Cloudflare production composition root without importing Fastify or SQLite. **Dependencies:** T17 and T18 shared HTTP/event contracts. **Files:** create `apps/worker/src/**`, D1 repository adapter and migration files, Worker HTTP/SSE tests, optional Durable Object coordination module, and Wrangler test configuration. **First red:** Worker REST/SSE contract and the shared repository suite fail because the Worker/D1 adapters do not exist. **Expected implementation:** Fetch-based Worker routes, D1 repository adapter plus migration, event-persist-before-publish, cursor/`Last-Event-ID` replay, disconnect recovery, and an optional Durable Object per-run coordination/fan-out layer enabled only when required. KV/R2 remain outside the relational repository contract.

**Verification:** Run the same repository contract against SQLite and D1; run Worker HTTP/SSE tests including reconnect after disconnect and replay from a persisted cursor; import-boundary test proves core has no D1/Worker/Fastify/SQLite imports. **Done:** D1 and SQLite satisfy one repository contract and Worker API/SSE behavior matches shared contracts. **Status:** Not started.

### Task T19: Implement the standalone credentials package and secret-isolation contract

**Goal:** Provide a fail-closed credential lifecycle using only validated OS credential-store backends.

**Dependencies:** S01 completed and T02 contracts available.

**PR/worktree:** PR-08 / `feat/credentials-llm-cli`.

**Files:** Create `packages/credentials/package.json`, `tsconfig.json`, `src/store.ts`, `src/admin-token-store.ts`, `src/os-store.ts`, `src/environment-source.ts`, `src/dotenv-source.ts`, `src/credential-resolver.ts`, `src/index.ts`; tests `packages/credentials/test/credential-store.test.ts`, `credential-resolver.test.ts`, `admin-token-store.test.ts`, `secret-isolation.test.ts`; modify `.gitignore` only to confirm `.env` coverage if necessary.

**Interfaces:** `CredentialStore.status/set/update/clear`, `CredentialResolver.withCredential(provider, callback)`, and the server's `AdminTokenStore`; core sees only `CredentialStatus`; precedence OS store → explicitly enabled environment → explicitly enabled `.env`.

**First failing test:** Fake each backend and assert only `native-windows`, `windows`, `native-macos`, `macos`, `native-linux`, and `secret-service` are accepted on their platforms; `file`, `null`, unknown, locked, and unavailable backends fail closed. Assert callback-scoped plaintext and sentinel absence from all persistence, logs, DTOs, browser state, and serialized errors.

**Expected red:** Credential ports and resolver are absent.

**Minimum implementation:** Add `cross-keychain` with its actual version locked by `pnpm-lock.yaml`; validate current backend before operations; allow only the platform-specific OS backend list and map unavailable/headless/Docker cases to `backend unavailable`; reject `file`, `null`, and unknown without fallback. Never return secrets from status or create plaintext/environment/`.env` fallback storage. `@gcah/llm` imports only the credential port/callback API.

**Refactor:** Share source result/error types; inject redactor without using logs as primary protection.

**Verification:** `pnpm --filter @gcah/credentials test`; `pnpm typecheck`; `pnpm lint`; `rg -n "<test-sentinel>"` over generated test artifacts returns no persisted match.

**Done:** Lifecycle and precedence tests pass; unavailable OS backend never silently falls back to a created file; plaintext appears only at the three permitted short-lived boundaries; no API/status/serialized error exposes it. Documentation states that JavaScript memory zeroization is not guaranteed.

**Parallel:** Yes, after S01; can overlap T17/T18. **Status:** Not started. **Commit:** — (record after execution).

### Task T20: Implement the OpenAI-compatible single-call adapter

**Goal:** Manually call a configurable course gateway model without embedding an agent runner or affecting default CI.

**Dependencies:** T02 and T19; consumes only `CredentialResolver.withCredential`, not concrete credential backends.

**PR/worktree:** PR-08 / `feat/credentials-llm-cli`.

**Files:** Create `packages/llm/src/openai-compatible.ts`, `provider-errors.ts`; tests `packages/llm/test/openai-compatible.test.ts`; create `scripts/integration-real-llm.ts` and `docs/integration-real-llm.md`.

**Interfaces:** Implements core `LlmClientPort`; consumes `baseUrl`, `model`, `providerName` plus callback-scoped key at the adapter call boundary; returns unknown response for strict core parsing and optional token usage. The key is not copied into request/domain DTOs or serialized errors.

**First failing test:** Against an injected fake HTTP transport, assert Chat Completions request shape, bearer key only in outbound header, DeepSeek/Qwen-neutral configuration, usage mapping/missing usage, and stable network/rate-limit/protocol errors; assert logs never contain the key.

**Expected red:** Adapter and error mapping are missing.

**Minimum implementation:** One HTTP completion per call; no agent SDK runner; timeout/abort support; map status and malformed response; pass response to shared parser boundary; gate manual script behind explicit flag and credential availability.

**Refactor:** Isolate transport for offline tests; keep provider names metadata-only.

**Verification:** `pnpm --filter @gcah/llm test -- openai-compatible` offline; `pnpm verify`; manual integration command documented but not run in default CI.

**Done:** Offline fake-transport suite passes; manual DeepSeek/Qwen instructions exist; missing usage is preserved as unavailable; no key is logged.

**Parallel:** Yes after T19; independent of server UI. **Status:** Not started. **Commit:** — (record after execution).

### Task T21: Build the CLI for run, status, approval, config, and credentials

**Goal:** Provide a thin authenticated server client with hidden credential input and consistent status vocabulary.

**Dependencies:** T18, T19, and T20.

**PR/worktree:** PR-08 / `feat/credentials-llm-cli`.

**Files:** Create `apps/cli/package.json`, `tsconfig.json`, `src/main.ts`, `client.ts`, commands `run.ts`, `status.ts`, `approval.ts`, `config.ts`, `credential.ts`, `server.ts`, and `hidden-input.ts`; tests `apps/cli/test/run.test.ts`, `approval.test.ts`, `credential.test.ts`, `output.test.ts`.

**Interfaces:** Commands `server start`, `run submit/status/cancel/clone`, `approval list/approve/reject`, `config status`, `credential status/set/update/clear`; consumes shared HTTP DTOs.

**First failing test:** With fake server/store, submit returns Run ID; status prints canonical terms; approve specifies once/session; hidden input never echoes; credential status never prints value; `.env` enablement emits explicit plaintext-risk warning.

**Expected red:** CLI package and commands are absent.

**Minimum implementation:** Parse commands deterministically; use server API for authority; acquire secret via no-echo prompt and pass it directly to the `CredentialStore` write boundary without placing it in command/domain objects or browser/server DTOs; minimize its local lifetime without claiming memory zeroization; sanitize all output; provide actionable backend-unavailable errors.

**Refactor:** Share output/error formatter and API client; keep policy logic out of CLI.

**Verification:** `pnpm --filter @gcah/cli test`; `pnpm typecheck`; `pnpm lint`.

**Done:** All documented lifecycle/task commands work against fake/injected server, and captured stdout/stderr contains no secret sentinel.

**Parallel:** No, integrates PR-08. **Status:** Not started. **Commit:** — (record after execution).

### Task T22: Build the React observation and approval WebUI

**Goal:** Display Runs, persisted events, validation results, and approval controls without placing policy logic in the browser.

**Dependencies:** T18 and shared DTOs from T02.

**PR/worktree:** PR-09 / `feat/web-public-demo`.

**Files:** Create `apps/webui/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `app.tsx`, `api/client.ts`, `api/sse.ts`, components `RunList.tsx`, `Timeline.tsx`, `ApprovalPanel.tsx`, `ValidationPanel.tsx`, `StatusBadge.tsx`, styles `src/styles.css`; tests `apps/webui/src/**/*.test.tsx`.

**Interfaces:** Same-origin cookie/SSE client consuming shared DTOs; UI may request approvals but cannot calculate governance decisions or state transitions.

**First failing test:** Render persisted event order and risk/validation details, submit one-time/session approval choices, reconnect SSE from the last cursor, show pause reasons/next actions, and ensure hostile rationale markup is rendered as text.

**Expected red:** The WebUI package, components, and SSE client are absent.

**Minimum implementation:** Build observation/approval views; keep all decisions server-side; use `EventSource` with same-origin cookies; track cursor and fetch missed events after reconnect; render only sanitized text and shared status terms.

**Refactor:** Extract accessible components and consistent status vocabulary; adopt Open Design `linear-app` if available, otherwise use concise engineering-console CSS and record reason in `AGENT_LOG.md`.

**Verification:** `pnpm --filter @gcah/webui test`; `pnpm typecheck`; `pnpm lint`; `pnpm --filter @gcah/webui build`.

**Done:** UI tests cover timeline, validation, approval, consistent statuses, pause guidance, and SSE reconnection; no authority or secret value exists in browser state.

**Parallel:** Yes after T18; can overlap T19–T21. **Status:** Not started. **Commit:** — (record after execution).

### Task T23: Add the anonymous restricted public-demo mode

**Goal:** Run only fixed Mock-LLM examples in resettable workspaces through an anonymous but capability-limited API.

**Dependencies:** T07, T18, and T22.

**PR/worktree:** PR-09 / `feat/web-public-demo`.

**Files:** Create `apps/server/src/public-demo.ts`, `rate-limit.ts`, `demo-workspace.ts`; create `packages/tools/src/executor/demo-executor.ts`, `packages/tools/src/validation/demo-validation-runner.ts`; tests `apps/server/test/public-demo.test.ts`, `demo-workspace.test.ts`, `packages/tools/test/demo-executor.test.ts`, `demo-validation-runner.test.ts`; create fixed template `examples/demo-workspace/README.md`, `examples/demo-workspace/src/example.ts`, `examples/demo-workspace/test/example.test.ts`.

**Interfaces:** Anonymous routes allow listing fixed examples, starting allowlisted `MockLlmClient` tasks, observing their events, and submitting demo approvals only; `DemoExecutor` implements the executor behavior without spawning a process; deterministic `DemoValidationRunner` implements core `ValidationRunner` from preset results; reset service copies the read-only template to a disposable workspace before each Run and discards it afterward.

**First failing test:** Reject uploads, arbitrary tasks/workspaces, credentials, real LLM, command execution, network and dependency actions; assert the public Worker composition contains no real LLM adapter and exposes no API-key field or transport route. Seed an API-key sentinel and prove it is absent from requests, responses, browser state/storage, logs, errors, D1, KV, and R2; spy on process-spawn/network APIs and assert zero calls.

**Expected red:** Public-demo composition, limiter, and reset service do not exist.

**Minimum implementation:** Add a separate public-demo composition root with `MockLlmClient`, `DemoExecutor`, deterministic `DemoValidationRunner`, and hard policy; preset tool/validation outcomes must drive the production failure classifier, fingerprinting, feedback, events, budgets, and state machine rather than bypassing them; expose only allowlisted endpoints; add IP/session frequency limits and small budgets; reset from fixed template for every Run and discard temporary state. Never invoke `child_process`, pnpm/test commands, a system shell, network transport, or a real LLM in public-demo mode.

**Refactor:** Keep public-demo capability checks centralized and independent from UI presentation; make reset lifecycle idempotent.

**Verification:** `pnpm --filter @gcah/server test -- public-demo demo-workspace`; `pnpm --filter @gcah/webui test`; `pnpm typecheck`; `pnpm lint`.

**Done:** Capability and isolation tests prove anonymous users cannot reach real workspace/LLM/credentials/commands or start a real subprocess/network call; no API key exists in request, browser, log, error, D1, KV, or R2 boundaries; preset outcomes still traverse the real state path without cross-visitor contamination.

**Parallel:** No after T22; completes PR-09. **Status:** Not started. **Commit:** — (record after execution).

### Task T24: Add the deterministic one-command mechanism demonstration

**Goal:** Reproduce the three core course mechanisms with Mock LLM in one offline command.

**Dependencies:** T16, T18, and T23.

**PR/worktree:** PR-10 / `feat/release-evidence`.

**Files:** Create `scripts/demo-mechanisms.ts`, `scripts/demo-scenarios.ts`, `scripts/demo-output.test.ts`; modify root `package.json` to add `demo:mechanisms` and register `scripts/**/*.test.ts` in the root Vitest `scripts` project; create `docs/mechanism-demo.md`.

**Interfaces:** Script composes in-memory repositories, fake clock/executor, MockLlmClient, and fixed temporary workspace; emits stable JSON and human-readable summary.

**First failing test:** Spawn `pnpm demo:mechanisms` and assert ordered markers: `DANGEROUS_ACTION_DENIED`, `VALIDATION_FAILED`, `MOCK_ACTION_CHANGED`, `SESSION_GRANT_EXPIRED`, `REAPPROVAL_REQUIRED`, then successful exit.

**Expected red:** Script/command and markers do not exist.

**Minimum implementation:** Create three deterministic scenarios; use fixed IDs/timestamps or normalize them; assert no network/real credentials; clean temporary state; exit nonzero if any expected state/event is absent.

**Refactor:** Reuse production composition ports without copying governance logic; keep scenario scripts readable for evaluators.

**Verification:** `pnpm demo:mechanisms`; `pnpm test -- --project scripts`; run twice and compare normalized output hashes; `pnpm verify`. The root `vitest.workspace.ts` must register a named `scripts` project covering `scripts/**/*.test.ts`.

**Done:** One command deterministically demonstrates blocking, feedback-driven action change, and grant expiry/reapproval offline.

**Parallel:** No; release evidence depends on integrated system. **Status:** Not started. **Commit:** — (record after execution).

### Task T25: Add GitLab and GitHub continuous integration

**Goal:** Run equivalent deterministic offline quality and mechanism checks in required GitLab and GitHub pipelines.

**Dependencies:** T24.

**PR/worktree:** PR-10 / `feat/release-evidence`.

**Files:** Create `.gitlab-ci.yml`, `.github/workflows/ci.yml`, `scripts/ci-contract.test.ts`; modify root `package.json` only to expose the CI-contract test command.

**Expected implementation:** GitLab contains a job literally named `unit-test`; both CI systems use frozen lockfile installation. Because `pnpm verify` already includes tests, the pipeline command sequence is `pnpm verify` followed by `pnpm demo:mechanisms`; it must not run a redundant standalone `pnpm test`. Real-LLM integration is manual and excluded.

**First failing test:** Parse both workflow files and assert GitLab `unit-test`, frozen install, `pnpm verify` followed by `pnpm demo:mechanisms`, absence of a separate `pnpm test` command, no real-LLM command, and equivalent Node/pnpm setup.

**Expected red:** Both CI files and their contract test are absent.

**Minimum implementation:** Add required GitLab jobs and GitHub workflow; cache only dependency artifacts that cannot contain secrets; install from frozen lockfile; run exactly `pnpm verify` plus `pnpm demo:mechanisms`; upload sanitized test evidence on failure.

**Refactor:** Deduplicate setup while leaving the literal `unit-test` job and required commands visible to evaluators.

**Verification:** `pnpm install --frozen-lockfile`; CI contract test; locally run `pnpm verify` then `pnpm demo:mechanisms`; trigger both pipelines and verify pass.

**Done:** `.gitlab-ci.yml` has passing `unit-test`; GitHub Actions passes equivalent offline checks; neither pipeline requires a key or networked LLM.

**Parallel:** No after T24. **Status:** Not started. **Commit:** — (record after execution).

### Task T26: Build the Docker/self-hosted delivery path

**Goal:** Package the Fastify + SQLite composition as a reproducible Linux `amd64` image for local development, testing, course distribution, and self-hosted fallback; this is not the Cloudflare production runtime.

**Dependencies:** T17, T18, T22, T23, and T25.

**PR/worktree:** PR-10 / `feat/release-evidence`.

**Files:** Create `Dockerfile`, `.dockerignore`, `.github/workflows/image.yml`, `scripts/container-contract.test.ts`; modify `.gitlab-ci.yml` to add image build/publish and root scripts only for container-contract testing.

**Expected implementation:** Multi-stage Linux `amd64` image, non-root runtime where feasible, healthcheck, one Fastify server serving UI/API/SSE only for this local/Docker/self-hosted path, `/data` for SQLite/audit/non-sensitive state, explicit workspace mount, and no baked credential or `.env`. A headless container without an OS credential store returns `backend unavailable` and never creates file storage.

**First failing test:** Parse/build the image and assert `linux/amd64`, health endpoint, configured port, mount paths, public-demo startup, absence of `.env`/secret sentinel, and that CI pushes a versioned tag plus immutable digest to a public registry.

**Expected red:** Dockerfile, image workflow, and container contract do not exist.

**Minimum implementation:** Add the self-hosted image and contract tests; copy only required artifacts and fixed templates; set non-root user/healthcheck; keep image publishing independent from Pages/Workers deployment.

**Refactor:** Minimize context/layers and remove build tooling from runtime image; align healthcheck with server route.

**Verification:** `docker build --platform linux/amd64`; container-contract test; run public-demo container; inspect image/filesystem/env for sentinels; pull the published tag anonymously and record digest.

**Done:** Linux `amd64` image builds, starts, passes healthcheck, is publicly pullable by digest, and contains no plaintext secret.

**Parallel:** No after T25. **Status:** Not started. **Commit:** — (record after execution).

### Task T27: Prepare Cloudflare delivery, document manual deployment, and pass final review

**Goal:** Produce the separate Cloudflare Pages/Workers/D1 delivery configuration and objective pre-deployment evidence, while leaving login, tokens, real deployment, domain binding, DNS, and HTTPS to an explicitly authorized human step.

**Dependencies:** S02, T18d, T22, T23, T25, and T26.

**PR/worktree:** PR-10 / `feat/release-evidence`.

**Files:** Create Pages/Workers/Wrangler deployment configuration, D1 migration/deployment scripts, `docs/security-review.md`, `docs/deployment.md`, and secret/security contract tests; modify `README.md` and `AGENT_LOG.md`. No Cloudflare credential or token is committed.

**Expected implementation:** Configure React + Vite Pages build, Worker routes/bindings, D1 migration, optional Durable Object binding, environment separation, preview checks, and rollback guidance. Document custom domain and HTTPS as manual Cloudflare/DNS steps, including least-privilege token setup performed only by an authorized human. Also document the independent Windows/Fastify and Docker/self-hosted path.

**First failing test:** Validate Pages/Workers/Wrangler config and D1 migration locally; seed a disposable API-key sentinel and prove it cannot appear in requests, browser state, logs, D1, KV, R2, or errors; assert public composition has Mock LLM only and no upload/shell/install/network capability.

**Expected red:** Deployment manifest, complete documentation, evidence, and final scanner/review do not exist.

**Minimum implementation:** Add deployable Pages/Workers/Wrangler configuration, D1 migrations, local/preview validation commands, rollback documentation, and a clearly marked human checklist for login, authorization, token configuration, deployment, custom domain, DNS, and HTTPS. Do not perform those external operations without separate authorization.

**Refactor:** Make README commands identical to tested commands; consolidate evidence links without exposing credentials or full prompts.

**Verification:** `pnpm install --frozen-lockfile`; `pnpm verify`; `pnpm demo:mechanisms`; SQLite/D1 contract parity; Worker SSE cursor replay/disconnect recovery; local Wrangler/Pages configuration validation; public-demo API-key absence tests; README Docker smoke test. Real deployment and URL checks remain pending until human authorization.

**Done:** All locally/CI-verifiable SPEC §10 criteria have evidence, Docker and Cloudflare artifacts are distinct, and no unresolved critical/high finding or secret leakage remains. A public URL/domain/HTTPS is recorded only after the separate human deployment step; S02 itself is not evidence of remote deployment.

**Parallel:** Final serial gate. **Status:** Not started. **Commit:** — (record after execution).

---

## 5. Formal execution protocol

For every formal task T01–T27, the assigned fresh agent must:

1. Read only the approved `SPEC.md`, `PLAN.md`, relevant existing files, and its task dependencies.
2. Confirm the listed failing test fails for the expected reason; a syntax/configuration failure unrelated to intended behavior does not count as red.
3. Add only the minimum production code needed to turn that test green.
4. Run the focused test, then the task's broader test/lint/typecheck commands.
5. Refactor only while the focused and broader tests remain green.
6. Review the diff for scope, secret leakage, generated files, and unauthorized dependency changes.
7. Update `AGENT_LOG.md` with task/subtask ID, agent type, red/green/refactor evidence, commands, decisions, deviations, and human edits; update this `PLAN.md` task/subtask status and commit field in the same change.
8. Commit with a focused conventional message, then record the actual commit hash in `PLAN.md` (using a follow-up documentation commit when the hash cannot refer to itself).
9. Run a **spec compliance review first** against `SPEC.md` and this task's acceptance criteria. Do not start code-quality review until compliance passes.
10. Run a **code quality review second** for correctness, maintainability, tests, security, and scope. Any Critical or High finding blocks all dependent work until fixed and both reviews are rerun.
11. In the PR description, list the implementing subagent, reviewing agent(s), all human-authored or human-modified files/hunks, validation evidence, and resolved Critical/High findings.
12. At the PR boundary, invoke Superpowers `requesting-code-review`, address its findings, then invoke `finishing-a-development-branch`. If either skill is unavailable, stop and ask rather than silently substituting another process.
13. Stop at the PR review gate; do not begin a dependent task until its prerequisite commit and PR review are approved.

Each unsplit T-task is one atomic fresh-subagent execution unit. For split tasks, the parent sections T01, T02, T03, T16, T18, T21, T22, T26, and T27 are acceptance summaries only and are **not** additional execution units. Assign subagents only the child IDs (`T01a`, `T01b`, `T02a`, and so on), never a split parent ID. A split parent is complete only when all child units pass the same per-unit status/log/review requirements. A child unit may commit independently inside its parent PR, but PR-01 through PR-10 remain the only PR/worktree grouping boundaries.

## 6. Final coverage matrix

| SPEC scope | Implementing tasks |
|---|---|
| pnpm workspace, quality, frozen lockfile | T01, T25 |
| Shared schema, complete entities, StepStatus, AgentResponse/ToolAction/FinishAction, ToolRequestSchema/ToolResultSchema, supported tool enum, rationale safety | T02 |
| Core-owned repository/clock/tool-gateway/validation/workspace/LLM ports and in-memory adapter | T03 |
| Core state machines with no adapter-package imports | T04, T16 |
| Standalone governance package and workspace/path/symlink/overlap fence | T05 |
| Budgets, StopReason, missing usage, protocol/repeat stopping | T06 |
| Governance and public/local rules | T07 |
| Approval, SessionGrant, hashes, expiry, reject feedback | T08 |
| Tools implementation of core ToolGatewayPort and mandatory executor boundary | T09 |
| list/read and output bounds | T10 |
| patch/write/delete/STALE_BASE | T11 |
| structured run_command and immutable run_validation | T12 |
| Validation, classification, fingerprints, feedback | T13 |
| Configuration and immutable snapshot via injected WorkspaceFencePort | T14 |
| Memory sources and bounded retrieval | T15 |
| Mock LLM adapter, injected-port-only core loop, completion gate | T16 |
| SQLite and audit consistency | T17 |
| Fastify local/self-hosted API and Worker/D1 production API, SSE replay, interruption | T18, T18d |
| CredentialStore and source precedence | S01, T19 |
| OpenAI-compatible adapter/manual integration | T20 |
| CLI | T21 |
| React WebUI | T22 |
| Public demo MockLlmClient, Demo/FakeExecutor, DemoValidationRunner, real feedback/state paths, and workspace reset | T23 |
| One-command mechanism demo | T24 |
| GitLab/GitHub CI | T25 |
| Docker/self-hosted/course delivery | T26 |
| Cloudflare Pages/Workers/Wrangler, D1 migration, manual domain/HTTPS steps, final security | S02, T18d, T27 |

## 7. Principal execution risks and gates

- **Hidden-context risk:** Gate CS must complete before spikes or formal code; its code is disposable and must not be reused.
- **Credential backend risk:** S01 selects the backend before T19. Failure must produce an explicit unavailable error, never plaintext downgrade.
- **Hosting boundary:** S02 selected Pages + Workers + D1 but performed no remote deployment. T26 is Docker/self-hosted; T27 is Cloudflare configuration and human-authorized deployment guidance.
- **LocalExecutor containment:** It is explicitly not an OS sandbox. Governance/approval and public-demo hard denial are mandatory controls, with optional Docker executor deferred unless required by acceptance evidence.
- **Persistence-before-effect:** T09/T17/T18 must preserve the invariant that failed persistence prevents tool execution and SSE publishes only committed events.
- **Secret propagation:** T02, T17, T19–T23, T26, and T27 contain sentinel or non-exposure tests at distinct boundaries.
- **Cross-platform paths:** T05 must pass Windows-native and Linux `amd64` matrices before governed mutation tools are accepted.
- **Scope growth:** Multi-agent orchestration, vector memory, full event sourcing, Anthropic, multi-user collaboration, and cloud repository execution remain excluded.

Plan status: **Rolling execution approved: PR-02 through PR-10**

Approval scope: PR-01 is complete and merged. Human rolling authorization now covers PR-02 through PR-10, corresponding to T03 through T27 in this plan. Each PR must still be implemented, tested, reviewed, merged, and cleaned up independently. After one PR completes successfully, the next PR may begin without separate per-PR approval. External deployment, real credentials, remote push/release, Cloudflare login/resources, DNS/domain/HTTPS changes, paid operations, and other explicitly restricted external actions remain outside this authorization. Mandatory pause conditions still apply. Current continuation point: PR-02 `core-domain`.
