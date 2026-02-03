# backend/_archive/tango_legacy_runners.py
"""
Legacy TANGO execution modes archived on 2026-02-02.

These runners were superseded by run_tango_simple() which is the primary
execution mode for local development and production.

Kept for historical reference only. Do not import or use these.
"""
import os
import subprocess
from typing import List, Tuple

from services.logger import log_info

# Note: These imports would need to be updated if ever restored
# from tango import TANGO_DIR, WORK_DIR, _ensure_dirs, _start_new_run_dir, _resolve_tango_bin


def run_tango_host(
    records: List[Tuple[str, str]],
    TANGO_DIR: str,
    WORK_DIR: str,
    _ensure_dirs,
    _start_new_run_dir,
    _resolve_tango_bin,
) -> str:
    """
    ARCHIVED: Host-based TANGO runner using Tango_run.sh script.

    This mode requires the Tango_run.sh script to be present and executable.
    Superseded by run_tango_simple() which calls the binary directly.
    """
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


def run_tango_docker(
    records: List[Tuple[str, str]],
    TANGO_DIR: str,
    WORK_DIR: str,
    _ensure_dirs,
    _start_new_run_dir,
) -> str:
    """
    ARCHIVED: Docker-based TANGO runner.

    This mode runs TANGO inside a Docker container for cross-platform compatibility.
    Superseded by run_tango_simple() which calls the binary directly.
    """
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

    # Use absolute path for Docker volume mount
    tango_dir_abs = os.path.abspath(TANGO_DIR)
    docker_cmd = [
        "docker","run","--rm",
        "-v", f"{tango_dir_abs}:/app/Tango",
        "-w", "/app/Tango",
        "--user", f"{os.getuid()}:{os.getgid()}",
        "desy-tango",
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
