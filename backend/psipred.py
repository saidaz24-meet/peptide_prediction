# backend/psipred.py
import os, re, subprocess
from datetime import datetime
from typing import List, Tuple, Optional
import pandas as pd

PROJECT_PATH = os.path.dirname(os.path.abspath(__file__))
PSI_DIR      = os.path.join(PROJECT_PATH, "Psipred")
WORK_DIR     = os.path.join(PSI_DIR, "work")
OUT_DIR      = os.path.join(PSI_DIR, "out")
KEY          = "Entry"

AA20 = set("ACDEFGHIKLMNPQRSTVWY")

def _ensure_dirs():
    os.makedirs(WORK_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

def _sanitize_seq(s: str) -> str:
    s = re.sub(r"[^A-Za-z]", "", (s or "")).upper()
    return "".join(ch for ch in s if ch in AA20)

def _docker_available() -> bool:
    return subprocess.call(["which", "docker"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0

def _image_exists(image: str) -> bool:
    try:
        p = subprocess.run(["docker","image","inspect", image],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, text=True)
        return p.returncode == 0
    except Exception:
        return False

def create_psipred_input(database: pd.DataFrame) -> List[Tuple[str,str]]:
    _ensure_dirs()
    recs: List[Tuple[str,str]] = []
    for _, row in database.iterrows():
        entry = str(row.get(KEY) or "").strip()
        seq   = str(row.get("Sequence") or "").strip()
        if not entry or not seq:
            continue
        seq = _sanitize_seq(seq)
        if len(seq) < 15:
            continue
        # write per-seq fasta now (runner expects it)
        with open(os.path.join(WORK_DIR, f"{entry}.fa"), "w") as fh:
            fh.write(f">{entry}\n{seq}\n")
        recs.append((entry, seq))
    print(f"[PSIPRED] Prepared {len(recs)} FASTA files in {WORK_DIR}")
    return recs

def _latest_run_dir() -> Optional[str]:
    if not os.path.isdir(OUT_DIR):
        return None
    runs = [os.path.join(OUT_DIR, d) for d in os.listdir(OUT_DIR)
            if d.startswith("run_") and os.path.isdir(os.path.join(OUT_DIR, d))]
    if not runs: return None
    runs.sort(key=os.path.getmtime)
    return runs[-1]

def run_psipred(records: List[Tuple[str,str]]) -> str:
    """
    Best-effort Docker runner. If Docker, image, or DB are missing, it returns quickly
    without raising (so the UI never freezes).
    """
    _ensure_dirs()
    stamp = datetime.now().strftime("run_%Y%m%d_%H%M%S")
    run_dir = os.path.join(OUT_DIR, stamp)
    os.makedirs(run_dir, exist_ok=True)

    if not records:
        print("[PSIPRED][WARN] No records to process")
        return run_dir

    # Gate conditions: if anything critical is missing, skip cleanly
    if not _docker_available():
        print("[PSIPRED][WARN] Docker not found on PATH; skipping PSIPRED.")
        return run_dir

    image = os.getenv("PSIPRED_IMAGE", "psipred-hhblits")
    if not _image_exists(image):
        print(f"[PSIPRED][WARN] Docker image '{image}' not found; skipping PSIPRED.")
        return run_dir

    db_host = os.getenv("PSIPRED_DB", "").strip()
    have_db = bool(db_host) and os.path.isdir(db_host)
    if not have_db:
        # Don’t attempt hhblits without a database; skip gracefully
        print("[PSIPRED][WARN] PSIPRED_DB not set or not a directory; skipping PSIPRED.")
        return run_dir

    # Run each sequence with a per-seq timeout so nothing can hang
    for eid, _ in records:
        fa_rel  = f"work/{eid}.fa"
        out_rel = f"out/{os.path.basename(run_dir)}/{eid}"
        cmd = [
            "docker","run","--rm",
            "-v", f"{PSI_DIR}:/app/Psipred",
            "-v", f"{db_host}:/db:ro",
            "-w", "/app/Psipred",
            image,
            "bash","-lc",
            (
                f"set -euo pipefail; "
                f"mkdir -p {out_rel} && "
                # 1) build MSA
                f"hhblits -i {fa_rel} "
                f"-oa3m {out_rel}/{eid}.a3m "
                f"-o {out_rel}/{eid}.hhblits "
                f"-d /db -E 1e-3 -maxfilt 500000 -b 1 -n 3 && "
                # 2) run psipred (image must provide 'runpsipred')
                f"runpsipred {fa_rel} {out_rel}/{eid}.a3m > {out_rel}/{eid}.ss2"
            )
        ]
        print("[PSIPRED] docker:", " ".join(cmd))
        try:
            proc = subprocess.run(cmd, text=True, capture_output=True, timeout=600)
            if proc.returncode != 0:
                print(f"[PSIPRED][ERR] seq {eid} failed (non-zero exit).")
                if proc.stdout: print(proc.stdout[:1000])
                if proc.stderr: print(proc.stderr[:1000])
                # continue to next sequence
        except subprocess.TimeoutExpired:
            print(f"[PSIPRED][ERR] seq {eid} timed out; skipping.")
        except Exception as e:
            print(f"[PSIPRED][ERR] seq {eid} unexpected error: {e}")

    print(f"[PSIPRED] Finished: outputs in {run_dir}")
    return run_dir

def _parse_ss2(path: str) -> Optional[pd.DataFrame]:
    if not os.path.exists(path):
        return None
    rows = []
    with open(path) as fh:
        for ln in fh:
            if ln.startswith("#") or not ln.strip():
                continue
            parts = ln.split()
            if len(parts) < 6:
                continue
            try:
                idx = int(parts[0]); aa = parts[1]; ss = parts[2]
                ph,pe,pc = map(float, parts[3:6])
                rows.append((idx, aa, ss, ph, pe, pc))
            except Exception:
                continue
    if not rows:
        return None
    return pd.DataFrame(rows, columns=["i","aa","ss","P_H","P_E","P_C"])

def _segments(prob: pd.Series, thr: float=0.5, minlen:int=6) -> List[Tuple[int,int]]:
    segs=[]; start=None
    vals = prob.tolist()
    for i, v in enumerate(vals, start=1):
        if v>=thr and start is None: start=i
        if (v<thr or i==len(vals)) and start is not None:
            end= i if v>=thr and i==len(vals) else i-1
            if end-start+1 >= minlen: segs.append((start,end))
            start=None
    return segs

def _ff_helix_percent(df_ss2: pd.DataFrame) -> float:
    segs = _segments(df_ss2["P_H"], thr=0.8, minlen=6)
    L = len(df_ss2)
    if L==0: return 0.0
    covered = sum(e-s+1 for s,e in segs)
    return round(100.0*covered/L, 1)

def _ssw_from_psipred(df_ss2: pd.DataFrame):
    import numpy as np
    PH, PE = df_ss2["P_H"].to_numpy(), df_ss2["P_E"].to_numpy()
    L = len(PH)
    frags=[]
    best_score= -1.0
    best_diff = 0.0
    wmins, wmaxs = 8, 20
    for w in range(wmins, min(wmaxs,L)+1):
        i=0
        while i+w<=L:
            ph = PH[i:i+w].mean()
            pe = PE[i:i+w].mean()
            diff = np.abs(PH[i:i+w]-PE[i:i+w]).mean()
            if ph>=0.35 and pe>=0.35 and diff<=0.15:
                j=i+w
                while j<L and min(PH[j],PE[j])>=0.35 and abs(PH[j]-PE[j])<=0.15:
                    j+=1
                frags.append((i+1, j))
                score = max(ph,pe)
                if score>best_score:
                    best_score=score; best_diff=diff
                i=j
            else:
                i+=1
    helix_pct = round(100.0*(PH>=0.5).mean(),1)
    beta_pct  = round(100.0*(PE>=0.5).mean(),1)
    if not frags:
        return [], -1.0, 0.0, helix_pct, beta_pct
    return frags, round(best_score,3), round(best_diff,3), helix_pct, beta_pct

def process_psipred_output(database: pd.DataFrame) -> None:
    """
    Non-destructive merge of PSIPRED results into the DataFrame.
    Fills:
      - Helix fragments (Psipred)
      - Psipred helix %, Psipred beta %
      - FF-Helix %
      - If Tango SSW missing: SSW fragments/score/diff/helix%/beta% from PSIPRED
    """
    _ensure_dirs()
    run_dir = _latest_run_dir()
    if not run_dir:
        print("[PSIPRED][WARN] No PSIPRED run dir; skipping merge.")
        return

    helix_frags_col=[]; helix_pct_col=[]; beta_pct_col=[]; ffh_col=[]
    ssw_frags=[]; ssw_score=[]; ssw_diff=[]; ssw_hpct=[]; ssw_bpct=[]

    for _, row in database.iterrows():
        entry = str(row.get(KEY) or "").strip()
        ss2 = os.path.join(run_dir, entry, f"{entry}.ss2")
        df = _parse_ss2(ss2)
        if df is None:
            helix_frags_col.append([])
            helix_pct_col.append(0.0)
            beta_pct_col.append(0.0)
            ffh_col.append(0.0)
            ssw_frags.append(row.get("SSW fragments","-") or "-")
            ssw_score.append(row.get("SSW score",-1))
            ssw_diff.append(row.get("SSW diff",0))
            ssw_hpct.append(row.get("SSW helix percentage",0))
            ssw_bpct.append(row.get("SSW beta percentage",0))
            continue

        helix_segs = _segments(df["P_H"], thr=0.5, minlen=6)
        helix_frags_col.append(helix_segs)
        helix_pct_col.append(round(100.0*(df["P_H"]>=0.5).mean(),1))
        beta_pct_col.append(round(100.0*(df["P_E"]>=0.5).mean(),1))
        ffh_col.append(_ff_helix_percent(df))

        if (row.get("SSW score", -1) == -1) and (row.get("SSW fragments","-") in ("-","",None,[])):
            fr, sc, dfv, hp, bp = _ssw_from_psipred(df)
            ssw_frags.append(fr); ssw_score.append(sc); ssw_diff.append(dfv)
            ssw_hpct.append(hp);  ssw_bpct.append(bp)
        else:
            ssw_frags.append(row.get("SSW fragments"))
            ssw_score.append(row.get("SSW score"))
            ssw_diff.append(row.get("SSW diff"))
            ssw_hpct.append(row.get("SSW helix percentage"))
            ssw_bpct.append(row.get("SSW beta percentage"))

    database["Helix fragments (Psipred)"] = helix_frags_col
    database["Psipred helix %"] = helix_pct_col
    database["Psipred beta %"]  = beta_pct_col
    database["FF-Helix %"]      = ffh_col
    database["SSW fragments"]         = ssw_frags
    database["SSW score"]             = ssw_score
    database["SSW diff"]              = ssw_diff
    database["SSW helix percentage"]  = ssw_hpct
    database["SSW beta percentage"]   = ssw_bpct
