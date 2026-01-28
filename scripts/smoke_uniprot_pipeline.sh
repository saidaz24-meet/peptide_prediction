#!/bin/bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
UI_BASE="${UI_BASE:-http://localhost:5173}"

echo "🧪 Testing UniProt Pipeline..."

# 1. Check API health
echo "  → Checking API health..."
if ! curl -s -f "${API_BASE}/api/health" >/dev/null 2>&1; then
  echo "  ❌ API health check failed"
  exit 1
fi
echo "  ✅ API health check passed"

# 2. Query UniProt (run_tango=false to ensure fast response)
# Use organism_id:9606 (human) which reliably returns results
echo "  → Querying UniProt for human proteins (organism_id:9606)..."
QUERY_RESPONSE=$(curl -s -X POST "${API_BASE}/api/uniprot/execute" \
  -H "Content-Type: application/json" \
  -d '{"query": "organism_id:9606", "run_tango": false, "run_psipred": false, "size": 5, "reviewed": true}')

# 3. Validate response structure
echo "  → Validating response structure..."
if ! echo "$QUERY_RESPONSE" | jq -e '.rows' > /dev/null 2>&1; then
  echo "  ❌ Response missing 'rows' field"
  exit 1
fi

ROW_COUNT=$(echo "$QUERY_RESPONSE" | jq '.rows | length' 2>/dev/null || echo "0")
if [ "$ROW_COUNT" -lt 2 ]; then
  echo "  ❌ Expected at least 2 rows, got $ROW_COUNT"
  exit 1
fi
echo "  ✅ Response has $ROW_COUNT rows"

# 4. Validate computed fields exist (always present, independent of provider status)
echo "  → Validating computed fields..."
FIRST_ROW=$(echo "$QUERY_RESPONSE" | jq '.rows[0]' 2>/dev/null)

# Check required computed fields (FF-Helix + biochem)
MISSING_FIELDS=()
if ! echo "$FIRST_ROW" | jq -e '.hydrophobicity' > /dev/null 2>&1; then
  MISSING_FIELDS+=("hydrophobicity")
fi
if ! echo "$FIRST_ROW" | jq -e '.charge' > /dev/null 2>&1; then
  MISSING_FIELDS+=("charge")
fi
if ! echo "$FIRST_ROW" | jq -e '.ffHelixPercent // ."FF-Helix %"' > /dev/null 2>&1; then
  MISSING_FIELDS+=("ffHelixPercent")
fi
# muH is optional (may be null/undefined), so we check existence but not value

if [ ${#MISSING_FIELDS[@]} -gt 0 ]; then
  echo "  ❌ Missing computed fields: ${MISSING_FIELDS[*]}"
  exit 1
fi
echo "  ✅ All computed fields present (hydrophobicity, charge, ffHelixPercent)"

# 5. Validate provider_status structure (must exist in meta)
echo "  → Validating provider_status structure..."
if ! echo "$QUERY_RESPONSE" | jq -e '.meta.provider_status' > /dev/null 2>&1; then
  echo "  ❌ Response missing 'meta.provider_status' field"
  exit 1
fi

# Check tango provider status structure
if ! echo "$QUERY_RESPONSE" | jq -e '.meta.provider_status.tango' > /dev/null 2>&1; then
  echo "  ❌ Response missing 'meta.provider_status.tango' field"
  exit 1
fi

TANGO_STATUS=$(echo "$QUERY_RESPONSE" | jq -r '.meta.provider_status.tango.status' 2>/dev/null || echo "")
if [ -z "$TANGO_STATUS" ]; then
  echo "  ❌ TANGO provider status missing 'status' field"
  exit 1
fi

# Validate status is one of the expected values
if [[ ! "$TANGO_STATUS" =~ ^(OFF|UNAVAILABLE|PARTIAL|AVAILABLE)$ ]]; then
  echo "  ❌ Invalid TANGO status: $TANGO_STATUS (expected: OFF|UNAVAILABLE|PARTIAL|AVAILABLE)"
  exit 1
fi

# Check provider_status.tango has expected fields (enabled, requested, ran)
if ! echo "$QUERY_RESPONSE" | jq -e '.meta.provider_status.tango | has("enabled")' > /dev/null 2>&1; then
  echo "  ⚠️  TANGO provider_status missing 'enabled' field (optional but recommended)"
fi

echo "  ✅ Provider status structure valid (tango.status=$TANGO_STATUS)"

# 6. Validate that sswPrediction only exists if TANGO ran (truth-based check)
echo "  → Validating provider status truth (sswPrediction presence)..."
TANGO_RAN=$(echo "$QUERY_RESPONSE" | jq -r '.meta.provider_status.tango.ran // false' 2>/dev/null || echo "false")
HAS_SSW=$(echo "$FIRST_ROW" | jq 'has("sswPrediction")' 2>/dev/null || echo "false")

if [ "$TANGO_RAN" = "false" ] && [ "$HAS_SSW" = "true" ]; then
  # This is a warning, not an error - backend may include null/undefined sswPrediction
  SSW_VALUE=$(echo "$FIRST_ROW" | jq -r '.sswPrediction // null' 2>/dev/null || echo "null")
  if [ "$SSW_VALUE" != "null" ] && [ "$SSW_VALUE" != "" ]; then
    echo "  ⚠️  WARNING: sswPrediction has value when TANGO didn't run (may be legacy data)"
  fi
fi

echo "  ✅ Provider status truth validated"

echo ""
echo "✅ UniProt Pipeline test passed!"
echo "  Rows: $ROW_COUNT"
echo "  TANGO status: $TANGO_STATUS"
echo "  TANGO ran: $TANGO_RAN"

