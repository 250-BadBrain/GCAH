# Security Review

Seeded sentinel used for scanner coverage: `sk-final-sentinel`.

Findings:

- no real credentials are required for CI, mechanism tests, or local mock tests.
- Local real-provider use requires the user to store a key through the OS credential store.
- The command-line workflow does not accept API keys as command-line arguments.
- Runtime data, local profiles, logs, events, local API responses, and CLI output must not contain plaintext credentials.

Automated evidence:

- `pnpm verify`
- `pnpm demo:mechanisms`
- `pnpm test -- scripts/scan-secrets.test.ts`
