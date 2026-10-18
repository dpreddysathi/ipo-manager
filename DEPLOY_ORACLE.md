# Deploy IPO Manager backend to Oracle Cloud (Always Free, 24/7)

Goal: backend live at `https://<your-name>.duckdns.org`, always on, free forever.
Your H2 database stays as-is (no migration, no data risk) — it lives in a Docker
volume on the VM.

## Part 1 — Oracle account (you do this once, ~15 min)

1. Sign up at https://www.oracle.com/cloud/free — card is verified but not charged.
   Approval is sometimes instant, sometimes takes a few days.
2. Create a VM: **Compute → Instances → Create instance**
   - Region: **ap-mumbai-1** (Mumbai — closest to you)
   - Image: **Ubuntu 24.04**
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM — free)
   - Resources: 2 OCPUs, 12 GB RAM (well within the free allowance)
   - Networking: keep the defaults, but note the **public IP** after creation
   - SSH keys: generate a new key pair, download and keep the private key safe
3. Open ports 80/443: **Networking → Virtual Cloud Networks → your VCN →
   Security Lists → Default Security List → Add Ingress Rules**
   - Source CIDR `0.0.0.0/0`, destination port **80**, TCP
   - Source CIDR `0.0.0.0/0`, destination port **443**, TCP
   (SSH port 22 is open by default.)

## Part 2 — free domain (5 min)

1. Go to https://www.duckdns.org, sign in (Google/GitHub), add a subdomain
   like `dp-ipo`, and point it at your VM's public IP.
2. Wait ~2 minutes, then check: `nslookup dp-ipo.duckdns.org` should show your IP.

## Part 3 — on the VM (SSH in, paste these)

```bash
# Docker + git
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
# log out and SSH back in so the docker group applies

# App
git clone https://github.com/dpreddysathi/ipo-manager.git
cd ipo-manager
cp .env.example .env

# Secrets (run each, paste the output into .env)
openssl rand -base64 32   # -> KYC_ENCRYPTION_KEY
openssl rand -base64 32   # -> AUTH_JWT_SECRET
nano .env                 # set DOMAIN=dp-ipo.duckdns.org + the two keys

# Launch
docker compose up -d --build
```

Give it ~2 minutes (first build compiles the jar; Caddy fetches the HTTPS cert).
Then open `https://dp-ipo.duckdns.org/api/ipos` — you should get JSON, not an error.

Useful commands:

```bash
docker compose ps              # status
docker compose logs -f app     # backend logs
docker compose logs -f caddy   # HTTPS/cert logs
```

## Part 4 — point the frontend at it

The GitHub Pages frontend currently calls the old Tailscale URL. Update it:

1. On github.com, open `dpreddysathi/ipo-manager` → `.github/workflows/pages.yml`
   → edit (pencil icon) → change `VITE_API_URL` to `https://dp-ipo.duckdns.org`
2. Commit, then **Actions → Deploy frontend to GitHub Pages → Run workflow**
   (or just push any frontend change).

## Part 5 — first login

Register on the live site **first** — the first account claims the data.
(If the home server comes back online later, we can copy your existing H2
database file into the `ipo-data` volume so nothing is lost.)

## Notes

- `restart: always` means the backend (and HTTPS) come back on their own after
  any crash or VM reboot. The VM itself never sleeps.
- Backups: `docker compose exec app tar czf - /app/data` now and then, or
  snapshot the boot volume in the Oracle console.
- ARM vs x86: the Dockerfile uses multi-arch images, so the ARM VM builds fine.
