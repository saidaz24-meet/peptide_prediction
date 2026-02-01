# Failure Modes

Every place a silent failure can happen: path resolution, tmp dirs, file permissions, macOS quarantine, Docker volume mounts, timeouts, parsing when outputs are empty.

For each: exact symptom, log signature, and the decisive fix.

## Critical: Path Mis-Resolution in Generated Scripts

### Symptom

**Exact Symptom**: TANGO produces 0 outputs for N inputs, but no error is returned to the UI. Provider status shows `UNAVAILABLE` with reason "Runner failed; 0/N parsed", but the root cause (path mis-resolution) is not visible.

**Log Signature**:
```json
{"level": "ERROR", "event": "tango_simple_failed", "message": "Simple runner failed", "reason": "NonZeroExit", "exit": 1, "path": "/absolute/path/to/tango"}
```

**Or in `run_meta.json`**:
```json
{
  "reason": "NonZeroExit",
  "exit_code": 1,
  "stderr_tail": "[TANGO] tango binary missing at /wrong/path/to/tango"
}
```

**Root Cause**: Generated script (`Tango_run.sh`) computes TANGO binary path relative to run directory using `../..` instead of absolute path. When script executes with `cwd=run_dir`, relative path resolution fails.

**Example of Broken Script**:
```bash
#!/bin/bash
BIN="../../Tango/bin/tango"  # ❌ WRONG: relative path from run_dir
"$BIN" P12345 ... > "P12345.txt"
```

**When This Happens**:
- Script is generated in `backend/.run_cache/Tango/out/run_YYYYMMDD_HHMMSS/`
- Script uses relative path `../../Tango/bin/tango`
- Actual path from run_dir: `backend/.run_cache/Tango/out/run_*/../../Tango/bin/tango` = `backend/.run_cache/Tango/bin/tango` (WRONG)
- Should be: `backend/Tango/bin/tango` (absolute)

### Fix

**Location**: `backend/tango.py:_write_simple_bat()`

**Current Code** (lines 256-286):
```python
def _write_simple_bat(records: List[Tuple[str, str]], script_path: str) -> None:
    # ...
    abs_bin = os.path.abspath(os.path.join(TANGO_DIR, "bin", "tango"))  # ✅ Already absolute
    lines.append(f'BIN="{abs_bin}"\n')  # ✅ Already using absolute path
```

**Status**: ✅ **FIXED** - Code already uses absolute path. However, verify that `TANGO_DIR` is resolved correctly.

**Verification**:
```python
# In _write_simple_bat(), add logging:
log_info("tango_script_generated", f"Generated script with binary path: {abs_bin}", **{
    "script_path": script_path,
    "bin_path": abs_bin,
    "bin_exists": os.path.exists(abs_bin),
})
```

**Additional Guard**: Add check in `run_tango_simple()` before execution:
```python
# Before executing script, verify binary exists at resolved path
if not os.path.exists(abs_bin):
    log_error("tango_bin_missing", f"TANGO binary not found at resolved path: {abs_bin}", **{
        "resolved_path": abs_bin,
        "tango_dir": TANGO_DIR,
    })
    # Write run_meta.json with diagnostic
    # Return run_dir with error status
```

---

## Silent Failure: TANGO Produces 0 Outputs for N Inputs

### Symptom

**Exact Symptom**: TANGO runner completes with exit code 0, but `parsed_ok: 0` in provider status. UI shows empty TANGO results (all fields null), but no error message is displayed.

**Log Signature**:
```json
{"level": "INFO", "event": "tango_parse_complete", "message": "Parsed TANGO outputs: 0 OK, N failed", "ok_count": 0, "bad_count": N, "total_entries": N}
```

**Or**:
```json
{"level": "ERROR", "event": "tango_simple_failed", "message": "Simple runner failed", "reason": "NonZeroExit", "exit": 1}
```

**Root Cause**: No fatal check when `parsed_ok == 0 && requested > 0`. Backend continues silently, sets provider status to `UNAVAILABLE`, but UI doesn't show actionable error.

### Fix

**Location**: `backend/tango.py:process_tango_output()`

**Add Fatal Check** (after line 1076):
```python
# If zero outputs, try to read reason from run_meta.json
if ok_ctr == 0:
    reason = _read_run_meta_reason(run_dir)
    if reason:
        result["reason"] = reason
    else:
        result["reason"] = "No run_meta.json; parser produced empty outputs"
    
    # ✅ NEW: Fatal check - raise ValueError if 0 outputs for N inputs
    if requested > 0:
        error_msg = (
            f"TANGO produced 0 outputs for {requested} inputs. "
            f"Run directory: {run_dir}. "
            f"Reason: {result.get('reason', 'Unknown')}. "
            f"Check run_meta.json for diagnostics."
        )
        log_error("tango_zero_outputs_fatal", error_msg, **{
            "requested": requested,
            "parsed_ok": ok_ctr,
            "run_dir": run_dir,
            "reason": result.get("reason"),
        })
        raise ValueError(error_msg)
```

**Location**: `backend/server.py:upload_csv()` and `execute_uniprot_query()`

**Catch and Surface to UI** (around line 470):
```python
try:
    parse_stats = tango.process_tango_output(df, run_dir=run_dir)
    # ...
except ValueError as e:
    # ✅ NEW: Surface fatal error to UI
    if "TANGO produced 0 outputs" in str(e):
        log_error("tango_zero_outputs_ui", f"TANGO zero outputs error: {e}", **{"error": str(e)})
        tango_provider_status = "UNAVAILABLE"
        tango_provider_reason = str(e)  # Include run directory and suspected cause
        # Set all SSW fields to None
        # ... existing code ...
        # ✅ NEW: Return error to UI (don't silently continue)
        raise HTTPException(
            status_code=500,
            detail=json.dumps({
                "source": "tango",
                "error": str(e),
                "run_dir": run_dir,
                "suspected_cause": result.get("reason", "Unknown"),
            })
        )
    else:
        # Existing ValueError handling
        # ...
```

---

## Silent Failure: macOS Quarantine Blocks Execution

### Symptom

**Exact Symptom**: TANGO binary exists and has executable permissions, but execution fails with "Operation not permitted" or Gatekeeper dialog.

**Log Signature**:
```json
{"level": "ERROR", "event": "tango_simple_failed", "message": "TANGO binary not executable", "reason": "EACCES", "path": "/absolute/path/to/tango"}
```

**Or in `run_meta.json`**:
```json
{
  "reason": "EACCES",
  "bin_exists": true,
  "bin_executable": false,
  "stderr_tail": "Operation not permitted"
}
```

**Root Cause**: macOS Gatekeeper quarantines downloaded binaries. Binary has `com.apple.quarantine` extended attribute.

### Fix

**Location**: `backend/tango.py:run_tango_simple()` (lines 401-407)

**Current Code** (already handles quarantine):
```python
# Make sure macOS Gatekeeper doesn't block
try:
    os.chmod(bin_path, 0o755)
    subprocess.run(["xattr", "-d", "com.apple.quarantine", bin_path],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except Exception:
    pass
```

**Status**: ✅ **FIXED** - Code already removes quarantine. However, add logging:

**Enhancement**:
```python
# Make sure macOS Gatekeeper doesn't block
try:
    os.chmod(bin_path, 0o755)
    result = subprocess.run(["xattr", "-d", "com.apple.quarantine", bin_path],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           capture_output=True)
    if result.returncode == 0:
        log_info("tango_quarantine_removed", f"Removed macOS quarantine from {bin_path}", **{"path": bin_path})
except Exception as e:
    log_warning("tango_quarantine_remove_failed", f"Failed to remove quarantine: {e}", **{"error": str(e)})
```

**Also in Generated Script** (`_write_simple_bat()`, line 272):
```python
# Ensure binary is executable and not quarantined (macOS safety)
lines.append('xattr -d com.apple.quarantine "$BIN" >/dev/null 2>&1 || true\n')
lines.append('chmod +x "$BIN" || true\n')
```

**Status**: ✅ **FIXED** - Script already removes quarantine.

---

## Silent Failure: File Permissions on Runtime Directories

### Symptom

**Exact Symptom**: TANGO runner fails to write output files to `run_dir/`, but error is not surfaced. Exit code may be 0 (script completes but files are missing).

**Log Signature**:
```json
{"level": "ERROR", "event": "tango_simple_failed", "message": "Simple runner failed", "reason": "NonZeroExit", "exit": 1, "stderr_tail": "Permission denied"}
```

**Or in `run_meta.json`**:
```json
{
  "reason": "NonZeroExit",
  "exit_code": 1,
  "stderr_tail": "bash: run_dir/P12345.txt: Permission denied"
}
```

**Root Cause**: Runtime directory (`backend/.run_cache/Tango/out/`) has incorrect permissions, or parent directory is read-only.

### Fix

**Location**: `backend/tango.py:_ensure_dirs()` (lines 61-64)

**Current Code**:
```python
def _ensure_dirs() -> None:
    """Create WORK_DIR and OUT_DIR if missing."""
    os.makedirs(WORK_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
```

**Enhancement**: Add permission check and fix:
```python
def _ensure_dirs() -> None:
    """Create WORK_DIR and OUT_DIR if missing."""
    os.makedirs(WORK_DIR, exist_ok=True, mode=0o755)
    os.makedirs(OUT_DIR, exist_ok=True, mode=0o755)
    
    # Verify write permissions
    if not os.access(WORK_DIR, os.W_OK):
        raise RuntimeError(f"WORK_DIR is not writable: {WORK_DIR}")
    if not os.access(OUT_DIR, os.W_OK):
        raise RuntimeError(f"OUT_DIR is not writable: {OUT_DIR}")
    
    log_info("tango_dirs_ensured", f"Ensured runtime directories exist and are writable", **{
        "work_dir": WORK_DIR,
        "out_dir": OUT_DIR,
    })
```

**Also in `_start_new_run_dir()`** (line 75):
```python
run_dir = os.path.join(OUT_DIR, stamp)
os.makedirs(run_dir, exist_ok=True, mode=0o755)  # ✅ Add mode
```

---

## Silent Failure: Docker Volume Mount Fails

### Symptom

**Exact Symptom**: Docker runner fails with "No such file or directory" when trying to access TANGO binary or input files.

**Log Signature**:
```json
{"level": "ERROR", "event": "tango_docker_failed", "message": "Docker Tango execution failed", "error": "No such file or directory"}
```

**Root Cause**: Docker volume mount uses relative path, which resolves incorrectly when `cwd` is not the project root.

### Fix

**Location**: `backend/tango.py:run_tango_docker()` (line 653)

**Current Code**:
```python
docker_cmd = [
    "docker","run","--rm",
    "-v", f"{TANGO_DIR}:/app/Tango",  # ❌ Relative path
    # ...
]
```

**Enhancement**: Use absolute path:
```python
tango_dir_abs = os.path.abspath(TANGO_DIR)
docker_cmd = [
    "docker","run","--rm",
    "-v", f"{tango_dir_abs}:/app/Tango",  # ✅ Absolute path
    # ...
]
log_info("tango_docker_mount", f"Docker volume mount: {tango_dir_abs}:/app/Tango", **{
    "host_path": tango_dir_abs,
    "container_path": "/app/Tango",
})
```

---

## Silent Failure: Timeout Without Error

### Symptom

**Exact Symptom**: TANGO runner times out after 3600 seconds, but error is not surfaced to UI. Provider status shows `UNAVAILABLE`, but no timeout message.

**Log Signature**:
```json
{"level": "ERROR", "event": "tango_simple_failed", "message": "Simple runner timed out", "reason": "Timeout", "exit": null}
```

**Or in `run_meta.json`**:
```json
{
  "reason": "Timeout",
  "exception_type": "TimeoutExpired",
  "stderr_tail": "Execution timed out after 3600 seconds"
}
```

**Root Cause**: Timeout is caught and logged, but not surfaced to UI as actionable error.

### Fix

**Location**: `backend/tango.py:run_tango_simple()` (lines 470-500)

**Current Code**: Already writes `run_meta.json` with timeout reason.

**Enhancement**: Ensure timeout reason is read and surfaced:
```python
# In process_tango_output(), when ok_ctr == 0:
reason = _read_run_meta_reason(run_dir)
if reason == "Timeout":
    error_msg = (
        f"TANGO execution timed out after 3600 seconds. "
        f"Run directory: {run_dir}. "
        f"Consider reducing batch size or increasing timeout."
    )
    # Raise ValueError with timeout message
```

**Also**: Add configurable timeout:
```python
# In run_tango_simple():
timeout_seconds = int(os.getenv("TANGO_TIMEOUT_SECONDS", "3600"))
proc = subprocess.run(
    cmd,
    cwd=run_dir,
    capture_output=True,
    text=True,
    timeout=timeout_seconds  # ✅ Configurable
)
```

---

## Silent Failure: Parsing Empty Output Files

### Symptom

**Exact Symptom**: TANGO produces output files (`.txt`), but they are empty or contain only error messages. Parser returns `None`, but no error is logged.

**Log Signature**:
```json
{"level": "INFO", "event": "tango_parse_progress", "message": "Parsed 0 OK, N missing/failed", "ok_count": 0, "bad_count": N}
```

**Root Cause**: Parser (`__get_peptide_tango_result()`) returns `None` for empty files, but doesn't log why.

### Fix

**Location**: `backend/tango.py:__get_peptide_tango_result()` (lines 741-825)

**Enhancement**: Add logging for empty/unparseable files:
```python
def __get_peptide_tango_result(filepath: str) -> Optional[dict]:
    if not os.path.exists(filepath) or os.path.getsize(filepath) < 20:
        log_warning("tango_file_empty", f"TANGO output file is empty or missing: {filepath}", **{
            "filepath": filepath,
            "exists": os.path.exists(filepath),
            "size": os.path.getsize(filepath) if os.path.exists(filepath) else 0,
        })
        return None
    
    # ... existing parsing code ...
    
    # If parsing fails, log why
    if not result:
        log_warning("tango_file_unparseable", f"TANGO output file is unparseable: {filepath}", **{
            "filepath": filepath,
            "size": os.path.getsize(filepath),
        })
    
    return result
```

---

## Silent Failure: TANGO Binary Not in PATH

### Symptom

**Exact Symptom**: `TANGO_BIN` env var not set, and `backend/Tango/bin/tango` doesn't exist. Fallback to `which tango` fails, but error is not surfaced until execution.

**Log Signature**:
```json
{"level": "ERROR", "event": "tango_simple_failed", "message": "TANGO binary not found", "reason": "ENOENT", "path": "/absolute/path/to/tango"}
```

**Root Cause**: Binary resolution happens at script generation time, but existence check happens at execution time.

### Fix

**Location**: `backend/tango.py:run_tango_simple()` (lines 340-368)

**Current Code**: Already checks binary existence before execution.

**Enhancement**: Add pre-flight check in `_resolve_tango_bin()`:
```python
def _resolve_tango_bin() -> str:
    """Host macOS tango lives under Tango/bin/tango."""
    # Check TANGO_BIN env var first
    tango_bin_env = os.getenv("TANGO_BIN")
    if tango_bin_env and os.path.exists(tango_bin_env):
        return os.path.abspath(tango_bin_env)
    
    # Check default location
    tb = os.path.join(TANGO_DIR, "bin", "tango")
    if os.path.exists(tb):
        # ... existing quarantine removal code ...
        return os.path.abspath(tb)
    
    # Fallback to system PATH
    which_path = shutil.which("tango")
    if which_path:
        return os.path.abspath(which_path)
    
    # ✅ Fatal: raise error if not found
    raise RuntimeError(
        f"TANGO binary not found. Checked: "
        f"TANGO_BIN={tango_bin_env}, "
        f"default={tb}, "
        f"PATH={which_path}"
    )
```

---

## Summary: All Silent Failures

| Failure Mode | Symptom | Log Signature | Fix Location | Status |
|--------------|---------|---------------|--------------|--------|
| Path mis-resolution | 0 outputs, wrong path in script | `tango_simple_failed`, `NonZeroExit` | `_write_simple_bat()` | ✅ Fixed (uses absolute) |
| 0 outputs for N inputs | Empty results, no error | `tango_parse_complete`, `ok_count: 0` | `process_tango_output()` | ❌ Needs fix |
| macOS quarantine | Binary exists but not executable | `tango_simple_failed`, `EACCES` | `run_tango_simple()` | ✅ Fixed (removes quarantine) |
| File permissions | Permission denied on write | `tango_simple_failed`, `Permission denied` | `_ensure_dirs()` | ⚠️ Needs enhancement |
| Docker volume mount | No such file or directory | `tango_docker_failed` | `run_tango_docker()` | ❌ Needs fix |
| Timeout | Timeout after 3600s, no error | `tango_simple_failed`, `Timeout` | `run_tango_simple()` | ⚠️ Needs enhancement |
| Empty output files | Parser returns None, no log | `tango_parse_progress`, `bad_count: N` | `__get_peptide_tango_result()` | ⚠️ Needs enhancement |
| Binary not in PATH | Binary not found | `tango_simple_failed`, `ENOENT` | `_resolve_tango_bin()` | ⚠️ Needs enhancement |

---

## Recommended Fixes (Priority Order)

1. **CRITICAL**: Add fatal check for 0 outputs when K>0 inputs (see above)
2. **HIGH**: Fix Docker volume mount to use absolute path
3. **MEDIUM**: Add logging for empty/unparseable output files
4. **MEDIUM**: Add permission checks for runtime directories
5. **LOW**: Add configurable timeout
6. **LOW**: Enhance binary resolution with better error messages

