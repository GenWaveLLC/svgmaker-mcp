# Cloud Run Deployment — Phased Plan

Hosted version of `svgmaker-mcp` on Google Cloud Run, over HTTP, multi-tenant. The npm/stdio version stays untouched — we add a cloud option.

**Decisions:** each caller sends their own SVGMaker API key in a header (key = auth); output is always a SVGMaker-hosted URL (no disk writes); stdio stays as-is; deploy via Dockerfile + manual `gcloud` and a GitHub Actions workflow.

---

## Phase 1 — Core refactor (per-request client + server factory)

Make the server able to run with a fresh SVGMaker client per request, without changing stdio behavior.

- `src/services/svgmakerService.ts` — add `createSvgmakerClient(apiKey, rateLimit?, baseUrl?)` (reuse existing config block). Give all 12 functions an optional `client` argument; fall back to the existing shared client when none is passed.
- `src/server.ts` *(new)* — `createMcpServer(client?)` that creates the MCP server and registers all tools, passing `client` into each handler.
- `src/tools/*.ts` (7 files) — accept an optional `client` and forward it to the matching service call.
- `src/index.ts` — call `createMcpServer()` then connect `StdioServerTransport`. Behavior identical to today.

**Done when:** `npm run build` + `typecheck` pass and stdio still generates/saves files exactly as before.

---

## Phase 2 — HTTP entry point

Add the cloud front door. stdio is the npm `bin`; HTTP is what the Docker image runs.

- `src/http.ts` *(new)* — Node built-in HTTP server (no new dependency) on `process.env.PORT`.
  - `POST /mcp`: read key from `x-svgmaker-api-key` (fallback `Authorization: Bearer`); 401 if missing. Build a per-request client + a fresh `createMcpServer(client)` + stateless `StreamableHTTPServerTransport`; handle the request; clean up after.
  - `GET /healthz`: 200 for Cloud Run health checks.

**Done when:** locally, `/healthz` returns 200, a `generate` call with the key header returns a URL, and a call with no key returns 401.

---

## Phase 3 — URL-only output

The 5 file-writing tools return a hosted URL in the cloud instead of saving to disk.

- `src/tools/*.ts` (`generate`, `edit`, `convert`, `generations` download, `gallery` download) — make `output_path` optional. When omitted, return the SVGMaker-hosted URL; when provided (stdio/local), keep the current save-to-disk behavior.
- Put the "what do we return" logic in one small helper so a future storage bucket is a single-file change.

**Done when:** with no `output_path`, tools return a URL; with `output_path`, files still save locally.

---

## Phase 4 — Containerize

- `Dockerfile` *(new)* — build TypeScript, install prod deps, `CMD node build/http.js`. Verify `sharp` loads (use full `node:20` base if the slim image fails).
- `.dockerignore` *(new)* — exclude `node_modules`, `build`, `.git`, logs, `.env`.

**Done when:** `docker build` + `docker run -p 8080:8080` pass the same checks as Phase 2.

---

## Phase 5 — Deploy (manual + CI)

- Document the manual `gcloud run deploy` command (README or this doc).
- `.github/workflows/deploy-cloud-run.yml` *(new)* — build + deploy to Cloud Run on push to `deploy/cloud` (and manual dispatch).

**Done when:** the service is live on Cloud Run, an authed `/mcp` generate works end-to-end, and the workflow deploys on push.

---

## Final verification (run once, after the code phases)

`npm run build && npm run lint && npm run typecheck`, then the stdio + HTTP + Docker + Cloud Run checks above.
