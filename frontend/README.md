# IPO Manager — Frontend

React + Vite + TypeScript frontend for the IPO Manager app
(spec: `~/workspace/user/files/IPO_MANAGER_SPEC.md` v2).
Hand-rolled CSS, no component library. HashRouter (static-host friendly).

## Run locally

```bash
cd ~/workspace/ipo-manager/frontend
npm install
npm run dev        # → http://localhost:5173
```

The app talks to the Spring Boot backend at `VITE_API_URL`
(default `http://localhost:8080`). To point at another backend
while developing:

```bash
VITE_API_URL=http://192.168.29.25:8080 npm run dev
```

> The backend must allow CORS for the dev origin, or serve the
> built frontend itself.

## Build

```bash
npm run build      # → dist/
```

## Deploy to GitHub Pages (project site)

The build is already configured for it:

- `vite.config.ts` sets `base: './'` → asset URLs are relative, so the
  app works from `https://<user>.github.io/<repo>/`.
- The app uses `HashRouter`, so routes live after `#` and GitHub Pages
  needs no SPA fallback configuration.

Steps:

1. Build against your **public** backend URL (e.g. the Tailscale Funnel
   or Cloudflare Tunnel address of the home server — plain `http://`
   will be blocked as mixed content from the HTTPS Pages site):

   ```bash
   VITE_API_URL=https://homeserver.<tailnet>.ts.net npm run build
   ```

2. Publish `dist/` to the `gh-pages` branch (or use a GitHub Action
   that runs the build above and deploys `dist/`).

3. In the repo: Settings → Pages → Deploy from branch → `gh-pages`.

## Backend endpoints used

CRUD: `/api/people`, `/api/ipos`, `/api/transactions`, `/api/applications`
KYC: `GET|PUT /api/people/{id}/kyc` (`?reveal=true` for full values)
Report: `GET /api/people/{id}/report?ipoId=`, `POST /api/reports/send`
Workflow: `PATCH /api/applications/{id}/status`, `PATCH /api/transactions/{id}/settle`
Dashboard: `GET /api/dashboard/stats`

See `src/api.ts` for the typed client.
