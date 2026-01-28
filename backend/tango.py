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
# Docker availability
# ---------------------------------------------------------------------
def _docker_available() -> bool:
    return shutil.which("docker") is not None


# ---------------------------------------------------------------------
# Paths / constants (repo-relative, robust to cwd)
# ---------------------------------------------------------------------
PROJECT_PATH = os.path.dirname(os.path.abspath(__file__))
TANGO_DIR    = os.path.abspath(os.path.join(PROJECT_PATH, "Tango"))

# Runtime output directories: Use temp location to avoid triggering uvicorn --reload
# If TANGO_RUNTIME_DIR env var is set, use it; otherwise use .run_cache in backend/
# This prevents file watchers from restarting the server during TANGO execution
_RUNTIME_BASE = os.getenv("TANGO_RUNTIME_DIR", os.path.join(PROJECT_PATH, ".run_cache", "Tango"))
WORK_DIR = os.path.join(_RUNTIME_BASE, "work")   # inputs for runs
OUT_DIR  = os.path.join(_RUNTIME_BASE, "out")    # per-run outputs

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
    Create a simple per-peptide runner script (bash script).
    Each line calls the Tango binary with inline params and redirects to <ID>.txt.
    Script is written to run_dir, and executed with cwd=run_dir, so outputs go to run_dir.
    Uses absolute path to the TANGO binary to avoid path resolution issues.
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
    for entry_id, seq in records:
        safe = _safe_id(entry_id)
        # Tango inline args format (what your colleague used)
        # Output to current directory (run_dir) where script is executed
        # Since cwd=run_dir, just use relative path
        lines.append(
            f'"$BIN" {safe} nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="{seq}" > "{safe}.txt"\n'
        )
    with open(script_path, "w") as fh:
        fh.writelines(lines)
    os.chmod(script_path, 0o755)

def run_tango_simple(records: Optional[List[Tuple[str, str]]]) -> str:
    """
    Very small, mac-native runner:
      - creates per-run folder Tango/out/run_*/
      - writes Tango_run.sh (bash script) into the run folder
      - executes it inside the per-run folder
      - outputs land under Tango/out/run_*/
    Safe no-op if records is empty; safe no-crash if tango/bin is missing.
    Returns the run_dir path for subsequent parsing.
    
    On failure, writes run_meta.json with diagnostic information.
    """
    import json
    from datetime import datetime
    
    _ensure_dirs()
    if not records:
        log_warning("tango_simple_skip", "No records for simple runner; skipping.")
        # Still create a run_dir to maintain consistency
        return _start_new_run_dir()

    # Prepare per-run folder and script
    run_dir = _start_new_run_dir()
    log_info("tango_simple_prepare", f"Prepared run directory: {run_dir}", **{"run_dir": run_dir, "sequence_count": len(records)})
    # Write script to run_dir (not global Tango/) to avoid conflicts with concurrent runs
    script_path = os.path.join(run_dir, "Tango_run.sh")
    _write_simple_bat(records, script_path)

    # Capture absolute paths and environment for diagnostics
    bin_path = os.path.join(TANGO_DIR, "bin", "tango")
    bin_path_abs = os.path.abspath(bin_path)
    run_dir_abs = os.path.abspath(run_dir)
    script_path_abs = os.path.abspath(script_path)
    
    # Capture input file paths (fmt1/2/3 from WORK_DIR)
    input_files = {}
    for fmt_name, fmt_file in [("fmt1", "Tango_input_fmt1.txt"), ("fmt2", "Tango_input_fmt2.txt"), ("fmt3", "Tango_input_fmt3.txt")]:
        fmt_path = os.path.join(WORK_DIR, fmt_file)
        if os.path.exists(fmt_path):
            input_files[fmt_name] = {
                "path": os.path.abspath(fmt_path),
                "size_bytes": os.path.getsize(fmt_path)
            }
    
    # Capture environment hints (first 200 chars of PATH, full LD_LIBRARY_PATH/DYLD_LIBRARY_PATH)
    env_hints = {}
    for env_var in ["PATH", "LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"]:
        val = os.environ.get(env_var, "")
        if env_var == "PATH" and val:
            env_hints["PATH_head"] = val[:200]  # First 200 chars
        elif val:
            env_hints[env_var] = val
    
    # Check if binary exists before attempting execution
    if not os.path.exists(bin_path):
        reason = "ENOENT"
        run_meta = {
            "traceId": get_trace_id(),
            "timestamp": datetime.now().isoformat(),
            "cmd": ["bash", "Tango_run.sh"],
            "cwd": run_dir_abs,
            "bin_path": bin_path_abs,
            "bin_exists": False,
            "envHints": env_hints,
            "inputs": input_files,
            "exit_code": None,
            "stderr_tail": "",
            "reason": reason,
        }
        meta_path = os.path.join(run_dir, "run_meta.json")
        try:
            with open(meta_path, "w") as f:
                json.dump(run_meta, f, indent=2)
        except Exception:
            pass
        log_error("tango_simple_failed", f"TANGO binary not found at {bin_path_abs}", **{
            "traceId": run_meta["traceId"],
            "reason": reason,
            "exit": None,
            "path": bin_path_abs,
        })
        return run_dir
    
    # Check if binary is executable
    if not os.access(bin_path, os.X_OK):
        reason = "EACCES"
        run_meta = {
            "traceId": get_trace_id(),
            "timestamp": datetime.now().isoformat(),
            "cmd": ["bash", "Tango_run.sh"],
            "cwd": run_dir_abs,
            "bin_path": bin_path_abs,
            "bin_exists": True,
            "bin_executable": False,
            "envHints": env_hints,
            "inputs": input_files,
            "exit_code": None,
            "stderr_tail": "",
            "reason": reason,
        }
        meta_path = os.path.join(run_dir, "run_meta.json")
        try:
            with open(meta_path, "w") as f:
                json.dump(run_meta, f, indent=2)
        except Exception:
            pass
        log_error("tango_simple_failed", f"TANGO binary not executable at {bin_path_abs}", **{
            "traceId": run_meta["traceId"],
            "reason": reason,
            "exit": None,
            "path": bin_path_abs,
        })
        return run_dir
    
    # Make sure macOS Gatekeeper doesn't block
    try:
        os.chmod(bin_path, 0o755)
        subprocess.run(["xattr", "-d", "com.apple.quarantine", bin_path],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # Execute inside the run directory so each <ID>.txt lands here
    # Use relative path to script since we're already in run_dir
    trace_id = get_trace_id()
    cmd = ["bash", "Tango_run.sh"]
    exception_type = None
    exit_code = None
    stderr_tail = ""
    reason = None
    
    try:
        proc = subprocess.run(
            cmd,
            cwd=run_dir,
            capture_output=True,
            text=True,
            timeout=3600  # 1 h guard
        )
        exit_code = proc.returncode
        # Capture last 2KB of stderr
        if proc.stderr:
            stderr_tail = proc.stderr[-2048:] if len(proc.stderr) > 2048 else proc.stderr
        
        if proc.returncode != 0:
            reason = "NonZeroExit"
            run_meta = {
                "traceId": trace_id,
                "timestamp": datetime.now().isoformat(),
                "cmd": cmd,
                "cwd": run_dir_abs,
                "bin_path": bin_path_abs,
                "bin_exists": True,
                "bin_executable": True,
                "envHints": env_hints,
                "inputs": input_files,
                "exit_code": exit_code,
                "stdout_preview": proc.stdout[:500] if proc.stdout else "",
                "stderr_tail": stderr_tail,
                "reason": reason,
            }
            meta_path = os.path.join(run_dir, "run_meta.json")
            try:
                with open(meta_path, "w") as f:
                    json.dump(run_meta, f, indent=2)
            except Exception as e:
                log_warning("tango_meta_write_failed", f"Failed to write run_meta.json: {e}", **{"error": str(e)})
            
            log_error("tango_simple_failed", "Simple runner failed", **{
                "traceId": trace_id,
                "reason": reason,
                "exit": exit_code,
                "path": bin_path_abs,
            })
        else:
            count_txt = len([f for f in os.listdir(run_dir) if f.lower().endswith(".txt")])
            ok = count_txt
            failed = max(0, len(records) - ok)
            log_info("tango_simple_complete", f"Tango simple run completed: {ok} succeeded, {failed} failed", **{
                "succeeded": ok,
                "failed": failed,
                "run_dir": run_dir,
            })
    except subprocess.TimeoutExpired as e:
        exception_type = "TimeoutExpired"
        reason = "Timeout"
        stderr_tail = "Execution timed out after 3600 seconds"
        run_meta = {
            "traceId": trace_id,
            "timestamp": datetime.now().isoformat(),
            "cmd": cmd,
            "cwd": run_dir_abs,
            "bin_path": bin_path_abs,
            "bin_exists": True,
            "bin_executable": True,
            "envHints": env_hints,
            "inputs": input_files,
            "exit_code": None,
            "exception_type": exception_type,
            "stderr_tail": stderr_tail,
            "reason": reason,
        }
        meta_path = os.path.join(run_dir, "run_meta.json")
        try:
            with open(meta_path, "w") as f:
                json.dump(run_meta, f, indent=2)
        except Exception:
            pass
        log_error("tango_simple_failed", "Simple runner timed out", **{
            "traceId": trace_id,
            "reason": reason,
            "exit": None,
            "path": bin_path_abs,
        })
    except FileNotFoundError as e:
        exception_type = "FileNotFoundError"
        reason = "ENOENT"
        run_meta = {
            "traceId": trace_id,
            "timestamp": datetime.now().isoformat(),
            "cmd": cmd,
            "cwd": run_dir_abs,
            "bin_path": bin_path_abs,
            "bin_exists": False,
            "envHints": env_hints,
            "inputs": input_files,
            "exit_code": None,
            "exception_type": exception_type,
            "stderr_tail": str(e),
            "reason": reason,
        }
        meta_path = os.path.join(run_dir, "run_meta.json")
        try:
            with open(meta_path, "w") as f:
                json.dump(run_meta, f, indent=2)
        except Exception:
            pass
        log_error("tango_simple_failed", f"TANGO binary or script not found: {e}", **{
            "traceId": trace_id,
            "reason": reason,
            "exit": None,
            "path": bin_path_abs,
        })
    except PermissionError as e:
        exception_type = "PermissionError"
        reason = "EACCES"
        run_meta = {
            "traceId": trace_id,
            "timestamp": datetime.now().isoformat(),
            "cmd": cmd,
            "cwd": run_dir_abs,
            "bin_path": bin_path_abs,
            "bin_exists": True,
            "bin_executable": False,
            "envHints": env_hints,
            "inputs": input_files,
            "exit_code": None,
            "exception_type": exception_type,
            "stderr_tail": str(e),
            "reason": reason,
        }
        meta_path = os.path.join(run_dir, "run_meta.json")
        try:
            with open(meta_path, "w") as f:
                json.dump(run_meta, f, indent=2)
        except Exception:
            pass
        log_error("tango_simple_failed", f"TANGO binary not executable: {e}", **{
            "traceId": trace_id,
            "reason": reason,
            "exit": None,
            "path": bin_path_abs,
        })
    except Exception as e:
        exception_type = type(e).__name__
        reason = "UnexpectedError"
        run_meta = {
            "traceId": trace_id,
            "timestamp": datetime.now().isoformat(),
            "cmd": cmd,
            "cwd": run_dir_abs,
            "bin_path": bin_path_abs,
            "bin_exists": os.path.exists(bin_path),
            "bin_executable": os.access(bin_path, os.X_OK) if os.path.exists(bin_path) else False,
            "envHints": env_hints,
            "inputs": input_files,
            "exit_code": None,
            "exception_type": exception_type,
            "stderr_tail": str(e),
            "reason": reason,
        }
        meta_path = os.path.join(run_dir, "run_meta.json")
        try:
            with open(meta_path, "w") as f:
                json.dump(run_meta, f, indent=2)
        except Exception:
            pass
        log_error("tango_simple_failed", f"Unexpected error during TANGO execution: {e}", **{
            "traceId": trace_id,
            "reason": reason,
            "exit": None,
            "path": bin_path_abs,
        })
    
    return run_dir


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

    # ✅ Use absolute path for Docker volume mount
    tango_dir_abs = os.path.abspath(TANGO_DIR)
    docker_cmd = [
        "docker","run","--rm",
        "-v", f"{tango_dir_abs}:/app/Tango",
        "-w", "/app/Tango",
        "--user", f"{os.getuid()}:{os.getgid()}",
        # Only force platform if you KNOW your base image is amd64-only.
        # "--platform","linux/amd64",
        "desy-tango",
        # ENTRYPOINT is assumed to be /bin/bash -lc
        f"chmod +x ./Tango_run.sh && ./Tango_run.sh work/Tango_input_fmt2.txt out/{run_dir_name}",
    ]
    log_info("tango_docker_mount", f"Docker volume mount: {tango_dir_abs}:/app/Tango", **{
        "host_path": tango_dir_abs,
        "container_path": "/app/Tango",
    })
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
def run_tango(records: Optional[List[Tuple[str, str]]] = None) -> Optional[str]:
    """
    Entry point used by server.py
    - If records provided, prefer SIMPLE mac runner (colleague parity).
    - If env TANGO_SIMPLE=0, try Docker/Host paths below.
    - If records is None, do nothing (server builds records via create_tango_input).
    Returns the run_dir path for subsequent parsing.
    """
    if not records:
        print("[TANGO][WARN] No records provided to run_tango(); skipping execution")
        return None

    if os.getenv("TANGO_SIMPLE", "1") == "1":
        return run_tango_simple(records)

    # Optional fallbacks (kept functional; not used by default)
    try:
        return run_tango_docker(records)
    except Exception as e:
        print(f"[TANGO][WARN] Docker path failed: {e} — trying host...")

    return run_tango_host(records)


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
def _append_defaults(fragments, scores, diffs, helix_pcts, beta_pcts):
    fragments.append("-")
    scores.append(-1)
    diffs.append(0)
    helix_pcts.append(0)
    beta_pcts.append(0)

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
                # Initialize defaults for this entry
                results_by_entry[entry] = {
                    "SSW fragments": "-",
                    "SSW score": -1,
                    "SSW diff": 0,
                    "SSW helix percentage": 0.0,
                    "SSW beta percentage": 0.0,
                    "Tango Beta curve": [],
                    "Tango Helix curve": [],
                    "Tango Turn curve": [],
                    "Tango Aggregation curve": [],
                }

        # Process TANGO output files and populate results_by_entry
        for entry in entry_set:
            safe = _safe_id(entry)
            out_file = os.path.join(run_dir, f"{safe}.txt")

            try:
                res = __get_peptide_tango_result(out_file)
            except Exception:
                res = None

            if not res:
                bad_ctr += 1
                continue

            analysed = __analyse_tango_results(res) or {}
            
            # Store results keyed by Entry
            # Use None (not -1/0) for missing metrics to indicate data unavailability
            results_by_entry[entry] = {
                "SSW fragments": analysed.get("SSW_residues", []) or "-",
                "SSW score": analysed.get("SSW_avg_score"),  # None if missing (not -1)
                "SSW diff": analysed.get("Helix_and_beta_diff"),  # None if missing (not 0)
                "SSW helix percentage": analysed.get("Helix_percentage"),  # None if missing (not 0)
                "SSW beta percentage": analysed.get("Beta_percentage"),  # None if missing (not 0)
                "Tango Beta curve": res.get("Beta prediction", []) or [],
                "Tango Helix curve": res.get("Helix prediction", []) or [],
                "Tango Turn curve": res.get("Turn prediction", []) or [],
                "Tango Aggregation curve": res.get("Aggregation prediction", []) or [],
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
        
        # Regression check: verify all columns have correct length
        expected_len = len(database)
        for col in ["SSW fragments", "SSW score", "SSW diff", "SSW helix percentage", 
                    "SSW beta percentage", "Tango Beta curve", "Tango Helix curve", 
                    "Tango Turn curve", "Tango Aggregation curve"]:
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
        # If zero outputs, try to read reason from run_meta.json
        if ok_ctr == 0:
            reason = _read_run_meta_reason(run_dir)
            if reason:
                result["reason"] = reason
            else:
                result["reason"] = "No run_meta.json; parser produced empty outputs"
            
            # ✅ Fatal check: raise ValueError if 0 outputs for N inputs
            if len(entry_set) > 0:
                error_msg = (
                    f"TANGO produced 0 outputs for {len(entry_set)} inputs. "
                    f"Run directory: {run_dir}. "
                    f"Reason: {result.get('reason', 'Unknown')}. "
                    f"Check run_meta.json for diagnostics."
                )
                log_error("tango_zero_outputs_fatal", error_msg, **{
                    "requested": len(entry_set),
                    "parsed_ok": ok_ctr,
                    "run_dir": run_dir,
                    "reason": result.get("reason"),
                })
                raise ValueError(error_msg)
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
                    "SSW score": -1,  # batch file doesn't have score
                    "SSW diff": 0,
                    "SSW helix percentage": 0.0,
                    "SSW beta percentage": 0.0,
                }
        
        bad_ctr, ok_ctr = 0, 0
        if df_out is not None and name_col:
            # Match by Entry and populate results_by_entry
            for entry, result_dict in results_by_entry.items():
                m = df_out[df_out[name_col] == entry]
                if not m.empty:
                    m0 = m.iloc[0]
                    result_dict["SSW helix percentage"] = m0.get(helix_pct_col, 0) if helix_pct_col else 0
                    result_dict["SSW beta percentage"] = m0.get(beta_pct_col, 0) if beta_pct_col else 0
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
        # If zero outputs, try to read reason from run_meta.json
        if ok_ctr == 0:
            reason = _read_run_meta_reason(run_dir)
            if reason:
                result["reason"] = reason
            else:
                result["reason"] = "No run_meta.json; parser produced empty outputs"
            
            # ✅ Fatal check: raise ValueError if 0 outputs for N inputs
            if len(results_by_entry) > 0:
                error_msg = (
                    f"TANGO produced 0 outputs for {len(results_by_entry)} inputs. "
                    f"Run directory: {run_dir}. "
                    f"Reason: {result.get('reason', 'Unknown')}. "
                    f"Check run_meta.json for diagnostics."
                )
                log_error("tango_zero_outputs_fatal", error_msg, **{
                    "requested": len(results_by_entry),
                    "parsed_ok": ok_ctr,
                    "run_dir": run_dir,
                    "reason": result.get("reason"),
                })
                raise ValueError(error_msg)
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
    result = {
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
    
    # ✅ Fatal check: raise ValueError if 0 outputs for N inputs
    if requested > 0:
        error_msg = (
            f"TANGO produced 0 outputs for {requested} inputs. "
            f"Run directory: {run_dir or 'None'}. "
            f"Reason: {result.get('reason', 'Unknown')}. "
            f"Check run_meta.json for diagnostics."
        )
        log_error("tango_zero_outputs_fatal", error_msg, **{
            "requested": requested,
            "parsed_ok": 0,
            "run_dir": run_dir,
            "reason": result.get("reason"),
        })
        raise ValueError(error_msg)
    
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
    
    # Get threshold strategy from env (default: "mean" to match current behavior)
    strategy = os.getenv("SSW_DIFF_THRESHOLD_STRATEGY", "mean").lower()
    fallback_threshold = float(os.getenv("SSW_DIFF_THRESHOLD_FALLBACK", "0.0"))
    
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
            avg_diff = float(os.getenv("SSW_DIFF_THRESHOLD_FIXED", "0.0"))
        elif strategy == "multiplier":
            multiplier = float(os.getenv("SSW_DIFF_THRESHOLD_MULTIPLIER", "1.0"))
            avg_diff = valid_diffs.mean() * multiplier
        else:
            # Unknown strategy, fall back to mean
            log_warning("ssw_diff_unknown_strategy", f"Unknown threshold strategy '{strategy}', using 'mean'", **{"strategy": strategy})
            avg_diff = valid_diffs.mean()
    
    statistical_result_dict[database_name]['4 SSW helix and beta difference threshold'] = avg_diff
    
    # Build predictions as index-aligned Series (not raw list)
    # Gate: Only compute SSW prediction for rows with valid TANGO metrics (SSW diff is not None and not NaN)
    # For rows without valid TANGO metrics, set sswPrediction = None (not -1, not 0, not 1)
    # Note: Original behavior is "prediction = 1 if diff <= avg_diff, else -1"
    # This is equivalent to checking "if diff > avg_diff, then -1"
    # The comparison operator determines when to mark as 1 (default: "<=" to match original)
    comparison_op = os.getenv("SSW_DIFF_COMPARISON", "<=").strip()
    preds = []
    for idx, row in database.iterrows():
        ssw_diff_val = row["SSW diff"]
        # Guard: Never compute SSW when required TANGO field is None or NaN
        if ssw_diff_val is None or (isinstance(ssw_diff_val, float) and (math.isnan(ssw_diff_val) or not math.isfinite(ssw_diff_val))):
            # No valid TANGO metrics → set to None (will be converted to null in JSON)
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
            # Default to "<=" (original behavior: prediction = 1 if diff <= avg_diff)
            preds.append(1 if ssw_diff_val <= avg_diff else -1)
    
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

def parse_tango_result(tango_raw: dict) -> dict:
    """
    Return a dict whose keys are the CSV header strings expected by PeptideSchema aliases
    (so downstream ingestion uses the same names).
    """
    return {
        "Entry": tango_raw.get("Entry"),
        "Sequence": tango_raw.get("Sequence"),
        "SSW prediction": tango_raw.get("SSW prediction"),
        "SSW score": tango_raw.get("SSW score"),
        "SSW diff": tango_raw.get("SSW diff"),
        "SSW helix percentage": tango_raw.get("SSW helix percentage"),
        "SSW beta percentage": tango_raw.get("SSW beta percentage"),
        # other fields as needed...
    }
