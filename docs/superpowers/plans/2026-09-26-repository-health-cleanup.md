# Repository Health Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the failed CI workflow, then fix defects exposed by the repository's normal verification and focused code review without changing existing CLI or server behavior.

**Architecture:** Keep the cleanup behavior-preserving and work in independent gates. First restore the release dependency materialization step already implemented in the packaging script, then run the same lint, typecheck, test, and demo checks as CI. Review any concrete failures in their owning package and make narrowly scoped fixes with regression coverage.

**Tech Stack:** TypeScript, Node.js, pnpm workspace, ESLint, TypeScript compiler, Vitest, GitHub Actions.

## Global Constraints

- Preserve the existing Coding Agent CLI and server interfaces.
- Keep the Windows release self-contained and free of symbolic links or junctions.
- Do not weaken lint, typecheck, or test configuration to make CI pass.
- Run verification with `CI=true` locally so pnpm does not prompt before replacing the installed modules directory.

---

### Task 1: Restore Windows release dependency materialization

**Files:**
- Modify: `scripts/package-win-exe.mjs`
- Modify: `scripts/ci-contract.test.ts`
- Test: `scripts/ci-contract.test.ts`

**Interfaces:**
- Consumes: `appDir` and the `materializeRootDependencies(nodeModulesDir)` helper already defined by the script.
- Produces: A release `app/node_modules` tree with dependencies copied out of pnpm's virtual store before `assertNoLinks(appDir)` runs.

- [x] Call `materializeRootDependencies(join(appDir, "node_modules"))` immediately after `pnpm deploy` returns:

```js
materializeRootDependencies(join(appDir, "node_modules"));
assertNoLinks(appDir);
```

- [x] Retain `assertNoLinks(appDir)` after materialization so the release fails if any link remains.
- [x] Add a CI contract assertion that the materialization call exists before `assertNoLinks(appDir)`.
- [x] Run `pnpm lint` and confirm the unused helper no longer fails lint.
- [x] Run `pnpm exec vitest run scripts/ci-contract.test.ts` and `pnpm package:win` on Windows.

### Task 2: Run the complete CI verification locally

**Files:**
- Modify only files required by a concrete failing check.
- Test: All workspace lint, typecheck, tests, and mechanism demo.

**Interfaces:**
- Consumes: The existing root `verify` and `demo:mechanisms` scripts.
- Produces: Passing checks, or specific reproducible failures with owning files and regression tests.

- [x] Set `$env:CI = 'true'` for local pnpm checks.
- [x] Run `pnpm verify`; lint, typecheck, and the test suite pass.
- [x] Add a regression assertion for the reproduced CI failure and run its targeted test.
- [x] Run `pnpm demo:mechanisms` after `pnpm verify` passes.

### Task 3: Review the changed runtime and packaging boundaries

**Files:**
- Review: `apps/server/src/local-production.ts`, `apps/server/src/server.ts`, `packages/core/src/loop/agent-loop.ts`, `packages/tools/src/gateway/tool-gateway.ts`, `scripts/package-win-exe.mjs`
- Modify only a file with a reproduced defect and a regression test.

**Interfaces:**
- Consumes: Existing workspace fences, startup recovery, governance gateway, and portable release contract.
- Produces: Focused regression coverage for any confirmed defect; otherwise no speculative refactor.

- [x] Check that startup recovery only transitions active runs and preserves terminal run history.
- [x] Check that gateway schema failures, denied actions, and executor errors remain surfaced as errors without bypassing governance.
- [x] Check that package relocation verification copies the release outside the repository and removes its temporary copy after success or failure.
- [x] Run `git diff --check` and the smallest relevant test after the confirmed fix.
