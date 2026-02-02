#!/usr/bin/env python3
"""
TANGO Smoke Test Script

Verifies that TANGO binary executes correctly and produces parseable output.
Exit code 0 = success, 1 = failure

Usage:
    python scripts/smoke_tango.py

Or via Makefile:
    make smoke-tango
"""
import os
import sys
import json

# Set USE_TANGO=1 to enable TANGO
os.environ["USE_TANGO"] = "1"

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tango import smoke_test_tango


def main():
    print("=" * 60)
    print("TANGO Smoke Test")
    print("=" * 60)

    result = smoke_test_tango()

    print(f"\nResult:")
    print(json.dumps(result, indent=2))

    if result.get("success"):
        print("\n" + "=" * 60)
        print("✅ TANGO smoke test PASSED")
        print("=" * 60)

        ssw = result.get("ssw_values", {})
        print(f"\nSSW Values:")
        print(f"  Helix %:  {ssw.get('helix_pct')}")
        print(f"  Beta %:   {ssw.get('beta_pct')}")
        print(f"  Score:    {ssw.get('ssw_score')}")
        print(f"  Diff:     {ssw.get('ssw_diff')}")
        print(f"\nDuration: {result.get('duration_ms')}ms")

        return 0
    else:
        print("\n" + "=" * 60)
        print("❌ TANGO smoke test FAILED")
        print("=" * 60)

        print(f"\nFailed at stage: {result.get('stage')}")
        print(f"Error: {result.get('error')}")

        if result.get("run_dir"):
            print(f"\nRun directory: {result.get('run_dir')}")
            print("Check run_meta.json for diagnostics:")
            meta_path = os.path.join(result["run_dir"], "run_meta.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path) as f:
                        meta = json.load(f)
                    print(json.dumps(meta, indent=2))
                except Exception as e:
                    print(f"  Could not read: {e}")
            else:
                print("  run_meta.json not found")

        return 1


if __name__ == "__main__":
    sys.exit(main())
