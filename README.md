#  Peptide Visual Lab (DESY — Landau Group)

Interactive web app for exploring peptide properties and fibril-forming predictions.
Designed for **internal use** at DESY (Proffessor Meytal Landau's group).
Developed with guidance from **Dr. Aleksandr Golubev**.

---
> Built at **DESY / CSSB (Landau Lab)**. Runs fully offline on a single lab machine, but can be published for worldwide access (see **Deployment**).

---

# #   Purpose

- Upload peptide datasets from UniProt (TSV/CSV/XLSX)
- Compute biophysical features (Hydrophobicity, Charge, Hydrophobic Moment μH)
- Integrate **Tango (SSW)** and **JPred** results (when local outputs are provided)
- Visualize cohorts, rank candidates, and export reports/shortlists

---

# #   Key Features

- **Flexible upload**: TSV/CSV/XLSX; optional column mapping
- **Upload QC**: invalid sequences reported, download *rejected_rows.csv*
- **Provenance pill**: JPred/Tango **ON/OFF** + hit counts
- **Six core metrics**:
1. Chameleon prediction (SSW)
2. Helix segments (JPred)
3. Charge
4. Hydrophobicity
5. Hydrophobic moment (μH)
6. FF-Helix (derived flag)
- **Visualizations**
- Hydrophobicity distribution
- Hydrophobicity vs μH scatter
- Chameleon distribution & cohort radar
- **Sliding-window profiles** (H & μH) with helix overlays
- **Smart ranking**: sliders for metric weights + **Top-N shortlist** (CSV)
- **Per-peptide deep dive**: segment track, metrics, interpretations
- **Exports**: CSV export; **PDF Report** (one-click)
- **Cloud (optional)**: Save/Load datasets via **Firebase Auth + Firestore**

---

# #   How It Works

1. **Backend** (`backend/` – FastAPI)
- Accepts UniProt exports (TSV/CSV/XLSX)
- Normalizes headers; derives `Length` if missing
- Computes **Charge**, **Hydrophobicity**, **μH** (sequence-based)
- If local results present and enabled:
- **JPred** → `Helix fragments (Jpred)`, `Helix score (Jpred)`
- **Tango** → `SSW prediction`, `SSW score`
- Computes **FF flags** from cohort thresholds
2. **Frontend** (`ui/` – React + Vite + shadcn/ui + Recharts)
- Upload → Preview → **Analyze** (calls backend)
- Optional **column mapping**
- Renders dashboards, detail pages, and exports

# #  #   Said's contributions (beyond UI design)

- **End-to-end Tango integration on macOS M-series**, with a **simple runner** that:
- writes canonical input formats,
- executes per-peptide predictions,
- parses heterogeneous Tango outputs (table, mixed text),
- merges results back into the DataFrame,
- computes SSW (chameleon) and cohort statistics robustly.
- **Feature-flagged PSIPRED path**: safe-to-enable Docker runner that prepares FASTAs, invokes HHblits+PSIPRED if present, else **logs and continues**.
- **FF-Helix% & core fragments** always computed (no Tango/PSIPRED dependency).
- **Frontend mapping & stats fixes** so “Chameleon Positive” and “Avg FF-Helix%” cards reflect backend data correctly.
- **Deployment playbooks** for: single lab server, tunnelled public access, or split front-/back-end hosting.

---

# #   Quick Start (local)

# #  #   1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

#  Feature flags (safe defaults)
export USE_TANGO=1          # Tango on (works with mac binary today)
export USE_PSIPRED=true     # OK if PSIPRED isn't installed; it will skip cleanly

uvicorn server:app --host 0.0.0.0 --port 8000 --reload

# #  #   2) Frontend

```bash
Copy code
cd ui
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local
npm run dev   # open http://127.0.0.1:5173
Upload a UniProt table (CSV/TSV/XLSX) with Entry and Sequence (others optional).
You’ll see cohort cards + ranking and a full table. Use Export CSV or Export shortlist.csv.
```
Tango & PSIPRED
Tango (macOS recommended)

Put your mac binary at backend/Tango/bin/tango

chmod +x backend/Tango/bin/tango

(Apple Silicon only, x86_64 binary) Install Rosetta:
softwareupdate --install-rosetta --agree-to-license

PSIPRED (optional; Docker)
Build/pull an image tagged psipred-hhblits and set PSIPRED_DB to your Uniclust folder. If not available, backend prints a warning and continues.

Details are in DEPLOYMENT.md.

Deployment (make it globally accessible)
The backend can keep running locally in your lab and still be reachable worldwide over HTTPS. Choose one:

Option A — Lab server + Cloudflare Tunnel (recommended)
Keep backend and Tango/PSIPRED on the lab laptop.

Serve the frontend either:

directly from the lab laptop (Nginx), or

host the static UI on Firebase Hosting/Vercel and proxy /api to the tunnel URL.

Use Cloudflare Tunnel to expose http://127.0.0.1:8000 to the internet safely (no open inbound port).

Steps (summary):

Build the UI: cd ui && npm run build

Install Nginx (or any static server) and serve ui/dist at /.

Install Cloudflare Tunnel (cloudflared), authenticate, and create a tunnel that forwards:

/api/* → http://localhost:8000

/ → local static files (or skip if using Firebase Hosting/Vercel)

Point your domain DNS (Cloudflare) to the tunnel. You get free HTTPS.

This keeps sensitive tools and data inside your lab while offering a stable public URL.

Option B — Cloud VM (Hetzner/AWS) with Docker
Provision a small VM, install Docker.

Run backend in a container with Tango/PSIPRED binaries mounted (or baked into the image).

Serve UI via Nginx.

Add a domain + Let’s Encrypt (or Caddy for auto-TLS).

Option C — Split hosting (very simple)
Frontend on Firebase Hosting (push ui/dist/).

Backend stays on lab laptop. Expose /api via Cloudflare Tunnel and set
VITE_API_BASE_URL="https://your-tunnel-domain.example/api" in the hosted UI.

All options are fully described in DEPLOYMENT.md with exact commands and example configs.

Roadmap (what’s next)
Single-sequence drawer: PSIPRED curves (P(H)/P(E)/P(C)), Tango β-aggregation track, segment ribbons.

Auth + Firestore: sign-in, “previous datasets”, cloud export of Tango/PSIPRED outputs (schema and rules outlined in DEV_GUIDE.md).

UniProt fetcher: type a protein or organism → fetch, window peptides to CSV, analyze.

License
This repository is intended for research use.
If you need a permissive OSI license, choose Apache-2.0 (recommended) or BSD-3-Clause.

For now, we include a DESY Research License template (LICENSE-DESY-RESEARCH.md).
If you plan a public SaaS, consider switching to Apache-2.0.

Acknowledgements
Tango: Fernandez-Escamilla et al., Nat Biotechnol 22, 1302–1306 (2004).

PSIPRED: Jones, J Mol Biol 292, 195–202 (1999).

Thanks to DESY / CSSB (Landau Lab): Said Azaizah & Dr. Aleksandr Golubev for guidance on SSW/FF calculations.