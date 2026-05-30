# Infrastructure Reference

This document describes how Trakt is hosted and deployed. If something breaks and you haven't touched this in a while, start here.

---

## Overview

Trakt runs on a Synology NAS (DS1817+) via Docker. There is no EC2 server anymore. Access is split into two layers:

- **Tailscale** — private access for the web UI and API from your own devices
- **Cloudflare Tunnel** — public HTTPS access for the Stremio addon URL only (required because Stremio rejects HTTP addon URLs)

---

## Where Things Run

| Component | Host | How |
|---|---|---|
| Trakt API | Synology NAS | Docker container (`trakt-api`) |
| Trakt Web | Synology NAS | Docker container (`trakt-web`) |
| MySQL | Synology NAS | Shared Docker container (`shared-mysql-1`) |
| Cloudflare Tunnel | Synology NAS | `cloudflared` binary, runs as a service |
| CI/CD | GitHub Actions | Builds images, pushes to ghcr.io |
| Image registry | GitHub Container Registry | `ghcr.io/jives00/trakt-api`, `ghcr.io/jives00/trakt-web` |

---

## Access URLs

| What | URL | Notes |
|---|---|---|
| Web UI | `http://synology:3001/trakt` | Tailscale required |
| API | `http://synology:3002` | Tailscale required |
| Stremio addon | `https://trakt.berek.xyz/stremio-addon/manifest.json` | Public via Cloudflare Tunnel |
| Adminer (DB UI) | `http://synology:8081` | Tailscale required |

---

## Network Architecture

```
Your devices (PC, phone)
    │
    │  Tailscale (private, encrypted)
    ▼
Synology NAS
    ├── trakt-web (port 3001) ── Next.js, proxies /api/* to trakt-api
    ├── trakt-api (port 3002) ── Fastify API
    └── shared-mysql-1 (port 3306, internal only)

Stremio (on any device)
    │
    │  HTTPS
    ▼
Cloudflare Tunnel → trakt.berek.xyz
    │
    │  cloudflared (running on NAS)
    ▼
localhost:3002 (trakt-api)
```

The web container proxies `/api/*` and `/stremio-addon/*` to `trakt-api:3002` via the `shared-db` Docker network. This is configured in `apps/web/next.config.mjs` using the `API_URL` build arg (baked in at image build time as `http://trakt-api:3002`).

---

## Docker Setup

All containers are defined in `docker-compose.yml` at the repo root. On the NAS, the compose file lives at `/volume2/docker/trakt/docker-compose.yml`.

**Shared infrastructure** (MySQL, Adminer, Watchtower) lives in a separate compose project at `/volume2/docker/shared/docker-compose.yml`. The `shared-db` Docker network is created there and declared `external: true` in Trakt's compose file — this is how `trakt-api` reaches MySQL by the hostname `mysql`.

**Watchtower** (in the shared compose) polls ghcr.io every 5 minutes and auto-deploys new images when CI pushes them.

---

## Deployment Flow

```
git push to main
    │
    ▼
GitHub Actions (.github/workflows/deploy.yml)
    ├── Builds trakt-api image → pushes to ghcr.io/jives00/trakt-api:latest
    └── Builds trakt-web image (with NEXT_PUBLIC_API_URL + API_URL baked in)
            └── pushes to ghcr.io/jives00/trakt-web:latest
    │
    ▼ (within ~5 minutes)
Watchtower on NAS detects new image → pulls → restarts containers
```

Manual deploy if needed (SSH into NAS):
```bash
cd /volume2/docker/trakt
sudo docker compose pull && sudo docker compose up -d
```

---

## Key Build-Time Variables

These are baked into the Docker images at build time — they cannot be changed via `.env` on the NAS after the image is built:

| Variable | Value | Where set | Why baked in |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://synology:3002` | GitHub Actions secret `TAILSCALE_HOSTNAME` | Next.js client bundle |
| `API_URL` | `http://trakt-api:3002` | Dockerfile default | Next.js rewrites() in next.config.mjs |

If the NAS hostname or API port ever changes, update the `TAILSCALE_HOSTNAME` secret in GitHub and push to main to rebuild.

---

## Cloudflare Tunnel

The tunnel exposes `localhost:3002` (the Trakt API) publicly at `https://trakt.berek.xyz`. This is the only publicly accessible endpoint — everything else is Tailscale-only.

**Tunnel is managed via:**
- Cloudflare Zero Trust dashboard → Networks → Tunnels → `nas-trakt`
- `cloudflared` binary installed at `/usr/local/bin/cloudflared` on the NAS
- Runs as a system service — starts automatically on NAS reboot

**If the tunnel goes down:**
1. SSH into NAS: `sudo systemctl status cloudflared`
2. Restart if needed: `sudo systemctl restart cloudflared`
3. Check the tunnel status in Cloudflare Zero Trust dashboard

**DNS:** `berek.xyz` is managed by Cloudflare. The `trakt` subdomain CNAME is auto-managed by the tunnel. Do not manually edit it.

---

## Database

MySQL runs in the `shared-mysql-1` container. Data is persisted to `/volume2/docker/shared/mysql/` on the NAS.

**Nightly backups:** A DSM Task Scheduler job runs at 2 AM, dumps all databases to `/volume2/docker/shared/backups/mysql_YYYYMMDD.sql`, and deletes dumps older than 30 days. Hyper Backup picks up this folder at 2:30 AM and syncs to S3.

**To access the database:** Open Adminer at `http://synology:8081` — login with MySQL root credentials.

**To run migrations:**
```bash
pnpm --filter api run migrate
```
This runs against whatever `DB_HOST` is set to in your local `.env`.

---

## Scrobbling

| Source | How it works |
|---|---|
| Emby | Webhook → `POST http://synology:3002/api/scrobble/emby` (Tailscale) |
| Stremio | Addon installed via `https://trakt.berek.xyz/stremio-addon/manifest.json` — polls API for now-playing |
| Kodi | `POST http://synology:3002/api/scrobble/kodi` with `X-Api-Key` header |

---

## Troubleshooting

**Web UI won't load:**
1. Check containers are running: `sudo docker ps` on NAS
2. Check web logs: `sudo docker logs trakt-web`
3. If proxy errors to `trakt-api`: check API container is up and on `shared-db` network

**API errors / DB connection refused:**
1. Check `shared-mysql-1` is running: `sudo docker ps | grep mysql`
2. Check API logs: `sudo docker logs trakt-api`
3. Verify `DB_HOST=mysql` in `/volume2/docker/trakt/.env`

**Stremio addon not working:**
1. Test `https://trakt.berek.xyz/stremio-addon/manifest.json` in browser — should return JSON
2. If timeout: check Cloudflare tunnel status (`sudo systemctl status cloudflared`)
3. If tunnel is down: `sudo systemctl restart cloudflared`

**New image not deploying automatically:**
1. Check Watchtower logs: `sudo docker logs shared-watchtower-1`
2. Check GitHub Actions — did the build succeed?
3. Manual deploy: `cd /volume2/docker/trakt && sudo docker compose pull && sudo docker compose up -d`

**Lost access (Tailscale down):**
1. DSM web UI may be accessible on LAN at the NAS local IP
2. Re-enable Tailscale via DSM Package Center if it stopped
