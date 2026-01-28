#!/bin/bash
# Preflight checks: idempotent script to run before starting the server.
# Checks: binary, perms, quarantine, volumes, Docker availability.

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory (repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
TANGO_DIR="$BACKEND_DIR/Tango"
TANGO_BIN="$TANGO_DIR/bin/tango"

echo "🔍 Running preflight checks..."
echo ""

# Track failures
FAILURES=0

# Check 1: TANGO binary exists
echo -n "Checking TANGO binary exists... "
if [ -f "$TANGO_BIN" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  ERROR: TANGO binary not found at $TANGO_BIN"
    echo "  Fix: Copy your TANGO binary to $TANGO_BIN"
    FAILURES=$((FAILURES + 1))
fi

# Check 2: TANGO binary is executable
if [ -f "$TANGO_BIN" ]; then
    echo -n "Checking TANGO binary is executable... "
    if [ -x "$TANGO_BIN" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC}"
        echo "  WARNING: TANGO binary is not executable"
        echo "  Fixing: chmod +x $TANGO_BIN"
        chmod +x "$TANGO_BIN" || {
            echo "  ERROR: Failed to make binary executable"
            FAILURES=$((FAILURES + 1))
        }
    fi
fi

# Check 3: macOS quarantine (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [ -f "$TANGO_BIN" ]; then
        echo -n "Checking macOS quarantine... "
        if xattr -l "$TANGO_BIN" 2>/dev/null | grep -q "com.apple.quarantine"; then
            echo -e "${YELLOW}⚠${NC}"
            echo "  WARNING: TANGO binary is quarantined"
            echo "  Fixing: xattr -d com.apple.quarantine $TANGO_BIN"
            xattr -d com.apple.quarantine "$TANGO_BIN" 2>/dev/null || {
                echo "  ERROR: Failed to remove quarantine (may need sudo)"
                FAILURES=$((FAILURES + 1))
            }
        else
            echo -e "${GREEN}✓${NC}"
        fi
    fi
fi

# Check 4: Runtime directories exist
echo -n "Checking runtime directories... "
RUNTIME_DIR="${TANGO_RUNTIME_DIR:-$BACKEND_DIR/.run_cache/Tango}"
WORK_DIR="$RUNTIME_DIR/work"
OUT_DIR="$RUNTIME_DIR/out"

if [ -d "$WORK_DIR" ] && [ -d "$OUT_DIR" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo "  WARNING: Runtime directories missing"
    echo "  Fixing: mkdir -p $WORK_DIR $OUT_DIR"
    mkdir -p "$WORK_DIR" "$OUT_DIR" || {
        echo "  ERROR: Failed to create runtime directories"
        FAILURES=$((FAILURES + 1))
    }
fi

# Check 5: Runtime directories are writable
if [ -d "$WORK_DIR" ] && [ -d "$OUT_DIR" ]; then
    echo -n "Checking runtime directories are writable... "
    if [ -w "$WORK_DIR" ] && [ -w "$OUT_DIR" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        echo "  ERROR: Runtime directories are not writable"
        echo "  Fix: chmod -R u+w $WORK_DIR $OUT_DIR"
        FAILURES=$((FAILURES + 1))
    fi
fi

# Check 6: Docker availability (optional, for PSIPRED)
echo -n "Checking Docker availability (optional)... "
if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC}"
        echo "  WARNING: Docker is installed but not running"
        echo "  Fix: Start Docker Desktop or docker daemon"
    fi
else
    echo -e "${YELLOW}⚠${NC}"
    echo "  WARNING: Docker not found (optional, needed for PSIPRED)"
fi

# Check 7: Python packages (basic check)
echo -n "Checking Python packages... "
if [ -d "$BACKEND_DIR/.venv" ] || [ -d "$BACKEND_DIR/venv" ]; then
    VENV_DIR="$BACKEND_DIR/.venv"
    [ -d "$BACKEND_DIR/venv" ] && VENV_DIR="$BACKEND_DIR/venv"
    
    if [ -f "$VENV_DIR/bin/python" ] || [ -f "$VENV_DIR/bin/python3" ]; then
        PYTHON_BIN="$VENV_DIR/bin/python"
        [ -f "$VENV_DIR/bin/python3" ] && PYTHON_BIN="$VENV_DIR/bin/python3"
        
        if "$PYTHON_BIN" -c "import fastapi, pandas, httpx" >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⚠${NC}"
            echo "  WARNING: Some Python packages missing"
            echo "  Fix: pip install -r $BACKEND_DIR/requirements.txt"
        fi
    else
        echo -e "${YELLOW}⚠${NC}"
        echo "  WARNING: Virtual environment Python not found"
    fi
else
    echo -e "${YELLOW}⚠${NC}"
    echo "  WARNING: Virtual environment not found"
    echo "  Fix: python3 -m venv $BACKEND_DIR/.venv"
fi

# Check 8: Rosetta 2 (Apple Silicon only)
if [[ "$OSTYPE" == "darwin"* ]] && [[ $(uname -m) == "arm64" ]]; then
    echo -n "Checking Rosetta 2 (Apple Silicon)... "
    if arch -x86_64 /usr/bin/true >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC}"
        echo "  WARNING: Rosetta 2 not installed (needed for x86_64 TANGO binary)"
        echo "  Fix: softwareupdate --install-rosetta --agree-to-license"
    fi
fi

echo ""
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ All preflight checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILURES check(s) failed${NC}"
    exit 1
fi

