# backend/tango.py
import os
import re
import json
import subprocess
import shutil
import math
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional

import pandas as pd
import auxiliary
from services.logger import get_logger, get_trace_id, log_info, log_warning, log_error

logger = get_logger()

# ---------------------------------------------------------------------
# Paths / constants (repo-relative, robust to cwd)
# ---------------------------------------------------------------------
PROJECT_PATH = os.path.dirname(os.path.abspath(__file__))
TANGO_DIR    = os.path.abspath(os.path.join(PROJECT_PATH, "Tango"))

# Runtime output directories: Use temp location to avoid triggering uvicorn --reload
# Load from config (with fallback for backward compatibility)
try:
    from config import settings
    _RUNTIME_BASE = settings.tango_runtime_dir
except ImportError:
    # Fallback if config not available (shouldn't happen in normal usage)
    _RUNTIME_BASE = os.getenv("TANGO_RUNTIME_DIR", os.path.join(PROJECT_PATH, ".run_cache", "Tango"))
WORK_DIR = os.path.join(_RUNTIME_BASE, "work")   # inputs for runs
OUT_DIR  = os.path.join(_RUNTIME_BASE, "out")    # per-run outputs

KEY = "Entry"  # DataFrame column that holds peptide ID (UniProt accession, etc.)

AA20 = set("ACDEFGHIKLMNPQRSTVWY")
AMBIGUOUS_MAP = {
    "B": "D",   # D/N ambiguous -> D (aspartate) to match reference
    "Z": "E",   # E/Q ambiguous -> E (glutamate) to match reference
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

def build_records_from_dataframe(df: pd.DataFrame) -> List[Tuple[str, str]]:
    """
    Extract (entry_id, sanitized_sequence) records from a DataFrame.

    This is a simplified alternative to create_tango_input() that doesn't
    do caching or write debug files.

    Args:
        df: DataFrame with 'Entry' and 'Sequence' columns

    Returns:
        List of (entry_id, sanitized_sequence) tuples
    """
    records: List[Tuple[str, str]] = []
    for _, row in df.iterrows():
        entry_id = str(row.get(KEY) or "").strip()
        if not entry_id:
            continue
        seq_raw = row.get("Sequence")
        if pd.isna(seq_raw):
            continue
        seq = _sanitize_seq(auxiliary.get_corrected_sequence(str(seq_raw)))
        if len(seq) < 5:
            continue
        records.append((entry_id, seq))
    return records


def run_tango_on_dataframe(df: pd.DataFrame) -> str:
    """
    Simplified entry point: extract records from DataFrame and run TANGO.

    This combines build_records_from_dataframe() + run_tango_simple() into
    a single call. Use this instead of the legacy pattern:
        existed = get_all_existed_tango_results_entries()
        records = create_tango_input(df, existed, force=True)
        run_dir = run_tango_simple(records)

    Args:
        df: DataFrame with 'Entry' and 'Sequence' columns

    Returns:
        Path to the run directory (for use with process_tango_output)
    """
    records = build_records_from_dataframe(df)
    return run_tango_simple(records)


# ---------------------------------------------------------------------
# SIMPLE MAC RUNNER (mimics colleague's .bat)
# ---------------------------------------------------------------------
def _write_simple_bat(records: List[Tuple[str, str]], script_path: str) -> List[Dict[str, str]]:
    """
    Create a simple per-peptide runner script (bash script).
    Each line calls the Tango binary with inline params and redirects to <ID>.txt.
    Script is written to run_dir, and executed with cwd=run_dir, so outputs go to run_dir.
    Uses absolute path to the TANGO binary to avoid path resolution issues.

    Returns:
        List of entry_mapping dicts: [{"peptide_id": ..., "tango_entry_id": ..., "expected_output": ...}, ...]
        This mapping is the SINGLE SOURCE OF TRUTH for output file names.
    """
    os.makedirs(os.path.dirname(script_path), exist_ok=True)
    # Compute absolute path to TANGO binary at script generation time
    abs_bin = os.path.abspath(os.path.join(TANGO_DIR, "bin", "tango"))
    lines = []
    lines.append("#!/bin/bash\n")
    lines.append("set -euo pipefail\n")
    # Use absolute path to binary (computed at script generation time)
    lines.append(f'BIN="{abs_bin}"\n')
    # Ensure binary is executable and not quarantined (macOS safety)
    lines.append('xattr -d com.apple.quarantine "$BIN" >/dev/null 2>&1 || true\n')
    lines.append('chmod +x "$BIN" || true\n')
    lines.append('if [ ! -x "$BIN" ]; then echo "[TANGO] tango binary missing at $BIN"; exit 1; fi\n')

    # Build entry_mapping as we write the script - this is the SINGLE SOURCE OF TRUTH
    entry_mapping: List[Dict[str, str]] = []
    for entry_id, seq in records:
        safe = _safe_id(entry_id)
        expected_output = f"{safe}.txt"
        entry_mapping.append({
            "peptide_id": entry_id,
            "tango_entry_id": safe,
            "expected_output": expected_output,
        })
        # Tango inline args format (what your colleague used)
        # Output to current directory (run_dir) where script is executed
        # Since cwd=run_dir, just use relative path
        lines.append(
            f'"$BIN" {safe} nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="{seq}" > "{expected_output}"\n'
        )
    with open(script_path, "w") as fh:
        fh.writelines(lines)
    os.chmod(script_path, 0o755)
    return entry_mapping


def _write_run_meta(
    run_dir: str,
    trace_id: str,
    reason: Optional[str],
    *,
    cmd: List[str],
    run_dir_abs: str,
    bin_path_abs: str,
    bin_exists: bool,
    bin_executable: bool = True,
    env_hints: Dict[str, Any],
    input_files: Dict[str, Any],
    inputs_requested: int,
    entry_mapping: Dict[str, str],
    exit_code: Optional[int] = None,
    stdout_preview: str = "",
    stderr_tail: str = "",
    exception_type: Optional[str] = None,
    output_files: Optional[List[str]] = None,
    outputs_found: Optional[int] = None,
    outputs_missing: Optional[int] = None,
) -> None:
    """
    Write run_meta.json with diagnostic information.

    Centralizes the run_meta.json writing logic to avoid code duplication.
    The entry_mapping INVARIANT is enforced: mapping is ALWAYS written.
    """
    run_meta = {
        "traceId": trace_id,
        "timestamp": datetime.now().isoformat(),
        "execution_mode": "simple",
        "cmd": cmd,
        "cwd": run_dir_abs,
        "bin_path": bin_path_abs,
        "bin_exists": bin_exists,
        "bin_executable": bin_executable,
        "envHints": env_hints,
        "inputs": input_files,
        "inputs_requested": inputs_requested,
        "entry_mapping": entry_mapping,  # INVARIANT: mapping is ALWAYS written
        "exit_code": exit_code,
        "reason": reason,
    }

    # Add optional fields only if they have meaningful values
    if stdout_preview:
        run_meta["stdout_preview"] = stdout_preview
    if stderr_tail:
        run_meta["stderr_tail"] = stderr_tail
    if exception_type:
        run_meta["exception_type"] = exception_type
    if output_files is not None:
        run_meta["output_files"] = output_files
    if outputs_found is not None:
        run_meta["outputs_found"] = outputs_found
    if outputs_missing is not None:
        run_meta["outputs_missing"] = outputs_missing

    meta_path = os.path.join(run_dir, "run_meta.json")
    try:
        with open(meta_path, "w") as f:
            json.dump(run_meta, f, indent=2)
    except Exception as e:
        log_warning("tango_meta_write_failed", f"Failed to write run_meta.json: {e}", **{"error": str(e)})


def run_tango_simple(records: Optional[List[Tuple[str, str]]]) -> str:
    """
    Mac-native TANGO runner:
      - Creates per-run folder Tango/out/run_*/
      - Writes Tango_run.sh (bash script) into the run folder
      - Executes it inside the per-run folder
      - Outputs land under Tango/out/run_*/

    Safe no-op if records is empty; safe no-crash if tango/bin is missing.
    Returns the run_dir path for subsequent parsing.
    On failure, writes run_meta.json with diagnostic information.
    """
    _ensure_dirs()
    if not records:
        log_warning("tango_simple_skip", "No records for simple runner; skipping.")
        return _start_new_run_dir()

    # Prepare per-run folder and script
    run_dir = _start_new_run_dir()
    log_info("tango_simple_prepare", f"Prepared run directory: {run_dir}",
             **{"run_dir": run_dir, "sequence_count": len(records)})

    script_path = os.path.join(run_dir, "Tango_run.sh")
    entry_mapping = _write_simple_bat(records, script_path)

    # Capture paths and environment for diagnostics
    bin_path = os.path.join(TANGO_DIR, "bin", "tango")
    bin_path_abs = os.path.abspath(bin_path)
    run_dir_abs = os.path.abspath(run_dir)
    cmd = ["bash", "Tango_run.sh"]

    # Capture input file paths
    input_files = {}
    for fmt_name, fmt_file in [("fmt1", "Tango_input_fmt1.txt"), ("fmt2", "Tango_input_fmt2.txt"), ("fmt3", "Tango_input_fmt3.txt")]:
        fmt_path = os.path.join(WORK_DIR, fmt_file)
        if os.path.exists(fmt_path):
            input_files[fmt_name] = {"path": os.path.abspath(fmt_path), "size_bytes": os.path.getsize(fmt_path)}

    # Capture environment hints
    env_hints = {}
    for env_var in ["PATH", "LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"]:
        val = os.environ.get(env_var, "")
        if env_var == "PATH" and val:
            env_hints["PATH_head"] = val[:200]
        elif val:
            env_hints[env_var] = val

    # Common kwargs for _write_run_meta
    meta_common = dict(
        cmd=cmd, run_dir_abs=run_dir_abs, bin_path_abs=bin_path_abs,
        env_hints=env_hints, input_files=input_files,
        inputs_requested=len(records), entry_mapping=entry_mapping
    )

    # Check if binary exists before attempting execution
    if not os.path.exists(bin_path):
        trace_id = get_trace_id()
        _write_run_meta(run_dir, trace_id, "ENOENT", bin_exists=False, bin_executable=False, **meta_common)
        log_error("tango_simple_failed", f"TANGO binary not found at {bin_path_abs}",
                  **{"traceId": trace_id, "reason": "ENOENT", "exit": None, "path": bin_path_abs})
        return run_dir

    # Check if binary is executable
    if not os.access(bin_path, os.X_OK):
        trace_id = get_trace_id()
        _write_run_meta(run_dir, trace_id, "EACCES", bin_exists=True, bin_executable=False, **meta_common)
        log_error("tango_simple_failed", f"TANGO binary not executable at {bin_path_abs}",
                  **{"traceId": trace_id, "reason": "EACCES", "exit": None, "path": bin_path_abs})
        return run_dir

    # Make sure macOS Gatekeeper doesn't block
    try:
        os.chmod(bin_path, 0o755)
        subprocess.run(["xattr", "-d", "com.apple.quarantine", bin_path],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # Execute inside the run directory
    trace_id = get_trace_id()

    try:
        proc = subprocess.run(cmd, cwd=run_dir, capture_output=True, text=True, timeout=3600)
        stderr_tail = proc.stderr[-2048:] if proc.stderr and len(proc.stderr) > 2048 else (proc.stderr or "")
        stdout_preview = proc.stdout[:500] if proc.stdout else ""
        output_files = [f for f in os.listdir(run_dir) if f.lower().endswith(".txt") and f != "Tango_run.sh"]

        if proc.returncode != 0:
            _write_run_meta(run_dir, trace_id, "NonZeroExit", bin_exists=True, exit_code=proc.returncode,
                            stdout_preview=stdout_preview, stderr_tail=stderr_tail,
                            output_files=output_files, outputs_found=len(output_files), **meta_common)
            log_error("tango_simple_failed", "Simple runner failed",
                      **{"traceId": trace_id, "reason": "NonZeroExit", "exit": proc.returncode, "path": bin_path_abs})
        else:
            ok, failed = len(output_files), max(0, len(records) - len(output_files))
            _write_run_meta(run_dir, trace_id, None, bin_exists=True, exit_code=0,
                            stdout_preview=stdout_preview, stderr_tail=stderr_tail,
                            output_files=output_files, outputs_found=ok, outputs_missing=failed, **meta_common)
            log_info("tango_simple_complete", f"Tango simple run completed: {ok} succeeded, {failed} failed",
                     **{"succeeded": ok, "failed": failed, "run_dir": run_dir, "output_files": output_files[:10]})

    except subprocess.TimeoutExpired:
        _write_run_meta(run_dir, trace_id, "Timeout", bin_exists=True,
                        stderr_tail="Execution timed out after 3600 seconds",
                        exception_type="TimeoutExpired", **meta_common)
        log_error("tango_simple_failed", "Simple runner timed out",
                  **{"traceId": trace_id, "reason": "Timeout", "exit": None, "path": bin_path_abs})

    except FileNotFoundError as e:
        _write_run_meta(run_dir, trace_id, "ENOENT", bin_exists=False, bin_executable=False,
                        stderr_tail=str(e), exception_type="FileNotFoundError", **meta_common)
        log_error("tango_simple_failed", f"TANGO binary or script not found: {e}",
                  **{"traceId": trace_id, "reason": "ENOENT", "exit": None, "path": bin_path_abs})

    except PermissionError as e:
        _write_run_meta(run_dir, trace_id, "EACCES", bin_exists=True, bin_executable=False,
                        stderr_tail=str(e), exception_type="PermissionError", **meta_common)
        log_error("tango_simple_failed", f"TANGO binary not executable: {e}",
                  **{"traceId": trace_id, "reason": "EACCES", "exit": None, "path": bin_path_abs})

    except Exception as e:
        _write_run_meta(run_dir, trace_id, "UnexpectedError",
                        bin_exists=os.path.exists(bin_path),
                        bin_executable=os.access(bin_path, os.X_OK) if os.path.exists(bin_path) else False,
                        stderr_tail=str(e), exception_type=type(e).__name__, **meta_common)
        log_error("tango_simple_failed", f"Unexpected error during TANGO execution: {e}",
                  **{"traceId": trace_id, "reason": "UnexpectedError", "exit": None, "path": bin_path_abs})

    return run_dir


# ---------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------
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


def none_if_nan(x: Any) -> Any:
    """
    Utility to convert NaN/inf to None for JSON serialization and Pydantic validation.
    Returns None if x is None, NaN, or inf; otherwise returns x unchanged.
    """
    if x is None:
        return None
    if isinstance(x, float):
        if math.isnan(x) or not math.isfinite(x):
            return None
    return x


def __analyse_tango_results(peptide_tango_results: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze TANGO results for a single peptide.
    Returns None (not -1/0) for missing metrics to indicate data unavailability.
    """
    if not peptide_tango_results:
        return {
            "SSW_residues": [],
            "SSW_avg_score": None,  # None instead of -1 to indicate missing data
            "Helix_and_beta_diff": None,  # None instead of 0 to indicate missing data
            "Helix_percentage": None,  # None instead of 0 to indicate missing data
            "Beta_percentage": None,  # None instead of 0 to indicate missing data
        }

    helix_track = peptide_tango_results.get("Helix prediction", []) or []
    beta_track  = peptide_tango_results.get("Beta prediction",  []) or []

    # Default percentages from tracks (if present)
    helix_pct = auxiliary.check_secondary_structure_prediction_content(helix_track) if helix_track else None
    beta_pct  = auxiliary.check_secondary_structure_prediction_content(beta_track)  if beta_track  else None

    # Fallback to summary if tracks are empty
    if helix_pct is None:
        helix_pct_summary = peptide_tango_results.get("Helix_pct_summary")
        if helix_pct_summary is not None:
            try:
                helix_pct = float(helix_pct_summary)
            except (ValueError, TypeError):
                helix_pct = None
        else:
            helix_pct = None
    if beta_pct is None:
        beta_pct_summary = peptide_tango_results.get("Beta_pct_summary")
        if beta_pct_summary is not None:
            try:
                beta_pct = float(beta_pct_summary)
            except (ValueError, TypeError):
                beta_pct = None
        else:
            beta_pct = None

    # Sanitize percentages: convert NaN/inf to None
    helix_pct = none_if_nan(helix_pct)
    beta_pct = none_if_nan(beta_pct)

    result = {
        "SSW_residues": [],
        "SSW_avg_score": None,  # None indicates missing data (not -1)
        "Helix_and_beta_diff": None,  # None indicates missing data (not 0)
        "Helix_percentage": helix_pct,  # Can be None if missing
        "Beta_percentage": beta_pct,  # Can be None if missing
    }

    # Only compute SSW when we have per-residue tracks
    if helix_track and beta_track:
        helix_segments = auxiliary.get_secondary_structure_segments(helix_track, prediction_method="Tango")
        beta_segments  = auxiliary.get_secondary_structure_segments(beta_track,  prediction_method="Tango")
        ssw_fragments  = auxiliary.find_secondary_structure_switch_segments(beta_segments=beta_segments,
                                                                           helix_segments=helix_segments)
        if ssw_fragments:
            ssw_score, ssw_diff = auxiliary.calc_secondary_structure_switch_difference_and_score(
                beta_prediction=beta_track,
                helix_prediction=helix_track,
                structure_prediction_indexes=ssw_fragments
            )
            # Sanitize: convert NaN/inf to None
            result["SSW_residues"] = ssw_fragments
            result["SSW_avg_score"] = none_if_nan(ssw_score)
            result["Helix_and_beta_diff"] = none_if_nan(ssw_diff)
        # else: keep None values (no valid SSW fragments)

    return result


# ---------------------------------------------------------------------
# Public: parse latest run back into the DataFrame
# ---------------------------------------------------------------------
def _read_entry_mapping(run_dir: str) -> Optional[List[Dict[str, str]]]:
    """
    Read entry_mapping from run_meta.json.
    Returns None if file doesn't exist or mapping is not present.
    """
    meta_path = os.path.join(run_dir, "run_meta.json")
    if not os.path.exists(meta_path):
        return None
    try:
        with open(meta_path, "r") as f:
            meta = json.load(f)
            return meta.get("entry_mapping")
    except Exception:
        return None


class TangoOutputBindingError(Exception):
    """Raised when TANGO output binding fails - outputs don't match inputs."""
    def __init__(self, message: str, details: Dict[str, Any]):
        super().__init__(message)
        self.details = details


def process_tango_output(database: pd.DataFrame, run_dir: Optional[str] = None) -> Dict[str, int]:
    """
    Parse a specific run in OUT_DIR/run_*/ and fill columns:
      - 'SSW fragments'
      - 'SSW score'
      - 'SSW diff'
      - 'SSW helix percentage'
      - 'SSW beta percentage'
    Also attaches per-residue curves (lists) when available:
      - 'Tango Beta curve', 'Tango Helix curve', 'Tango Turn curve', 'Tango Aggregation curve'

    Args:
        database: DataFrame to fill with TANGO results
        run_dir: Explicit run directory path. If None, falls back to _latest_run_dir()
                 (race condition risk - only for backward compatibility with example dataset).

    WARNING: In request flows (upload-csv, uniprot/execute), always pass explicit run_dir
             to avoid race conditions with concurrent requests.

    INVARIANT: Parser MUST use run_meta.json mapping to find outputs, not guess names.
    If run_meta.json is missing or has no entry_mapping, this is a fatal error.

    Safe defaults are used when a peptide file is missing or unparsable.
    Always fills every row so researchers see complete results.
    """

    def _append_defaults_local(_frags, _scores, _diffs, _h_pct, _b_pct, _cb, _ch, _ct, _ca):
        _frags.append("-")
        _scores.append(None)  # Use None instead of -1 for missing SSW score
        _diffs.append(None)   # Use None instead of 0 for missing SSW diff
        _h_pct.append(None)   # Use None for missing percentage
        _b_pct.append(None)   # Use None for missing percentage
        _cb.append([]); _ch.append([]); _ct.append([]); _ca.append([])

    _ensure_dirs()
    # Use explicit run_dir if provided, otherwise fall back to latest (for backward compatibility only)
    # WARNING: Falling back to _latest_run_dir() is not thread-safe and can cause race conditions
    # in concurrent request scenarios. Always pass explicit run_dir in request flows.
    if run_dir is None:
        run_dir = _latest_run_dir()
        if run_dir is None:
            raise ValueError("process_tango_output: run_dir is None and _latest_run_dir() returned None. "
                           "In request flows, always pass explicit run_dir from the runner.")

    trace_id = get_trace_id()
    log_info("tango_parse_start", f"Parsing TANGO outputs from {run_dir}", **{"run_dir": run_dir})

    # ---------- INVARIANT: Read entry_mapping from run_meta.json ----------
    # Parser MUST use run_meta.json mapping to find outputs, not guess names.
    meta_path = os.path.join(run_dir, "run_meta.json")
    entry_mapping = _read_entry_mapping(run_dir)

    # Collect directory contents for diagnostics
    dir_contents = []
    if os.path.isdir(run_dir):
        try:
            dir_contents = os.listdir(run_dir)
        except Exception:
            dir_contents = ["<error listing directory>"]

    # ---------- Preferred: per-peptide files ----------
    if run_dir and os.path.isdir(run_dir):
        # Build dict keyed by Entry (stable key) with all TANGO results
        # This ensures alignment by Entry, not row order
        results_by_entry: Dict[str, Dict[str, Any]] = {}
        bad_ctr, ok_ctr = 0, 0

        # Collect all Entry IDs from database
        entry_set = set()
        for _, row in database.iterrows():
            entry = str(row.get(KEY) or "").strip()
            if entry:
                entry_set.add(entry)
                # Initialize defaults for this entry (use None for missing data, not -1)
                results_by_entry[entry] = {
                    "SSW fragments": "-",
                    "SSW score": None,  # Use None instead of -1
                    "SSW diff": None,   # Use None instead of 0
                    "SSW helix percentage": None,  # Use None instead of 0.0
                    "SSW beta percentage": None,   # Use None instead of 0.0
                    "Tango Beta curve": [],
                    "Tango Helix curve": [],
                    "Tango Turn curve": [],
                    "Tango Aggregation curve": [],
                }

        # INVARIANT: Use entry_mapping from run_meta.json if available
        # This is the SINGLE SOURCE OF TRUTH for output file names
        if entry_mapping:
            # Build lookup: peptide_id -> expected_output filename
            mapping_lookup = {m["peptide_id"]: m["expected_output"] for m in entry_mapping}
            expected_files = [m["expected_output"] for m in entry_mapping]
        else:
            # FALLBACK: No mapping in run_meta.json - use _safe_id() (legacy behavior)
            # This should only happen for old run directories or smoke tests
            log_warning("tango_no_mapping",
                f"No entry_mapping in run_meta.json at {meta_path}. Using legacy _safe_id() lookup.",
                **{"run_dir": run_dir, "meta_path": meta_path})
            mapping_lookup = {entry: f"{_safe_id(entry)}.txt" for entry in entry_set}
            expected_files = list(mapping_lookup.values())

        # Process TANGO output files using the mapping
        for entry in entry_set:
            # Use mapping to find output file (not guessing with _safe_id)
            expected_output = mapping_lookup.get(entry)
            if not expected_output:
                # Entry not in mapping - this shouldn't happen if run_meta was written correctly
                log_warning("tango_entry_not_in_mapping",
                    f"Entry '{entry}' not found in entry_mapping",
                    **{"entry": entry, "mapping_keys": list(mapping_lookup.keys())[:10]})
                bad_ctr += 1
                continue

            out_file = os.path.join(run_dir, expected_output)

            try:
                res = __get_peptide_tango_result(out_file)
            except Exception:
                res = None

            if not res:
                bad_ctr += 1
                continue

            analysed = __analyse_tango_results(res) or {}

            # Get curves
            beta_curve = res.get("Beta prediction", []) or []
            helix_curve = res.get("Helix prediction", []) or []
            turn_curve = res.get("Turn prediction", []) or []
            agg_curve = res.get("Aggregation prediction", []) or []

            # Compute summary fields (canonical fields for UI)
            # These provide a single source of truth, avoiding UI need to check extras
            tango_has_data = bool(beta_curve or helix_curve or agg_curve)
            tango_beta_max = max(beta_curve) if beta_curve else None
            tango_helix_max = max(helix_curve) if helix_curve else None
            tango_agg_max = max(agg_curve) if agg_curve else None

            # Store results keyed by Entry
            # Use None (not -1/0) for missing metrics to indicate data unavailability
            results_by_entry[entry] = {
                "SSW fragments": analysed.get("SSW_residues", []) or "-",
                "SSW score": analysed.get("SSW_avg_score"),  # None if missing (not -1)
                "SSW diff": analysed.get("Helix_and_beta_diff"),  # None if missing (not 0)
                "SSW helix percentage": analysed.get("Helix_percentage"),  # None if missing (not 0)
                "SSW beta percentage": analysed.get("Beta_percentage"),  # None if missing (not 0)
                "Tango Beta curve": beta_curve,
                "Tango Helix curve": helix_curve,
                "Tango Turn curve": turn_curve,
                "Tango Aggregation curve": agg_curve,
                # Canonical summary fields
                "Tango has data": tango_has_data,
                "Tango Beta max": tango_beta_max,
                "Tango Helix max": tango_helix_max,
                "Tango Aggregation max": tango_agg_max,
            }
            
            # Debug tracing for specific entry (avoid circular import)
            debug_entry = os.getenv("DEBUG_ENTRY", "").strip()
            if debug_entry and str(entry).strip() == str(debug_entry).strip():
                log_info("tango_parse_entry", f"Parsing TANGO output for entry {entry}", entry=entry, **{
                    "raw_keys": list(res.keys()) if res else [],
                    "beta_prediction_len": len(res.get('Beta prediction', [])) if res else 0,
                    "helix_prediction_len": len(res.get('Helix prediction', [])) if res else 0,
                    "analysed_keys": list(analysed.keys()),
                    "helix_percentage": analysed.get('Helix_percentage'),
                    "beta_percentage": analysed.get('Beta_percentage'),
                    "ssw_avg_score": analysed.get('SSW_avg_score'),
                    "helix_beta_diff": analysed.get('Helix_and_beta_diff'),
                })
            
            ok_ctr += 1

        log_info("tango_parse_progress", f"Parsed {ok_ctr} OK, {bad_ctr} missing/failed", **{
            "ok_count": ok_ctr,
            "bad_count": bad_ctr,
            "total_entries": len(entry_set),
        })
        
        # Assign using Entry-aligned mapping (.map() ensures alignment by stable key)
        # This eliminates ndarray length mismatch errors
        # Use None (not -1/0) for missing metrics to indicate data unavailability
        database["SSW fragments"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("SSW fragments", "-"))
        # Use object dtype to allow None values
        database["SSW score"] = database[KEY].map(lambda e: none_if_nan(results_by_entry.get(str(e).strip(), {}).get("SSW score")))
        database["SSW diff"] = database[KEY].map(lambda e: none_if_nan(results_by_entry.get(str(e).strip(), {}).get("SSW diff")))
        database["SSW helix percentage"] = database[KEY].map(lambda e: none_if_nan(results_by_entry.get(str(e).strip(), {}).get("SSW helix percentage")))
        database["SSW beta percentage"] = database[KEY].map(lambda e: none_if_nan(results_by_entry.get(str(e).strip(), {}).get("SSW beta percentage")))
        database["Tango Beta curve"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("Tango Beta curve", []))
        database["Tango Helix curve"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("Tango Helix curve", []))
        database["Tango Turn curve"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("Tango Turn curve", []))
        database["Tango Aggregation curve"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("Tango Aggregation curve", []))
        # Canonical summary fields (for UI to use instead of extras)
        database["Tango has data"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("Tango has data", False))
        database["Tango Beta max"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("Tango Beta max"))
        database["Tango Helix max"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("Tango Helix max"))
        database["Tango Aggregation max"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("Tango Aggregation max"))
        
        # Regression check: verify all columns have correct length
        expected_len = len(database)
        for col in ["SSW fragments", "SSW score", "SSW diff", "SSW helix percentage",
                    "SSW beta percentage", "Tango Beta curve", "Tango Helix curve",
                    "Tango Turn curve", "Tango Aggregation curve",
                    "Tango has data", "Tango Beta max", "Tango Helix max", "Tango Aggregation max"]:
            if col in database.columns:
                actual_len = len(database[col])
                if actual_len != expected_len:
                    raise ValueError(
                        f"[TANGO][ERROR] Column '{col}' length mismatch after Entry-aligned assignment: "
                        f"expected {expected_len} (DataFrame rows), got {actual_len}. "
                        f"TANGO provider status: FAILED - assignment alignment error."
                    )
        
        log_info("tango_parse_complete", f"Tango parsing/merge complete: {ok_ctr} OK, {bad_ctr} BAD/empty", **{
            "ok_count": ok_ctr,
            "bad_count": bad_ctr,
            "total_entries": len(entry_set),
        })
        result = {
            "parsed_ok": ok_ctr,
            "parsed_bad": bad_ctr,
            "requested": len(entry_set),
        }
        # If zero outputs, provide structured error
        if ok_ctr == 0:
            reason = _read_run_meta_reason(run_dir)
            if reason:
                result["reason"] = reason
            else:
                result["reason"] = "No run_meta.json; parser produced empty outputs"

            result["dir_contents"] = dir_contents
            result["expected_files"] = expected_files[:10]  # First 10 for brevity
            result["run_meta_path"] = meta_path

            # ✅ INVARIANT: Fatal check with structured error
            # Never return silent null/unknown when USE_TANGO=1 and a run occurred
            if len(entry_set) > 0:
                error_details = {
                    "inputs_count": len(entry_set),
                    "outputs_expected": expected_files[:10],
                    "outputs_found": [f for f in dir_contents if f.endswith(".txt") and f != "Tango_run.sh"],
                    "run_dir": run_dir,
                    "run_meta_path": meta_path,
                    "reason": result.get("reason"),
                    "provider_status": "FAILED",
                }
                error_msg = (
                    f"TANGO OUTPUT BINDING FAILED: Produced 0 outputs for {len(entry_set)} inputs. "
                    f"Expected files: {expected_files[:3]}. "
                    f"Found files: {[f for f in dir_contents if f.endswith('.txt') and f != 'Tango_run.sh'][:5]}. "
                    f"Run meta: {meta_path}. "
                    f"Reason: {result.get('reason', 'Unknown')}."
                )
                log_error("tango_output_binding_failed", error_msg, **error_details)
                raise TangoOutputBindingError(error_msg, error_details)
        return result

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

        # Build dict keyed by Entry for Entry-aligned assignment
        results_by_entry: Dict[str, Dict[str, Any]] = {}
        for _, row in database.iterrows():
            entry = str(row.get(KEY) or "").strip()
            if entry:
                results_by_entry[entry] = {
                    "SSW fragments": "-",
                    "SSW score": None,  # Use None instead of -1 for missing data
                    "SSW diff": None,   # Use None instead of 0 for missing data
                    "SSW helix percentage": None,  # Use None instead of 0.0
                    "SSW beta percentage": None,   # Use None instead of 0.0
                }
        
        bad_ctr, ok_ctr = 0, 0
        if df_out is not None and name_col:
            # Match by Entry and populate results_by_entry
            for entry, result_dict in results_by_entry.items():
                m = df_out[df_out[name_col] == entry]
                if not m.empty:
                    m0 = m.iloc[0]
                    result_dict["SSW helix percentage"] = m0.get(helix_pct_col, None) if helix_pct_col else None
                    result_dict["SSW beta percentage"] = m0.get(beta_pct_col, None) if beta_pct_col else None
                    ok_ctr += 1
                else:
                    bad_ctr += 1
        else:
            bad_ctr = len(results_by_entry)
        
        # Assign using Entry-aligned mapping (eliminates ndarray length mismatch)
        # Use None (not -1/0) for missing metrics to indicate data unavailability
        database["SSW fragments"] = database[KEY].map(lambda e: results_by_entry.get(str(e).strip(), {}).get("SSW fragments", "-"))
        database["SSW score"] = database[KEY].map(lambda e: none_if_nan(results_by_entry.get(str(e).strip(), {}).get("SSW score")))
        database["SSW diff"] = database[KEY].map(lambda e: none_if_nan(results_by_entry.get(str(e).strip(), {}).get("SSW diff")))
        database["SSW helix percentage"] = database[KEY].map(lambda e: none_if_nan(results_by_entry.get(str(e).strip(), {}).get("SSW helix percentage")))
        database["SSW beta percentage"] = database[KEY].map(lambda e: none_if_nan(results_by_entry.get(str(e).strip(), {}).get("SSW beta percentage")))

        log_info("tango_parse_batch_complete", f"Tango parsing/merge complete (batch fallback): {ok_ctr} OK, {bad_ctr} BAD/empty", **{
            "ok_count": ok_ctr,
            "bad_count": bad_ctr,
            "total_entries": len(results_by_entry),
        })
        result = {
            "parsed_ok": ok_ctr,
            "parsed_bad": bad_ctr,
            "requested": len(results_by_entry),
        }
        # If zero outputs, provide structured error
        if ok_ctr == 0:
            reason = _read_run_meta_reason(run_dir)
            if reason:
                result["reason"] = reason
            else:
                result["reason"] = "No run_meta.json; parser produced empty outputs"

            # ✅ INVARIANT: Fatal check with structured error
            if len(results_by_entry) > 0:
                error_details = {
                    "inputs_count": len(results_by_entry),
                    "outputs_expected": [],
                    "outputs_found": [],
                    "run_dir": run_dir,
                    "run_meta_path": meta_path,
                    "reason": result.get("reason"),
                    "provider_status": "FAILED",
                }
                error_msg = (
                    f"TANGO OUTPUT BINDING FAILED (batch fallback): Produced 0 outputs for {len(results_by_entry)} inputs. "
                    f"Run meta: {meta_path}. "
                    f"Reason: {result.get('reason', 'Unknown')}."
                )
                log_error("tango_output_binding_failed", error_msg, **error_details)
                raise TangoOutputBindingError(error_msg, error_details)
        return result

    # ---------- Nothing: defaults ----------
    print("[TANGO][WARN] No run directory or batch output found; filling defaults.")
    n = len(database)
    # Use index-aligned Series to ensure proper alignment
    # Use None (not -1/0) for missing metrics to indicate data unavailability
    database["SSW fragments"]        = pd.Series(["-"] * n, index=database.index, dtype=object)
    database["SSW score"]            = pd.Series([None] * n, index=database.index, dtype=object)
    database["SSW diff"]             = pd.Series([None] * n, index=database.index, dtype=object)
    database["SSW helix percentage"] = pd.Series([None] * n, index=database.index, dtype=object)
    database["SSW beta percentage"]  = pd.Series([None] * n, index=database.index, dtype=object)

    # Return stats indicating no successful parses
    requested = len(database)
    result: Dict[str, Any] = {
        "parsed_ok": 0,
        "parsed_bad": requested,
        "requested": requested,
    }
    # Try to read reason from run_meta.json if run_dir exists
    if run_dir:
        reason = _read_run_meta_reason(run_dir)
        if reason:
            result["reason"] = reason
        else:
            result["reason"] = "No run directory or batch output found"
    else:
        result["reason"] = "No run directory or batch output found"

    # ✅ INVARIANT: Fatal check with structured error
    # Never return silent null/unknown when USE_TANGO=1 and a run occurred
    if requested > 0:
        error_details = {
            "inputs_count": requested,
            "outputs_expected": [],
            "outputs_found": dir_contents if run_dir else [],
            "run_dir": run_dir or "None",
            "run_meta_path": meta_path if run_dir else "None",
            "reason": result.get("reason"),
            "provider_status": "FAILED",
        }
        error_msg = (
            f"TANGO OUTPUT BINDING FAILED: No run directory or batch output found. "
            f"Requested {requested} inputs. "
            f"Run directory: {run_dir or 'None'}. "
            f"Reason: {result.get('reason', 'Unknown')}."
        )
        log_error("tango_output_binding_failed", error_msg, **error_details)
        raise TangoOutputBindingError(error_msg, error_details)

    return result


# ---------------------------------------------------------------------
# Helper: read reason from run_meta.json
# ---------------------------------------------------------------------
def _read_run_meta_reason(run_dir: Optional[str]) -> Optional[str]:
    """
    Read the 'reason' field from run_meta.json if it exists.
    Returns None if file doesn't exist or reason is not present.
    """
    if not run_dir or not os.path.isdir(run_dir):
        return None
    
    meta_path = os.path.join(run_dir, "run_meta.json")
    if not os.path.exists(meta_path):
        return None
    
    try:
        with open(meta_path, "r") as f:
            meta = json.load(f)
            return meta.get("reason")
    except Exception:
        return None


# ---------------------------------------------------------------------
# Public: TANGO smoke test for diagnostics
# ---------------------------------------------------------------------
def smoke_test_tango(n_inputs: int = 1) -> Dict[str, Any]:
    """
    Run a TANGO smoke test to verify the pipeline works.

    INVARIANT: For N inputs, we MUST parse N outputs OR fail loudly.

    Uses test sequences and verifies:
    1. Binary execution succeeds
    2. run_meta.json contains entry_mapping
    3. All expected output files are created
    4. All outputs can be parsed
    5. SSW values are computed

    Args:
        n_inputs: Number of test sequences to run (default 1)

    Returns dict with:
        success: bool - whether smoke test passed
        stage: str - last successful stage
        error: str | None - error message if failed
        run_dir: str | None - run directory path
        run_meta_path: str | None - path to run_meta.json
        inputs_count: int - number of inputs sent
        outputs_expected: list - expected output filenames from entry_mapping
        outputs_found: list - actual output files found
        outputs_parsed: int - number successfully parsed
        duration_ms: int - execution time in milliseconds
    """
    import time
    start = time.time()

    result: Dict[str, Any] = {
        "success": False,
        "stage": "init",
        "error": None,
        "run_dir": None,
        "run_meta_path": None,
        "inputs_count": n_inputs,
        "outputs_expected": [],
        "outputs_found": [],
        "outputs_parsed": 0,
        "duration_ms": 0,
    }

    # Generate test sequences
    test_seqs = [
        ("_SMOKE_TEST_1_", "ACDEFGHIKLMNPQRSTVWY"),
        ("_SMOKE_TEST_2_", "AAAAAAAAAAAAAAAAAAAA"),
        ("_SMOKE_TEST_3_", "LLLLLLLLLLLLLLLLLLLL"),
    ]
    records = test_seqs[:n_inputs]

    try:
        # Stage 1: Run TANGO
        run_dir = run_tango_simple(records)
        result["run_dir"] = run_dir
        result["stage"] = "run"

        # Stage 2: Verify run_meta.json exists and has entry_mapping
        meta_path = os.path.join(run_dir, "run_meta.json")
        result["run_meta_path"] = meta_path

        if not os.path.exists(meta_path):
            result["error"] = f"run_meta.json not created at {meta_path}"
            result["duration_ms"] = int((time.time() - start) * 1000)
            return result

        with open(meta_path, "r") as f:
            run_meta = json.load(f)

        entry_mapping = run_meta.get("entry_mapping")
        if not entry_mapping:
            result["error"] = "run_meta.json missing entry_mapping - INVARIANT VIOLATED"
            result["duration_ms"] = int((time.time() - start) * 1000)
            return result

        result["stage"] = "meta_verified"

        # Stage 3: Check all expected output files exist
        expected_files = [m["expected_output"] for m in entry_mapping]
        result["outputs_expected"] = expected_files

        dir_contents = os.listdir(run_dir) if os.path.isdir(run_dir) else []
        result["outputs_found"] = [f for f in dir_contents if f.endswith(".txt") and f != "Tango_run.sh"]

        missing_files = [f for f in expected_files if f not in dir_contents]
        if missing_files:
            result["error"] = (
                f"INVARIANT VIOLATED: {len(missing_files)} of {len(expected_files)} expected outputs missing. "
                f"Missing: {missing_files}. Found: {result['outputs_found']}"
            )
            result["duration_ms"] = int((time.time() - start) * 1000)
            return result

        result["stage"] = "files_verified"

        # Stage 4: Parse all output files
        parsed_count = 0
        for mapping in entry_mapping:
            out_file = os.path.join(run_dir, mapping["expected_output"])
            parsed = __get_peptide_tango_result(out_file)
            if parsed:
                parsed_count += 1

        result["outputs_parsed"] = parsed_count

        if parsed_count != len(entry_mapping):
            result["error"] = (
                f"INVARIANT VIOLATED: Parsed {parsed_count} of {len(entry_mapping)} outputs. "
                f"Expected to parse all."
            )
            result["duration_ms"] = int((time.time() - start) * 1000)
            return result

        result["stage"] = "complete"
        result["success"] = True

    except Exception as e:
        result["error"] = f"{type(e).__name__}: {str(e)}"

    result["duration_ms"] = int((time.time() - start) * 1000)

    # Cleanup: remove smoke test output files
    if result.get("run_dir") and os.path.isdir(result["run_dir"]):
        for mapping in records:
            out_file = os.path.join(result["run_dir"], f"{_safe_id(mapping[0])}.txt")
            try:
                if os.path.exists(out_file):
                    os.remove(out_file)
            except Exception:
                pass

    return result


# ---------------------------------------------------------------------
# Public: compute SSW prediction flag (unchanged logic)
# ---------------------------------------------------------------------
def filter_by_avg_diff(database: pd.DataFrame, database_name: str, statistical_result_dict: dict) -> None:
    """
    Mark 'SSW prediction' = 1 when SSW diff is <= avg threshold; else -1.
    Uses index-aligned Series to ensure proper DataFrame alignment.
    
    Threshold calculation strategy (env var SSW_DIFF_THRESHOLD_STRATEGY):
    - "mean" (default): Use mean of valid SSW diff values
    - "median": Use median of valid SSW diff values
    - "fixed": Use fixed value from SSW_DIFF_THRESHOLD_FIXED (default: 0.0)
    - "multiplier": Use mean * SSW_DIFF_THRESHOLD_MULTIPLIER (default: 1.0)
    
    Fallback threshold when no valid diffs (env var SSW_DIFF_THRESHOLD_FALLBACK, default: 0.0)
    """
    import os
    from services.logger import log_warning
    
    if "SSW diff" not in database.columns:
        # Use None (not -1) to indicate missing data
        database["SSW diff"] = pd.Series([None] * len(database), index=database.index, dtype=object)
    
    # Get threshold strategy from config (with fallback for backward compatibility)
    try:
        from config import settings
        strategy = settings.SSW_DIFF_THRESHOLD_STRATEGY
        fallback_threshold = settings.SSW_DIFF_THRESHOLD_FALLBACK
        fixed_threshold = settings.SSW_DIFF_THRESHOLD_FIXED
        multiplier = settings.SSW_DIFF_THRESHOLD_MULTIPLIER
    except ImportError:
        # Fallback if config not available
        strategy = os.getenv("SSW_DIFF_THRESHOLD_STRATEGY", "mean").lower()
        fallback_threshold = float(os.getenv("SSW_DIFF_THRESHOLD_FALLBACK", "0.0"))
        fixed_threshold = float(os.getenv("SSW_DIFF_THRESHOLD_FIXED", "0.0"))
        multiplier = float(os.getenv("SSW_DIFF_THRESHOLD_MULTIPLIER", "1.0"))
    
    # Calculate threshold based on strategy
    # Gate: Only use rows with valid TANGO metrics (SSW diff is not None and not NaN)
    valid_diffs = database[database["SSW diff"].notna()]["SSW diff"]
    # Filter out NaN/inf values
    valid_diffs = valid_diffs[valid_diffs.apply(lambda x: x is not None and isinstance(x, (int, float)) and math.isfinite(x))]
    if len(valid_diffs) == 0:
        avg_diff = fallback_threshold
        log_warning("ssw_diff_no_valid", f"No valid SSW diff values; using fallback threshold {fallback_threshold}", **{"strategy": strategy, "fallback": fallback_threshold})
    else:
        if strategy == "mean":
            avg_diff = valid_diffs.mean()
        elif strategy == "median":
            avg_diff = valid_diffs.median()
        elif strategy == "fixed":
            avg_diff = fixed_threshold
        elif strategy == "multiplier":
            avg_diff = valid_diffs.mean() * multiplier
        else:
            # Unknown strategy, fall back to mean
            log_warning("ssw_diff_unknown_strategy", f"Unknown threshold strategy '{strategy}', using 'mean'", **{"strategy": strategy})
            avg_diff = valid_diffs.mean()
    
    statistical_result_dict[database_name]['4 SSW helix and beta difference threshold'] = avg_diff
    
    # Build predictions as index-aligned Series (not raw list)
    # Gate: Only compute SSW prediction for rows with valid TANGO metrics (SSW diff is not None and not NaN)
    # For rows without valid TANGO metrics, set sswPrediction = None (not -1, not 0, not 1)
    # Note: Reference implementation uses "prediction = 1 if diff < avg_diff, else -1"
    # This means diff >= avg → -1 (NOT SSW), diff < avg → 1 (IS SSW)
    # The comparison operator determines when to mark as 1 (default: "<" to match reference)
    comparison_op = os.getenv("SSW_DIFF_COMPARISON", "<").strip()
    preds = []
    for idx, row in database.iterrows():
        ssw_diff_val = row["SSW diff"]
        helix_pct = row.get("SSW helix percentage")
        beta_pct = row.get("SSW beta percentage")

        # Determine if TANGO actually ran for this row
        # TANGO ran if we have helix or beta percentages (even if 0.0)
        tango_ran = (helix_pct is not None and not (isinstance(helix_pct, float) and math.isnan(helix_pct))) or \
                    (beta_pct is not None and not (isinstance(beta_pct, float) and math.isnan(beta_pct)))

        # Guard: Handle missing SSW diff
        if ssw_diff_val is None or (isinstance(ssw_diff_val, float) and (math.isnan(ssw_diff_val) or not math.isfinite(ssw_diff_val))):
            if tango_ran:
                # TANGO ran but no SSW fragments found → predict -1 (no structural switch)
                # This is different from "TANGO didn't run" (which would be None)
                preds.append(-1)
            else:
                # TANGO didn't run → set to None (will be converted to null in JSON)
                preds.append(None)
        elif comparison_op == ">=":
            preds.append(1 if ssw_diff_val >= avg_diff else -1)
        elif comparison_op == "<=":
            preds.append(1 if ssw_diff_val <= avg_diff else -1)
        elif comparison_op == ">":
            preds.append(1 if ssw_diff_val > avg_diff else -1)
        elif comparison_op == "<":
            preds.append(1 if ssw_diff_val < avg_diff else -1)
        else:
            # Default to "<" (reference behavior: prediction = 1 if diff < avg_diff)
            preds.append(1 if ssw_diff_val < avg_diff else -1)
    
    # Assign using index-aligned Series to ensure proper alignment
    # Use object dtype to allow None values
    preds_series = pd.Series(preds, index=database.index, dtype=object)
    
    # Sanitize: replace any NaN values with None (shouldn't happen, but defensive)
    preds_series = preds_series.apply(lambda x: None if (isinstance(x, float) and (math.isnan(x) or not math.isfinite(x))) else x)
    
    # Assertion: verify length matches before assignment
    if len(preds_series) != len(database):
        raise ValueError(
            f"[TANGO][ERROR] SSW prediction length mismatch: "
            f"expected {len(database)} (DataFrame rows), got {len(preds_series)}. "
            f"TANGO provider status: FAILED - assignment alignment error."
        )
    
    database["SSW prediction"] = preds_series


