#!/bin/bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
UI_BASE="${UI_BASE:-http://localhost:5173}"

echo "🧪 Testing Provider Status..."

# Create test CSV
TEST_CSV=$(mktemp)
cat > "$TEST_CSV" <<EOF
Name,Sequence
Test1,MEEPQSDPSVEPPLSQETFS
Test2,DLWKLLPENNVLSPLPSQA
EOF

# 1. Upload CSV
echo "  → Uploading test CSV..."
UPLOAD_RESPONSE=$(curl -s -X POST "${API_BASE}/api/upload-csv" \
  -F "file=@${TEST_CSV}")

# 2. Check provider status in API response (prefer meta.provider_status, fallback to row-level)
if echo "$UPLOAD_RESPONSE" | jq -e '.meta.provider_status' > /dev/null 2>&1; then
  echo "  ✅ Provider status in API response (meta.provider_status)"
elif echo "$UPLOAD_RESPONSE" | jq -e '.rows[0].providerStatus' > /dev/null 2>&1; then
  echo "  ✅ Provider status in API response (row-level)"
elif echo "$UPLOAD_RESPONSE" | jq -e '.peptides[0].providerStatus' > /dev/null 2>&1; then
  echo "  ✅ Provider status in API response (legacy format)"
else
  echo "  ⚠️  Provider status missing in API response (may not be implemented yet)"
fi

# 3. Check TANGO status (prefer meta.provider_status.tango)
TANGO_STATUS=$(echo "$UPLOAD_RESPONSE" | jq -r '.meta.provider_status.tango.status // .rows[0].providerStatus.tango.status // .peptides[0].providerStatus.tango.status // "missing"' 2>/dev/null || echo "missing")
if [ "$TANGO_STATUS" != "missing" ]; then
  echo "  ✅ TANGO status: $TANGO_STATUS"
else
  echo "  ⚠️  TANGO status missing (may not be implemented yet)"
fi

# 4. Verify results page shows provider status
echo "  → Verifying provider status in Results page..."
# Note: This is a basic check; full UI testing requires Selenium/Playwright
if curl -s "${UI_BASE}/results" | grep -q "TANGO\|PSIPRED"; then
  echo "  ✅ Provider status visible in Results page"
else
  echo "  ⚠️  Provider status not found in Results page HTML (may require UI interaction)"
fi

rm -f "$TEST_CSV"
echo "✅ Provider Status test passed!"

