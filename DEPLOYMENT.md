```markdown
#  Deployment Guide

This is the operational runbook for the **lab server** and **public access**.

# #   1) System prerequisites

- macOS 12+ (Intel or Apple Silicon) or Ubuntu 20.04+/Debian 11+
- Python 3.11+, Node 18+, Git
- (Optional) Docker (required if enabling PSIPRED)
- (Apple Silicon + x86_64 Tango) Install Rosetta:
```bash
softwareupdate --install-rosetta --agree-to-license
2) Clone & install
```bash
Copy code
git clone <your_repo_url> peptide_visual_lab
cd peptide_visual_lab
Backend:
```
```bash
Copy code
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
Frontend:
```
```bash
Copy code
cd ../ui
npm install
3) Backend env
Create backend/.env:
```
```env
Copy code
USE_TANGO=1
USE_PSIPRED=true
# PSIPRED_DB=/data/uniclust30  # set when the DB exists
PORT=8000
4) Tango
macOS (recommended):
```
```bash
Copy code
backend/Tango/bin/tango
chmod +x backend/Tango/bin/tango
xattr -d com.apple.quarantine backend/Tango/bin/tango || true
Linux (optional, container):
```
Use backend/Tango/Dockerfile.tango to build desy-tango, or run your native binary.

5) PSIPRED (optional)
Build/pull an image tagged psipred-hhblits with HHsuite + runpsipred in PATH.

Download Uniclust30 to e.g. /data/uniclust30 and set PSIPRED_DB in .env.

If missing, the backend logs [PSIPRED][WARN] ... skipping and continues.

6) Launch (dev)
Backend:

```bash
Copy code
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000} --reload
Frontend:
```
```bash
Copy code
cd ui
npm run dev   # open http://127.0.0.1:5173
7) Production build
bash
Copy code
cd ui
npm run build  # creates ui/dist
Serve ui/dist with Nginx/Apache/Caddy or host it on Firebase Hosting/Vercel.
```
8) Make it public (three patterns)
A) Lab laptop + Cloudflare Tunnel (recommended)
Install cloudflared and log in:

```bash
Copy code
cloudflared tunnel login
Create a tunnel forwarding:
```
/api/* → http://localhost:8000

/ → local static UI (if serving from the same machine)

DNS in Cloudflare: map peptides.example.org to the tunnel.

HTTPS arrives automatically via Cloudflare.

Split UI: alternatively deploy UI to Firebase Hosting or Vercel and configure
VITE_API_BASE_URL=https://peptides.example.org/api (the tunnel domain).

B) Cloud VM (Docker)
Provision a VM, install Docker, copy binaries/DBs.

Run backend container, serve UI with Nginx, add Let’s Encrypt (or Caddy auto-TLS).

C) Hybrid (simplest)
UI on Firebase Hosting (push ui/dist).

Backend on lab laptop via tunnel.

Set frontend .env → VITE_API_BASE_URL to the tunnel’s domain.

9) systemd (Linux)
See the example peptide-backend.service & peptide-frontend.service (build step) in README.

10) Verify
Upload CSV; backend should print:

Tango queued/run/parsed messages

[UPLOAD] rows=... • SSW preds ... • FF-Helix avail ...

UI cards display Chameleon Positive and Avg FF-Helix (not “Not available”).

11) Backups / housekeeping
Archive backend/Tango/out/ and backend/Psipred/out/ periodically.

The app always reads the latest run_* directory.

12) Troubleshooting
FF-Helix shows “Not available”
Update frontend mapping (mappers.ts) and stats (datasetStore.ts) to use ffHelixPercent.

Chameleon 0.0% but backend logs positives
Ensure chameleonPrediction is typed -1|0|1 and counted where === 1.

Tango on macOS fails to execute
chmod +x, remove quarantine, install Rosetta (Apple Silicon).

PSIPRED missing
Check docker images | grep psipred-hhblits and PSIPRED_DB path.