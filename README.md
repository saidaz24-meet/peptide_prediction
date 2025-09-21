# Peptide Visual Lab (DESY — Meytal Landau Group)

Interactive web app for exploring peptide properties and fibril-forming predictions.
Designed for **internal use** at DESY (Meytal Landau group).  
Developed with guidance from **Aleksandr Golubev**.

> **Private**: no public deployment intended. Use within the lab only.

---

## Purpose

- Upload peptide datasets from UniProt (TSV/CSV/XLSX)
- Compute biophysical features (Hydrophobicity, Charge, Hydrophobic Moment μH)
- Integrate **Tango (SSW)** and **JPred** results (when local outputs are provided)
- Visualize cohorts, rank candidates, and export reports/shortlists

---

## Key Features

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

## How It Works

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

---

## JPred / Tango Integration

**No online calls.** The app reads **local output files** produced by colleagues.

- Place result files here:
  - `backend/Jpred/` — JPred outputs
  - `backend/Tango/` — Tango outputs
- Enable at runtime:
  ```bash
  export USE_JPRED=1
  export USE_TANGO=1
Start backend in the same shell (see below).
The Results page shows non-empty helix segments and SSW predictions when files match your Entry/Accession IDs.

If columns remain “Not available”: files are missing or filenames don’t match IDs.

Local Development
Backend
bash
Copy code
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Optional (local results enabled):
export USE_JPRED=1
export USE_TANGO=1
uvicorn server:app --reload --port 8000
Notes

Requires: fastapi, uvicorn, pandas, numpy, openpyxl

If you hit np.Inf error, change to np.inf or pin numpy<2.

Frontend
bash
Copy code
cd ui
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local
# (optional Firebase)
cat <<EOF >> .env.local
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=...
VITE_FB_PROJECT_ID=...
VITE_FB_STORAGE_BUCKET=...
VITE_FB_MSG_SENDER=...
VITE_FB_APP_ID=...
EOF

npm run dev
# open http://localhost:5173
File Formats
Recommended columns: Entry/Accession, Sequence (required), Length (optional)

The backend derives Length from Sequence when absent.

Computed fields (Hydrophobicity, Charge, μH, FF flags) are added server-side.

Privacy & Scope
Internal tool for DESY (Meytal Landau group)

No public deployment; datasets may be confidential

Firebase access is limited to lab accounts (if enabled)

## Acknowledgements
Algorithmic approach and backend code provided by Aleksandr Golubev