# GCAH

GCAH is a Coding Agent Harness for the AI4SE final project.

Submission documents are collected under [`docs/submission/`](docs/submission/):

- [`README.md`](docs/submission/README.md): project overview, installation, operation, distribution, and safety boundaries.
- [`SPEC.md`](docs/submission/SPEC.md): product and mechanism specification.
- [`PLAN.md`](docs/submission/PLAN.md): implementation plan and task evidence.
- [`SPEC_PROCESS.md`](docs/submission/SPEC_PROCESS.md): Superpowers specification process notes.
- [`AGENT_LOG.md`](docs/submission/AGENT_LOG.md): development log and validation evidence.
- [`REFLECTION.md`](docs/submission/REFLECTION.md): reflection report.
- [`DELIVERABLES.md`](docs/submission/DELIVERABLES.md): course requirement checklist.

Quick verification:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm demo:mechanisms
pnpm build
```

Browser demo:

```powershell
pnpm demo:web
```

Local interactive agent:

```powershell
pnpm build
node apps/cli/dist/src/bin.js local
```
