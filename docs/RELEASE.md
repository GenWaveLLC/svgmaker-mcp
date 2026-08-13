# Deploy the SVGMaker MCP to Cloud Run

Steps to deploy the **HTTPS server** (`build/http.js`) to Google Cloud Run at `https://mcp.svgmaker.io`. Users connect with a browser login (no API key).

> This is separate from the npm/stdio package. Deploying here does not touch npm, and publishing npm does not touch this server.

---

## 0. Before you start

- [ ] `gcloud` CLI installed and logged in (`gcloud auth login`).
- [ ] `docker` installed and running.
- [ ] `jq` installed.
- [ ] You have Cloud Run deploy access on the **`svgmaker-fun`** project (same project as the converter → same billing; the MCP is just a separate service in it).
- [ ] `svgmaker.io` + SDK are **LIVE in production** — Cloud Run cannot reach a local `svgmaker.io`, so browser login won't work until they are public.

---

## 1. Deploy

- [ ] First time on a machine only: `gcloud config set project svgmaker-fun`
- [ ] Deploy:
  - New image / code changes → `./deploy.sh`
  - Only changed a setting → `./deploy.sh --update`
- [ ] Copy the **Service URL** it prints (the `...run.app` one).

---

## 2. Quick check

- [ ] Health: `curl <SERVICE_URL>/health` → prints `ok`.
- [ ] Login trigger: `curl -i -X POST <SERVICE_URL>/mcp` → returns **401** with a `WWW-Authenticate` header.

---

## 3. Point the domain `mcp.svgmaker.io` (first time only)

Two places — neither is in the code:

**Google Cloud (Cloud Run → Manage Custom Domains):**
- [ ] Map `mcp.svgmaker.io` → the `svgmaker-mcp` service.
- [ ] Note the CNAME target it shows (`ghs.googlehosted.com`).

**IONOS (DNS for `svgmaker.io`):**
- [ ] Add record → Type: `CNAME`, Host: `mcp`, Points to: `ghs.googlehosted.com`.

**Then:**
- [ ] Wait a few minutes to ~1 hour for the SSL certificate 🔒.

---

## 4. Verify

- [ ] `curl https://mcp.svgmaker.io/health` → `ok`.
- [ ] `claude mcp add --transport http svgmaker https://mcp.svgmaker.io/mcp`
- [ ] Confirm: browser opens → login → Allow → tool returns an image.

---

## If something goes wrong

- **No deploy permission** → the deploy errors clearly. Ask an admin for Cloud Run access. Nothing breaks.
- **Login doesn't complete** → confirm `svgmaker.io` is in production and `MCP_PUBLIC_URL` / `SVGMAKER_AUTH_SERVER_URL` in `settings.json` are correct. Re-run `./deploy.sh --update`.
- **Domain not working** → DNS takes time. Re-check the CNAME in IONOS and the mapping in Cloud Run.
- **Roll back** → in Cloud Run, route 100% traffic to a previous revision.

---

## Quick reference

| Action | Command |
|---|---|
| Set GCP project | `gcloud config set project <PROJECT_ID>` |
| Deploy (build + push) | `./deploy.sh` |
| Update settings only | `./deploy.sh --update` |
| Health check | `curl https://mcp.svgmaker.io/health` |
| Add MCP to client | `claude mcp add --transport http svgmaker https://mcp.svgmaker.io/mcp` |
