# IPO Manager — Deploy Guide

Full-stack app: **Spring Boot backend** (Docker, home server) + **React frontend** (GitHub Pages).
Single user, no login. KYC fields (PAN, email, broker login, optional password/MPIN)
are AES-256-GCM encrypted in the database.

## 1. Project layout

```
ipo-manager/
├── backend/    Spring Boot 3.2 / Java 17 / file-backed H2  → Docker image
└── frontend/   Vite + React + TypeScript                   → GitHub Pages (static)
```

## 2. Backend — first build & local run

Prerequisites: Java 17, Maven 3.9+.

```bash
cd backend

# 1) Generate the KYC encryption key (base64 of 32 random bytes).
#    Save it somewhere safe — losing it means losing all stored KYC data.
export KYC_ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "$KYC_ENCRYPTION_KEY" > ~/.ipo-kyc-key   # keep this file private
chmod 600 ~/.ipo-kyc-key

# 1b) Generate the JWT signing secret (for login tokens).
#     Any random value works; keep it private like the KYC key.
openssl rand -hex 32 > ~/.ipo-jwt-secret
chmod 600 ~/.ipo-jwt-secret

# 2) Build and run
mvn -DskipTests package
KYC_ENCRYPTION_KEY=$(cat ~/.ipo-kyc-key) \
AUTH_JWT_SECRET=$(cat ~/.ipo-jwt-secret) \
java -jar target/*.jar
# → http://localhost:8080
```

The app fails fast on startup if `KYC_ENCRYPTION_KEY` or `AUTH_JWT_SECRET`
is missing or invalid.

Quick smoke test (in another terminal):

```bash
curl -s localhost:8080/api/dashboard/stats
curl -s -X POST localhost:8080/api/people \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Person","phone":"9876543210"}'
```

## 3. Backend — Docker on the home server

On the server (Ubuntu, Docker installed):

```bash
# copy the project over (or git clone it), then — the Dockerfile builds
# the jar itself (multi-stage), so no local Maven/Java is needed:
cd ipo-manager
docker build -t ipo-manager-backend ./backend

# run it — data persists in the named volume, key comes from the env var
docker run -d --name ipo-manager --restart unless-stopped \
  -p 8080:8080 \
  -v ipo-data:/app/data \
  -e KYC_ENCRYPTION_KEY="$(cat ~/.ipo-kyc-key)" \
  -e AUTH_JWT_SECRET="$(cat ~/.ipo-jwt-secret)" \
  ipo-manager-backend

docker logs -f ipo-manager
```

**Backups:** the whole database is one file set under the `ipo-data` volume.
Back it up occasionally:

```bash
docker run --rm -v ipo-data:/data -v ~/backups:/backup \
  alpine tar czf /backup/ipo-data-$(date +%F).tar.gz -C /data .
```

Keep `~/.ipo-kyc-key` backed up separately (password manager, USB stick).
Without the key, the database backup's KYC fields are unrecoverable.
Also back up `~/.ipo-jwt-secret` — rotating it logs every user out
(their saved tokens stop verifying), so keep the same value across rebuilds.

## 4. Make the backend reachable from the internet (for GitHub Pages)

The frontend on GitHub Pages is public HTTPS, so the backend needs a public
HTTPS URL too. Easiest free option with Tailscale already installed:

```bash
# on the server — exposes ONLY this backend, nothing else
tailscale funnel 8080
# → gives you https://<something>.ts.net
```

Then tell the backend to allow the GitHub Pages origin:

```bash
docker run -d --name ipo-manager --restart unless-stopped \
  -p 8080:8080 \
  -v ipo-data:/app/data \
  -e KYC_ENCRYPTION_KEY="$(cat ~/.ipo-kyc-key)" \
  -e AUTH_JWT_SECRET="$(cat ~/.ipo-jwt-secret)" \
  -e APP_CORS_ALLOWED_ORIGINS="https://<your-username>.github.io" \
  ipo-manager-backend
```

(`APP_CORS_ALLOWED_ORIGINS` maps to `app.cors.allowed-origins` in Spring Boot's
relaxed binding. For local dev the default is `http://localhost:5173`.)

## 5. Frontend — build & deploy to GitHub Pages

```bash
cd frontend
npm install

# point it at the backend's public URL (or http://localhost:8080 for local dev)
VITE_API_URL=https://<your-tailscale-funnel-url> npm run build
# → static files in dist/
```

Deploy options:
- **Easiest:** copy the contents of `dist/` to your GitHub Pages repo/branch
  (e.g. the `gh-pages` branch or `docs/` folder), enable Pages in repo settings.
- The app uses hash routing and relative asset paths, so it works from a
  project sub-path like `https://<you>.github.io/ipo-manager/` with no extra config.

For local dev: `npm run dev` (uses `http://localhost:8080` by default).

## 6. Notes & gotchas

- **Ports:** backend 8080, frontend dev 5173. CORS allows 5173 by default.
- **Single user:** there is no login. Anyone with the backend URL can use the API —
  the Tailscale Funnel URL is unguessable, but treat it like a password anyway.
- **WhatsApp reports:** no paid gateway. The backend builds the message, saves a
  report log, and returns a pre-filled `wa.me` link you open to send manually.
- **KYC reveal:** masked by default; clicking reveal shows full values for
  30 seconds and writes an audit log row.
- **H2 console** is disabled; talk to the DB only through the API.
- **IPO auto-sync:** the backend pulls Chittorgarh's mainboard IPO list daily
  at 06:30 IST (plus a "Sync now" button on the IPO page). New IPOs arrive
  with an AUTO badge; hand-added IPOs are never modified. The first sync
  after deploy fetches ~200 detail pages for lot sizes — it runs in the
  background and can take several minutes; later syncs are fast.
