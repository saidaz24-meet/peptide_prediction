# Test Fixtures

**Purpose**: Sample input files used by test suites to validate parsing, normalization, and pipeline logic.

**Location**: `backend/tests/fixtures/`

---

## CSV Fixtures

### `normal.csv`
**Purpose**: Standard valid CSV with all expected columns.  
**Used by**: `test_golden_pipeline.py::test_normal_csv()`

**Content**:
- 3 rows with Entry, Sequence, Length, Organism, Protein name
- All standard amino acids (A-Z)
- Valid data types and formats

**Tests**:
- Basic parsing and column normalization
- Entry/ID alignment preservation
- Biochemical feature calculation
- FF-Helix% computation

---

### `missing_headers.csv`
**Purpose**: CSV file without header row (data starts immediately).  
**Used by**: `test_golden_pipeline.py::test_missing_headers()`

**Content**:
- 3 rows of data, no header line
- Columns: Entry, Sequence, Length (inferred from position)

**Tests**:
- Header detection and inference
- Error handling for missing headers
- Graceful failure when required columns can't be identified

**Expected Behavior**: Should be rejected by `require_cols()` validation.

---

### `ambiguous_headers.csv`
**Purpose**: CSV with multiple columns matching the same canonical name (ambiguous mapping).  
**Used by**: `test_golden_pipeline.py::test_ambiguous_headers()`

**Content**:
- Headers: `Entry`, `Entry ID (Primary)`, `Sequence`, `Length`
- Two columns could map to "Entry" canonical name

**Tests**:
- Ambiguous header detection
- Error handling for ambiguous column mappings
- HTTPException 400 for ambiguous headers

**Expected Behavior**: Should raise HTTPException 400 during `canonicalize_headers()`.

---

### `weird_delimiter.csv`
**Purpose**: Tab-separated file (TSV) to test delimiter auto-detection.  
**Used by**: `test_golden_pipeline.py::test_weird_delimiter()`

**Content**:
- Tab-separated values (TSV format)
- Headers: Entry, Sequence, Length, Description
- Contains commas in Description field (tests delimiter detection)

**Tests**:
- Delimiter auto-detection (tab vs comma)
- Handling of special characters in fields
- TSV parsing logic

---

### `nans_empty.csv`
**Purpose**: CSV with NaN values and empty sequences to test data cleaning.  
**Used by**: `test_golden_pipeline.py::test_nans_empty()`

**Content**:
- Row with empty Sequence (P67890)
- Row with "nan" as string (P99999)
- Mixed valid and invalid data

**Tests**:
- NaN handling and data cleaning
- Empty sequence detection
- Pipeline robustness with missing data
- Validation of required fields

---

### `nonstandard_aa.csv`
**Purpose**: CSV with non-standard amino acid codes (X, B, Z, *).  
**Used by**: `test_golden_pipeline.py::test_nonstandard_aa()`

**Content**:
- Sequences containing: X (unknown), B (Asn/Asp), * (stop codon)
- Tests sequence validation and sanitization

**Tests**:
- Non-standard amino acid handling
- Sequence sanitization logic
- Biochemical calculation with ambiguous residues

---

## Inline Test Data

Some tests use inline CSV content instead of fixture files:

### `test_api_contracts.py`
**Fixture**: Inline `TEST_CSV_CONTENT` string  
**Content**: Simple 2-row CSV with Entry and Sequence columns  
**Used by**:
- `test_upload_csv_returns_rows_and_meta()`
- `test_upload_csv_rows_have_camelcase_keys()`
- `test_upload_csv_all_rows_have_consistent_format()`
- `test_upload_csv_meta_has_provider_status()`

**Note**: Consider extracting to `fixtures/simple.csv` for reuse.

---

## Example Dataset (Not in Fixtures)

**File**: `ui/public/Final_Staphylococcus_2023_new.xlsx`  
**Purpose**: Production example dataset served via `GET /api/example`  
**Used by**: `backend/services/example_service.py::load_example_data()`

**Note**: This is a large production dataset, not a test fixture. It's kept in `ui/public/` for the example endpoint.

---

## Usage in Tests

### Current Pattern (golden_inputs/)
```python
csv_path = os.path.join(os.path.dirname(__file__), "golden_inputs", "normal.csv")
df = run_pipeline_on_csv(csv_path)
```

### Future Pattern (fixtures/)
```python
csv_path = os.path.join(os.path.dirname(__file__), "fixtures", "normal.csv")
df = run_pipeline_on_csv(csv_path)
```

**Migration Note**: Tests currently use `golden_inputs/`. Fixtures are copied here for organization. Tests can be migrated to use `fixtures/` when convenient.

---

## Adding New Fixtures

1. **Create fixture file** in `backend/tests/fixtures/`
2. **Update this README** with:
   - Purpose and content description
   - Which test uses it
   - Expected behavior
3. **Add test** that uses the fixture
4. **Keep fixtures small** (< 10 rows recommended for fast tests)

**Naming Convention**: `{purpose}_{variant}.csv` (e.g., `unicode_bom.csv`, `large_file.csv`)

---

## File Formats Supported

- **CSV**: Comma-separated (`.csv`)
- **TSV**: Tab-separated (`.tsv` or `.csv` with tabs)
- **XLSX**: Excel format (`.xlsx`) - for example dataset only
- **TXT**: Text files with delimiters

**Note**: All fixtures are currently CSV format. TSV/XLSX fixtures can be added as needed.

---

## Maintenance

- **Keep fixtures small**: Fast test execution
- **Document changes**: Update README when fixtures change
- **Version control**: All fixtures are tracked in git
- **No generated data**: Fixtures are static, manually created test inputs

