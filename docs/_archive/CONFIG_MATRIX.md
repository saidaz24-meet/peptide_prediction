# Config Matrix

All toggles/flags with defaults, where each flag is read in code, and which path it changes.

## Feature Flags

### USE_TANGO

**Default**: `true` (enabled)

**Type**: Boolean (accepts: `1`, `true`, `yes`, `on` / `0`, `false`, `no`, `off`)

**Read In**:
- `backend/server.py:57` - `USE_TANGO = env_true("USE_TANGO", True)`
- `backend/server.py:412` - `if env_true("USE_TANGO", True):`
- `backend/server.py:528` - `if not env_true("USE_TANGO", True):`
- `backend/server.py:761` - `if USE_TANGO:`
- `backend/server.py:1292` - `if request.run_tango and USE_TANGO:`

**Effect**:
- Enables/disables TANGO processing in upload and predict endpoints
- When disabled: Provider status = `OFF`, all TANGO fields set to `null`

**Path Changes**: None (runtime behavior only)

---

### USE_PSIPRED

**Default**: `true` (enabled)

**Type**: Boolean (accepts: `1`, `true`, `yes`, `on` / `0`, `false`, `no`, `off`)

**Read In**:
- `backend/server.py:58` - `USE_PSIPRED = env_true("USE_PSIPRED", True)`
- `backend/services/secondary_structure.py:73` - `use_psipred_val = os.getenv("USE_PSIPRED", "true")`
- `backend/services/secondary_structure.py:204` - `use_psipred_val = os.getenv("USE_PSIPRED", "true")`

**Effect**:
- Enables/disables PSIPRED processing via provider interface
- When disabled: Provider status = `OFF`, all PSIPRED fields set to `null`

**Path Changes**: None (runtime behavior only)

---

### USE_JPRED

**Default**: `False` (disabled, kept for reference only)

**Type**: Boolean

**Read In**:
- `backend/server.py:55` - `USE_JPRED = False  # Always disabled`

**Effect**:
- JPred is disabled and kept for reference only
- Provider status = `OFF`, all JPred fields set to `null`

**Path Changes**: None

---

## TANGO Configuration

### TANGO_MODE

**Default**: `simple`

**Type**: String (`simple`, `host`, `docker`)

**Read In**:
- `backend/server.py:60` - `use_simple = os.getenv("TANGO_MODE", "simple").lower() == "simple"`
- `backend/server.py:895` - `use_docker = os.getenv("TANGO_MODE", "simple").lower() != "simple"`

**Effect**:
- `simple`: Use simple runner (default, generates bash script)
- `host`: Use host runner (uses `Tango_run.sh` wrapper)
- `docker`: Use Docker runner (requires `desy-tango` image)

**Path Changes**: None (runner selection only)

---

### TANGO_SIMPLE

**Default**: `1` (enabled)

**Type**: String (`1` or `0`)

**Read In**:
- `backend/tango.py:689` - `if os.getenv("TANGO_SIMPLE", "1") == "1":`

**Effect**:
- Forces simple runner even if `TANGO_MODE` is set to `host` or `docker`
- When `0`: Falls back to Docker, then host runner

**Path Changes**: None (runner selection only)

---

### TANGO_BIN

**Default**: `None` (auto-resolved)

**Type**: String (absolute path to TANGO binary)

**Read In**:
- `backend/server.py:948` - `tango_bin_env = os.getenv("TANGO_BIN")`
- `backend/tango.py:139` - `_resolve_tango_bin()` (checks `TANGO_BIN` env var)

**Effect**:
- Overrides default TANGO binary path resolution
- Default resolution: `backend/Tango/bin/tango` → `which tango` (system PATH)

**Path Changes**:
- Binary path resolution (absolute path used in generated scripts)

---

### TANGO_RUNTIME_DIR

**Default**: `backend/.run_cache/Tango`

**Type**: String (absolute or relative path)

**Read In**:
- `backend/tango.py:33` - `_RUNTIME_BASE = os.getenv("TANGO_RUNTIME_DIR", os.path.join(PROJECT_PATH, ".run_cache", "Tango"))`

**Effect**:
- Overrides default runtime directory
- Work directory: `$TANGO_RUNTIME_DIR/work/`
- Output directory: `$TANGO_RUNTIME_DIR/out/`

**Path Changes**:
- Work directory: `$TANGO_RUNTIME_DIR/work/`
- Output directory: `$TANGO_RUNTIME_DIR/out/`

---

### TANGO_DOCKER_IMAGE

**Default**: `desy-tango`

**Type**: String (Docker image name)

**Read In**:
- `backend/server.py:896` - `docker_image = os.getenv("TANGO_DOCKER_IMAGE", "desy-tango")`

**Effect**:
- Docker image name for TANGO Docker runner
- Used when `TANGO_MODE=docker` or `TANGO_SIMPLE=0`

**Path Changes**: None (Docker image selection only)

---

## PSIPRED Configuration

### PSIPRED_IMAGE

**Default**: `psipred-hhblits`

**Type**: String (Docker image name)

**Read In**:
- `backend/services/secondary_structure.py:128` - `image = os.getenv("PSIPRED_IMAGE", "psipred-hhblits")`
- `backend/psipred.py:85` - `image = os.getenv("PSIPRED_IMAGE", "psipred-hhblits")`

**Effect**:
- Docker image name for PSIPRED processing
- Used when `USE_PSIPRED=true` and Docker is available

**Path Changes**: None (Docker image selection only)

---

### PSIPRED_DB

**Default**: `""` (empty, optional)

**Type**: String (path to Uniclust database)

**Read In**:
- `backend/psipred.py:90` - `db_host = os.getenv("PSIPRED_DB", "").strip()`

**Effect**:
- Uniclust database path for PSIPRED HHblits step
- Optional: PSIPRED may work without explicit DB path (uses image defaults)

**Path Changes**: None (database path for HHblits)

---

### PSIPRED_RUNTIME_DIR

**Default**: `backend/.run_cache/Psipred`

**Type**: String (absolute or relative path)

**Read In**:
- `backend/psipred.py:13` - `_RUNTIME_BASE = os.getenv("PSIPRED_RUNTIME_DIR", os.path.join(PROJECT_PATH, ".run_cache", "Psipred"))`

**Effect**:
- Overrides default PSIPRED runtime directory
- Work directory: `$PSIPRED_RUNTIME_DIR/work/`
- Output directory: `$PSIPRED_RUNTIME_DIR/out/`

**Path Changes**:
- Work directory: `$PSIPRED_RUNTIME_DIR/work/`
- Output directory: `$PSIPRED_RUNTIME_DIR/out/`

---

## SSW (Secondary Structure Switch) Configuration

### SSW_DIFF_THRESHOLD_STRATEGY

**Default**: `mean`

**Type**: String (`mean`, `median`, `fixed`, `multiplier`)

**Read In**:
- `backend/tango.py:1237` - `strategy = os.getenv("SSW_DIFF_THRESHOLD_STRATEGY", "mean").lower()`

**Effect**:
- `mean`: Use mean of valid SSW diff values (default)
- `median`: Use median of valid SSW diff values
- `fixed`: Use fixed value from `SSW_DIFF_THRESHOLD_FIXED`
- `multiplier`: Use mean * `SSW_DIFF_THRESHOLD_MULTIPLIER`

**Path Changes**: None (threshold calculation only)

---

### SSW_DIFF_THRESHOLD_FALLBACK

**Default**: `0.0`

**Type**: Float

**Read In**:
- `backend/tango.py:1238` - `fallback_threshold = float(os.getenv("SSW_DIFF_THRESHOLD_FALLBACK", "0.0"))`

**Effect**:
- Fallback threshold when no valid SSW diff values exist
- Used when all rows have `None` or `NaN` for `SSW diff`

**Path Changes**: None (threshold calculation only)

---

### SSW_DIFF_THRESHOLD_FIXED

**Default**: `0.0`

**Type**: Float

**Read In**:
- `backend/tango.py:1254` - `avg_diff = float(os.getenv("SSW_DIFF_THRESHOLD_FIXED", "0.0"))`

**Effect**:
- Fixed threshold value when `SSW_DIFF_THRESHOLD_STRATEGY=fixed`
- Overrides mean/median calculation

**Path Changes**: None (threshold calculation only)

---

### SSW_DIFF_THRESHOLD_MULTIPLIER

**Default**: `1.0`

**Type**: Float

**Read In**:
- `backend/tango.py:1256` - `multiplier = float(os.getenv("SSW_DIFF_THRESHOLD_MULTIPLIER", "1.0"))`

**Effect**:
- Multiplier for mean when `SSW_DIFF_THRESHOLD_STRATEGY=multiplier`
- Formula: `threshold = mean * multiplier`

**Path Changes**: None (threshold calculation only)

---

### SSW_DIFF_COMPARISON

**Default**: `<=`

**Type**: String (`<=`, `>=`, `<`, `>`)

**Read In**:
- `backend/tango.py:1271` - `comparison_op = os.getenv("SSW_DIFF_COMPARISON", "<=").strip()`

**Effect**:
- Comparison operator for SSW prediction
- `<=`: `SSW prediction = 1 if diff <= threshold else -1` (default)
- `>=`: `SSW prediction = 1 if diff >= threshold else -1`
- `<`: `SSW prediction = 1 if diff < threshold else -1`
- `>`: `SSW prediction = 1 if diff > threshold else -1`

**Path Changes**: None (prediction logic only)

---

## FF-Helix Configuration

### FF_HELIX_CORE_LEN

**Default**: `6`

**Type**: Integer

**Read In**:
- `backend/auxiliary.py:48` - `core_len = int(os.getenv("FF_HELIX_CORE_LEN", "6"))`
- `backend/auxiliary.py:87` - `core_len = int(os.getenv("FF_HELIX_CORE_LEN", "6"))`

**Effect**:
- Window size for helix core detection
- Used in `ff_helix_percent()` and `ff_helix_cores()`
- Smaller values = more sensitive (detects shorter helices)

**Path Changes**: None (calculation only)

---

### FF_HELIX_THRESHOLD

**Default**: `1.0`

**Type**: Float

**Read In**:
- `backend/auxiliary.py:50` - `thr = float(os.getenv("FF_HELIX_THRESHOLD", "1.0"))`
- `backend/auxiliary.py:89` - `thr = float(os.getenv("FF_HELIX_THRESHOLD", "1.0"))`

**Effect**:
- Threshold for helix propensity (mean of window)
- Used in `ff_helix_percent()` and `ff_helix_cores()`
- Higher values = stricter (requires higher helix propensity)

**Path Changes**: None (calculation only)

---

## Logging Configuration

### LOG_LEVEL

**Default**: `INFO`

**Type**: String (`DEBUG`, `INFO`, `WARNING`, `ERROR`)

**Read In**:
- `backend/services/logger.py:70` - `log_level = os.getenv("LOG_LEVEL", "INFO")`

**Effect**:
- Logging level for structured logs
- Filters log events by severity

**Path Changes**: None (logging only)

---

### DEBUG_ENTRY

**Default**: `""` (empty, disabled)

**Type**: String (Entry ID to trace)

**Read In**:
- `backend/server.py:52` - `DEBUG_ENTRY = os.getenv("DEBUG_ENTRY", "").strip()`
- `backend/tango.py:1017` - `debug_entry = os.getenv("DEBUG_ENTRY", "").strip()`
- `backend/services/normalize.py:423` - `debug_entry = os.getenv("DEBUG_ENTRY", "").strip()`

**Effect**:
- Enables detailed tracing for specific Entry ID
- Logs all operations for that entry (upload, parse, normalize, etc.)

**Path Changes**: None (logging only)

---

### ENABLE_PROVIDER_STATUS_ASSERT

**Default**: `0` (disabled)

**Type**: String (`0` or `1`)

**Read In**:
- `backend/server.py:636` - `if os.getenv("ENABLE_PROVIDER_STATUS_ASSERT", "0") == "1":`

**Effect**:
- Enables provider status invariant assertions
- When `1`: Fails fast if provider status is not `AVAILABLE` but fields are not `null`
- Useful for development/debugging

**Path Changes**: None (assertion only)

---

## Frontend Configuration

### VITE_API_BASE_URL

**Default**: `http://127.0.0.1:8000`

**Type**: String (URL)

**Read In**:
- `ui/src/lib/api.ts:1-2` - `export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000";`

**Effect**:
- API base URL for frontend HTTP requests
- Set in `ui/.env.local` or `ui/vite.config.ts`

**Path Changes**: None (HTTP client configuration only)

---

## Summary Table

| Flag | Default | Type | Read In | Path Changes |
|------|---------|------|---------|-------------|
| `USE_TANGO` | `true` | Boolean | `server.py:57` | None |
| `USE_PSIPRED` | `true` | Boolean | `server.py:58` | None |
| `USE_JPRED` | `False` | Boolean | `server.py:55` | None |
| `TANGO_MODE` | `simple` | String | `server.py:60` | None |
| `TANGO_SIMPLE` | `1` | String | `tango.py:689` | None |
| `TANGO_BIN` | `None` | String | `server.py:948` | Binary path resolution |
| `TANGO_RUNTIME_DIR` | `backend/.run_cache/Tango` | String | `tango.py:33` | Work/out directories |
| `TANGO_DOCKER_IMAGE` | `desy-tango` | String | `server.py:896` | None |
| `PSIPRED_IMAGE` | `psipred-hhblits` | String | `secondary_structure.py:128` | None |
| `PSIPRED_DB` | `""` | String | `psipred.py:90` | None |
| `PSIPRED_RUNTIME_DIR` | `backend/.run_cache/Psipred` | String | `psipred.py:13` | Work/out directories |
| `SSW_DIFF_THRESHOLD_STRATEGY` | `mean` | String | `tango.py:1237` | None |
| `SSW_DIFF_THRESHOLD_FALLBACK` | `0.0` | Float | `tango.py:1238` | None |
| `SSW_DIFF_THRESHOLD_FIXED` | `0.0` | Float | `tango.py:1254` | None |
| `SSW_DIFF_THRESHOLD_MULTIPLIER` | `1.0` | Float | `tango.py:1256` | None |
| `SSW_DIFF_COMPARISON` | `<=` | String | `tango.py:1271` | None |
| `FF_HELIX_CORE_LEN` | `6` | Integer | `auxiliary.py:48` | None |
| `FF_HELIX_THRESHOLD` | `1.0` | Float | `auxiliary.py:50` | None |
| `LOG_LEVEL` | `INFO` | String | `logger.py:70` | None |
| `DEBUG_ENTRY` | `""` | String | `server.py:52` | None |
| `ENABLE_PROVIDER_STATUS_ASSERT` | `0` | String | `server.py:636` | None |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | String | `api.ts:1-2` | None |

---

## Environment Variable Parsing

### Boolean Parsing

**Function**: `backend/server.py:env_true()`

**Accepts**:
- `True`: `1`, `true`, `yes`, `on` (case-insensitive)
- `False`: `0`, `false`, `no`, `off` (case-insensitive)

**Used For**:
- `USE_TANGO`
- `USE_PSIPRED`

### String Parsing

**Default**: `os.getenv(name, default)`

**Used For**:
- All other environment variables

### Float/Integer Parsing

**Default**: `float(os.getenv(name, default))` or `int(os.getenv(name, default))`

**Used For**:
- `SSW_DIFF_THRESHOLD_FALLBACK`
- `SSW_DIFF_THRESHOLD_FIXED`
- `SSW_DIFF_THRESHOLD_MULTIPLIER`
- `FF_HELIX_CORE_LEN`
- `FF_HELIX_THRESHOLD`

---

## Configuration Files

### Backend `.env` File

**Location**: `backend/.env`

**Format**:
```bash
USE_TANGO=1
USE_PSIPRED=1
TANGO_MODE=simple
TANGO_RUNTIME_DIR=backend/.run_cache/Tango
```

**Loading**: Via `python-dotenv` in `server.py:33-42`

### Frontend `.env.local` File

**Location**: `ui/.env.local`

**Format**:
```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

**Loading**: Via Vite (automatic, `import.meta.env.VITE_*`)

---

## Path Resolution Order

### TANGO Binary

1. `TANGO_BIN` environment variable (absolute path)
2. `backend/Tango/bin/tango` (relative to backend/)
3. `which tango` (system PATH)

### Runtime Directories

1. `TANGO_RUNTIME_DIR` environment variable
2. `backend/.run_cache/Tango` (default)

### Docker Images

1. `TANGO_DOCKER_IMAGE` environment variable
2. `desy-tango` (default)

1. `PSIPRED_IMAGE` environment variable
2. `psipred-hhblits` (default)

