# S02 Cloudflare Hosting Spike

Date: 2026-07-13
Branch/worktree: `spike/hosting` at `E:/Desktop/GCAH-spike-hosting`
Base commit: `c90233373a6937af164017b636aae2b1c590a7d6`
Scope: findings-only Cloudflare feasibility validation. No formal WebUI, server,
database, Docker, or deployment implementation was started.

## Gate Check

- `git rev-parse --show-toplevel`: `E:/Desktop/GCAH-spike-hosting`
- `git branch --show-current`: `spike/hosting`
- `git rev-parse HEAD`: `c90233373a6937af164017b636aae2b1c590a7d6`
- `git status --short`: clean before spike edits

## Sources Checked

- Cloudflare Pages React guide: https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Workers Streams: https://developers.cloudflare.com/workers/runtime-apis/streams/
- Cloudflare Workers Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Cloudflare KV: https://developers.cloudflare.com/kv/
- Cloudflare R2: https://developers.cloudflare.com/r2/

External deployment was intentionally not attempted. It would require
Cloudflare login, account/project authorization, token creation, and possibly
domain/DNS actions, which are human-confirmed external operations under the
spike restrictions.

## Cloudflare Recommended Deployment Topology

Recommended public demo topology:

```text
Cloudflare Pages
  demo.example.com
  React + Vite static assets, no user secrets, no policy authority

Cloudflare Workers
  same-origin /api/* and /api/events, or api.demo.example.com if explicitly tested
  REST, SSE, auth/session checks, rate limits, Mock LLM-only public demo composition

Cloudflare storage bindings
  D1: relational run/event/audit/memory metadata
  Durable Objects: per-run coordination and optional live connection fan-out
  KV: low-frequency config, feature flags, rate buckets, cacheable public metadata
  R2: optional large sanitized artifacts, demo assets, exported evidence bundles
```

Prefer same-origin routing for public demo because SPEC requires cookie-based
REST/SSE auth and CSRF/Origin checks. A split `api.demo.example.com` topology is
possible, but it adds CORS and cookie credential testing obligations.

Custom domain and HTTPS are feasible through Cloudflare Pages custom domains.
A subdomain can CNAME to the Pages subdomain; an apex domain must be a
Cloudflare zone. DNS/domain setup remains a manual deployment step.

## Pages Validation Conclusion

React + Vite static frontend is compatible with Cloudflare Pages. Cloudflare's
React guide uses a normal build command and `dist` output directory, matching
Vite defaults. The WebUI should remain a static observation/approval client and
must not contain policy logic, API keys, deployment secrets, or real LLM
credentials.

Recommended T22/T27 adjustment: do not require the production public demo to be
served by a single Fastify process. Build WebUI as static Pages output and route
API/SSE to Workers.

## Workers Validation Conclusion

Backend deployment to Cloudflare Workers is feasible if the server is written
around the Fetch API runtime model. Workers can serve REST endpoints, stream
responses, access bindings, use environment variables/secrets, and bind to D1,
Durable Objects, KV, and R2.

The current planned Node/Fastify server should be treated as the local/Docker
self-hosted composition root. Cloudflare production needs a separate Worker
composition root or a deliberately selected Worker-compatible HTTP adapter.

## Fastify Compatibility Conclusion

Current Fastify design cannot be assumed to run directly on Workers unchanged.
Fastify's normal server lifecycle expects Node HTTP server semantics, while
Workers dispatch `fetch(request, env, ctx)` and return Web `Response` objects.
Cloudflare has partial Node.js compatibility, but that does not make a long-lived
Node server process or filesystem-backed Node deployment model equivalent to a
Worker.

Recommended boundary:

- Keep core, shared schemas, governance, LLM ports, tool policy, and repository
  ports framework-neutral.
- Keep Fastify adapter for local/self-hosted and Docker verification.
- Add a Worker HTTP adapter/composition root for Cloudflare.
- Do not place authority or state transitions in Pages or browser code.

## SSE Conclusion

SSE is feasible on Workers by returning `text/event-stream` with a
`ReadableStream`. The disposable `.spikes/hosting/worker-sse-shape.ts` records
the expected shape without implementing production behavior.

Limits and design notes:

- Persist events before publishing; clients must reconnect using cursors.
- HTTP-triggered Workers have no hard wall-clock duration while the client stays
  connected, but client disconnects can cancel request-associated work.
- Free Workers have low CPU allowance, so SSE handlers must avoid polling loops,
  heavy JSON work, and per-client expensive computation.
- Durable Objects are a strong fit for per-run connection coordination or
  fan-out if simple Worker streaming plus D1 cursor replay is not enough.

## SQLite, D1, Durable Objects, KV, and R2

Local SQLite:

- Good for Windows native, local development, tests, Docker/self-hosted, and
  course distribution.
- Not directly compatible with Cloudflare Workers as a filesystem database file.

D1:

- Best primary Cloudflare production replacement for SQLite-shaped relational
  data: runs, steps, actions, decisions, events, audit rows, memory metadata.
- SQL-compatible but accessed through Cloudflare bindings/API, so it requires a
  D1 repository adapter rather than reusing a local SQLite driver.

Durable Objects:

- Best for stateful coordination: one active Run per workspace, per-run live
  event fan-out, session-like serialized operations, and strongly consistent
  object-local state.
- Not the primary analytical/audit database unless the data is naturally scoped
  to one object.

KV:

- Good for globally readable, low-write key-value data such as feature flags,
  demo configuration, rate-limit counters with acceptable semantics, and cached
  public metadata.
- Not suitable as the source of truth for ordered audit/event logs or strong
  transactional invariants.

R2:

- Good for large unstructured objects: sanitized exported evidence bundles,
  downloadable artifacts, demo static data, logs after redaction, or snapshots.
- Not suitable for relational run state, approval invariants, or low-latency
  event cursor queries.

## Repository Adapter Recommendation

Yes, GCAH needs repository adapters between local SQLite and Cloudflare
production storage.

Recommended repository matrix:

- Tests: in-memory repositories.
- Local/native and Docker/self-hosted: SQLite repositories.
- Cloudflare public demo: D1 repositories, optionally assisted by Durable
  Objects for coordination and live fan-out.
- R2/KV adapters should be separate capability-specific ports, not hidden behind
  the relational repository contract.

The core must continue depending only on repository ports. SQL dialect,
Cloudflare bindings, object routing, and retry behavior belong in adapters.

## Docker Positioning

For Cloudflare production deployment, Docker should not be the primary runtime
artifact. Cloudflare Pages and Workers deploy source/bundles plus bindings, not
the planned Linux OCI single container.

Docker remains valuable for:

- local development and reproducible evaluator runs;
- Linux `amd64` compatibility evidence;
- self-hosted distribution;
- optional local sandbox/executor experiments;
- course fallback if Cloudflare credentials or domain setup are unavailable.

T26 should be revised from "public demo production image" to "local/self-hosted
image and course distribution image" if Cloudflare remains the final target.

## Public Demo Security Boundary

Public demo on Cloudflare must run Mock LLM only.

Required boundary:

- no UI/API path accepts, transmits, stores, validates, or echoes user API keys;
- no real LLM adapter is bound in public-demo Worker configuration;
- no arbitrary workspace upload, command execution, dependency installation, or
  outbound network capability is exposed to anonymous users;
- Cloudflare Secrets, if used for admin/session internals, are server-side only
  and never included in Pages assets, browser state, events, logs, D1, KV, R2,
  or serialized errors;
- demo runs use fixed examples and resettable state with rate limits and small
  budgets.

## Free Quota and Platform Limits

Important constraints from Cloudflare documentation as of 2026-07-13:

- Workers Free: 100,000 requests/day, 10 ms CPU per invocation, 128 MB memory,
  50 subrequests/request, six simultaneous outgoing connections/request, 3 MB
  Worker size, and one-second startup limit.
- Workers HTTP duration: no hard wall-clock duration while the client remains
  connected; request-associated work can be canceled after disconnect/response,
  with `waitUntil()` available only for a short continuation window.
- Workers Logs Free: 200,000 log events/day with three-day retention.
- D1 Free: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage.
- KV Free: 100,000 reads/day, 1,000 writes/day, 1,000 deletes/day, 1 GB stored.
- Durable Objects are available on Free and Paid plans; Free supports
  SQLite-backed Durable Objects, with request/duration quotas.
- R2 Free includes monthly storage and operation allowances; useful but not a
  transactional store.

Cold start appears acceptable for this demo class because Workers are designed
for quick startup, but bundle size and initialization work must be kept small.
Do not initialize large dependency graphs or load full run history on request.

## SPEC/PLAN Conflict Findings and Suggested Changes

Do not edit SPEC.md or PLAN.md during this spike. Suggested changes:

- Replace S02 wording that evaluates Render/Railway/Linux OCI with
  Cloudflare-only Pages + Workers validation.
- Replace `docs/spikes/public-hosting.md` and `.spikes/public-hosting/**` paths
  with the Cloudflare paths used here, or explicitly alias them.
- Revise SPEC 7.3 requirement that public deployment is a Linux OCI single
  container. For Cloudflare, public production should be Pages + Workers.
- Revise SPEC 11.2 requirement that the public platform must support Linux OCI
  image and persistent data directory. Cloudflare should require Pages,
  Workers, bindings, D1/DO/KV/R2, secrets, and stable URL/custom domain instead.
- Revise T22c "one Fastify process serves production UI/API/SSE" so it applies
  only to local/Docker self-hosted. Cloudflare production should split static UI
  and Worker API/SSE.
- Revise T26 image publishing so Docker is course/local/self-hosted evidence,
  not Cloudflare production deployment.
- Revise T27 deployment guide to document Wrangler/Pages deployment, bindings,
  migrations, custom domains, rollback, and Cloudflare manual authorization
  steps.
- Add a Worker adapter task before T27 if Cloudflare production is mandatory.
- Add D1 repository adapter acceptance tests mirroring SQLite repository
  contracts.
- Add explicit public-demo test that no API key field exists in requests,
  browser state, persisted storage, logs, or serialized errors.

## Unverified Items

- Actual Pages deployment URL, build logs, and rollback behavior.
- Actual Worker deployment, route binding, secrets, and observability behavior.
- D1 migrations and compatibility with the future SQLite schema.
- Durable Object fan-out design under concurrent SSE clients.
- Custom domain activation and HTTPS certificate issuance.
- Free quota behavior under realistic public-demo traffic.
- Wrangler CI token scopes and least-privilege setup.
- Whether a Fastify Worker adapter is worth using versus a small native Fetch
  router such as Hono or a hand-written adapter.

These remain unverified because they require Cloudflare account login,
authorization tokens, account/project selection, and possibly DNS/domain
operations.

## Recommendation

Recommend entering formal implementation only after SPEC.md and PLAN.md are
revised to reflect Cloudflare Pages + Workers as the production target and to
add the required Worker/D1 repository adapter work.

Do not enter formal T26/T27 with the current single-container public deployment
assumption. The local/Docker track is still useful, but it is no longer the
Cloudflare production topology.

