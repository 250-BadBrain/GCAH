# Security Review

Seeded sentinel used for scanner coverage: `sk-final-sentinel`.

Findings:

- no real credentials are required for CI, the mechanism demo, public demo, or local tests.
- Public demo uses Mock LLM only and exposes no API-key input or transport path.
- Real Cloudflare deployment, DNS, HTTPS, Wrangler login, API tokens, and remote migrations are human-authorized steps only.
- Docker/self-hosted images must not bake `.env`, tokens, or plaintext credentials.

Automated evidence:

- `pnpm verify`
- `pnpm demo:mechanisms`
- `pnpm test -- scripts/scan-secrets.test.ts`
- `pnpm test -- scripts/container-contract.test.ts`
