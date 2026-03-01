# Backend — Claude Instructions

## Stack
FastAPI + Pydantic v2 + pandas. Python 3.11+. Venv at `.venv/`.

## Service Layer Pattern
- Services modify DataFrames **in-place** (return `None`) or return `Dict[str, Any]`
- Services handle errors gracefully: `log_warning(event_key, msg, **meta)` — never raise to caller
- Routes handle validation: catch errors and raise `HTTPException(status_code, detail=str(e))`
- TANGO/S4PRED tools are called from services, never from routes

## DataFrame Conventions
- Column names use **spaces**: `"SSW prediction"`, `"Full length uH"`, `"FF-Helix %"`
- Null = `None` only. Never `-1`, `"N/A"`, empty string as sentinel
- Exception: Flag columns use `-1` (not candidate), `1` (candidate), `None` (no data)
- Access rows with `df.iloc[0]["Column Name"]` or `df.at[idx, "Column Name"]`

## Config
Always use `from config import settings` — never raw `os.getenv()` in services.
```python
from config import settings
if settings.USE_TANGO:
    ...
```

## Type Hints
- Always explicit: `def fn(df: pd.DataFrame, config: Optional[Dict[str, Any]]) -> None:`
- Use `Optional[T]` not `T | None`
- Always parameterize generics: `Dict[str, Any]`, `List[str]`, `Tuple[int, str]`

## Imports
Order: stdlib → third-party → local. Absolute paths for packages.
```python
import os
from typing import Optional, Dict, Any

import pandas as pd
from fastapi import HTTPException

from config import settings
from services.logger import log_info, log_warning
```

## Logging
Structured logging with event keys:
```python
log_info("tango_complete", f"Processed {n} sequences", run_time_ms=elapsed)
log_warning("s4pred_skip", "S4PRED disabled", reason="USE_S4PRED=0")
log_error("upload_failed", f"Parse error: {e}", stage="parse")
```

## Normalization Pipeline
`normalize.py` transforms raw DataFrame → API-ready dict. Three-tier header matching:
exact match → synonym list → regex substring. Raises HTTPException for ambiguous matches.

## Protected Files
- `schemas/api_models.py` — NEVER modify without explicit approval
- `api/routes/*.py` — endpoint signatures are public API

## Test Pattern
```python
os.environ.setdefault("USE_TANGO", "0")  # Before app import
os.environ.setdefault("USE_S4PRED", "0")
from api.main import app
client = TestClient(app)
# Constants at module level, assert contract keys
```

## Quick Reference
```bash
cd backend
USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ -v --tb=short
make smoke-tango         # Verify TANGO binary
make contract-check      # API contract sync
```
