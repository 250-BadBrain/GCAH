# GCAH

## Verification

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm demo:mechanisms
pnpm build
```

## Browser Demo

```powershell
pnpm demo:web
```

Open `http://127.0.0.1:4173` after the command prints the local address. The demo is mock-only and uses fixed public-demo scenarios; it does not accept API keys, arbitrary workspaces, shell commands, dependency installation, uploads, or external network access.

Cloudflare login, Wrangler login, DNS, HTTPS, remote migrations, remote pushes, releases, and real credentials are not automated.
