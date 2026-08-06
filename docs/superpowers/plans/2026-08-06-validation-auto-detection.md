# Validation Auto Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local interactive validation usable across common project types instead of hard-coding `pnpm test`.

**Architecture:** The CLI owns validation profile selection and project detection because it already manages the local workspace profile. The server composition root accepts either a concrete validation command or explicit no-validation, while AgentLoop, governance, tool execution, and feedback remain unchanged.

**Tech Stack:** TypeScript, Node.js filesystem APIs, existing CLI REPL, Fastify local production composition, Vitest.

## Global Constraints

- Do not use real API keys in automated tests.
- Do not call real LLM providers in automated tests.
- Do not allow arbitrary shell validation commands.
- Keep validation commands as structured executable plus args with workspace-fenced cwd.
- Preserve public demo Mock-only behavior.
- Default CI must remain offline and deterministic.

---

### Task 1: Validation Profile Resolver

**Files:**
- Create: `apps/cli/src/validation-profile.ts`
- Test: `apps/cli/test/validation-profile.test.ts`

**Interfaces:**
- Produces: `resolveLocalValidation(profile: string | undefined, workspacePath: string): Promise<ResolvedLocalValidation>`
- Produces: `isAllowedLocalValidation(profile: string): boolean`
- Produces: `ResolvedLocalValidation.command`, where `null` means validation is explicitly disabled.

- [x] **Step 1: Write failing tests for `none`, `pnpm-test`, and `auto` detection.**
- [x] **Step 2: Implement filesystem-based detection for Node/pnpm/npm/yarn, Python pytest, Rust, and Go.**
- [x] **Step 3: Keep unknown projects on explicit no-validation with a user-facing diagnostic.**
- [x] **Step 4: Run `pnpm --filter @gcah/cli test -- validation-profile`.**

### Task 2: CLI and REPL Integration

**Files:**
- Modify: `apps/cli/src/main.ts`
- Modify: `apps/cli/src/local-repl.ts`
- Modify: `apps/cli/src/local-session.ts`
- Test: `apps/cli/test/local-repl.test.ts`
- Test: `apps/cli/test/local-session.test.ts`

**Interfaces:**
- Consumes: `resolveLocalValidation`.
- Produces: `/validation auto`, `/validation none`, `/validation pnpm-test`, and `/validation status`.

- [x] **Step 1: Add REPL help and status output for validation profiles.**
- [x] **Step 2: Resolve validation before creating the embedded app.**
- [x] **Step 3: Pass `validationCommand: null` when validation is explicitly disabled or not detected.**
- [x] **Step 4: Run CLI tests.**

### Task 3: Local Production No-Validation Semantics

**Files:**
- Modify: `apps/server/src/local-production.ts`
- Test: `apps/server/test/local-production.integration.test.ts`

**Interfaces:**
- Consumes: `validationCommand?: CommandTemplate | null`.
- Produces: empty `validation.required` in the config snapshot for explicit no-validation.

- [x] **Step 1: Distinguish omitted validation command from explicit `null`.**
- [x] **Step 2: Keep legacy demo-validator fallback only for omitted validation command.**
- [x] **Step 3: Ensure mutation validation is considered satisfied when no validators are required.**

### Task 4: Documentation and Verification

**Files:**
- Modify: `docs/submission/PLAN.md`
- Modify: `README.md`
- Modify: `docs/submission/README.md`

**Interfaces:**
- Documents: `auto`, `none`, and `pnpm-test` behavior and limitations.

- [x] **Step 1: Append T31 to the submission plan.**
- [x] **Step 2: Document that validation orchestrates project-native checks rather than proving universal correctness.**
- [x] **Step 3: Run `pnpm verify`, `pnpm build`, and `git diff --check`.**
