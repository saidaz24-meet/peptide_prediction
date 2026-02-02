#!/usr/bin/env python3
"""
TANGO Smoke Test Script

Verifies TANGO binary executes correctly and produces parseable output.
INVARIANT: For N inputs, we MUST parse N outputs OR fail loudly.

Exit code 0 = success, 1 = failure

Usage:
    python scripts/smoke_tango.py         # Test with 1 input (default)
    python scripts/smoke_tango.py 3       # Test with 3 inputs

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
    # Parse optional n_inputs argument
    n_inputs = 1
    if len(sys.argv) > 1:
        try:
            n_inputs = int(sys.argv[1])
            if n_inputs < 1 or n_inputs > 3:
                print("Error: n_inputs must be 1, 2, or 3")
                return 1
        except ValueError:
            print(f"Error: Invalid argument '{sys.argv[1]}'. Expected integer 1-3.")
            return 1

    print("=" * 60)
    print(f"TANGO Smoke Test (N={n_inputs} inputs)")
    print("=" * 60)
    print(f"\nINVARIANT: For {n_inputs} inputs, we MUST parse {n_inputs} outputs")

    result = smoke_test_tango(n_inputs=n_inputs)

    print(f"\nResult:")
    print(json.dumps(result, indent=2, default=str))

    if result.get("success"):
        print("\n" + "=" * 60)
        print(f"✅ TANGO smoke test PASSED")
        print("=" * 60)

        print(f"\nInputs:          {result.get('inputs_count')}")
        print(f"Outputs expected: {len(result.get('outputs_expected', []))}")
        print(f"Outputs found:    {len(result.get('outputs_found', []))}")
        print(f"Outputs parsed:   {result.get('outputs_parsed')}")
        print(f"Duration:         {result.get('duration_ms')}ms")

        # Verify invariant explicitly
        inputs = result.get("inputs_count", 0)
        parsed = result.get("outputs_parsed", 0)
        if inputs == parsed:
            print(f"\n✅ INVARIANT SATISFIED: {inputs} inputs → {parsed} outputs")
        else:
            print(f"\n❌ INVARIANT VIOLATED: {inputs} inputs → {parsed} outputs")
            return 1

        return 0
    else:
        print("\n" + "=" * 60)
        print("❌ TANGO smoke test FAILED")
        print("=" * 60)

        print(f"\nFailed at stage: {result.get('stage')}")
        print(f"Error: {result.get('error')}")
        print(f"\nInputs:          {result.get('inputs_count')}")
        print(f"Outputs expected: {result.get('outputs_expected')}")
        print(f"Outputs found:    {result.get('outputs_found')}")

        if result.get("run_meta_path"):
            print(f"\nRun meta: {result.get('run_meta_path')}")
            meta_path = result["run_meta_path"]
            if os.path.exists(meta_path):
                try:
                    with open(meta_path) as f:
                        meta = json.load(f)
                    print("\nrun_meta.json contents:")
                    print(json.dumps(meta, indent=2, default=str))
                except Exception as e:
                    print(f"  Could not read: {e}")
            else:
                print("  run_meta.json not found")

        return 1


if __name__ == "__main__":
    sys.exit(main())
