# Dev Ergonomics: Setup & Tooling

## 🔧 Environment Variables

### `.env.example` (Backend)

```bash
# Tool execution mode
USE_DOCKER=false              # Use host binaries (default: false)
USE_TANGO=true                # Enable TANGO (default: true)
USE_PSIPRED=true              # Enable PSIPRED (default: true, best-effort)
USE_JPRED=false               # Always disabled (kept for reference)

# TANGO configuration
TANGO_MODE=simple             # "simple" (host) or "docker"
TANGO_BIN=                    # Path to tango binary (auto-detected if empty)
TANGO_TIMEOUT_SECONDS=3600    # Per-run timeout (1 hour)

# PSIPRED configuration
PSIPRED_IMAGE=psipred-hhblits # Docker image name
PSIPRED_DB=                   # Path to Uniclust database (required for PSIPRED)
PSIPRED_TIMEOUT_SECONDS=600   # Per-sequence timeout (10 minutes)

# Peptide thresholds
MIN_PEPTIDE_LENGTH=40         # Minimum peptide length for processing
FF_HELIX_MIN_LENGTH=5         # Minimum FF-Helix segment length
FF_HELIX_MAX_GAP=3           # Maximum gap in FF-Helix segments

# PSIPRED thresholds
PSIPRED_WINDOW_MIN=8          # Minimum window size for SSW proxy
PSIPRED_WINDOW_MAX=20         # Maximum window size for SSW proxy
PSIPRED_CHAMELEON_PH_THRESHOLD=0.35  # Minimum P(helix) for chameleon
PSIPRED_CHAMELEON_PE_THRESHOLD=0.35  # Minimum P(beta) for chameleon
PSIPRED_CHAMELEON_DIFF_THRESHOLD=0.15  # Max |P(H) - P(E)| for chameleon

# Background queue (future)
USE_BACKGROUND_QUEUE=false     # Enable background job queue (default: false)

# Debug
DEBUG_ENTRY=                  # Entry ID to trace through pipeline
```

### `.env.local` (Frontend)

```bash
# API base URL
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 🚀 One-Command Dev Run

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy .env.example to .env and edit as needed
cp .env.example .env

# Run server
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd ui
npm install

# Create .env.local
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local

# Run dev server
npm run dev
```

### Combined (Single Command)

```bash
# Terminal 1: Backend
cd backend && source .venv/bin/activate && uvicorn server:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd ui && npm run dev
```

## 🧪 Testing Knobs

### Small Synthetic Sequences

Create `backend/tests/fixtures/synthetic_sequences.csv`:

```csv
Entry,Sequence
TEST001,MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWYIKK
TEST002,ACDEFGHIKLMNPQRSTVWY
TEST003,AAAAAAAAAA
```

**Usage**:
```bash
curl -X POST http://127.0.0.1:8000/api/upload-csv \
  -F "file=@backend/tests/fixtures/synthetic_sequences.csv"
```

### Fixture CSVs

Located in `backend/tests/golden_inputs/`:
- `normal.csv` — Standard UniProt export
- `ambiguous_headers.csv` — Multiple columns matching same canonical name
- `missing_headers.csv` — Missing required columns
- `nans_empty.csv` — NaN and empty values
- `nonstandard_aa.csv` — Non-standard amino acids
- `weird_delimiter.csv` — Non-standard delimiter

**Usage**:
```bash
# Run golden pipeline test
cd backend
python -m pytest tests/test_golden_pipeline.py -v
```

### Golden JSON Outputs

Create `backend/tests/golden_outputs/` with expected JSON responses:

```json
{
  "rows": [
    {
      "id": "TEST001",
      "sequence": "MKTAY...",
      "sswPrediction": 1,
      "providerStatus": {
        "tango": {"status": "available"},
        "psipred": {"status": "unavailable", "reason": "Docker not configured"}
      }
    }
  ],
  "meta": {
    "use_tango": true,
    "ssw_rows": 1
  }
}
```

**Usage**:
```python
# In test file
def test_upload_normal_csv():
    response = client.post("/api/upload-csv", files={"file": open("fixtures/normal.csv")})
    assert response.status_code == 200
    data = response.json()
    
    # Compare with golden output
    with open("golden_outputs/normal.json") as f:
        expected = json.load(f)
    assert data == expected
```

## 🔍 Debugging Tools

### Trace Specific Entry

Set `DEBUG_ENTRY` env var or query param:

```bash
# Backend
export DEBUG_ENTRY=P12345
uvicorn server:app --reload

# Or via query param
curl "http://127.0.0.1:8000/api/upload-csv?debug_entry=P12345" \
  -F "file=@data.csv"
```

**Output**: Detailed logs for that entry at each pipeline stage.

### Frontend Debug

Add to browser console:

```javascript
// Set debug entry
localStorage.setItem('DEBUG_ENTRY', 'P12345');

// Or via URL
// http://localhost:5173/results?debug_entry=P12345
```

**Output**: Console logs for that entry in mapper, store, stats.

### Provider Status Inspection

```python
# In Python shell
from backend.services.provider_tracking import create_provider_status_for_row
import pandas as pd

df = pd.read_csv("data.csv")
row = df.iloc[0]
status = create_provider_status_for_row(row, tango_enabled=True, psipred_enabled=True)
print(status.dict())
```

## 📊 Seed Example Dataset

### Using Precomputed Example

```bash
# Backend serves example dataset
curl http://127.0.0.1:8000/api/example

# Or with recalc (recompute TANGO/PSIPRED)
curl http://127.0.0.1:8000/api/example?recalc=1
```

### Creating New Example Dataset

1. Export from UniProt (TSV format)
2. Place at `ui/public/example/peptide_data.csv`
3. Update `server.py:L65` if path differs:

```python
EXAMPLE_PATH = BASE_DIR / "ui" / "public" / "example" / "peptide_data.csv"
```

## 🐳 Docker Setup (Optional)

### TANGO Docker

```bash
# Build image
cd backend/Tango
docker build -t desy-tango -f Dockerfile .

# Test
docker run --rm -v $(pwd):/app/Tango desy-tango ./Tango_run.sh work/input.txt out/test
```

### PSIPRED Docker

```bash
# Pull or build image
docker pull psipred-hhblits  # Or build from Dockerfile

# Set PSIPRED_DB env var
export PSIPRED_DB=/path/to/uniclust

# Test
docker run --rm \
  -v $(pwd)/backend/Psipred:/app/Psipred \
  -v $PSIPRED_DB:/db:ro \
  psipred-hhblits \
  runpsipred /app/Psipred/work/test.fa /app/Psipred/work/test.a3m
```

## 🧹 Cleanup Scripts

### Clear TANGO Outputs

```bash
# Remove all run dirs
rm -rf backend/Tango/out/run_*

# Or keep last N runs
cd backend/Tango/out
ls -t | tail -n +6 | xargs rm -rf  # Keep last 5 runs
```

### Clear PSIPRED Outputs

```bash
# Remove all run dirs
rm -rf backend/Psipred/out/run_*
```

### Clear Cache

```bash
# If cache.py integrated
rm -rf backend/cache/*
```

## 📝 Logging Configuration

### Structured JSON Logs

```python
# backend/server.py
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if hasattr(record, "extra"):
            log_entry.update(record.extra)
        return json.dumps(log_entry)

handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
```

### Log Levels

- **DEBUG**: Detailed pipeline steps, entry tracing
- **INFO**: Normal operations (upload, processing, results)
- **WARNING**: Provider unavailable, missing data
- **ERROR**: Tool failures, parsing errors

## 🔐 Security Notes

### Development

- CORS allows all origins (fine for local dev)
- No authentication (internal tool)
- File upload size not limited (add `MAX_FILE_SIZE` check)

### Production

- Restrict CORS origins
- Add API key authentication
- Add file size limits
- Add rate limiting
- Use HTTPS

## 📚 Additional Resources

- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Implementation Status**: See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- **Continuation Plan**: See [CONTINUATION_PLAN.md](./CONTINUATION_PLAN.md)
- **File Reference**: See [FILE_REFERENCE.md](./FILE_REFERENCE.md)

---

**Last Updated**: 2025-01-XX

