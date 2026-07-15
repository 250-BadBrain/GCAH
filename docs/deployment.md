# Deployment

## Local

Run:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm demo:mechanisms
pnpm build
```

## Docker / Self-Hosted

Build locally when Docker is available:

```powershell
docker build --platform linux/amd64 -t gcah:local .
```

Mount non-sensitive runtime state at `/data`. Do not bake `.env`, API keys, Cloudflare tokens, or user credentials into the image.

## Cloudflare

Cloudflare login is a human step.
Wrangler login is not automated.
DNS and HTTPS are manual.

Manual operator checklist:

1. Create least-privilege Cloudflare credentials outside the repository.
2. Run Wrangler login manually.
3. Create or select Pages, Workers, D1, and optional Durable Object resources manually.
4. Apply D1 migrations only after review.
5. Bind domains, DNS, and HTTPS manually.
6. Record the deployed URL only after the separate deployment authorization.
