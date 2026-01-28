#!/bin/bash
# Smoke test: runs a tiny UniProt query (2 sequences), validates at least 2 Tango outputs exist.
# Exits non-zero if not.

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
API_BASE="${API_BASE:-http://127.0.0.1:8000}"
QUERY="accession:P0DI90 OR accession:C0HK44"  # 2 sequences
EXPECTED_MIN=2

echo "🧪 Running UniProt smoke test..."
echo "  API: $API_BASE"
echo "  Query: $QUERY"
echo "  Expected: at least $EXPECTED_MIN TANGO outputs"
echo ""

# Check API is reachable
echo -n "Checking API health... "
if curl -s -f "$API_BASE/api/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  ERROR: API not reachable at $API_BASE"
    echo "  Fix: Start backend server: cd backend && uvicorn server:app --host 0.0.0.0 --port 8000"
    exit 1
fi

# Execute UniProt query
echo -n "Executing UniProt query... "
RESPONSE=$(curl -s -X POST "$API_BASE/api/uniprot/execute" \
    -H "Content-Type: application/json" \
    -d "{
        \"query\": \"$QUERY\",
        \"run_tango\": true,
        \"run_psipred\": false,
        \"size\": 10
    }")

if [ $? -ne 0 ]; then
    echo -e "${RED}✗${NC}"
    echo "  ERROR: Failed to execute query"
    exit 1
fi

# Check response has rows
ROW_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('rows', [])))" 2>/dev/null || echo "0")

if [ "$ROW_COUNT" -lt "$EXPECTED_MIN" ]; then
    echo -e "${RED}✗${NC}"
    echo "  ERROR: Expected at least $EXPECTED_MIN rows, got $ROW_COUNT"
    exit 1
fi

echo -e "${GREEN}✓${NC} ($ROW_COUNT rows)"
echo ""

# Check TANGO provider status
echo -n "Checking TANGO provider status... "
TANGO_STATUS=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('meta', {}).get('provider_status', {}).get('tango', {}).get('status', 'UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")

if [ "$TANGO_STATUS" = "AVAILABLE" ] || [ "$TANGO_STATUS" = "PARTIAL" ]; then
    echo -e "${GREEN}✓${NC} ($TANGO_STATUS)"
else
    echo -e "${YELLOW}⚠${NC} ($TANGO_STATUS)"
    echo "  WARNING: TANGO status is not AVAILABLE or PARTIAL"
fi

# Check TANGO outputs count
echo -n "Checking TANGO outputs count... "
PARSED_OK=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('meta', {}).get('provider_status', {}).get('tango', {}).get('stats', {}).get('parsed_ok', 0))" 2>/dev/null || echo "0")

if [ "$PARSED_OK" -ge "$EXPECTED_MIN" ]; then
    echo -e "${GREEN}✓${NC} ($PARSED_OK outputs)"
else
    echo -e "${RED}✗${NC} ($PARSED_OK outputs, expected at least $EXPECTED_MIN)"
    echo "  ERROR: TANGO produced fewer outputs than expected"
    
    # Try to get reason
    REASON=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('meta', {}).get('provider_status', {}).get('tango', {}).get('reason', 'Unknown'))" 2>/dev/null || echo "Unknown")
    echo "  Reason: $REASON"
    
    exit 1
fi

# Check computed fields exist (always present, independent of provider status)
echo -n "Checking computed fields exist... "
HAS_COMPUTED_FIELDS=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = data.get('rows', [])
if not rows:
    print('false')
    sys.exit(0)
first_row = rows[0]
# Check required computed fields (biochem + FF-Helix)
has_hydro = 'hydrophobicity' in first_row or 'Hydrophobicity' in first_row
has_charge = 'charge' in first_row or 'Charge' in first_row
has_ff = 'ffHelixPercent' in first_row or 'FF-Helix %' in first_row or 'FF-Helix Percent' in first_row
print('true' if (has_hydro and has_charge and has_ff) else 'false')
" 2>/dev/null || echo "false")

if [ "$HAS_COMPUTED_FIELDS" = "true" ]; then
    echo -e "${GREEN}✓${NC} (hydrophobicity, charge, ffHelixPercent)"
else
    echo -e "${RED}✗${NC}"
    echo "  ERROR: Missing required computed fields"
    exit 1
fi

# Check that sswPrediction only exists if TANGO ran (truth-based validation)
echo -n "Checking provider status truth (sswPrediction)... "
TANGO_RAN=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('meta', {}).get('provider_status', {}).get('tango', {}).get('ran', False))" 2>/dev/null || echo "false")
ROWS_WITH_SSW_VALUE=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = data.get('rows', [])
# Count rows where sswPrediction exists AND has a non-null value
count = sum(1 for r in rows if r.get('sswPrediction') is not None and r.get('sswPrediction') != 'null')
print(count)
" 2>/dev/null || echo "0")

if [ "$TANGO_RAN" = "True" ]; then
    if [ "$ROWS_WITH_SSW_VALUE" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} (TANGO ran, $ROWS_WITH_SSW_VALUE rows with sswPrediction)"
    else
        echo -e "${YELLOW}⚠${NC} (TANGO ran but no rows have sswPrediction values)"
    fi
else
    if [ "$ROWS_WITH_SSW_VALUE" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} (TANGO didn't run, no sswPrediction values - correct)"
    else
        echo -e "${YELLOW}⚠${NC} (TANGO didn't run but $ROWS_WITH_SSW_VALUE rows have sswPrediction - may be legacy data)"
    fi
fi

echo ""
echo -e "${GREEN}✅ Smoke test passed!${NC}"
echo "  Rows: $ROW_COUNT"
echo "  TANGO outputs: $PARSED_OK"
echo "  Rows with TANGO data: $ROWS_WITH_TANGO"
exit 0

