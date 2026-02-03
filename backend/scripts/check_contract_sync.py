#!/usr/bin/env python3
"""
Contract Sync Check: Validates backend/schemas/api_models.py matches ui/src/types/peptide.ts

Canonical source of truth: backend/schemas/api_models.py (PeptideRow)
Consumer: ui/src/types/peptide.ts (Peptide)

This script extracts field names from both files and asserts they align.
Run with: make contract-check
"""

import re
import sys
from pathlib import Path

# Paths relative to backend/
BACKEND_SCHEMA = Path(__file__).parent.parent / "schemas" / "api_models.py"
UI_TYPES = Path(__file__).parent.parent.parent / "ui" / "src" / "types" / "peptide.ts"

# Canonical contract fields from PeptideRow (backend)
# These MUST exist in both backend and frontend
CONTRACT_FIELDS = {
    # Required
    "id",
    "sequence",
    # Identity
    "name",
    "species",
    "length",
    # Biochem
    "hydrophobicity",
    "charge",
    "muH",
    # SSW/TANGO
    "sswPrediction",
    "sswScore",
    "sswDiff",
    "sswHelixPercentage",
    "sswBetaPercentage",
    # Tango summary
    "tangoHasData",
    "tangoAggMax",
    "tangoBetaMax",
    "tangoHelixMax",
    # FF-Helix
    "ffHelixPercent",
    "ffHelixFragments",
    # Provider status
    "providerStatus",
}

# Known frontend aliases (UI uses different names for some fields)
# Format: backend_name -> frontend_name
KNOWN_ALIASES = {
    "sswHelixPercentage": "sswHelixPct",
    "sswBetaPercentage": "sswBetaPct",
    "extras": "extra",
}


def extract_pydantic_fields(filepath: Path) -> set:
    """Extract field names from PeptideRow Pydantic model."""
    text = filepath.read_text()

    # Find PeptideRow class block
    match = re.search(r"class PeptideRow\(BaseModel\):(.*?)(?=\nclass |\Z)", text, re.DOTALL)
    if not match:
        print(f"ERROR: Could not find PeptideRow class in {filepath}")
        sys.exit(1)

    class_body = match.group(1)

    # Extract field definitions: field_name: Type = Field(...)
    # Matches: "    field_name: Optional[type] = Field(...)"
    field_pattern = r"^\s+(\w+):\s+(?:Optional\[)?\w+"
    fields = set(re.findall(field_pattern, class_body, re.MULTILINE))

    # Remove internal fields
    fields.discard("model_config")

    return fields


def extract_typescript_fields(filepath: Path) -> set:
    """Extract field names from Peptide TypeScript type."""
    text = filepath.read_text()

    # Find Peptide type block (export type Peptide = { ... })
    match = re.search(r"export type Peptide\s*=\s*\{(.*?)\n\};", text, re.DOTALL)
    if not match:
        print(f"ERROR: Could not find Peptide type in {filepath}")
        sys.exit(1)

    type_body = match.group(1)

    # Extract field definitions: fieldName?: Type | null;
    # Matches: "  fieldName: Type" or "  fieldName?: Type"
    field_pattern = r"^\s+(\w+)\??:"
    fields = set(re.findall(field_pattern, type_body, re.MULTILINE))

    return fields


def check_contract():
    """Check that contract fields exist in both backend and frontend."""
    print("=" * 60)
    print("Contract Sync Check")
    print("=" * 60)
    print(f"Backend: {BACKEND_SCHEMA}")
    print(f"Frontend: {UI_TYPES}")
    print()

    if not BACKEND_SCHEMA.exists():
        print(f"ERROR: Backend schema not found: {BACKEND_SCHEMA}")
        sys.exit(1)

    if not UI_TYPES.exists():
        print(f"ERROR: Frontend types not found: {UI_TYPES}")
        sys.exit(1)

    backend_fields = extract_pydantic_fields(BACKEND_SCHEMA)
    frontend_fields = extract_typescript_fields(UI_TYPES)

    print(f"Backend PeptideRow fields: {len(backend_fields)}")
    print(f"Frontend Peptide fields: {len(frontend_fields)}")
    print()

    # Check each contract field
    errors = []
    warnings = []

    for field in sorted(CONTRACT_FIELDS):
        in_backend = field in backend_fields
        frontend_name = KNOWN_ALIASES.get(field, field)
        in_frontend = frontend_name in frontend_fields

        if not in_backend:
            errors.append(f"MISSING in backend: {field}")
        elif not in_frontend:
            errors.append(f"MISSING in frontend: {field} (expected: {frontend_name})")
        elif field in KNOWN_ALIASES:
            warnings.append(f"ALIAS: backend '{field}' -> frontend '{frontend_name}'")

    # Report results
    if warnings:
        print("⚠️  Known Aliases (acceptable drift):")
        for w in warnings:
            print(f"   {w}")
        print()

    if errors:
        print("❌ Contract Violations:")
        for e in errors:
            print(f"   {e}")
        print()
        print("FAILED: Contract sync check failed")
        sys.exit(1)
    else:
        print("✅ All contract fields present in both backend and frontend")
        print("PASSED: Contract sync check passed")
        sys.exit(0)


if __name__ == "__main__":
    check_contract()
