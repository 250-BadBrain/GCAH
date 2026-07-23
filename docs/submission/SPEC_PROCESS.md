# SPEC Process Record

## 2026-07-12 - Gate CS Cold-Start Validation

Evidence source: `docs/evidence/cold-start/`.

### Attempt 1 - invalid

- Agent: DeepSeek V4 Flash.
- Base commit: `3b04048a3bf95a05e1d9c2ac975fab75fa42566d`.
- Branch/worktree used: `main` at `E:\Desktop\GCAH`.
- Reported duration: about 30 minutes.
- Attempted scope: T01a, T01b, T02a, T02b, T02c.
- Result: invalid cold-start evidence because implementation files were written in the main worktree instead of a disposable worktree.
- Human discovery/cleanup: `2026-07-12-attempt-1-main-status.txt` showed untracked implementation files in the main worktree, including root workspace files and `packages/`. The attempt was therefore rejected as Gate CS evidence and the implementation artifacts were not accepted.

### Attempt 2 - valid disposable worktree

- Agent: DeepSeek V4 Flash.
- Base commit: `3b04048a3bf95a05e1d9c2ac975fab75fa42566d`.
- Branch: `cold-start/spec-validation`.
- Worktree: `E:/Desktop/GCAH-cold-start`.
- Timebox: 2 hours.
- Actual duration: about 7 minutes.
- Attempted scope: T01a, T01b, T02a, T02b, T02c.
- Validation result: `pnpm verify` exited 0; 7 test files and 47 tests passed; lint, typecheck, test, and frozen-lockfile validation passed according to the saved report.
- Disposal: all cold-start source, test, lockfile, package, and generated artifacts were discarded with the disposable worktree. No implementation code was merged, copied, cherry-picked, or reused in the formal branch.

### Findings

- Zod version was underspecified. The cold-start agent used Zod 4.4.3 and had to follow Zod 4 `z.record(z.string(), z.unknown())` behavior.
- `Step.status` was missing from SPEC, while `Run.status` and `Action.status` were specified.
- The boundary for rejecting unknown tool names was unclear. The validation demonstrated that tool names should be constrained by the supported tool enum before governance/tool dispatch.
- `rationale` needed a sharper treatment as untrusted display-only plain text.
- Core entity schemas needed explicit required/optional/nullable rules.
- PLAN T01a/T01b needed a clearer boundary: T01a only proves the non-product runner; T01b creates the behavioral missing-export red.
- PLAN cold-start rules conflicted with formal child-task closeout steps. Gate CS must override task-level instructions to update docs/logs or commit during the disposable experiment.
- PLAN needed to specify how package-manager build-script approvals are handled using an explicit allowlist rather than ad hoc interaction.
- PLAN needed an audit step for T02 parent acceptance and explicit ownership of `ToolRequestSchema`, `ToolResultSchema`, and complete entity schemas.
- The cold-start agent encountered ambiguities and made assumptions instead of strictly pausing to ask, so the process rule remains: future cold-start or formal agents must stop immediately on ambiguity.

### Documentation Revisions Made From Evidence

- `SPEC.md`: added `Step.status`, supported tool-name enum requirement, untrusted plain-text rationale handling, entity required/optional/nullable constraints, and Zod 4 lockfile expectation.
- `PLAN.md`: clarified Gate CS precedence, cold-start no-doc-update/no-commit rule, T01a/T01b boundaries, pnpm build-script allowlist, T02 parent acceptance audit, and schema ownership.
- `AGENT_LOG.md`: recorded the invalid first cold-start and the valid second cold-start.

## 2026-07-13 - Spike Conclusion Writeback

### S01 Windows credential-store evidence

- `docs/spikes/credential-store.md` records the disposable `cross-keychain` probe.
- Windows `native-windows` was exercised for set/get/status/update/clear and cleanup; the formal adapter must validate the active backend and allow only OS credential-store backends.
- macOS Keychain, Linux Secret Service, and Docker/headless behavior were not runtime-tested. They remain unverified and must not be described as validated support.
- Formal behavior is fail closed: reject `file`, `null`, unknown, and unavailable backends; never downgrade to file storage.

### S02 online deployment scope removed

- The final submission does not require online deployment or a public URL.
- The permanent submission docs were revised to describe local command-line use as the delivery path.
- No external account login, remote resource creation, custom-domain binding, DNS change, or remote deployment was performed.
- Disposable spike code was deleted; the credential-store report remains as permanent evidence.
