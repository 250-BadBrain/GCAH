# Course Deliverables Checklist

This file maps the AI4SE final project requirements in `docs/course/` to the submitted GCAH repository artifacts.

## Document Deliverables

| Requirement | Repository artifact |
| --- | --- |
| SPEC design document | `docs/submission/SPEC.md` |
| PLAN implementation plan | `docs/submission/PLAN.md` |
| SPEC process document | `docs/submission/SPEC_PROCESS.md` |
| README with project overview, install, run, distribution, structure, and safety boundaries | `docs/submission/README.md` |
| AGENT_LOG implementation/process evidence | `docs/submission/AGENT_LOG.md` |
| REFLECTION report | `docs/submission/REFLECTION.md` |
| Course requirement sources | `docs/course/AI4SE_Final_Project_通用要求.md`, `docs/course/AI4SE_Final_Project_A_Coding_Agent_Harness.md` |

The root `README.md` is intentionally kept as a short repository entry point that links to this submission bundle.

## Coding Agent Harness Requirements

| Requirement | Evidence |
| --- | --- |
| Self-implemented harness core, not a hosted agent framework | `packages/core`, `packages/governance`, `packages/tools`, `packages/llm`, `packages/persistence` |
| Agent main loop | `packages/core/src/agent-loop.ts` |
| Injectable mock/stub LLM | `packages/llm`, `packages/core/test/agent-loop.test.ts`, public demo fixtures using Scripted Mock LLM |
| OpenAI-compatible real provider path | `packages/llm/src/openai-compatible.ts`, `apps/server/src/local-production.ts`, `apps/cli/src/main.ts` |
| Tool dispatch and workspace actions | `packages/tools` |
| Governance and HITL approval | `packages/governance`, `apps/server/src/approvals-config.ts`, CLI approval commands |
| Objective feedback/validation loop | `packages/core/src/validation.ts`, `packages/tools/src/validation`, local `pnpm-test` validation mode |
| Memory/context capability | `packages/core` memory ports and repository-backed run context |
| SQLite persistence | `packages/persistence` |
| REST/SSE/WebUI | `apps/server`, `apps/webui` |
| Mock-only public demo | `pnpm demo:web`, `apps/server/src/public-demo.ts`, `apps/server/test/public-demo.test.ts` |
| Mechanism demo | `pnpm demo:mechanisms`, `docs/mechanism-demo.md` |

## Security And Credential Requirements

| Requirement | Evidence |
| --- | --- |
| No committed real credentials | secret scan tests and `docs/security-review.md` |
| Secure credential storage | `packages/credentials`, credential CLI commands documented in `docs/submission/README.md` |
| Hidden key entry and no plaintext status | credential CLI tests and README command flow |
| API key not accepted by public demo | public demo tests and `docs/security-review.md` |
| API key not stored in config, SQLite, events, logs, REST, SSE, or browser state | local production integration tests and `docs/security-review.md` |
| Backend unavailable fails closed | credential/backend tests |

## Testing, CI, And Distribution

| Requirement | Evidence |
| --- | --- |
| One-command verification | `pnpm verify` |
| Build command | `pnpm build` |
| Mock-LLM deterministic tests | unit and integration tests under `packages/*/test` and `apps/server/test` |
| CI unit-test job | `.gitlab-ci.yml` |
| Docker/container distribution | `Dockerfile`, `docs/deployment.md`, `docs/submission/README.md` |
| Frozen lockfile | `pnpm-lock.yaml`, `.npmrc`, CI configuration |
| Cloudflare/manual deployment guide | `docs/deployment.md` |

## External Evidence Still Requiring Manual Submission

The repository contains the implementation and local evidence, but the following items depend on external systems and must be supplied manually at submission time:

- Public repository URL or the course-required Git remote location.
- Final CI/CD run record showing a passing pipeline.
- Public WebUI URL, if the course staff requires an actually reachable hosted deployment at grading time.
- Any real LLM smoke-test transcript using the student's own provider key. The project intentionally does not automate paid provider calls or store real keys.

## Recommended Final Local Check

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm demo:mechanisms
pnpm build
git diff --check
```
