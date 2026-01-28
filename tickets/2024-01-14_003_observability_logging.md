# Ticket 003: Enhanced Observability

**Date**: 2024-01-14  
**Phase**: 1.3  
**Priority**: Medium  
**Status**: Open

## Background

Current logging is minimal (`print()` statements). We need structured JSON logs for:
- Runner selection (which runner was chosen and why)
- Path resolution (absolute paths used)
- Output counts (how many outputs produced vs requested)
- Fatal errors (0 outputs for N inputs)

This ticket adds structured logging throughout the pipeline.

## Goal

Add structured JSON logging for:
1. Runner selection (TANGO/PSIPRED: simple/host/docker)
2. Path resolution (absolute paths)
3. Output counts (produced vs requested)
4. Fatal errors (0 outputs for N inputs)

## Exact Edits

### Backend: Structured Logging Helper

**File**: `backend/services/logging.py` (new)

```python
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',  # JSON format
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger(__name__)

def log_structured(
    level: str,
    event: str,
    message: str,
    **kwargs: Any
) -> None:
    """
    Emit structured JSON log.
    
    Args:
        level: Log level (INFO, WARNING, ERROR)
        event: Event name (e.g., "tango_runner_selected")
        message: Human-readable message
        **kwargs: Additional fields
    """
    log_entry: Dict[str, Any] = {
        "timestamp": datetime.utcnow().isoformat(),
        "level": level,
        "event": event,
        "message": message,
        **kwargs
    }
    
    log_msg = json.dumps(log_entry)
    
    if level == "ERROR":
        logger.error(log_msg)
    elif level == "WARNING":
        logger.warning(log_msg)
    else:
        logger.info(log_msg)

def log_info(event: str, message: str, **kwargs: Any) -> None:
    """Log info-level event."""
    log_structured("INFO", event, message, **kwargs)

def log_warning(event: str, message: str, **kwargs: Any) -> None:
    """Log warning-level event."""
    log_structured("WARNING", event, message, **kwargs)

def log_error(event: str, message: str, **kwargs: Any) -> None:
    """Log error-level event."""
    log_structured("ERROR", event, message, **kwargs)
```

### Backend: TANGO Runner Selection Logging

**File**: `backend/tango.py`

**Add logging in `run_tango_simple`** (after runner selection, around line 302):

```python
from services.logging import log_info, log_warning, log_error

# In run_tango_simple(), after determining runner type:
if use_simple:
    log_info(
        "tango_runner_selected",
        "TANGO runner: simple (host binary)",
        runner="simple",
        reason="TANGO_SIMPLE=1",
        tango_binary_path=os.path.abspath(tango_binary)
    )
elif use_docker:
    log_info(
        "tango_runner_selected",
        "TANGO runner: docker",
        runner="docker",
        reason="TANGO_SIMPLE=0 and Docker available",
        docker_image="desy-tango"
    )
else:
    log_warning(
        "tango_runner_selected",
        "TANGO runner: fallback (no binary, no Docker)",
        runner="none",
        reason="TANGO_SIMPLE=0 and Docker unavailable"
    )
```

**Add logging in `_resolve_tango_binary`** (after path resolution, around line 319):

```python
# In _resolve_tango_binary(), after resolving path:
resolved_path = os.path.abspath(tango_binary)
log_info(
    "tango_path_resolved",
    f"TANGO binary path resolved: {resolved_path}",
    original_path=tango_binary,
    resolved_path=resolved_path,
    exists=os.path.exists(resolved_path)
)
```

**Add logging in `process_tango_output`** (after counting outputs, around line 1032):

```python
# In process_tango_output(), after counting outputs:
log_info(
    "tango_outputs_produced",
    f"TANGO produced {ok_ctr} outputs for {len(entry_set)} inputs",
    produced=ok_ctr,
    requested=len(entry_set),
    run_dir=run_dir
)

# In fatal check (already exists, but add logging):
if ok_ctr == 0 and len(entry_set) > 0:
    reason = _read_run_meta_reason(run_dir)
    log_error(
        "tango_fatal_zero_outputs",
        f"TANGO produced 0 outputs for {len(entry_set)} inputs",
        run_dir=run_dir,
        requested=len(entry_set),
        produced=0,
        reason=reason or "Unknown error"
    )
    # ... existing ValueError raise ...
```

### Backend: PSIPRED Logging

**File**: `backend/psipred.py`

**Add logging in `run_psipred`** (after runner selection):

```python
from services.logging import log_info, log_warning, log_error

# In run_psipred(), after determining runner:
if use_docker:
    log_info(
        "psipred_runner_selected",
        "PSIPRED runner: docker",
        runner="docker",
        docker_image="desy-psipred"
    )
else:
    log_warning(
        "psipred_runner_selected",
        "PSIPRED runner: skipped (Docker unavailable)",
        runner="none",
        reason="Docker unavailable or USE_PSIPRED=0"
    )
```

**Add logging after output parsing**:

```python
# After parsing outputs:
log_info(
    "psipred_outputs_produced",
    f"PSIPRED produced {len(parsed_results)} outputs for {len(records)} inputs",
    produced=len(parsed_results),
    requested=len(records),
    run_dir=run_dir
)
```

### Backend: Server Endpoint Logging

**File**: `backend/server.py`

**Add logging in upload/predict endpoints**:

```python
from services.logging import log_info, log_error

# In upload_csv(), after processing:
log_info(
    "upload_complete",
    f"Upload processed {len(df)} peptides",
    peptide_count=len(df),
    tango_status=tango_provider_status,
    psipred_status=psipred_provider_status
)

# In execute_uniprot_query(), after processing:
log_info(
    "uniprot_query_complete",
    f"UniProt query processed {len(df)} peptides",
    query=query,
    peptide_count=len(df),
    tango_status=provider_status_meta["tango"]["status"],
    psipred_status=provider_status_meta["psipred"]["status"]
)
```

## Test Steps

1. **Runner selection logging**:
   ```bash
   # Set TANGO_SIMPLE=1
   export TANGO_SIMPLE=1
   # Upload CSV
   curl -X POST http://localhost:8000/api/upload-csv -F "file=@test.csv"
   # Check logs for: {"event": "tango_runner_selected", "runner": "simple", ...}
   ```

2. **Path resolution logging**:
   ```bash
   # Upload CSV
   # Check logs for: {"event": "tango_path_resolved", "resolved_path": "/abs/path/...", ...}
   ```

3. **Output counts logging**:
   ```bash
   # Upload CSV
   # Check logs for: {"event": "tango_outputs_produced", "produced": 50, "requested": 50, ...}
   ```

4. **Fatal error logging**:
   ```bash
   # Set invalid TANGO path
   export TANGO_BINARY_PATH=/invalid/path
   # Upload CSV
   # Check logs for: {"event": "tango_fatal_zero_outputs", "produced": 0, "requested": 50, ...}
   ```

## Acceptance Criteria

- ✅ Upload CSV → logs show `{"event": "tango_runner_selected", "runner": "simple", ...}`
- ✅ Upload CSV → logs show `{"event": "tango_path_resolved", "resolved_path": "/abs/path/...", ...}`
- ✅ Upload CSV → logs show `{"event": "tango_outputs_produced", "produced": 50, "requested": 50, ...}`
- ✅ TANGO fails → logs show `{"event": "tango_fatal_zero_outputs", "produced": 0, "requested": 50, ...}`

## Demo Steps

1. Start backend with `--log-level=INFO`
2. Upload CSV → show structured JSON logs in console
3. Filter logs by `event` → show runner selection, path resolution, output counts

## Related Tickets

- Ticket 001: UniProt Pipeline (logs windowing events)
- Ticket 002: Provider Status Visibility (logs provider status changes)

