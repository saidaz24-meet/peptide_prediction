# backend/server.py
import io, os, json, re
from typing import Optional, Dict, List
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import auxiliary, biochemCalculation, jpred, tango
from auxiliary import ff_helix_percent, ff_helix_cores

from dotenv import load_dotenv
# Explicitly point to backend/.env
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

# If you use python-dotenv, make sure .env is loaded before reading env vars:
try:
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(dotenv_path=Path(__file__).with_name(".env"))
except Exception:
    pass

def env_true(name: str, default: bool = True) -> bool:
    """Treat 1/true/yes/on (case-insensitive) as True; 0/false/no/off as False."""
    v = os.getenv(name)
    if v is None:
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")

USE_JPRED = os.getenv("USE_JPRED", "0") == "1"
USE_TANGO = os.getenv("USE_TANGO", "0") == "1"
USE_PSIPRED = os.getenv("USE_PSIPRED", "true").lower() == "true"

use_simple = os.getenv("TANGO_MODE", "simple").lower() == "simple"

app = FastAPI(title="Peptide Prediction Service")

def ensure_ff_cols(df):
    df["FF-Helix %"] = df["Sequence"].astype(str).apply(ff_helix_percent)
    df["FF Helix fragments"] = df["Sequence"].astype(str).apply(ff_helix_cores)

# --- Example dataset config ---
EXAMPLE_PATH = os.path.join(os.path.dirname(__file__), "data", "Final_Staphylococcus_2023_new.xlsx")

# columns that mean “we already have results” so don’t recompute
JPRED_COLS = ["Helix fragments (Jpred)", "Helix score (Jpred)"]
TANGO_COLS = ["SSW prediction", "SSW score"]
BIOCHEM_COLS = ["Charge", "Hydrophobicity", "Full length uH"]

def has_any(df: pd.DataFrame, cols: list[str]) -> bool:
    return any(c in df.columns for c in cols)

def has_all(df: pd.DataFrame, cols: list[str]) -> bool:
    return all(c in df.columns for c in cols)

# CORS for local dev (Vite on :5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

print(f"[BOOT] USE_JPRED={USE_JPRED} • USE_TANGO={USE_TANGO}")



# --- UI compatibility shims (naming + per-row flags) ---
def _finalize_ui_aliases(df: pd.DataFrame) -> None:
    # Per-row chameleon flag so the UI can just average/sum if it wants
    if "SSW prediction" in df.columns:
        df["Chameleon"] = (df["SSW prediction"] == 1).astype(int)
    else:
        df["Chameleon"] = 0

    # FF-Helix alias: some UIs use "FF Helix %" (no hyphen)
    if "FF-Helix %" in df.columns:
        df["FF Helix %"] = pd.to_numeric(df["FF-Helix %"], errors="coerce")
    elif "FF Helix %" in df.columns:
        # normalize to the hyphen name too, just in case other parts expect it
        df["FF-Helix %"] = pd.to_numeric(df["FF Helix %"], errors="coerce")
    else:
        df["FF-Helix %"] = -1
        df["FF Helix %"] = -1

    # Ensure fragments column exists (empty list per row if missing)
    if "FF Helix fragments" not in df.columns:
        df["FF Helix fragments"] = pd.Series([[] for _ in range(len(df))], dtype=object)



# Add these functions to your server.py file

def normalize_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names to expected format."""
    df = canonicalize_headers(df)
    
    # Ensure required columns exist
    if "entry" in df.columns:
        df = df.rename(columns={"entry": "Entry"})
    if "sequence" in df.columns:
        df = df.rename(columns={"sequence": "Sequence"})
    if "length" in df.columns:
        df = df.rename(columns={"length": "Length"})
    if "organism" in df.columns:
        df = df.rename(columns={"organism": "Organism"})
    if "name" in df.columns:
        df = df.rename(columns={"name": "Protein name"})
    
    return df

def ensure_cols(df: pd.DataFrame):
    """Ensure all required columns exist with default values."""
    required_cols = [
        "Charge", "Hydrophobicity", "Full length uH", "Helix (Jpred) uH",
        "Beta full length uH", "SSW prediction", "SSW score", "SSW diff",
        "SSW helix percentage", "SSW beta percentage",
        "FF-Secondary structure switch", "FF-Helix (Jpred)"
    ]
    
    for col in required_cols:
        if col not in df.columns:
            if col == "Helix fragments (Jpred)":
                df[col] = pd.Series([[] for _ in range(len(df))], dtype=object)
            else:
                df[col] = -1

def ff_flags(df: pd.DataFrame):
    """Calculate FF flags based on existing data."""
    # This function should compute your final FF flags
    # For now, just ensure the columns exist
    if "FF-Helix (Jpred)" not in df.columns:
        df["FF-Helix (Jpred)"] = -1
    if "FF-Secondary structure switch" not in df.columns:
        df["FF-Secondary structure switch"] = -1


@app.get("/api/example")
def load_example(recalc: int = 0):
    """
    Serve the presentation dataset with JPred/Tango already computed.
    By default (recalc=0) we DO NOT recompute biochem/JPred/Tango.
    Set recalc=1 if you explicitly want to recompute locally.
    """
    if not os.path.exists(EXAMPLE_PATH):
        raise HTTPException(status_code=404, detail=f"Example file not found at {EXAMPLE_PATH}")

    try:
        df = pd.read_excel(EXAMPLE_PATH)  # needs openpyxl
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed reading example xlsx: {e}")

    # Normalize essential columns but DO NOT drop precomputed fields
    try:
        df = normalize_cols(df)  # your existing helper: maps Entry/Sequence/Length
    except HTTPException:
        # for legacy sheets, derive Length if missing
        if "Sequence" in df.columns and "Length" not in df.columns:
            df["Length"] = df["Sequence"].astype(str).str.len()

    # Decide what to compute based on what's already present
    already_has_biochem = has_all(df, BIOCHEM_COLS)
    already_has_jpred  = has_any(df, JPRED_COLS)
    already_has_tango  = has_any(df, TANGO_COLS)

    # Recompute only if asked (recalc=1) or missing
    if recalc or not already_has_biochem:
        ensure_cols(df)     # creates missing cols with -1
        calc_biochem(df)    # computes Charge, Hydrophobicity, uH
    else:
        # ensure numeric types for charts
        for c in BIOCHEM_COLS:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce")

    if recalc or (USE_JPRED and not already_has_jpred):
        try:
            jpred.process_jpred_output(df, "Example")
        except Exception as e:
            print(f"[WARN] JPred parse failed (example): {e}")

    if recalc or (USE_TANGO and not already_has_tango):
        try:
            # whichever Tango flow you use; if you switched to run_and_attach, call that
            if hasattr(tango, "run_and_attach"):
                tango.run_and_attach(df)
            else:
                tango.process_tango_output(df)
                tango.filter_by_avg_diff(df, "Example", {"Example": {}})
        except Exception as e:
            print(f"[WARN] Tango parse failed (example): {e}")

    # Always compute final FF flags on the DataFrame we’re returning
    ensure_cols(df)
    ff_flags(df)

    # build meta so the UI can show provenance pills
    meta = {
        "use_jpred": USE_JPRED or already_has_jpred,
        "use_tango": USE_TANGO or already_has_tango,
        "jpred_rows": int((df.get("Helix fragments (Jpred)", pd.Series([-1]*len(df))) != -1).sum()),
        "ssw_rows":   int((df.get("SSW prediction", pd.Series([-1]*len(df))) != -1).sum()),
        "valid_seq_rows": int(df["Sequence"].notna().sum())
    }
    print(f"[EXAMPLE] rows={len(df)} • JPred rows={meta['jpred_rows']} • Tango rows={meta['ssw_rows']} • recalc={recalc}")

    return {"rows": json.loads(df.to_json(orient="records")), "meta": meta}

@app.get("/api/health")
def health():
    return {"ok": True}

# ---------- Helpers ----------
AA20 = set(list("ACDEFGHIKLMNPQRSTVWY"))

def sanitize_seq(s: str) -> str:
    s = (s or "").upper()
    s = re.sub(r"[^A-Z]", "", s)        # drop spaces, digits, etc.
    # keep 20 canonical AAs; convert ambiguous to closest if you want
    s = "".join([ch for ch in s if ch in AA20])
    return s

# Accept many UniProt header variants and collapse to canonical keys
HEADER_SYNONYMS: Dict[str, List[str]] = {
    "entry": [
        "entry", "accession", "ac", "uniprotkb", "uniprot id", "id",
        "primary accession", "primary (accession no.)", "entry id"
    ],
    "sequence": ["sequence", "seq"],
    "length": ["length", "len"],
    "organism": ["organism", "organism name", "species"],
    "name": ["protein names", "protein name", "entry name", "recommended name", "name"],
}

def _norm(s: str) -> str:
    return str(s).strip().lower().replace("\ufeff","").strip('"\'')

def canonicalize_headers(df: pd.DataFrame) -> pd.DataFrame:
    lower = {c: _norm(c) for c in df.columns}
    rename = {}
    for canon, opts in HEADER_SYNONYMS.items():
        hit = next((orig for orig, low in lower.items() if low in opts), None)
        if hit:
            rename[hit] = canon
    return df.rename(columns=rename)

def require_cols(df: pd.DataFrame, cols: List[str]):
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise HTTPException(
            400,
            detail=f"Missing required column(s): {missing}. "
                   f"Available columns: {list(df.columns)}. "
                   f"Export from UniProt with at least 'Entry/Accession' and 'Sequence'."
        )

def read_any_table(raw: bytes, filename: str) -> pd.DataFrame:
    """Read CSV/TSV/XLS(X) with auto delimiter detection and BOM handling."""
    fn = filename.lower()
    bio = io.BytesIO(raw)

    if fn.endswith((".xlsx", ".xls")):
        # needs openpyxl installed
        return pd.read_excel(bio)

    # Try UTF-8 with BOM removal; let pandas sniff the delimiter
    try:
        return pd.read_csv(io.BytesIO(raw), sep=None, engine="python", encoding="utf-8-sig")
    except Exception:
        pass

    # Fallback to TSV, then CSV explicitly
    try:
        return pd.read_csv(io.BytesIO(raw), sep="\t", encoding="utf-8-sig")
    except Exception:
        return pd.read_csv(io.BytesIO(raw), sep=",", encoding="utf-8-sig")

# ---------- NEW: small utilities for FF + percents ----------
def ensure_computed_cols(df: pd.DataFrame):
    for c in [
        "Charge", "Hydrophobicity", "Full length uH", "Helix (Jpred) uH",
        "Helix fragments (Jpred)", "Helix score (Jpred)",
        "SSW prediction", "SSW score", "Beta full length uH"
    ]:
        if c not in df.columns:
            if c == "Helix fragments (Jpred)":
                # object dtype column of empty lists
                df[c] = pd.Series([[] for _ in range(len(df))], dtype=object)
            else:
                df[c] = -1

def _to_segments(val):
    # treat -1 / None / empty as no segments
    if val is None or (isinstance(val, (int, float)) and val == -1):
        return []
    if isinstance(val, (list, tuple)):
        return list(val)
    if isinstance(val, str):
        s = val.strip()
        if not s:
            return []
        # try JSON first (e.g., "[[5,12],[20,28]]")
        try:
            seg = json.loads(s)
            if isinstance(seg, (list, tuple)):
                return list(seg)
        except Exception:
            pass
        # fallback: "5-12;20-28" or "5:12,20:28"
        seg = []
        for part in re.split(r"[;,]", s):
            m = re.match(r"\s*(\d+)\s*[-:]\s*(\d+)\s*", part)
            if m:
                seg.append([int(m.group(1)), int(m.group(2))])
        return seg
    return []

def calc_biochem(df: pd.DataFrame):
    charges, hydros, uh_full, uh_helix, uh_beta = [], [], [], [], []
    for _, r in df.iterrows():
        seq_raw = str(r["Sequence"])
        seq = sanitize_seq(seq_raw) or auxiliary.get_corrected_sequence(seq_raw)
        if not seq:
            # mark invalids so the UI can show 'Not available' instead of 0.00
            charges.append(float("nan"))
            hydros.append(float("nan"))
            uh_full.append(float("nan"))
            uh_helix.append(float("nan"))
            uh_beta.append(float("nan"))
            continue

        charges.append(biochemCalculation.total_charge(seq))
        hydros.append(biochemCalculation.hydrophobicity(seq))
        uh_full.append(biochemCalculation.hydrophobic_moment(seq))

        # robustly parse helix fragments
        helix_frags = _to_segments(r.get("Helix fragments (Jpred)", []))
        uh_helix.append(auxiliary.get_avg_uH_by_segments(seq, helix_frags))

        uh_beta.append(biochemCalculation.hydrophobic_moment(seq, angle=160))

    df["Charge"] = charges
    df["Hydrophobicity"] = hydros
    df["Full length uH"] = uh_full
    df["Helix (Jpred) uH"] = uh_helix
    df["Beta full length uH"] = uh_beta

def apply_ff_flags(df: pd.DataFrame):
    ssw_avg_H = df[df["SSW prediction"] != 1]["Hydrophobicity"].mean()
    jpred_avg_uH = df[df["Helix (Jpred) uH"] != -1]["Helix (Jpred) uH"].mean()
    df["FF-Secondary structure switch"] = [
        1 if r["SSW prediction"] == 1 and r["Hydrophobicity"] >= ssw_avg_H else -1
        for _, r in df.iterrows()
    ]
    df["FF-Helix (Jpred)"] = [
        1 if r["Helix (Jpred) uH"] != -1 and r["Helix (Jpred) uH"] >= jpred_avg_uH else -1
        for _, r in df.iterrows()
    ]

def _fill_percent_from_tango_if_missing(df: pd.DataFrame) -> None:
    """
    If PSIPRED is off, ensure percent content fields exist using Tango merges.
    (Your tango.process_tango_output already sets these for each row.)
    We just guarantee presence + numeric dtype so the UI cards can compute means.
    """
    for col in ["SSW helix percentage", "SSW beta percentage"]:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

def _chameleon_percent(df: pd.DataFrame) -> float:
    """Percent of rows that are chameleon-positive (SSW prediction == 1)."""
    if "SSW prediction" not in df.columns or len(df) == 0:
        return 0.0
    pos = int((df["SSW prediction"] == 1).sum())
    return round(100.0 * pos / len(df), 1)

# ---------- Endpoints ----------

@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """
    Accept a UniProt export as CSV/TSV/XLSX.
    Only 'Entry/Accession' and 'Sequence' are required; 'Length' is computed if missing.
    Computed fields (Hydrophobicity, Charge, μH, FF flags) are added server-side.
    """
    raw = await file.read()
    try:
        df = read_any_table(raw, file.filename)
    except Exception as e:
        raise HTTPException(400, detail=f"Failed to parse table: {e}")

    df = canonicalize_headers(df)
    require_cols(df, ["entry", "sequence"])

    # build canonical names used by the rest of the pipeline
    df = df.rename(columns={
        "entry": "Entry",
        "sequence": "Sequence",
        "length": "Length",
        "organism": "Organism",
        "name": "Protein name",
    })

    # if Length absent, derive from sequence
    if "Length" not in df.columns:
        df["Length"] = df["Sequence"].astype(str).str.len()

    # Step 2 (already present): compute FF-Helix %
    ensure_ff_cols(df)
    ensure_computed_cols(df)

    if USE_PSIPRED:
        try:
            import psipred
            recs = psipred.create_psipred_input(df)
            if recs:
                psipred.run_psipred(recs)         # best-effort; returns fast if not set up
                psipred.process_psipred_output(df)
            else:
                print("[PSIPRED] No eligible sequences (len<15) or empty; skipping.")
        except Exception as e:
            print(f"[PSIPRED][WARN] skipped due to error: {e}")

    # Optional enrichments (parse local outputs if present)
    if USE_JPRED:
        try:
            jpred.process_jpred_output(df, "Uploaded")
        except Exception:
            pass

    # --- TANGO (simple mac runner) -----------------------------------------
    try:
        if env_true("USE_TANGO", True):
            # Build fresh records (Entry, Sequence) from df
            existed = tango.get_all_existed_tango_results_entries()
            records = tango.create_tango_input(df, existed_tango_results=existed, force=True)

            if records:
                tango.run_tango_simple(records)  # creates out/run_*/<ID>.txt
            else:
                print("[TANGO] No records to run (possibly all already processed).")

            # Parse latest run_* back into the DataFrame
            tango.process_tango_output(df)

            # Step 3: ensure %Helix / %β present from Tango if PSIPRED is off
            _fill_percent_from_tango_if_missing(df)

            # Produce SSW prediction column used by the Chameleon badge
            try:
                stats = {"upload": {}}
                tango.filter_by_avg_diff(df, "upload", stats)
            except Exception as e:
                print(f"[TANGO][WARN] Could not compute SSW prediction: {e}")

        else:
            print("[TANGO] disabled by USE_TANGO env.")
    except Exception as e:
        print(f"[TANGO][WARN] {e}  (continuing without Tango)")
    # -----------------------------------------------------------------------

    jpred_hits = int((df["Helix fragments (Jpred)"] != -1).sum()) if "Helix fragments (Jpred)" in df.columns else 0
    ssw_hits   = int((df["SSW prediction"] != -1).sum())           if "SSW prediction" in df.columns else 0

    # --- Step 1: compute Chameleon % and helpful summary print -------------
    cham_percent = _chameleon_percent(df)
    ff_avail = int((pd.to_numeric(df.get("FF-Helix %", pd.Series([-1]*len(df))), errors="coerce") != -1).sum())
    print(f"[UPLOAD] rows={len(df)} • JPred segments found for {jpred_hits} rows • "
          f"SSW preds for {ssw_hits} rows • Chameleon+ {cham_percent}% • "
          f"FF-Helix avail {ff_avail}/{len(df)}")

    # Compute biochemical features and flags
    calc_biochem(df)
    apply_ff_flags(df)
    _finalize_ui_aliases(df) 

    # --- Finalize FF fields for UI ---
    if "FF-Helix %" not in df.columns:
        df["FF-Helix %"] = -1
    df["FF-Helix %"] = pd.to_numeric(df["FF-Helix %"], errors="coerce").fillna(-1)

    if "FF Helix fragments" not in df.columns:
        df["FF Helix fragments"] = pd.Series([[] for _ in range(len(df))], dtype=object)

    # ===== CAMELCASE SHIM (so the UI sees the values) =====
    df_out = df.copy()
    # core KPIs
    df_out["ffHelixPercent"]     = pd.to_numeric(df_out.get("FF-Helix %", -1), errors="coerce").fillna(-1)
    df_out["ffHelixFragments"]   = df_out.get("FF Helix fragments", [[] for _ in range(len(df_out))])
    df_out["chameleonPrediction"] = pd.to_numeric(df_out.get("SSW prediction", -1), errors="coerce").fillna(-1)

    # helix/beta % from PSIPRED if present, otherwise from Tango merge
    df_out["helixPercent"] = pd.to_numeric(
        df_out.get("PSIPRED helix %", df_out.get("SSW helix percentage", 0)), errors="coerce"
    ).fillna(0)
    df_out["betaPercent"] = pd.to_numeric(
        df_out.get("PSIPRED beta %", df_out.get("SSW beta percentage", 0)), errors="coerce"
    ).fillna(0)

    rows_json = json.loads(df_out.to_json(orient="records"))
    return {
        "rows": rows_json,
        "meta": {
            "use_jpred": USE_JPRED, "use_tango": USE_TANGO,
            "jpred_rows": jpred_hits, "ssw_rows": ssw_hits,
            "valid_seq_rows": int(df["Sequence"].notna().sum())
        }
    }


@app.post("/api/predict")
async def predict(sequence: str = Form(...), entry: Optional[str] = Form(None)):
    seq = auxiliary.get_corrected_sequence(sequence)
    df = pd.DataFrame([{"Entry": entry or "adhoc", "Sequence": seq, "Length": len(seq)}])

    # Step 2 (already present): compute FF-Helix %
    ensure_ff_cols(df)
    ensure_computed_cols(df)

    # Optional enrichments for single sequence
    if USE_TANGO:
        try:
            # prefer simple runner; fallback to generic if not present
            tango_records = [(entry or "adhoc", seq)]
            if hasattr(tango, "run_tango_simple"):
                print("running tango simple")
                tango.run_tango_simple(tango_records)
            else:
                print("not running tango simple, but run_tango instead because the other one failed")
                tango.run_tango(records=tango_records)

            tango.process_tango_output(df)
            _fill_percent_from_tango_if_missing(df)
            tango.filter_by_avg_diff(df, "single", {"single": {}})
        except Exception as e:
            print(f"[PREDICT][WARN] Tango failed: {e}")

    if USE_JPRED:
        try:
            jpred.process_jpred_output(df, "single")
        except Exception as e:
            print(f"[PREDICT][WARN] JPred failed: {e}")

    calc_biochem(df)
    apply_ff_flags(df)
    _finalize_ui_aliases(df) 

    # --- Finalize FF fields for UI ---
    if "FF-Helix %" not in df.columns:
        df["FF-Helix %"] = -1
    df["FF-Helix %"] = pd.to_numeric(df["FF-Helix %"], errors="coerce").fillna(-1)

    if "FF Helix fragments" not in df.columns:
        df["FF Helix fragments"] = pd.Series([[] for _ in range(len(df))], dtype=object)

    # ===== CAMELCASE SHIM (single row) =====
    df_out = df.copy()
    df_out["ffHelixPercent"]      = pd.to_numeric(df_out.get("FF-Helix %", -1), errors="coerce").fillna(-1)
    df_out["ffHelixFragments"]    = df_out.get("FF Helix fragments", [[] for _ in range(len(df_out))])
    df_out["chameleonPrediction"] = pd.to_numeric(df_out.get("SSW prediction", -1), errors="coerce").fillna(-1)
    df_out["helixPercent"]        = pd.to_numeric(
        df_out.get("PSIPRED helix %", df_out.get("SSW helix percentage", 0)), errors="coerce"
    ).fillna(0)
    df_out["betaPercent"]         = pd.to_numeric(
        df_out.get("PSIPRED beta %", df_out.get("SSW beta percentage", 0)), errors="coerce"
    ).fillna(0)

    return json.loads(df_out.to_json(orient="records"))[0]

