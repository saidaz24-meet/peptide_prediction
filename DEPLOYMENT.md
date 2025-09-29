# 🚀 Deployment Guide

This is the operational runbook for the **lab server** and **public access**.

---

## 1️⃣ System Prerequisites

- 🍎 macOS 12+ (Intel or Apple Silicon) or 🐧 Ubuntu 20.04+/Debian 11+
- 🐍 Python 3.11+, 📦 Node 18+, 🔧 Git
- 🐳 (Optional) Docker (required if enabling PSIPRED)
- 🍎 (Apple Silicon + x86_64 Tango) Install Rosetta:

```bash
softwareupdate --install-rosetta --agree-to-license
```

---

## 2️⃣ Clone & Install

```bash
git clone <your_repo_url> peptide_visual_lab
cd peptide_visual_lab
```

### Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend:

```bash
cd ../ui
npm install
```

---

## 3️⃣ Backend Environment

Create `backend/.env`:

```env
USE_TANGO=1
USE_PSIPRED=true
# PSIPRED_DB=/data/uniclust30  # set when the DB exists
PORT=8000
```

---

## 4️⃣ Tango Setup

### macOS (recommended):

```bash
backend/Tango/bin/tango
chmod +x backend/Tango/bin/tango
xattr -d com.apple.quarantine backend/Tango/bin/tango || true
```

### Linux (optional, container):

Use `backend/Tango/Dockerfile.tango` to build `desy-tango`, or run your native binary.

---

## 5️⃣ PSIPRED (Optional)

Build/pull an image tagged `psipred-hhblits` with HHsuite + `runpsipred` in PATH.

Download Uniclust30 to e.g. `/data/uniclust30` and set `PSIPRED_DB` in `.env`.

If missing, the backend logs `[PSIPRED][WARN] ... skipping` and continues.

---

## 6️⃣ Launch (Development)

### Backend:

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000} --reload
```

### Frontend:

```bash
cd ui
npm run dev   # open http://127.0.0.1:5173
```

---

## 7️⃣ Production Build

```bash
cd ui
npm run build  # creates ui/dist
```

Serve `ui/dist` with Nginx/Apache/Caddy or host it on Firebase Hosting/Vercel.

---

## 8️⃣ Make It Public (Three Deployment Patterns)

### 🅰️ Lab Laptop + Cloudflare Tunnel (Recommended)

Install cloudflared and log in:

```bash
cloudflared tunnel login
```

Create a tunnel forwarding:
- `/api/*` → `http://localhost:8000`
- `/` → local static UI (if serving from the same machine)

DNS in Cloudflare: map `peptides.example.org` to the tunnel.

🔒 HTTPS arrives automatically via Cloudflare.

**Split UI:** alternatively deploy UI to Firebase Hosting or Vercel and configure
`VITE_API_BASE_URL=https://peptides.example.org/api` (the tunnel domain).

### 🅱️ Cloud VM (Docker)

Provision a VM, install Docker, copy binaries/DBs.

Run backend container, serve UI with Nginx, add Let's Encrypt (or Caddy auto-TLS).

### ©️ Hybrid (Simplest)

- UI on Firebase Hosting (push `ui/dist`).
- Backend on lab laptop via tunnel.
- Set frontend `.env` → `VITE_API_BASE_URL` to the tunnel's domain.

---

## 9️⃣ systemd (Linux)

See the example `peptide-backend.service` & `peptide-frontend.service` (build step) in README.

---

## 🔟 Verification

Upload CSV; backend should print:

- Tango queued/run/parsed messages
- `[UPLOAD] rows=... • SSW preds ... • FF-Helix avail ...`

UI cards display **Chameleon Positive** and **Avg FF-Helix** (not "Not available").

---

## 1️⃣1️⃣ Backups / Housekeeping

📁 Archive `backend/Tango/out/` and `backend/Psipred/out/` periodically.

The app always reads the latest `run_*` directory.

---

## 1️⃣2️⃣ Troubleshooting

### 🔧 FF-Helix shows "Not available"
Update frontend mapping (`mappers.ts`) and stats (`datasetStore.ts`) to use `ffHelixPercent`.

### 🦎 Chameleon 0.0% but backend logs positives
Ensure `chameleonPrediction` is typed `-1|0|1` and counted where `=== 1`.

### 🥭 Tango on macOS fails to execute
`chmod +x`, remove quarantine, install Rosetta (Apple Silicon).

### 🧠 PSIPRED missing
Check `docker images | grep psipred-hhblits` and `PSIPRED_DB` path.

---

## 📋 Production Checklist

- [ ] ✅ Backend runs without errors
- [ ] 🔧 Tango binary executable and unquarantined
- [ ] 🐳 Docker available (if using PSIPRED)
- [ ] 🌐 Frontend builds successfully (`npm run build`)
- [ ] 🔒 HTTPS configured (Cloudflare/Let's Encrypt)
- [ ] 📊 Test upload shows correct statistics
- [ ] 🔄 Backups scheduled for output directories
- [ ] 📝 Environment variables documented