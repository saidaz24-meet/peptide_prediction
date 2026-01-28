# Workflows

Operator cookbook: How to run locally (macOS/Apple Silicon & Intel), with/without Docker.

## Prerequisites

### macOS (Apple Silicon & Intel)

**Required:**
- Python 3.9+ (check: `python3 --version`)
- Node.js 18+ (check: `node --version`)
- TANGO binary at `backend/Tango/bin/tango` (macOS x86_64 binary)

**Optional:**
- Docker (for PSIPRED, or TANGO fallback)
- Rosetta 2 (Apple Silicon only, if using x86_64 TANGO binary)

### Preflight Checks

Run `checks/preflight.sh` before starting the server:

```bash
cd /path/to/peptide_prediction
./checks/preflight.sh
```

This checks:
- ✅ TANGO binary exists and is executable
- ✅ macOS quarantine removed
- ✅ Runtime directories exist
- ✅ Docker available (if using PSIPRED)
- ✅ Required Python packages installed

## Quick Start (10 Steps)

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd peptide_prediction
```

### Step 2: Install TANGO Binary

**Option A: Copy Existing Binary**
```bash
# Copy your macOS TANGO binary to:
cp /path/to/tango backend/Tango/bin/tango
chmod +x backend/Tango/bin/tango
```

**Option B: Build from Source**
```bash
# Follow TANGO build instructions
# Place binary at: backend/Tango/bin/tango
```

### Step 3: Remove macOS Quarantine (Apple Silicon/Intel)

```bash
cd backend/Tango/bin
xattr -d com.apple.quarantine tango 2>/dev/null || true
chmod +x tango
```

**Note**: The preflight script does this automatically.

### Step 4: Install Rosetta 2 (Apple Silicon Only)

If using x86_64 TANGO binary on Apple Silicon:

```bash
softwareupdate --install-rosetta --agree-to-license
```

**Check**: `arch -x86_64 /usr/bin/true` should succeed.

### Step 5: Setup Backend Environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On zsh/bash
# OR: .venv/bin/activate.fish  # On fish shell
pip install -r requirements.txt
```

### Step 6: Configure Environment Variables

Create `backend/.env`:

```bash
# TANGO Configuration
USE_TANGO=1
TANGO_MODE=simple
TANGO_SIMPLE=1
TANGO_RUNTIME_DIR=backend/.run_cache/Tango

# PSIPRED Configuration (optional)
USE_PSIPRED=1
PSIPRED_IMAGE=psipred-hhblits
PSIPRED_DB=/path/to/uniclust

# Logging
DEBUG_ENTRY=  # Optional: trace specific entry ID
```

**See `CONFIG_MATRIX.md` for complete list of environment variables.**

### Step 7: Verify TANGO Binary Path

```bash
python3 checks/verify_tango_path.py
```

This prints the exact TANGO binary path used by each runner (simple, host, docker).

### Step 8: Start Backend Server

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**Check**: Open `http://127.0.0.1:8000/api/health` → Should return `{"ok": true}`

### Step 9: Setup Frontend

```bash
cd ui
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

**Check**: Open `http://127.0.0.1:5173` → Should see upload page

### Step 10: Run Smoke Test

```bash
./checks/smoke_uniprot.sh
```

This runs a tiny UniProt query (2 sequences), validates at least 2 TANGO outputs exist, exits non-zero if not.

**Success**: You should see results in the web UI.

---

## Detailed Setup

### Backend Setup (macOS)

#### 1. Python Environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Verify**: `python3 -c "import fastapi, pandas, httpx; print('OK')"`

#### 2. TANGO Binary Setup

**Check Binary Location:**
```bash
ls -la backend/Tango/bin/tango
```

**Expected Output:**
```
-rwxr-xr-x  1 user  staff  <size>  <date>  backend/Tango/bin/tango
```

**If Missing:**
- Copy your TANGO binary to `backend/Tango/bin/tango`
- Make executable: `chmod +x backend/Tango/bin/tango`
- Remove quarantine: `xattr -d com.apple.quarantine backend/Tango/bin/tango`

**Verify Binary Works:**
```bash
cd backend/Tango/bin
./tango --version  # Should print version or usage
```

**If Binary Fails (Apple Silicon + x86_64 binary):**
```bash
# Install Rosetta 2
softwareupdate --install-rosetta --agree-to-license

# Test with Rosetta
arch -x86_64 ./tango --version
```

#### 3. Runtime Directories

**Create Directories:**
```bash
mkdir -p backend/.run_cache/Tango/work
mkdir -p backend/.run_cache/Tango/out
```

**Or use environment variable:**
```bash
export TANGO_RUNTIME_DIR=/custom/path/to/Tango
mkdir -p "$TANGO_RUNTIME_DIR/work" "$TANGO_RUNTIME_DIR/out"
```

#### 4. Environment Variables

**Create `backend/.env`:**
```bash
# Feature Flags
USE_TANGO=1
USE_PSIPRED=1

# TANGO Configuration
TANGO_MODE=simple
TANGO_SIMPLE=1
TANGO_BIN=  # Optional: override binary path
TANGO_RUNTIME_DIR=backend/.run_cache/Tango

# PSIPRED Configuration
PSIPRED_IMAGE=psipred-hhblits
PSIPRED_DB=  # Optional: Uniclust database path

# Logging
DEBUG_ENTRY=  # Optional: trace specific entry ID
ENABLE_PROVIDER_STATUS_ASSERT=0  # Set to 1 for dev assertions
```

**Load Environment:**
```bash
source .venv/bin/activate
export $(cat .env | xargs)  # Load .env variables
```

#### 5. Start Server

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**Check Health:**
```bash
curl http://127.0.0.1:8000/api/health
# Expected: {"ok": true}
```

**Check TANGO Diagnostics:**
```bash
curl http://127.0.0.1:8000/api/providers/diagnose/tango
# Expected: {"status": "found", "path": "/absolute/path/to/tango", ...}
```

### Frontend Setup

#### 1. Install Dependencies

```bash
cd ui
npm install
```

#### 2. Configure API Base URL

**Create `ui/.env.local`:**
```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

**Or set in `ui/vite.config.ts`:**
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000'
    }
  }
})
```

#### 3. Start Dev Server

```bash
npm run dev
```

**Check**: Open `http://127.0.0.1:5173` → Should see upload page

### Docker Setup (Optional)

#### TANGO Docker Image

**Build Image:**
```bash
cd backend/Tango
docker build -t desy-tango -f Dockerfile .
```

**Test Image:**
```bash
docker run --rm -v "$(pwd):/app/Tango" desy-tango "ls -la /app/Tango/bin/tango"
```

**Use Docker Runner:**
```bash
export TANGO_MODE=docker
export TANGO_SIMPLE=0
```

#### PSIPRED Docker Image

**Build Image:**
```bash
# Follow PSIPRED Docker build instructions
docker build -t psipred-hhblits -f psipred/Dockerfile .
```

**Configure:**
```bash
export USE_PSIPRED=1
export PSIPRED_IMAGE=psipred-hhblits
export PSIPRED_DB=/path/to/uniclust
```

---

## Running Without Docker

### TANGO (Native macOS)

**Default (Simple Runner):**
```bash
export USE_TANGO=1
export TANGO_MODE=simple
export TANGO_SIMPLE=1
```

**Requirements:**
- TANGO binary at `backend/Tango/bin/tango`
- Executable permissions
- macOS quarantine removed
- Rosetta 2 (Apple Silicon + x86_64 binary)

### PSIPRED (Skip)

**Disable PSIPRED:**
```bash
export USE_PSIPRED=0
```

**Note**: FF-Helix % is always computed (no PSIPRED dependency).

---

## Running With Docker

### TANGO (Docker Fallback)

**Use Docker Runner:**
```bash
export TANGO_MODE=docker
export TANGO_SIMPLE=0
```

**Requirements:**
- Docker installed and running
- Docker image `desy-tango` built
- Volume mount: `backend/Tango/` → `/app/Tango`

### PSIPRED (Docker)

**Enable PSIPRED:**
```bash
export USE_PSIPRED=1
export PSIPRED_IMAGE=psipred-hhblits
export PSIPRED_DB=/path/to/uniclust
```

**Requirements:**
- Docker installed and running
- Docker image `psipred-hhblits` built
- Uniclust database mounted

---

## Troubleshooting

### TANGO Binary Not Found

**Symptom**: `{"status": "missing", "reason": "TANGO binary not found at ..."}`

**Fix:**
```bash
# Check binary location
ls -la backend/Tango/bin/tango

# If missing, copy binary
cp /path/to/tango backend/Tango/bin/tango
chmod +x backend/Tango/bin/tango
xattr -d com.apple.quarantine backend/Tango/bin/tango
```

### TANGO Binary Not Executable

**Symptom**: `{"status": "no-exec-permission", "reason": "TANGO binary at ... is not executable"}`

**Fix:**
```bash
chmod +x backend/Tango/bin/tango
```

### macOS Quarantine Blocking Execution

**Symptom**: Binary exists but fails to execute (Gatekeeper error)

**Fix:**
```bash
xattr -d com.apple.quarantine backend/Tango/bin/tango
```

**Auto-fix**: The preflight script does this automatically.

### Rosetta 2 Not Installed (Apple Silicon)

**Symptom**: Binary fails with "Bad CPU type" error

**Fix:**
```bash
softwareupdate --install-rosetta --agree-to-license
```

### TANGO Produces 0 Outputs

**Symptom**: `parsed_ok: 0` in provider status

**Check:**
```bash
# Check run directory
ls -la backend/.run_cache/Tango/out/run_*/

# Check run_meta.json for diagnostics
cat backend/.run_cache/Tango/out/run_*/run_meta.json
```

**Common Causes:**
- Binary path mis-resolution (see `FAILURE_MODES.md`)
- Permissions issue
- Timeout (check `run_meta.json`)

**Fix**: See `FAILURE_MODES.md` for specific fixes.

### Docker Volume Mount Fails

**Symptom**: Docker runner fails with "No such file or directory"

**Fix:**
```bash
# Check volume mount path
docker run --rm -v "$(pwd)/backend/Tango:/app/Tango" desy-tango "ls -la /app/Tango/bin/tango"

# Use absolute path
docker run --rm -v "$(realpath backend/Tango):/app/Tango" desy-tango "ls -la /app/Tango/bin/tango"
```

### Frontend Can't Connect to Backend

**Symptom**: CORS error or "Failed to fetch"

**Fix:**
```bash
# Check backend is running
curl http://127.0.0.1:8000/api/health

# Check CORS configuration in server.py
# Should allow: http://127.0.0.1:5173, http://localhost:5173
```

---

## Example .env Files

### Minimal (.env.minimal)

```bash
USE_TANGO=1
USE_PSIPRED=0
TANGO_MODE=simple
```

### Full (.env.full)

```bash
# Feature Flags
USE_TANGO=1
USE_PSIPRED=1

# TANGO Configuration
TANGO_MODE=simple
TANGO_SIMPLE=1
TANGO_BIN=
TANGO_RUNTIME_DIR=backend/.run_cache/Tango

# PSIPRED Configuration
PSIPRED_IMAGE=psipred-hhblits
PSIPRED_DB=/path/to/uniclust

# Logging
DEBUG_ENTRY=
ENABLE_PROVIDER_STATUS_ASSERT=0

# SSW Threshold Configuration
SSW_DIFF_THRESHOLD_STRATEGY=mean
SSW_DIFF_THRESHOLD_FALLBACK=0.0
SSW_DIFF_COMPARISON=<=

# FF-Helix Configuration
FF_HELIX_CORE_LEN=6
FF_HELIX_THRESHOLD=1.0
```

---

## From Zero to Results (Complete Workflow)

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd peptide_prediction
   ```

2. **Run Preflight Checks**
   ```bash
   ./checks/preflight.sh
   ```

3. **Setup Backend**
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env  # Edit as needed
   ```

4. **Install TANGO Binary**
   ```bash
   cp /path/to/tango backend/Tango/bin/tango
   chmod +x backend/Tango/bin/tango
   xattr -d com.apple.quarantine backend/Tango/bin/tango
   ```

5. **Verify TANGO Path**
   ```bash
   python3 checks/verify_tango_path.py
   ```

6. **Start Backend**
   ```bash
   cd backend
   source .venv/bin/activate
   uvicorn server:app --host 0.0.0.0 --port 8000 --reload
   ```

7. **Setup Frontend**
   ```bash
   cd ui
   npm install
   echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local
   npm run dev
   ```

8. **Run Smoke Test**
   ```bash
   ./checks/smoke_uniprot.sh
   ```

9. **Open Browser**
   - Navigate to `http://127.0.0.1:5173`
   - Upload a CSV file or execute a UniProt query
   - View results in the web UI

10. **Verify Results**
    - Check provider status badges (TANGO/PSIPRED)
    - Verify TANGO outputs exist: `ls -la backend/.run_cache/Tango/out/run_*/`
    - Check logs for errors: `tail -f backend/logs/*.log` (if logging to file)

---

## Next Steps

- See `CONFIG_MATRIX.md` for all configuration options
- See `FAILURE_MODES.md` for troubleshooting specific issues
- See `OBSERVABILITY.md` for logging and monitoring

