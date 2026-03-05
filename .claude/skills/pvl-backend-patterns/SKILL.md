---
name: pvl-backend-patterns
description: Python backend patterns for PVL. Use when working on any backend Python file, service, route, or backend test. Covers FastAPI patterns, DataFrame conventions, error handling, and service layer structure.
user-invocable: false
---

# PVL Backend Patterns

## Service Layer
- Services modify DataFrames **in-place** (return `None`) or return `Dict[str, Any]`
- Services log errors with `log_warning(event_key, msg, **meta)` — never raise exceptions
- Routes catch errors and raise `HTTPException(status_code, detail=str(e))`
- TANGO/S4PRED tools called from services, never from routes

## DataFrame Column Names — SPACES, not underscores
```
"SSW prediction"       "SSW score"         "SSW diff"
"Full length uH"       "FF-Helix %"        "FF Helix fragments"
"Helix prediction (S4PRED)"                "Helix fragments (S4PRED)"
"Entry"                "Sequence"           "Length"
"Charge"               "Hydrophobicity"
```

## Null Semantics (CRITICAL)
- Always `None` (JSON `null`). Never `-1`, `"N/A"`, or `""` as sentinel
- Exception: Flag columns use `-1` (not candidate), `1` (candidate), `None` (no data)
- Valid -1 fields: `sswPrediction`, `s4predSswPrediction`, `s4predHelixPrediction`, `ffHelixFlag`, `ffSswFlag`

## Config Access
Always `from config import settings` — never raw `os.getenv()`:
```python
from config import settings
if settings.USE_TANGO:
    ...
```

## Type Hints
- Always explicit return types: `def fn(df: pd.DataFrame) -> None:`
- `Optional[T]` not `T | None`
- Always parameterize: `Dict[str, Any]`, `List[str]`, not bare `Dict`, `List`

## Import Order
```python
import os                              # 1. stdlib
from typing import Optional, Dict, Any

import pandas as pd                    # 2. third-party
from fastapi import HTTPException

from config import settings            # 3. local
from services.logger import log_info, log_warning
```

## Logging Pattern
```python
log_info("event_key", f"message", metric=value)
log_warning("event_key", f"message", reason="why")
log_error("event_key", f"message", stage="where")
```

## Route Pattern
```python
@router.post("/api/endpoint", response_model=ResponseSchema)
async def endpoint(
    param: str = Form(...),
    optional: Optional[str] = Form(None),
):
    # 1. Validate input
    # 2. Call service
    # 3. Return (response_model auto-validates)
```

## Protected Files — DO NOT EDIT without approval
- `schemas/api_models.py` — API contract (hook will block edits)
- `api/routes/*.py` — endpoint signatures

## Test Pattern
```python
os.environ.setdefault("USE_TANGO", "0")   # Before app import
os.environ.setdefault("USE_S4PRED", "0")
from api.main import app
client = TestClient(app)
```

## Normalization — 3-tier header matching
`normalize.py` header canonicalization: exact match → synonym list → regex substring.
Raises `HTTPException` for ambiguous matches.

## Pydantic v2 Patterns
- `Field(...)` = required, `Field(None, ...)` = optional
- `@model_validator(mode='before')` for preprocessing
- Return `model.model_dump(exclude_none=True)` to serialize
