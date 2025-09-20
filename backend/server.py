# backend/server.py
import io, os, json, re
from typing import Optional, Dict, List
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import auxiliary, biochemCalculation, jpred, tango

# Turn these on AFTER you copy result folders into backend/Tango and backend/Jpred
USE_TANGO = bool(int(os.getenv("USE_TANGO", "0")))
USE_JPRED  = bool(int(os.getenv("USE_JPRED", "0")))

app = FastAPI(title="Peptide Prediction Service")

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

@app.get("/api/health")
def health():
    return {"ok": True}

# ---------- Helpers ----------

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



# NEW STUFF GOING ON
# NEW STUFF GOING ON

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
        seq = auxiliary.get_corrected_sequence(str(r["Sequence"]))
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


# NEW STUFF GOING ON UP 
# NEW STUFF GOING ON UP


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

    ensure_computed_cols(df)

    # Optional enrichments (parse local outputs if present)
    if USE_JPRED:
        try: jpred.process_jpred_output(df, "Uploaded")
        except Exception: pass
    if USE_TANGO:
        try:
            tango.process_tango_output(df)
            tango.filter_by_avg_diff(df, "Uploaded", {"Uploaded": {}})
        except Exception: pass

    # Compute biochemical features and flags
    calc_biochem(df)
    apply_ff_flags(df)

    return {"rows": json.loads(df.to_json(orient="records"))}

@app.post("/api/predict")
async def predict(sequence: str = Form(...), entry: Optional[str] = Form(None)):
    seq = auxiliary.get_corrected_sequence(sequence)
    df = pd.DataFrame([{"Entry": entry or "adhoc", "Sequence": seq, "Length": len(seq)}])
    ensure_computed_cols(df)
    calc_biochem(df)
    apply_ff_flags(df)
    return json.loads(df.to_json(orient="records"))[0]
