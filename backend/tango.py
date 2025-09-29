# backend/tango.py
import os
import re
import subprocess
import shutil
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional

import pandas as pd
import auxiliary

# ---------------------------------------------------------------------
# Docker availability
# ---------------------------------------------------------------------
def _docker_available() -> bool:
    return shutil.which("docker") is not None


# ---------------------------------------------------------------------
# Paths / constants (repo-relative, robust to cwd)
# ---------------------------------------------------------------------
PROJECT_PATH = os.path.dirname(os.path.abspath(__file__))
TANGO_DIR    = os.path.abspath(os.path.join(PROJECT_PATH, "Tango"))

# Canonical working/output dirs
WORK_DIR = os.path.join(TANGO_DIR, "work")   # inputs for runs
OUT_DIR  = os.path.join(TANGO_DIR, "out")    # per-run outputs

# Back-compat aliases (older code referenced these)
TANGO_WORK_DIR = WORK_DIR
TANGO_OUT_ROOT = OUT_DIR
OUT_ROOT       = OUT_DIR  # legacy name

KEY = "Entry"  # DataFrame column that holds peptide ID (UniProt accession, etc.)

AA20 = set("ACDEFGHIKLMNPQRSTVWY")
AMBIGUOUS_MAP = {
    "B": "N",   # D/N ambiguous -> choose N
    "Z": "Q",   # E/Q ambiguous -> choose Q
    "X": "",    # unknown -> drop
    "U": "C",   # selenocysteine -> treat as C
    "O": "K",   # pyrrolysine -> treat as K
    "*": "",    # stop -> drop
}

# Cache for latest run directory — IMPORTANT: different name from the function!
_LATEST_RUN_DIR: Optional[str] = None


# ---------------------------------------------------------------------
# Dir helpers (canonical) + back-compat shims
# ---------------------------------------------------------------------
def _ensure_dirs() -> None:
    """Create WORK_DIR and OUT_DIR if missing."""
    os.makedirs(WORK_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

# Back-compat shim: some code calls _ensure_tree()
def _ensure_tree() -> None:
    _ensure_dirs()

def _start_new_run_dir() -> str:
    """Create a new timestamped run dir and cache it. Also sweeps stray *.txt in Tango/."""
    _ensure_dirs()
    stamp = datetime.now().strftime("run_%Y%m%d_%H%M%S")
    run_dir = os.path.join(OUT_DIR, stamp)
    os.makedirs(run_dir, exist_ok=True)

    # Sweep any stray per-peptide *.txt laying in Tango/ into this run dir
    for name in os.listdir(TANGO_DIR):
        if not name.lower().endswith(".txt"):
            continue
        if name.startswith("Tango_input") or name.startswith("Tango_output"):
            continue
        try:
            shutil.move(os.path.join(TANGO_DIR, name), os.path.join(run_dir, name))
        except Exception:
            pass

    global _LATEST_RUN_DIR
    _LATEST_RUN_DIR = run_dir
    return run_dir

# Back-compat shim: some code expects _ensure_run_dirs() to return a run dir
def _ensure_run_dirs() -> str:
    return _start_new_run_dir()

def _latest_run_dir() -> Optional[str]:
    """
    Return the newest OUT_DIR/run_* dir (or the one we just created).
    NOTE: This is a function; the cached string is _LATEST_RUN_DIR (uppercase).
    """
    global _LATEST_RUN_DIR
    if _LATEST_RUN_DIR and os.path.isdir(_LATEST_RUN_DIR):
        return _LATEST_RUN_DIR
    if not os.path.isdir(OUT_DIR):
        return None
    runs = [
        os.path.join(OUT_DIR, d)
        for d in os.listdir(OUT_DIR)
        if d.startswith("run_") and os.path.isdir(os.path.join(OUT_DIR, d))
    ]
    if not runs:
        return None
    runs.sort(key=os.path.getmtime)
    _LATEST_RUN_DIR = runs[-1]
    return _LATEST_RUN_DIR


# ---------------------------------------------------------------------
# Misc helpers
# ---------------------------------------------------------------------
def _safe_id(x: str) -> str:
    x = str(x or "").strip() or "unknown"
    return "".join(ch if ch.isalnum() or ch in "_-." else "_" for ch in x)

def _sanitize_seq(seq: str) -> str:
    s = (seq or "").upper()
    s = re.sub(r"[^A-Z*]", "", s)  # keep letters/'*'
    out = []
    for ch in s:
        if ch in AA20:
            out.append(ch)
        elif ch in AMBIGUOUS_MAP:
            rep = AMBIGUOUS_MAP[ch]
            if rep:
                out.append(rep)
        # else: drop
    return "".join(out)

def _resolve_tango_bin() -> str:
    """Host macOS tango lives under Tango/bin/tango."""
    tb = os.path.join(TANGO_DIR, "bin", "tango")
    if not os.path.exists(tb):
        raise RuntimeError(f"Tango binary not found at {tb}")
    # Make sure it’s executable & not quarantined
    try:
        os.chmod(tb, 0o755)
    except Exception:
        pass
    try:
        subprocess.run(["xattr", "-d", "com.apple.quarantine", tb],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass
    return tb


# ---------------------------------------------------------------------
# Public: check cache
# ---------------------------------------------------------------------
def get_all_existed_tango_results_entries() -> set:
    """
    Return a set of Entry IDs that already have a Tango per-peptide output.
    Looks in OUT_DIR/run_*/<ENTRY>.txt of the latest run.
    """
    _ensure_dirs()
    out = set()
    latest = _latest_run_dir()
    if latest:
        for f in os.listdir(latest):
            if f.lower().endswith(".txt"):
                out.add(f.split(".")[0])
    return out


# ---------------------------------------------------------------------
# Public: input writers (debug visibility) + record builder
# ---------------------------------------------------------------------
def create_tango_input(
    database: pd.DataFrame,
    existed_tango_results: set,
    force: bool = False
) -> List[Tuple[str, str]]:
    """
    Build/preview inputs and return (entry_id, seq) records to run.
    Writes three formats to WORK_DIR for debugging.
    """
    _ensure_dirs()

    # also respect latest run cache
    latest = _latest_run_dir()
    already = set()
    if latest:
        for f in os.listdir(latest):
            if f.lower().endswith(".txt"):
                already.add(f.split(".")[0])

    records: List[Tuple[str, str]] = []
    for _, row in database.iterrows():
        entry_id = str(row.get(KEY) or "").strip()
        if not entry_id:
            continue
        seq_raw = row.get("Sequence")
        if pd.isna(seq_raw):
            continue
        seq = _sanitize_seq(auxiliary.get_corrected_sequence(str(seq_raw)))
        if len(seq) < 5:
            continue
        if not force and (entry_id in existed_tango_results or entry_id in already):
            continue
        records.append((entry_id, seq))

    # Always write debug inputs
    f1 = os.path.join(WORK_DIR, "Tango_input_fmt1.txt")
    with open(f1, "w") as fh:
        for eid, seq in records:
            fh.write(f'{eid} nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="{seq}"\n')
    print(f"[DEBUG] Wrote {f1} with {len(records)} sequences (fmt1)")

    f2 = os.path.join(WORK_DIR, "Tango_input_fmt2.txt")
    with open(f2, "w") as fh:
        for eid, seq in records:
            fh.write(f"{eid} N N 7 298 0.1 0 {seq}\n")
    print(f"[DEBUG] Wrote {f2} with {len(records)} sequences (fmt2)")

    f3 = os.path.join(WORK_DIR, "Tango_input_fmt3.txt")
    with open(f3, "w") as fh:
        fh.write("Name\tnt\tct\tpH\tte\tio\ttf\tseq\n")
        for eid, seq in records:
            fh.write(f"{eid}\tN\tN\t7\t298\t0.1\t0\t{seq}\n")
    print(f"[DEBUG] Wrote {f3} with {len(records)} sequences (fmt3)")

    print(f"[DEBUG] Tango: queued {len(records)} sequences")
    return records


def _write_single_inputs(entry: str, seq: str) -> Dict[str, str]:
    """
    Write two single-input files:
      - fmt2 standard:    "<entry> N N 7 298 0.1 0 <seq>"
      - fmt2 aggregation: "<entry> N N 7 298 0.1 1 <seq>"  (note the '1')
    Returns dict with paths: {'standard': ..., 'aggregation': ...}
    """
    os.makedirs(WORK_DIR, exist_ok=True)
    p_std = os.path.join(WORK_DIR, "single_input.txt")
    p_agg = os.path.join(WORK_DIR, "single_input_aggregation.txt")
    with open(p_std, "w") as fh:
        fh.write(f"{entry} N N 7 298 0.1 0 {seq}\n")
    with open(p_agg, "w") as fh:
        fh.write(f"{entry} N N 7 298 0.1 1 {seq}\n")
    return {"standard": p_std, "aggregation": p_agg}


# ---------------------------------------------------------------------
# SIMPLE MAC RUNNER (mimics colleague’s .bat)
# ---------------------------------------------------------------------
def _write_simple_bat(records: List[Tuple[str, str]], script_path: str) -> None:
    """
    Create a simple per-peptide runner script (bash, but named .bat for parity).
    Each line calls the Tango binary with inline params and redirects to <ID>.txt.
    """
    os.makedirs(os.path.dirname(script_path), exist_ok=True)
    lines = []
    lines.append("#!/bin/bash\n")
    lines.append("set -euo pipefail\n")
    lines.append('BIN="$(dirname "$0")/bin/tango"\n')
    lines.append('if [ ! -x "$BIN" ]; then echo "[TANGO] tango binary missing at $BIN"; exit 1; fi\n')
    for entry_id, seq in records:
        safe = _safe_id(entry_id)
        # Tango inline args format (what your colleague used)
        lines.append(
            f'"$BIN" {safe} nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="{seq}" > "{safe}.txt"\n'
        )
    with open(script_path, "w") as fh:
        fh.writelines(lines)
    os.chmod(script_path, 0o755)

def run_tango_simple(records: Optional[List[Tuple[str, str]]]) -> None:
    """
    Very small, mac-native runner:
      - writes Tango_run.bat (bash script) into Tango/
      - executes it inside the per-run folder
      - outputs land under Tango/out/run_*/
    Safe no-op if records is empty; safe no-crash if tango/bin is missing.
    """
    _ensure_dirs()
    if not records:
        print("[TANGO][WARN] No records for simple runner; skipping.")
        return

    # Prepare per-run folder and script
    run_dir = _start_new_run_dir()
    script_path = os.path.join(TANGO_DIR, "Tango_run.bat")  # keep name for parity
    _write_simple_bat(records, script_path)

    # Make sure macOS Gatekeeper doesn’t block
    bin_path = os.path.join(TANGO_DIR, "bin", "tango")
    if not os.path.exists(bin_path):
        print(f"[TANGO][WARN] tango binary not found at {bin_path}; skipping execution.")
        return
    try:
        os.chmod(bin_path, 0o755)
        subprocess.run(["xattr", "-d", "com.apple.quarantine", bin_path],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # Execute inside the run directory so each <ID>.txt lands here
    try:
        proc = subprocess.run(
            ["bash", script_path],
            cwd=run_dir,
            capture_output=True,
            text=True,
            timeout=3600  # 1 h guard
        )
        if proc.returncode != 0:
            print("[TANGO][ERR] simple runner failed")
            print(proc.stdout[:2000])
            print(proc.stderr[:2000])
        else:
            count_txt = len([f for f in os.listdir(run_dir) if f.lower().endswith(".txt")])
            ok = count_txt
            print(f"[DEBUG] Tango simple run: OK={ok} FAIL={max(0, len(records)-ok)} • outputs at {run_dir}")
    except subprocess.TimeoutExpired:
        print("[TANGO][ERR] simple runner timed out; partial outputs may exist.")


# ---------------------------------------------------------------------
# Host macOS script runner (uses Tango_run.sh)
# ---------------------------------------------------------------------
def run_tango_host(records: List[Tuple[str, str]]) -> str:
    if not records:
        raise RuntimeError("run_tango_host: no records to process")

    _ensure_dirs()
    run_dir = _start_new_run_dir()

    # Write fmt2 input
    fmt2_rel = os.path.join("work", "Tango_input_fmt2.txt")
    fmt2_abs = os.path.join(WORK_DIR, "Tango_input_fmt2.txt")
    with open(fmt2_abs, "w") as f:
        for entry_id, seq in records:
            f.write(f"{entry_id} N N 7 298 0.1 0 {seq}\n")

    # Export TANGO_BIN so the script knows where the binary is
    env = os.environ.copy()
    env["TANGO_BIN"] = _resolve_tango_bin()

    sh_path = os.path.join(TANGO_DIR, "Tango_run.sh")
    if not (os.path.isfile(sh_path) and os.access(sh_path, os.X_OK)):
        raise RuntimeError("Tango_run.sh not found or not executable")

    # Run the script with paths relative to TANGO_DIR
    out_rel = os.path.join("out", os.path.basename(run_dir))
    cmd = ["bash", "./Tango_run.sh", fmt2_rel, out_rel]
    print(f"[DEBUG] Host Tango: {' '.join(cmd)} (TANGO_BIN={env['TANGO_BIN']})")

    proc = subprocess.run(cmd, cwd=TANGO_DIR, env=env, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stdout); print(proc.stderr)
        raise RuntimeError("Host Tango_run.sh failed")

    count_txt = len([f for f in os.listdir(run_dir) if f.lower().endswith(".txt")])
    print(f"[DEBUG] Tango finished per-peptide: {count_txt} files in {run_dir}")
    return run_dir


# ---------------------------------------------------------------------
# Docker fallback runner
# ---------------------------------------------------------------------
def run_tango_docker(records: List[Tuple[str, str]]) -> str:
    _ensure_dirs()
    run_dir = _start_new_run_dir()
    if not records:
        print("[TANGO][WARN] No records to process")
        return run_dir

    fmt2_path = os.path.join(WORK_DIR, "Tango_input_fmt2.txt")
    with open(fmt2_path, "w") as f:
        for entry_id, seq in records:
            f.write(f"{entry_id} N N 7 298 0.1 0 {seq}\n")

    run_dir_name = os.path.basename(run_dir)

    docker_cmd = [
        "docker","run","--rm",
        "-v", f"{TANGO_DIR}:/app/Tango",
        "-w", "/app/Tango",
        "--user", f"{os.getuid()}:{os.getgid()}",
        # Only force platform if you KNOW your base image is amd64-only.
        # "--platform","linux/amd64",
        "desy-tango",
        # ENTRYPOINT is assumed to be /bin/bash -lc
        f"chmod +x ./Tango_run.sh && ./Tango_run.sh work/Tango_input_fmt2.txt out/{run_dir_name}",
    ]
    print("[DEBUG] Docker Tango:", " ".join(docker_cmd))
    result = subprocess.run(docker_cmd, capture_output=True, text=True, timeout=900)
    if result.returncode != 0:
        print("[ERROR] Docker Tango stdout:\n", result.stdout[:2000])
        print("[ERROR] Docker Tango stderr:\n", result.stderr[:2000])
        raise RuntimeError(f"Docker Tango execution failed with code {result.returncode}")

    count_txt = len([f for f in os.listdir(run_dir) if f.lower().endswith(".txt")])
    print(f"[DEBUG] Tango finished per-peptide: {count_txt} files in {run_dir}")
    return run_dir


# ---------------------------------------------------------------------
# Main entry: SIMPLE first; Host/Docker kept as optional fallbacks
# ---------------------------------------------------------------------
def run_tango(records: Optional[List[Tuple[str, str]]] = None) -> None:
    """
    Entry point used by server.py
    - If records provided, prefer SIMPLE mac runner (colleague parity).
    - If env TANGO_SIMPLE=0, try Docker/Host paths below.
    - If records is None, do nothing (server builds records via create_tango_input).
    """
    if not records:
        print("[TANGO][WARN] No records provided to run_tango(); skipping execution")
        return

    if os.getenv("TANGO_SIMPLE", "1") == "1":
        run_tango_simple(records)
        return

    # Optional fallbacks (kept functional; not used by default)
    try:
        run_tango_docker(records)
        return
    except Exception as e:
        print(f"[TANGO][WARN] Docker path failed: {e} — trying host...")

    run_tango_host(records)
    return


# ---------------------------------------------------------------------
# Parsing helpers (tabular first; tolerant fallback)
# ---------------------------------------------------------------------
_NUM_RE = re.compile(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?")

def _extract_four_tracks_from_text(text: str) -> Optional[Tuple[list, list, list, list]]:
    """
    Heuristically extract 4 numeric columns per residue from Tango stdout
    when there is no clean TSV. Returns (beta, helix, turn, agg) or None.
    """
    beta, helix, turn, agg = [], [], [], []
    lines = text.splitlines()

    streak, best = [], []
    for ln in lines:
        nums = _NUM_RE.findall(ln)
        if len(nums) >= 4:
            vals = list(map(float, nums[-4:]))  # last four numbers on the line
            streak.append(vals)
        else:
            if len(streak) > len(best):
                best = streak
            streak = []
    if len(streak) > len(best):
        best = streak

    if len(best) >= 3:  # need at least a few residues
        for v in best:
            b, h, t, a = v
            beta.append(b); helix.append(h); turn.append(t); agg.append(a)
        return beta, helix, turn, agg
    return None

def _percent_content(vals: list) -> float:
    if not vals:
        return 0.0
    mx = max(vals)
    scale = 100.0 if mx > 1.01 else 1.0
    return round(100.0 * sum((v/scale) > 0.5 for v in vals) / len(vals), 1)

def __get_peptide_tango_result(filepath: str) -> Optional[dict]:
    """
    Parse a single Tango per-peptide result file.
    Supports two formats:
      (A) Header table:  res  aa  Beta  Turn  Helix  Aggregation [Conc-Stab_Aggregation?]
      (B) Fallback: lines with at least 5 numeric fields: <idx> <Beta> <Helix> <Turn> <Aggregation>

    Returns dict with lists: "Beta prediction", "Helix prediction", "Turn prediction", "Aggregation prediction",
    or None if nothing parseable.
    """
    if not os.path.exists(filepath) or os.path.getsize(filepath) < 20:
        return None

    name = os.path.splitext(os.path.basename(filepath))[0]
    try:
        with open(filepath, "r") as fh:
            lines = [ln.strip() for ln in fh if ln.strip()]
    except Exception:
        return None

    # ---------- Try headered table ----------
    header_idx = -1
    header_cols = None
    for i, ln in enumerate(lines[:20]):  # header should be near top
        low = ln.lower().replace("\t", " ")
        if "beta" in low and "turn" in low and "helix" in low:
            header_idx = i
            header_cols = re.split(r"\s+", ln)
            break

    if header_idx >= 0 and header_cols:
        idx_map = {c.lower(): k for k, c in enumerate(header_cols)}
        need = ["beta", "turn", "helix"]
        if all(k in idx_map for k in need):
            beta, helix, turn, agg = [], [], [], []
            for ln in lines[header_idx + 1:]:
                parts = re.split(r"\s+", ln)
                try:
                    b = float(parts[idx_map["beta"]])
                    t = float(parts[idx_map["turn"]])
                    h = float(parts[idx_map["helix"]])
                    a = float(parts[idx_map["aggregation"]]) if "aggregation" in idx_map else 0.0
                except Exception:
                    continue
                beta.append(b); helix.append(h); turn.append(t); agg.append(a)

            if len(beta) >= 3:
                return {
                    "Name": name,
                    "Beta prediction": beta,
                    "Helix prediction": helix,
                    "Turn prediction": turn,
                    "Aggregation prediction": agg,
                }

    # ---------- Fallback: 5 numeric fields per line ----------
    good = []
    num_re = re.compile(r"[-+]?\d+(?:\.\d+)?")
    for ln in lines:
        parts = ln.split()
        if len(parts) < 5:
            continue
        try:
            _ = int(parts[0])  # residue index
            vals = [float(p) for p in parts[1:5] if num_re.fullmatch(p)]
            if len(vals) == 4:
                # assumed order: Beta, Helix, Turn, Aggregation
                good.append(vals)
        except Exception:
            continue

    if len(good) >= 3:
        beta, helix, turn, agg = [], [], [], []
        for b,h,t,a in good:
            beta.append(b); helix.append(h); turn.append(t); agg.append(a)
        return {
            "Name": name,
            "Beta prediction": beta,
            "Helix prediction": helix,
            "Turn prediction": turn,
            "Aggregation prediction": agg,
        }

    # ---------- Unusable (empty or prompts) ----------
    return None


def __analyse_tango_results(peptide_tango_results: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not peptide_tango_results:
        return {
            "SSW_residues": [],
            "SSW_avg_score": -1,
            "Helix_and_beta_diff": 0,
            "Helix_percentage": 0,
            "Beta_percentage": 0,
        }

    helix_track = peptide_tango_results.get("Helix prediction", []) or []
    beta_track  = peptide_tango_results.get("Beta prediction",  []) or []

    # Default percentages from tracks (if present)
    helix_pct = auxiliary.check_secondary_structure_prediction_content(helix_track) if helix_track else None
    beta_pct  = auxiliary.check_secondary_structure_prediction_content(beta_track)  if beta_track  else None

    # Fallback to summary if tracks are empty
    if helix_pct is None:
        helix_pct = float(peptide_tango_results.get("Helix_pct_summary") or 0)
    if beta_pct is None:
        beta_pct = float(peptide_tango_results.get("Beta_pct_summary") or 0)

    result = {
        "SSW_residues": [],
        "SSW_avg_score": -1,
        "Helix_and_beta_diff": 0,     # cannot compute without per-residue tracks
        "Helix_percentage": helix_pct or 0,
        "Beta_percentage":  beta_pct or 0,
    }

    # Only compute SSW when we have per-residue tracks
    if helix_track and beta_track:
        helix_segments = auxiliary.get_secondary_structure_segments(helix_track, prediction_method="Tango")
        beta_segments  = auxiliary.get_secondary_structure_segments(beta_track,  prediction_method="Tango")
        ssw_fragments  = auxiliary.find_secondary_structure_switch_segments(beta_segments=beta_segments,
                                                                           helix_segments=helix_segments)
        ssw_score, ssw_diff = auxiliary.calc_secondary_structure_switch_difference_and_score(
            beta_prediction=beta_track,
            helix_prediction=helix_track,
            structure_prediction_indexes=ssw_fragments
        )
        result["SSW_residues"] = ssw_fragments or []
        result["SSW_avg_score"] = ssw_score if ssw_fragments else -1
        result["Helix_and_beta_diff"] = ssw_diff if ssw_fragments else 0

    return result


# ---------------------------------------------------------------------
# Public: parse latest run back into the DataFrame
# ---------------------------------------------------------------------
def _append_defaults(fragments, scores, diffs, helix_pcts, beta_pcts):
    fragments.append("-")
    scores.append(-1)
    diffs.append(0)
    helix_pcts.append(0)
    beta_pcts.append(0)

def process_tango_output(database: pd.DataFrame) -> None:
    """
    Parse the **latest** run in OUT_DIR/run_*/ and fill columns:
      - 'SSW fragments'
      - 'SSW score'
      - 'SSW diff'
      - 'SSW helix percentage'
      - 'SSW beta percentage'
    Also attaches per-residue curves (lists) when available:
      - 'Tango Beta curve', 'Tango Helix curve', 'Tango Turn curve', 'Tango Aggregation curve'

    Safe defaults are used when a peptide file is missing or unparsable.
    Always fills every row so researchers see complete results.
    """

    def _append_defaults_local(_frags, _scores, _diffs, _h_pct, _b_pct, _cb, _ch, _ct, _ca):
        _frags.append("-")
        _scores.append(-1)
        _diffs.append(0)
        _h_pct.append(0)
        _b_pct.append(0)
        _cb.append([]); _ch.append([]); _ct.append([]); _ca.append([])

    _ensure_dirs()
    run_dir = _latest_run_dir()

    # ---------- Preferred: per-peptide files ----------
    if run_dir and os.path.isdir(run_dir):
        ssw_frags, ssw_scores, ssw_diffs, helix_pct, beta_pct = [], [], [], [], []
        beta_curves, helix_curves, turn_curves, agg_curves = [], [], [], []
        bad_ctr, ok_ctr = 0, 0

        # Iterate rows in order; collect aligned lists
        for _, row in database.iterrows():
            entry = str(row.get(KEY) or "").strip()
            if not entry:
                bad_ctr += 1
                _append_defaults_local(ssw_frags, ssw_scores, ssw_diffs, helix_pct, beta_pct,
                                       beta_curves, helix_curves, turn_curves, agg_curves)
                continue

            safe = _safe_id(entry)
            out_file = os.path.join(run_dir, f"{safe}.txt")

            try:
                res = __get_peptide_tango_result(out_file)
            except Exception:
                res = None

            if not res:
                bad_ctr += 1
                _append_defaults_local(ssw_frags, ssw_scores, ssw_diffs, helix_pct, beta_pct,
                                       beta_curves, helix_curves, turn_curves, agg_curves)
                continue

            analysed = __analyse_tango_results(res) or {}
            ssw_frags.append(analysed.get("SSW_residues", "-") or "-")
            ssw_scores.append(analysed.get("SSW_avg_score", -1))
            ssw_diffs.append(analysed.get("Helix_and_beta_diff", 0))
            helix_pct.append(analysed.get("Helix_percentage", 0))
            beta_pct.append(analysed.get("Beta_percentage", 0))

            beta_curves.append(res.get("Beta prediction", []) or [])
            helix_curves.append(res.get("Helix prediction", []) or [])
            turn_curves.append(res.get("Turn prediction", []) or [])
            agg_curves.append(res.get("Aggregation prediction", []) or [])

            ok_ctr += 1

        print(f"[DEBUG] Tango parse lists lens: frags={len(ssw_frags)} scores={len(ssw_scores)} "
              f"diffs={len(ssw_diffs)} H%={len(helix_pct)} B%={len(beta_pct)} rows={len(database)}")

        # Defensive: make sure we have 1 value per input row
        n = len(database)
        def _fix_len(lst, fill):
            if len(lst) < n:
                lst = list(lst) + [fill] * (n - len(lst))
            elif len(lst) > n:
                lst = list(lst)[:n]
            return lst

        ssw_frags  = _fix_len(ssw_frags, "-")
        ssw_scores = _fix_len(ssw_scores, -1)
        ssw_diffs  = _fix_len(ssw_diffs, 0)
        helix_pct  = _fix_len(helix_pct, 0)
        beta_pct   = _fix_len(beta_pct, 0)

        beta_curves  = _fix_len(beta_curves,  [])
        helix_curves = _fix_len(helix_curves, [])
        turn_curves  = _fix_len(turn_curves,  [])
        agg_curves   = _fix_len(agg_curves,   [])

        # Assign with Series to avoid index/shape complaints
        database["SSW fragments"]        = pd.Series(ssw_frags,  index=database.index, dtype=object)
        database["SSW score"]            = pd.Series(ssw_scores, index=database.index)
        database["SSW diff"]             = pd.Series(ssw_diffs,  index=database.index)
        database["SSW helix percentage"] = pd.Series(helix_pct,  index=database.index)
        database["SSW beta percentage"]  = pd.Series(beta_pct,   index=database.index)

        # Per-residue curves for plotting (object dtype lists)
        database["Tango Beta curve"]        = pd.Series(beta_curves,  index=database.index, dtype=object)
        database["Tango Helix curve"]       = pd.Series(helix_curves, index=database.index, dtype=object)
        database["Tango Turn curve"]        = pd.Series(turn_curves,  index=database.index, dtype=object)
        database["Tango Aggregation curve"] = pd.Series(agg_curves,   index=database.index, dtype=object)

        print(f"[DEBUG] Tango parsing/merge complete • OK={ok_ctr} BAD/empty={bad_ctr}")
        return

    # ---------- Fallback: single batch file ----------
    batch_path = os.path.join(TANGO_DIR, "Tango_output.txt")
    if os.path.exists(batch_path):
        try:
            from io import StringIO
            with open(batch_path, "r") as fh:
                tab_lines = [ln for ln in fh if "\t" in ln]
            if tab_lines:
                df_out = pd.read_csv(StringIO("".join(tab_lines)), sep="\t")
                lower = {c.lower(): c for c in df_out.columns}
                name_col       = lower.get("name") or lower.get("entry") or lower.get("id")
                helix_pct_col  = lower.get("helix_percent") or lower.get("helix percentage")
                beta_pct_col   = lower.get("beta_percent")  or lower.get("beta percentage")
            else:
                df_out = None
                name_col = helix_pct_col = beta_pct_col = None
        except Exception:
            df_out = None
            name_col = helix_pct_col = beta_pct_col = None

        ssw_frags, ssw_scores, ssw_diffs, helix_pct, beta_pct = [], [], [], [], []
        bad_ctr, ok_ctr = 0, 0
        for _, row in database.iterrows():
            if df_out is not None and name_col:
                m = df_out[df_out[name_col] == row.get(KEY)]
                if not m.empty:
                    m0 = m.iloc[0]
                    ssw_frags.append("-")
                    ssw_scores.append(-1)
                    ssw_diffs.append(0)
                    helix_pct.append(m0.get(helix_pct_col, 0) if helix_pct_col else 0)
                    beta_pct.append(m0.get(beta_pct_col, 0)   if beta_pct_col  else 0)
                    ok_ctr += 1
                    continue
            bad_ctr += 1
            _append_defaults(ssw_frags, ssw_scores, ssw_diffs, helix_pct, beta_pct)

        database["SSW fragments"]        = pd.Series(ssw_frags,  index=database.index, dtype=object)
        database["SSW score"]            = pd.Series(ssw_scores, index=database.index)
        database["SSW diff"]             = pd.Series(ssw_diffs,  index=database.index)
        database["SSW helix percentage"] = pd.Series(helix_pct,  index=database.index)
        database["SSW beta percentage"]  = pd.Series(beta_pct,   index=database.index)

        print(f"[DEBUG] Tango parsing/merge complete (batch fallback) • OK={ok_ctr} BAD/empty={bad_ctr}")
        return

    # ---------- Nothing: defaults ----------
    print("[TANGO][WARN] No run directory or batch output found; filling defaults.")
    database["SSW fragments"]        = "-"
    database["SSW score"]            = -1
    database["SSW diff"]             = 0
    database["SSW helix percentage"] = 0
    database["SSW beta percentage"]  = 0


# ---------------------------------------------------------------------
# Public: compute SSW prediction flag (unchanged logic)
# ---------------------------------------------------------------------
def filter_by_avg_diff(database: pd.DataFrame, database_name: str, statistical_result_dict: dict) -> None:
    """
    Mark 'SSW prediction' = 1 when SSW diff is <= avg threshold; else -1.
    """
    avg_diff = database[database["SSW diff"] != -1]["SSW diff"].mean()
    statistical_result_dict[database_name]['4 SSW helix and beta difference threshold'] = avg_diff
    preds = []
    for _, row in database.iterrows():
        if row["SSW diff"] > avg_diff or row["SSW diff"] == -1:
            preds.append(-1)
        else:
            preds.append(1)
    database["SSW prediction"] = preds


# =====================================================================
# SAFE PARKING LOT (optional/legacy helpers kept for future use)
# =====================================================================

# NOTE: These helpers are not used by the current "simple" flow,
# but they remain here intact in case you or the next dev want to switch.

# _docker_available()  # already used above

# Example of a stricter finder (unused right now):
# def _find_tango_bin() -> str:
#     for p in [os.path.join(TANGO_DIR, "tango"),
#               os.path.join(TANGO_DIR, "bin", "tango")]:
#         if os.path.isfile(p):
#             return p
#     raise RuntimeError("Tango binary not found at Tango/tango or Tango/bin/tango.")

# Old "stdin-driven" simple runner (kept for reference):
# import shlex
# def run_tango_simple_stdin(records: List[Tuple[str, str]]) -> str:
#     if not records:
#         print("[TANGO][WARN] No records to process")
#         return _start_new_run_dir()
#     _ensure_dirs()
#     run_dir = _start_new_run_dir()
#     tango_bin = _find_tango_bin()
#     try:
#         if not os.access(tango_bin, os.X_OK):
#             os.chmod(tango_bin, 0o755)
#     except Exception:
#         pass
#     single_in = os.path.join(WORK_DIR, "single_input.txt")
#     cwd = TANGO_DIR
#     ok, fail = 0, 0
#     for entry, seq in records:
#         entry = (entry or "").strip()
#         seq   = (seq or "").strip()
#         if not entry or len(seq) < 5:
#             fail += 1; continue
#         with open(single_in, "w") as fh:
#             fh.write(f"{entry} N N 7 298 0.1 0 {seq}\n")
#         out_file = os.path.join(run_dir, f"{_safe_id(entry)}.txt")
#         cmd = [
#             "bash", "-lc",
#             f'printf "Y\\n{shlex.quote(os.path.relpath(single_in, cwd))}\\n" | '
#             f'{shlex.quote(os.path.relpath(tango_bin, cwd))} > {shlex.quote(os.path.relpath(out_file, cwd))}'
#         ]
#         proc = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
#         ok += 1 if proc.returncode == 0 else 0
#         fail += 0 if proc.returncode == 0 else 1
#     print(f"[DEBUG] Tango simple stdin-run: OK={ok} FAIL={fail} • outputs at {run_dir}")
#     return run_dir
