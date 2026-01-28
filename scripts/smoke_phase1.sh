#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🧪 Running Phase 1 Smoke Tests..."
echo ""

# Preflight checks (verify environment before running tests)
echo "Preflight: Environment checks"
if ./checks/preflight.sh; then
  echo "✅ Preflight checks passed"
else
  echo "❌ Preflight checks failed"
  exit 1
fi
echo ""

# Test 1.1
echo "Test 1.1: UniProt Pipeline"
if ./scripts/smoke_uniprot_pipeline.sh; then
  echo "✅ Test 1.1 passed"
else
  echo "❌ Test 1.1 failed"
  exit 1
fi
echo ""

# Test 1.2
echo "Test 1.2: Provider Status"
if ./scripts/smoke_provider_status.sh; then
  echo "✅ Test 1.2 passed"
else
  echo "❌ Test 1.2 failed"
  exit 1
fi
echo ""

# Test 1.3
echo "Test 1.3: Structured Logging"
if ./scripts/smoke_logging.sh; then
  echo "✅ Test 1.3 passed"
else
  echo "❌ Test 1.3 failed"
  exit 1
fi
echo ""

echo "🎉 All Phase 1 tests passed!"

