# Observability

List of log events (names, levels), and structured logging guards.

## Log Event Catalog

### Request Lifecycle

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `request_start` | INFO | HTTP request received | `method`, `path` |
| `request_end` | INFO | HTTP request completed | `method`, `path`, `status_code` |
| `request_error` | ERROR | HTTP request failed | `method`, `path`, `error` |
| `boot` | INFO | Server startup | None |

### Upload/UniProt Processing

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `upload_parse_start` | INFO | File parsing started | None |
| `upload_parse_complete` | INFO | File parsing completed | `row_count` |
| `upload_parse_failed` | ERROR | File parsing failed | `error` |
| `normalize_start` | INFO | Column normalization started | None |
| `normalize_complete` | INFO | Column normalization completed | `column_count` |
| `ff_helix_compute_start` | INFO | FF-Helix computation started | None |
| `ff_helix_complete` | INFO | FF-Helix computation completed | None |
| `uniprot_execute_start` | INFO | UniProt query execution started | `query`, `reviewed`, `length_min`, `length_max`, `sort`, `size` |
| `uniprot_url` | INFO | UniProt API URL built | `url` |
| `uniprot_fetch_success` | INFO | UniProt query succeeded | `row_count`, `columns` |
| `uniprot_no_results` | WARNING | UniProt query returned 0 rows | `query`, `url` |
| `uniprot_analysis_start` | INFO | Analysis pipeline started | None |
| `uniprot_normalize_complete` | INFO | UniProt normalization completed | `column_count` |
| `uniprot_ff_helix_start` | INFO | FF-Helix computation started (UniProt) | None |
| `uniprot_ff_helix_complete` | INFO | FF-Helix computation completed (UniProt) | None |
| `uniprot_biochem_start` | INFO | Biochemical calculations started (UniProt) | None |
| `uniprot_biochem_complete` | INFO | Biochemical calculations completed (UniProt) | None |
| `uniprot_normalize_ui_start` | INFO | UI normalization started (UniProt) | None |
| `uniprot_normalize_ui_complete` | INFO | UI normalization completed (UniProt) | `row_count` |
| `uniprot_analysis_complete` | INFO | UniProt analysis completed | `total_rows`, `jpred_hits`, `ssw_hits`, `ssw_positive_percent`, `ssw_positives`, `ff_helix_available`, `tango_ran`, `psipred_ran` |
| `upload_complete` | INFO | Upload processing completed | `total_rows`, `jpred_hits`, `ssw_hits`, `ssw_positive_percent`, `ssw_positives`, `ff_helix_available` |
| `normalize_ui_start` | INFO | UI normalization started | None |
| `normalize_ui_complete` | INFO | UI normalization completed | `row_count` |

### TANGO Processing

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `tango_run_start` | INFO | TANGO execution started | `sequence_count` |
| `tango_run_complete` | INFO | TANGO execution completed | `run_dir` |
| `tango_skip` | INFO | TANGO skipped (no records) | None |
| `tango_parse_start` | INFO | TANGO output parsing started | `run_dir` |
| `tango_parse_complete` | INFO | TANGO output parsing completed | `ok_count`, `bad_count`, `total_entries` |
| `tango_parse_progress` | INFO | TANGO parsing progress | `ok_count`, `bad_count`, `total_entries` |
| `tango_parse_failed` | ERROR | TANGO parsing failed | `error`, `entry` |
| `tango_filter_start` | INFO | SSW prediction computation started | None |
| `tango_filter_complete` | INFO | SSW prediction computation completed | None |
| `tango_filter_failed` | ERROR | SSW prediction computation failed | `error`, `entry` |
| `tango_stats` | INFO | TANGO provider status | `status`, `reason`, `parsed_ok`, `parsed_bad`, `requested` |
| `tango_disabled` | INFO | TANGO disabled by environment | None |
| `tango_error` | WARNING | TANGO error (continuing) | `error` |
| `tango_simple_prepare` | INFO | Simple runner preparation | `run_dir`, `sequence_count` |
| `tango_simple_complete` | INFO | Simple runner completed | `succeeded`, `failed`, `run_dir` |
| `tango_simple_failed` | ERROR | Simple runner failed | `traceId`, `reason`, `exit`, `path` |
| `tango_simple_skip` | WARNING | Simple runner skipped (no records) | None |
| `tango_quarantine_removed` | INFO | macOS quarantine removed | `path` |
| `tango_quarantine_remove_failed` | WARNING | Failed to remove quarantine | `error` |
| `tango_dirs_ensured` | INFO | Runtime directories ensured | `work_dir`, `out_dir` |
| `tango_script_generated` | INFO | Runner script generated | `script_path`, `bin_path`, `bin_exists` |
| `tango_bin_missing` | ERROR | TANGO binary not found | `resolved_path`, `tango_dir` |
| `tango_zero_outputs_fatal` | ERROR | TANGO produced 0 outputs for N inputs | `requested`, `parsed_ok`, `run_dir`, `reason` |
| `tango_zero_outputs_ui` | ERROR | TANGO zero outputs error (UI) | `error` |
| `tango_file_empty` | WARNING | TANGO output file is empty | `filepath`, `exists`, `size` |
| `tango_file_unparseable` | WARNING | TANGO output file is unparseable | `filepath`, `size` |
| `tango_parse_entry` | INFO | Parsing TANGO output for specific entry | `entry`, `raw_keys`, `beta_prediction_len`, `helix_prediction_len`, `analysed_keys`, `helix_percentage`, `beta_percentage`, `ssw_avg_score`, `helix_beta_diff` |
| `tango_parse_batch_complete` | INFO | TANGO batch parsing completed | `ok_count`, `bad_count`, `total_entries` |
| `tango_meta_write_failed` | WARNING | Failed to write run_meta.json | `error` |
| `tango_docker_mount` | INFO | Docker volume mount configured | `host_path`, `container_path` |

### PSIPRED Processing

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `psipred_skip` | INFO | PSIPRED skipped | `reason` |
| `psipred_prepare` | INFO | PSIPRED input preparation | None |
| `psipred_run` | INFO | PSIPRED execution started | `sequence_count` |
| `psipred_run_complete` | INFO | PSIPRED execution completed | `run_dir` |
| `psipred_parse` | INFO | PSIPRED output parsing started | None |
| `psipred_complete` | INFO | PSIPRED processing completed | None |
| `psipred_error` | WARNING | PSIPRED error (continuing) | `error` |
| `uniprot_psipred_limit` | INFO | PSIPRED limited to N sequences | `requested`, `limited` |
| `uniprot_secondary_structure_start` | INFO | Secondary structure processing started (UniProt) | `sequence_count` |
| `uniprot_secondary_structure_complete` | INFO | Secondary structure processing completed (UniProt) | None |
| `uniprot_secondary_structure_error` | WARNING | Secondary structure error (UniProt) | `error` |
| `secondary_structure_start` | INFO | Secondary structure processing started | None |
| `secondary_structure_complete` | INFO | Secondary structure processing completed | None |
| `secondary_structure_error` | WARNING | Secondary structure error | `error` |
| `secondary_structure_skip` | INFO | Secondary structure provider not configured | None |

### Biochemical Calculations

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `biochem_compute_start` | INFO | Biochemical calculations started | None |
| `biochem_complete` | INFO | Biochemical calculations completed | None |

### Normalization

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `csv_normalize_sample` | INFO | CSV normalization sample row | `entry`, `ffHelixPercent_raw`, `ffHelixPercent_type`, `ffHelixPercent_is_na`, `all_ff_keys` |
| `csv_normalize_after` | INFO | After PeptideSchema normalization (sample) | `entry`, `ffHelixPercent`, `ffHelixPercent_type`, `ffHelixPercent_is_na`, `all_ff_keys_camel` |
| `normalize_before` | INFO | Before PeptideSchema normalization | `entry`, `ssw_keys` |
| `normalize_after` | INFO | After PeptideSchema normalization | `entry`, `ssw_keys` |
| `normalize_row_failed` | WARNING | Row normalization failed | `entry`, `error` |

### Debug Tracing

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `upload_trace_entry` | INFO | Tracing specific entry | `entry` |
| `trace_dataframe_merge` | INFO | DataFrame merge for traced entry | `entry`, `index`, `sequence_length` |
| `trace_field` | INFO | Field value for traced entry | `entry`, `field`, `value`, `type` |
| `trace_entry_not_found` | WARNING | Traced entry not found | `entry` |
| `trace_after_finalize` | INFO | After finalize for traced entry | `entry` |
| `trace_api_response` | INFO | API response for traced entry | `entry`, `ssw_keys` |

### UniProt Query Parsing

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `uniprot_sort_received` | INFO | Sort parameter received | `received_sort`, `sort_type` |
| `uniprot_invalid_sort` | WARNING | Invalid sort value received | `received_sort`, `allowed` |
| `uniprot_sort_valid` | INFO | Sort parameter validated | `sort` |
| `uniprot_sort_omitted` | INFO | Sort parameter omitted (default) | None |
| `uniprot_fallback_url` | INFO | Minimal fallback URL built | `url` |
| `uniprot_fallback_success` | INFO | Minimal fallback succeeded | `result_count` |
| `uniprot_fallback_failed` | ERROR | Minimal fallback failed | `fallback_error` |
| `uniprot_fallback_analysis_error` | WARNING | Error analyzing fallback results | `error` |
| `uniprot_400_error` | WARNING | UniProt API returned 400 | `status_code`, `original_url` |
| `uniprot_api_error` | ERROR | UniProt API server error | `status_code` |
| `uniprot_client_error` | WARNING | UniProt API client error | `status_code` |
| `uniprot_timeout` | ERROR | UniProt API request timed out | None |
| `uniprot_error` | ERROR | UniProt API error | `error` |

### SSW (Secondary Structure Switch) Processing

| Event Name | Level | Description | Fields |
|------------|-------|-------------|--------|
| `ssw_diff_no_valid` | WARNING | No valid SSW diff values | `strategy`, `fallback` |
| `ssw_diff_unknown_strategy` | WARNING | Unknown threshold strategy | `strategy` |

---

## Structured Logging Guards

### Guard 1: Runner Selection

**Location**: `backend/tango.py:run_tango_simple()`

**Current**: No logging for runner selection.

**Add**:
```python
def run_tango_simple(records: Optional[List[Tuple[str, str]]]) -> str:
    # ...
    log_info("tango_runner_selected", "Simple runner selected", **{
        "runner": "simple",
        "sequence_count": len(records) if records else 0,
        "tango_mode": os.getenv("TANGO_MODE", "simple"),
        "tango_simple": os.getenv("TANGO_SIMPLE", "1"),
    })
```

---

### Guard 2: Resolved Paths

**Location**: `backend/tango.py:run_tango_simple()`

**Current**: Paths logged in error cases only.

**Add**:
```python
# Before execution, log resolved paths
bin_path_abs = os.path.abspath(bin_path)
run_dir_abs = os.path.abspath(run_dir)
script_path_abs = os.path.abspath(script_path)

log_info("tango_paths_resolved", "TANGO paths resolved", **{
    "bin_path": bin_path_abs,
    "bin_exists": os.path.exists(bin_path_abs),
    "bin_executable": os.access(bin_path_abs, os.X_OK) if os.path.exists(bin_path_abs) else False,
    "run_dir": run_dir_abs,
    "script_path": script_path_abs,
    "work_dir": os.path.abspath(WORK_DIR),
    "out_dir": os.path.abspath(OUT_DIR),
})
```

---

### Guard 3: Counts of Produced *.txt Files

**Location**: `backend/tango.py:run_tango_simple()`

**Current**: Count logged after execution, but not before parsing.

**Add**:
```python
# After execution, before parsing
count_txt = len([f for f in os.listdir(run_dir) if f.lower().endswith(".txt")])
log_info("tango_outputs_counted", f"TANGO outputs counted: {count_txt} files", **{
    "count": count_txt,
    "expected": len(records) if records else 0,
    "run_dir": run_dir,
    "files": [f for f in os.listdir(run_dir) if f.lower().endswith(".txt")][:10],  # First 10
})
```

**Also in `process_tango_output()`**:
```python
# After parsing, log counts
log_info("tango_parse_counts", "TANGO parse counts", **{
    "parsed_ok": ok_ctr,
    "parsed_bad": bad_ctr,
    "requested": len(entry_set),
    "output_files_count": len([f for f in os.listdir(run_dir) if f.lower().endswith(".txt")]) if run_dir and os.path.isdir(run_dir) else 0,
})
```

---

### Guard 4: Non-Zero Exit Codes

**Location**: `backend/tango.py:run_tango_simple()`

**Current**: Exit code logged in error cases.

**Add**:
```python
# Always log exit code, even on success
log_info("tango_execution_complete", f"TANGO execution completed with exit code {exit_code}", **{
    "exit_code": exit_code,
    "run_dir": run_dir,
    "sequence_count": len(records) if records else 0,
    "output_files": len([f for f in os.listdir(run_dir) if f.lower().endswith(".txt")]) if exit_code == 0 else 0,
})
```

---

### Guard 5: Hard Guard for 0 Outputs

**Location**: `backend/tango.py:process_tango_output()`

**Current**: No fatal check.

**Add** (see `FAILURE_MODES.md` for full implementation):
```python
# After parsing, if zero outputs for N inputs, raise error
if ok_ctr == 0 and requested > 0:
    reason = _read_run_meta_reason(run_dir)
    error_msg = (
        f"TANGO produced 0 outputs for {requested} inputs. "
        f"Run directory: {run_dir}. "
        f"Reason: {reason or 'Unknown'}. "
        f"Check run_meta.json for diagnostics."
    )
    log_error("tango_zero_outputs_fatal", error_msg, **{
        "requested": requested,
        "parsed_ok": ok_ctr,
        "run_dir": run_dir,
        "reason": reason,
    })
    raise ValueError(error_msg)
```

---

## Log Format

**Format**: JSON (single-line, compact)

**Example**:
```json
{"timestamp": "2024-01-13T18:30:15.123Z", "level": "INFO", "event": "tango_run_start", "message": "Running TANGO for 10 sequences", "traceId": "a1b2c3d4", "sequence_count": 10}
```

**Fields**:
- `timestamp`: ISO 8601 UTC timestamp
- `level`: `DEBUG`, `INFO`, `WARNING`, `ERROR`
- `event`: Event name (e.g., `tango_run_start`)
- `message`: Human-readable message
- `traceId`: Request trace ID (8 characters)
- `entry`: Entry ID (for peptide-specific tracing)
- Additional fields: Event-specific (e.g., `sequence_count`, `run_dir`)

---

## Log Levels

- **DEBUG**: Detailed diagnostic information (not used in production)
- **INFO**: General informational messages (default)
- **WARNING**: Warning messages (non-fatal issues)
- **ERROR**: Error messages (fatal issues, but execution continues)

---

## Trace ID

**Generation**: Per-request UUID (8 characters) or from `X-Trace-Id` header

**Usage**: All logs within a request share the same `traceId`

**Example**:
```json
{"level": "INFO", "event": "request_start", "traceId": "a1b2c3d4", "method": "POST", "path": "/api/upload-csv"}
{"level": "INFO", "event": "tango_run_start", "traceId": "a1b2c3d4", "sequence_count": 10}
{"level": "INFO", "event": "request_end", "traceId": "a1b2c3d4", "status_code": 200}
```

---

## Entry-Specific Tracing

**Enabled**: When `DEBUG_ENTRY` environment variable is set

**Usage**: Logs all operations for a specific Entry ID

**Example**:
```json
{"level": "INFO", "event": "upload_trace_entry", "traceId": "a1b2c3d4", "entry": "P12345", "message": "Tracing entry: P12345"}
{"level": "INFO", "event": "tango_parse_entry", "traceId": "a1b2c3d4", "entry": "P12345", "raw_keys": ["Beta prediction", "Helix prediction"], "beta_prediction_len": 50}
```

---

## Recommended Logging Additions

1. **Runner Selection**: Log which runner is selected and why
2. **Path Resolution**: Log all resolved paths (binary, run_dir, script)
3. **Output Counts**: Log counts of produced files before and after parsing
4. **Exit Codes**: Always log exit codes, even on success
5. **Hard Guard**: Fatal error when 0 outputs for N inputs (see `FAILURE_MODES.md`)

See implementation details in `FAILURE_MODES.md`.

