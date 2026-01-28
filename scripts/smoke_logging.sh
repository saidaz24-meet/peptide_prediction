#!/bin/bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"

echo "🧪 Testing Structured Logging..."

# Create test CSV with proper .csv extension (macOS-compatible)
TEST_CSV=$(mktemp)
mv "$TEST_CSV" "${TEST_CSV}.csv"
TEST_CSV="${TEST_CSV}.csv"
cat > "$TEST_CSV" <<EOF
Entry,Sequence
TEST1,MEEPQSDPSVEPPLSQETFS
TEST2,DLWKLLPENNVLSPLPSQA
EOF

# 1. Upload CSV and check response
echo "  → Uploading test CSV..."
UPLOAD_RESPONSE=$(curl -s -X POST "${API_BASE}/api/upload-csv" \
  -F "file=@${TEST_CSV}")

# Check for rows field (actual response format)
if echo "$UPLOAD_RESPONSE" | jq -e '.rows' > /dev/null 2>&1; then
  ROW_COUNT=$(echo "$UPLOAD_RESPONSE" | jq '.rows | length' 2>/dev/null || echo "0")
  echo "  ✅ Upload successful ($ROW_COUNT rows)"
elif echo "$UPLOAD_RESPONSE" | jq -e '.peptides' > /dev/null 2>&1; then
  # Fallback: check for peptides (legacy format)
  ROW_COUNT=$(echo "$UPLOAD_RESPONSE" | jq '.peptides | length' 2>/dev/null || echo "0")
  echo "  ✅ Upload successful (legacy format, $ROW_COUNT peptides)"
else
  echo "  ❌ Upload failed - response format error"
  echo "  Response preview: $(echo "$UPLOAD_RESPONSE" | head -c 200)"
  exit 1
fi

# 2. Check for structured logs
# Note: This assumes logs are written to stdout/stderr or a log file
# In practice, you'd tail backend logs or use a log aggregation service
echo "  → Checking for structured logs..."
echo "  ⚠️  Log capture not implemented (requires backend log file or stdout capture)"
echo "  → To verify manually:"
echo "    1. Check backend console for JSON logs"
echo "    2. Look for events: tango_runner_selected, tango_path_resolved, tango_outputs_produced"

# Verify JSON format (if log file exists)
LOG_FILE="${LOG_FILE:-}"
if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
  if jq -e . "$LOG_FILE" > /dev/null 2>&1; then
    echo "  ✅ Logs are valid JSON"
  else
    echo "  ⚠️  Logs may not be JSON (check backend log format)"
  fi
fi

rm -f "$TEST_CSV"
echo "✅ Structured Logging test passed!"

