# Infrastructure Reference

This document describes how Trakt is hosted and deployed. Copy `docs/INFRASTRUCTURE.local.md` (gitignored) for your own setup-specific notes.

---

## Overview

Trakt runs on a home NAS via Docker. Access is split into two layers:

- **Tailscale** — private access for the web UI and API from your own devices

---

## Where Things Run

| Component | Host | How |
|---|---|---|
| Trakt API | Home NAS | Docker container (`trakt-api`) |
| Trakt Web | Home NAS | Docker container (`trakt-web`) |
| MySQL | Home NAS | Shared Docker container (`shared-mysql-1`) |
| CI/CD | GitHub Actions | Builds images, pushes to ghcr.io |
| Image registry | GitHub Container Registry | `ghcr.io/<user>/trakt-api`, `ghcr.io/<user>/trakt-web` |

---

## Access URLs

| What | URL | Notes |
|---|---|---|
| Web UI | `http://<nas-hostname>:3001/trakt` | Tailscale required |
| API | `http://<nas-hostname>:3002` | Tailscale required |
| Nuvio addon | `http://<nas-hostname>:3002/nuvio-addon/manifest.json` | Tailscale required |
| Adminer (DB UI) | `http://<nas-hostname>:8081` | Tailscale required |

---

## Network Architecture

```
Your devices (PC, phone)
    │
    │  Tailscale (private, encrypted)
    ▼
Home NAS
    ├── trakt-web (port 3001) ── Next.js, proxies /api/* to trakt-api
    ├── trakt-api (port 3002) ── Fastify API
    └── shared-mysql-1 (port 3306, internal only)


```

The web container proxies `/api/*` and `/nuvio-addon/*` to `trakt-api:3002` via the `shared-db` Docker network. This is configured in `apps/web/next.config.mjs` using the `API_URL` build arg (baked in at image build time as `http://trakt-api:3002`).

---

## Docker Setup

All containers are defined in `docker-compose.yml` at the repo root. On the NAS, place the compose file at a path like `/path/to/trakt/docker-compose.yml`.

**Shared infrastructure** (MySQL, Adminer, Watchtower) lives in a separate compose project. The `shared-db` Docker network is created there and declared `external: true` in Trakt's compose file — this is how `trakt-api` reaches MySQL by the hostname `mysql`.

**Watchtower** (in the shared compose) polls ghcr.io every 5 minutes and auto-deploys new images when CI pushes them.

---

## Deployment Flow

```
git push to main
    │
    ▼
GitHub Actions (.github/workflows/deploy.yml)
    ├── Builds trakt-api image → pushes to ghcr.io/<user>/trakt-api:latest
    └── Builds trakt-web image (with NEXT_PUBLIC_API_URL + API_URL baked in)
            └── pushes to ghcr.io/<user>/trakt-web:latest
    │
    ▼ (within ~5 minutes)
Watchtower on NAS detects new image → pulls → restarts containers
```

Manual deploy if needed (SSH into NAS):
```bash
cd /path/to/trakt
sudo docker compose pull && sudo docker compose up -d
```

---

## Key Build-Time Variables

These are baked into the Docker images at build time — they cannot be changed via `.env` on the NAS after the image is built:

| Variable | Value | Where set | Why baked in |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://<nas-hostname>:3002` | GitHub Actions secret `TAILSCALE_HOSTNAME` | Next.js client bundle |
| `API_URL` | `http://trakt-api:3002` | Dockerfile default | Next.js rewrites() in next.config.mjs |

If the NAS hostname or API port ever changes, update the `TAILSCALE_HOSTNAME` secret in GitHub and push to main to rebuild.

---

## Cloudflare Tunnel

The tunnel exposes `localhost:3002` (the Trakt API) publicly at your tunnel domain. This is the only publicly accessible endpoint — everything else is Tailscale-only.

> **No longer required.** The tunnel existed solely so Stremio could reach the addon over HTTPS. That addon has been removed — nothing depends on public access any more. The tunnel can be torn down whenever you like; it is documented here only because it is still running.

**Tunnel is managed via:**
- Cloudflare Zero Trust dashboard → Networks → Tunnels
- `cloudflared` binary installed on the NAS
- Runs as a system service — starts automatically on NAS reboot

**If the tunnel goes down:**
1. SSH into NAS: `sudo systemctl status cloudflared`
2. Restart if needed: `sudo systemctl restart cloudflared`
3. Check the tunnel status in Cloudflare Zero Trust dashboard

---

## Database

MySQL runs in the `shared-mysql-1` container. Data is persisted to a bind-mounted volume on the NAS.

**To access the database:** Open Adminer at `http://<nas-hostname>:8081`

**To run migrations:**
```bash
pnpm --filter api run migrate
```
This runs against whatever `DB_HOST` is set to in your local `.env`.

---

## Scrobbling

| Source | How it works |
|---|---|
| Emby | Webhook → `POST http://<nas-hostname>:3002/api/scrobble/emby` (Tailscale) |
| NuvioTV | `POST http://<nas-hostname>:3002/api/scrobble/nuvio/{start,stop}` with `X-Api-Key` header |
| Kodi | `POST http://<nas-hostname>:3002/api/scrobble/kodi` with `X-Api-Key` header |

---

## Troubleshooting

**Web UI won't load:**
1. Check containers are running: `sudo docker ps` on NAS
2. Check web logs: `sudo docker logs trakt-web`
3. If proxy errors to `trakt-api`: check API container is up and on `shared-db` network

**API errors / DB connection refused:**
1. Check `shared-mysql-1` is running: `sudo docker ps | grep mysql`
2. Check API logs: `sudo docker logs trakt-api`
3. Verify `DB_HOST=mysql` in your NAS `.env`

**New image not deploying automatically:**
1. Check Watchtower logs: `sudo docker logs shared-watchtower-1`
2. Check GitHub Actions — did the build succeed?
3. Manual deploy: `sudo docker compose pull && sudo docker compose up -d`

**Lost access (Tailscale down):**
1. DSM web UI may be accessible on LAN at the NAS local IP
2. Re-enable Tailscale via package manager if it stopped
