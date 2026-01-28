#!/usr/bin/env python3
"""
Smoke test for backend API endpoints.
Tests /api/example and /api/predict without requiring full setup.

Usage:
    # Ensure server is running first:
    # cd backend && uvicorn server:app --host 127.0.0.1 --port 8000
    
    # Then run this script:
    python scripts/smoke_test_backend.py
    
    # Or specify custom base URL:
    API_BASE_URL=http://localhost:8000 python scripts/smoke_test_backend.py
"""

import os
import sys
import requests
import json

# Default API base URL
API_BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")


def test_health():
    """Test /api/health endpoint"""
    print("\n🏥 Testing /api/health...")
    try:
        response = requests.get(f"{API_BASE}/api/health", timeout=5)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("ok") is True, "Health check should return ok: true"
        print("  ✅ Health check passed")
        return True
    except requests.exceptions.ConnectionError:
        print(f"  ❌ Cannot connect to {API_BASE}")
        print(f"  💡 Make sure the server is running:")
        print(f"     cd backend && uvicorn server:app --host 127.0.0.1 --port 8000")
        return False
    except Exception as e:
        print(f"  ❌ Health check failed: {e}")
        return False


def test_example():
    """Test /api/example endpoint"""
    print("\n📊 Testing /api/example...")
    try:
        response = requests.get(f"{API_BASE}/api/example?recalc=0", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check response structure
        assert "rows" in data, "Response missing 'rows' key"
        assert "meta" in data, "Response missing 'meta' key"
        
        rows = data["rows"]
        assert isinstance(rows, list), f"'rows' should be a list, got {type(rows)}"
        assert len(rows) > 0, "Expected at least one row in example data"
        
        # Check first row structure
        first_row = rows[0]
        assert "id" in first_row or "Entry" in first_row, "Row missing 'id' or 'Entry'"
        assert "sequence" in first_row, "Row missing 'sequence'"
        
        # Check meta structure
        meta = data["meta"]
        assert isinstance(meta, dict), f"'meta' should be a dict, got {type(meta)}"
        
        print(f"  ✅ Example endpoint passed ({len(rows)} rows returned)")
        
        # Verify no "0 becomes -1" errors
        for i, row in enumerate(rows[:10]):  # Check first 10 rows
            # Check SSW prediction
            if "sswPrediction" in row and row["sswPrediction"] == 0:
                assert row["sswPrediction"] == 0, \
                    f"Row {i}: sswPrediction 0 was changed to {row['sswPrediction']}"
        
        print("  ✅ No '0 becomes -1' errors in example data")
        return True
        
    except Exception as e:
        print(f"  ❌ Example endpoint failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_predict():
    """Test /api/predict endpoint with a simple sequence"""
    print("\n🧬 Testing /api/predict...")
    try:
        # Test with a simple sequence
        test_sequence = "ACDEFGHIKLMNPQRSTVWY"  # 20 standard amino acids
        test_entry = "TEST001"
        
        form_data = {
            "sequence": test_sequence,
            "entry": test_entry,
        }
        
        response = requests.post(
            f"{API_BASE}/api/predict",
            data=form_data,
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check response structure
        assert "id" in data or "entry" in data, "Response missing 'id' or 'entry'"
        assert "sequence" in data, "Response missing 'sequence'"
        assert data["sequence"] == test_sequence, "Sequence mismatch in response"
        
        # Check that required output columns exist
        required_fields = ["charge", "hydrophobicity", "muH", "ffHelixPercent"]
        for field in required_fields:
            assert field in data, f"Response missing required field: {field}"
        
        # Verify calculations are numeric (or NaN/None, but not missing key)
        if "charge" in data and data["charge"] is not None:
            assert isinstance(data["charge"], (int, float)), \
                f"Charge should be numeric, got {type(data['charge'])}"
        
        if "hydrophobicity" in data and data["hydrophobicity"] is not None:
            assert isinstance(data["hydrophobicity"], (int, float)), \
                f"Hydrophobicity should be numeric, got {type(data['hydrophobicity'])}"
        
        print(f"  ✅ Predict endpoint passed")
        print(f"     Entry: {data.get('id', data.get('entry', 'N/A'))}")
        print(f"     Charge: {data.get('charge', 'N/A')}")
        print(f"     Hydrophobicity: {data.get('hydrophobicity', 'N/A')}")
        
        # Verify no "0 becomes -1" error
        if "sswPrediction" in data and data["sswPrediction"] == 0:
            assert data["sswPrediction"] == 0, \
                "sswPrediction 0 was changed to -1"
        
        return True
        
    except Exception as e:
        print(f"  ❌ Predict endpoint failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all smoke tests"""
    print("=" * 60)
    print("💨 Backend Smoke Test Suite")
    print("=" * 60)
    print(f"Testing API at: {API_BASE}")
    print()
    
    # Check if server is reachable first
    if not test_health():
        print("\n❌ Server is not reachable. Please start it first.")
        print("\nTo start the server:")
        print("  cd backend")
        print("  source .venv/bin/activate  # if using venv")
        print("  uvicorn server:app --host 127.0.0.1 --port 8000")
        return 1
    
    # Run tests
    tests = [
        test_example,
        test_predict,
    ]
    
    passed = 0
    failed = 0
    
    for test_func in tests:
        if test_func():
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    # Check if requests is available
    try:
        import requests
    except ImportError:
        print("❌ 'requests' library not found.")
        print("   Install it with: pip install requests")
        sys.exit(1)
    
    sys.exit(main())

