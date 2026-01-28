# Continuation Plan: Concrete PRs

## 🎯 PR Strategy

**Short-term (1–2 days)**: Lock down types→store→mappers contract, surface provider status, fix N/A handling, remove dead code, ensure per-run temp dirs, add structured logs.

**Medium-term (1 week)**: Postgres schema, Docker toggle, background queue stub.

## 📦 PR 1: Types → Store → Mappers Contract Lock + Provider Status

**Goal**: Fix mapper to include `providerStatus`, ensure type consistency.

**Files Changed**:
- `ui/src/lib/mappers.ts`
- `ui/src/types/peptide.ts` (verify)

**Diffs**:

```typescript
// ui/src/lib/mappers.ts

export function mapBackendRowToPeptide(row: Record<string, any>): Peptide {
  // ... existing code ...
  
  const peptide: Peptide = {
    id: idStr,
    name: getAny(row, ["name", "Protein name", "Name"]),
    species: getAny(row, ["species", "Organism", "Species", "organism"]),
    sequence: seq,
    length: typeof length === "number" && !Number.isNaN(length) ? length : 0,

    hydrophobicity,
    charge,
    muH,

    // FF
    ffHelixPercent,
    ffHelixFragments,

    // SSW (Secondary Structure Switch)
    sswPrediction,
    chameleonPrediction: sswPrediction, // Backward compatibility alias
    sswScore,
    sswDiff,
    sswHelixPct,
    sswBetaPct,

    // Providers
    jpred,
    tango,
    psipred,

    // ADD: Provider status (from backend)
    providerStatus: row.providerStatus || row.provider_status || undefined,
  };

  return peptide;
}
```

**Test**: Verify `providerStatus` appears in mapped peptides.

---

## 📦 PR 2: Remove Dead Code + Consolidate API Functions

**Goal**: Remove unused components and duplicate functions.

**Files Changed**:
- `ui/src/pages/Results.tsx` (remove CorrelationCard import)
- `ui/src/components/CorrelationCard.tsx` (delete)
- `ui/src/components/EvidencePanel.tsx` (delete)
- `ui/src/components/PositionBars.tsx` (delete or document)
- `ui/src/lib/api.ts` (remove `callPredict()` and `normalizeRow()`)

**Diffs**:

```typescript
// ui/src/pages/Results.tsx
// REMOVE: import { CorrelationCard } from '@/components/CorrelationCard';

// ui/src/lib/api.ts
// REMOVE: export async function callPredict(...)
// REMOVE: export function normalizeRow(...)
```

**Test**: Verify app still compiles and runs.

---

## 📦 PR 3: Per-Run Temp Dir Audit + Fixes

**Goal**: Ensure all runners use per-run temp dirs, no global path collisions.

**Files Changed**:
- `backend/tango.py` (verify `_start_new_run_dir()` usage)
- `backend/Tango/Tango_run.sh` (audit for per-run dir compliance)
- `backend/Tango/Tango_run.bat` (verify or remove if macOS-only)

**Diffs**:

```bash
# backend/Tango/Tango_run.sh
# AUDIT: Ensure script uses relative paths within run dir
# If hardcoded paths exist, update to use $OUT_DIR variable
```

**Test**: Run TANGO multiple times, verify outputs go to separate `run_*/` dirs.

---

## 📦 PR 4: Result KPIs Guards + Export N/A Handling

**Goal**: Show "N/A" instead of empty strings, guard against undefined values.

**Files Changed**:
- `ui/src/pages/Results.tsx` (export CSV function)
- `ui/src/components/ResultsKpis.tsx` (verify guards)

**Diffs**:

```typescript
// ui/src/pages/Results.tsx
function exportShortlistCSV() {
  // ... existing code ...
  const rows = shortlist.map((p) =>
    cols.map((c) => {
      const val = (p as any)[c];
      if (val === undefined || val === null) return 'N/A'; // CHANGED: was ''
      if (c === 'sswPrediction' || c === 'chameleonPrediction') {
        return val === 1 ? 'Positive' : val === -1 ? 'N/A' : 'Negative';
      }
      return val;
    })
  );
  // ... rest of function ...
}
```

**Test**: Export CSV with missing values, verify "N/A" appears.

---

## 📦 PR 5: Structured Logging

**Goal**: Replace `print()` with structured JSON logs.

**Files Changed**:
- `backend/server.py`
- `backend/tango.py`
- `backend/psipred.py`
- `backend/services/normalize.py`

**Diffs**:

```python
# backend/server.py
import logging
import json
from datetime import datetime

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',  # JSON format
    handlers=[logging.StreamHandler()]
)

def log_structured(level: str, message: str, **kwargs):
    """Emit structured JSON log."""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "level": level,
        "message": message,
        **kwargs
    }
    logging.info(json.dumps(log_entry))

# Replace print() calls:
# OLD: print(f"[TANGO] rows={len(df)}")
# NEW: log_structured("INFO", "TANGO processing complete", rows=len(df), provider="tango")
```

**Test**: Run upload, verify structured JSON logs in console.

---

## 📦 PR 6: DataFrame Fake Defaults → pd.NA

**Goal**: Use `pd.NA` instead of `-1`/`0`/`"-"` at DataFrame level.

**Files Changed**:
- `backend/tango.py` (replace `-1` with `pd.NA`)
- `backend/psipred.py` (replace `0.0` with `pd.NA`)
- `backend/server.py:ensure_cols()` (replace `-1` with `pd.NA`)

**Diffs**:

```python
# backend/tango.py
# OLD: df["SSW score"] = pd.Series([-1] * n, index=df.index)
# NEW: df["SSW score"] = pd.Series([pd.NA] * n, index=df.index, dtype="Float64")

# backend/psipred.py
# OLD: database["Psipred helix %"] = pd.Series([0.0] * n, index=database.index)
# NEW: database["Psipred helix %"] = pd.Series([pd.NA] * n, index=database.index, dtype="Float64")

# backend/server.py
def ensure_cols(df: pd.DataFrame):
    """Ensure all required columns exist with pd.NA defaults."""
    required_cols = [
        "Charge", "Hydrophobicity", "Full length uH", "Helix (Jpred) uH",
        "Beta full length uH", "SSW prediction", "SSW score", "SSW diff",
        "SSW helix percentage", "SSW beta percentage",
        "FF-Secondary structure switch", "FF-Helix (Jpred)"
    ]
    
    for col in required_cols:
        if col not in df.columns:
            if col == "Helix fragments (Jpred)":
                df[col] = pd.Series([[] for _ in range(len(df))], dtype=object)
            else:
                # CHANGED: Use pd.NA instead of -1
                df[col] = pd.Series([pd.NA] * len(df), index=df.index, dtype="Float64")
```

**Test**: Run upload, verify DataFrame has `pd.NA` instead of `-1`, normalization converts to `null`.

---

## 📦 PR 7: Magic Thresholds → Env Vars

**Goal**: Move hardcoded thresholds to env vars.

**Files Changed**:
- `backend/auxiliary.py`
- `backend/psipred.py`
- `backend/tango.py`
- `.env.example` (new)

**Diffs**:

```python
# backend/auxiliary.py
import os

MINIMAL_PEPTIDE_LENGTH = int(os.getenv("MIN_PEPTIDE_LENGTH", "40"))
MIN_LENGTH = int(os.getenv("FF_HELIX_MIN_LENGTH", "5"))
MAX_GAP = int(os.getenv("FF_HELIX_MAX_GAP", "3"))

# backend/psipred.py
PSIPRED_WINDOW_MIN = int(os.getenv("PSIPRED_WINDOW_MIN", "8"))
PSIPRED_WINDOW_MAX = int(os.getenv("PSIPRED_WINDOW_MAX", "20"))
PSIPRED_CHAMELEON_PH_THRESHOLD = float(os.getenv("PSIPRED_CHAMELEON_PH_THRESHOLD", "0.35"))
PSIPRED_CHAMELEON_PE_THRESHOLD = float(os.getenv("PSIPRED_CHAMELEON_PE_THRESHOLD", "0.35"))
PSIPRED_CHAMELEON_DIFF_THRESHOLD = float(os.getenv("PSIPRED_CHAMELEON_DIFF_THRESHOLD", "0.15"))

# backend/tango.py
TANGO_TIMEOUT = int(os.getenv("TANGO_TIMEOUT_SECONDS", "3600"))
PSIPRED_TIMEOUT = int(os.getenv("PSIPRED_TIMEOUT_SECONDS", "600"))
```

```bash
# .env.example (new file)
# Peptide thresholds
MIN_PEPTIDE_LENGTH=40
FF_HELIX_MIN_LENGTH=5
FF_HELIX_MAX_GAP=3

# PSIPRED thresholds
PSIPRED_WINDOW_MIN=8
PSIPRED_WINDOW_MAX=20
PSIPRED_CHAMELEON_PH_THRESHOLD=0.35
PSIPRED_CHAMELEON_PE_THRESHOLD=0.35
PSIPRED_CHAMELEON_DIFF_THRESHOLD=0.15

# Timeouts
TANGO_TIMEOUT_SECONDS=3600
PSIPRED_TIMEOUT_SECONDS=600
```

**Test**: Set env vars, verify thresholds change.

---

## 📦 PR 8: Postgres Schema + Cache Integration (Optional)

**Goal**: Define Postgres schema, integrate sequence hash caching.

**Files Changed**:
- `backend/schemas/db.py` (new)
- `backend/services/cache.py` (integrate into endpoints)
- `backend/server.py` (use cache)

**Diffs**:

```python
# backend/schemas/db.py (new)
from sqlalchemy import Column, String, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class PeptideCache(Base):
    __tablename__ = "peptide_cache"
    
    sequence_hash = Column(String(16), primary_key=True)
    provider = Column(String(20), primary_key=True)  # "tango", "psipred", "biochem"
    result_json = Column(JSON)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

# backend/server.py
from services.cache import cache_get, cache_set, sequence_hash

@app.post("/api/upload-csv")
async def upload_csv(...):
    # ... existing code ...
    
    # Check cache for each sequence
    for idx, row in df.iterrows():
        seq = str(row["Sequence"])
        hash_key = sequence_hash(seq)
        
        # Try cache first
        cached = cache_get(hash_key, "biochem")
        if cached:
            df.loc[idx, "Charge"] = cached.get("charge")
            df.loc[idx, "Hydrophobicity"] = cached.get("hydrophobicity")
            # ... etc ...
    
    # ... rest of processing ...
    
    # Cache results
    for idx, row in df.iterrows():
        seq = str(row["Sequence"])
        hash_key = sequence_hash(seq)
        cache_set(hash_key, "biochem", {
            "charge": row["Charge"],
            "hydrophobicity": row["Hydrophobicity"],
            # ... etc ...
        })
```

**Test**: Run upload twice with same sequences, verify cache hit.

---

## 📦 PR 9: Docker Toggle + PSIPRED Host Option

**Goal**: Add unified `USE_DOCKER` flag, make PSIPRED respect it.

**Files Changed**:
- `backend/server.py`
- `backend/psipred.py`
- `.env.example`

**Diffs**:

```python
# backend/server.py
USE_DOCKER = env_true("USE_DOCKER", False)  # Default: host mode
USE_TANGO = env_true("USE_TANGO", True)
USE_PSIPRED = env_true("USE_PSIPRED", True)

# backend/psipred.py
def run_psipred(records: List[Tuple[str,str]], use_docker: bool = True) -> str:
    """
    Run PSIPRED with Docker (if use_docker=True) or host runner (if use_docker=False).
    """
    if use_docker:
        # ... existing Docker code ...
    else:
        # NEW: Host runner (if available)
        # For now, skip if Docker disabled
        print("[PSIPRED][WARN] Host runner not implemented; skipping.")
        return run_dir
```

```bash
# .env.example
# Tool execution mode
USE_DOCKER=false  # Use host binaries (default: false)
USE_TANGO=true
USE_PSIPRED=true
```

**Test**: Set `USE_DOCKER=false`, verify PSIPRED skips cleanly.

---

## 📦 PR 10: Background Queue Stub (Off by Default)

**Goal**: Add background queue infrastructure (disabled by default).

**Files Changed**:
- `backend/services/queue.py` (new)
- `backend/server.py` (optional queue integration)

**Diffs**:

```python
# backend/services/queue.py (new)
import os
from typing import Optional, Callable

USE_QUEUE = os.getenv("USE_BACKGROUND_QUEUE", "false").lower() == "true"

class BackgroundQueue:
    """Stub for future background job queue."""
    
    def __init__(self):
        self.enabled = USE_QUEUE
    
    def enqueue(self, job_type: str, payload: dict, callback: Optional[Callable] = None):
        """Enqueue a job (stub: executes immediately if queue disabled)."""
        if not self.enabled:
            # Execute immediately (current behavior)
            if callback:
                callback(payload)
            return
        
        # Future: Add Redis/Celery integration here
        pass

queue = BackgroundQueue()
```

**Test**: Verify queue is disabled by default, uploads work as before.

---

## 🚨 Risk Log

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Tool Availability** | Medium | Best-effort skip (PSIPRED), clear error messages (TANGO) |
| **DB Size** | Low | Cache TTL, periodic cleanup, sequence hash (16 chars) |
| **Docker Friction** | Medium | Host-first mode (TANGO), optional Docker (PSIPRED) |
| **Large CSV Behavior** | High | Add pagination, streaming, file size limits |
| **Type Mismatches** | Medium | TypeScript strict mode, Pydantic validation |
| **Per-Run Dir Collisions** | Low | Timestamped dirs (no collisions possible) |

### Mitigations

1. **Large CSV**: Add `MAX_FILE_SIZE=50MB` check, pagination for results
2. **Docker Friction**: Host-first mode, clear error messages
3. **Type Mismatches**: Strict TypeScript, Pydantic validation, mapper tests
4. **Tool Availability**: Provider status tracking, graceful degradation

---

## 📋 PR Priority Order

1. **PR 1** (Types/Store/Mappers) — **Critical**: Fixes data flow
2. **PR 2** (Dead Code) — **Low Risk**: Cleanup
3. **PR 3** (Temp Dirs) — **Medium**: Prevents collisions
4. **PR 4** (N/A Handling) — **Low**: UX improvement
5. **PR 5** (Logging) — **Medium**: Observability
6. **PR 6** (Fake Defaults) — **Medium**: Data quality
7. **PR 7** (Thresholds) — **Low**: Configurability
8. **PR 8** (Postgres) — **Optional**: Performance
9. **PR 9** (Docker Toggle) — **Low**: Flexibility
10. **PR 10** (Queue) — **Optional**: Scalability

---

**Next**: See [DEV_ERGONOMICS.md](./DEV_ERGONOMICS.md) for dev setup and tooling.

