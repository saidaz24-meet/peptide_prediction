# Execution Paths

End-to-end flows for the 3 most important user actions.

## Flow 1: UniProt Search → Analysis → Tango → Display

### Entrypoint
- **Frontend**: `ui/src/pages/Upload.tsx` → `UniProtQueryInput` component
- **API Endpoint**: `POST /api/uniprot/execute` (backend/server.py:1078)

### Step-by-Step Flow

1. **User Input** (`UniProtQueryInput.tsx`)
   - User enters query (e.g., `"amyloid organism_id:9606"`)
   - Frontend calls `POST /api/uniprot/parse` to validate query
   - User clicks "Execute Query"

2. **Query Execution** (`server.py:execute_uniprot_query()`)
   - Parse query mode (accession/keyword/organism/keyword_organism)
   - Build UniProt API URL via `build_uniprot_export_url()`
   - Fetch TSV from UniProt REST API (`https://rest.uniprot.org/uniprotkb/search`)
   - Parse TSV into DataFrame

3. **Column Normalization** (`services/normalize.py:normalize_cols()`)
   - Canonicalize headers (Entry, Sequence, Length)
   - Derive Length from Sequence if missing
   - **Input**: Raw DataFrame from UniProt
   - **Output**: Normalized DataFrame with required columns

4. **FF-Helix Computation** (`server.py:ensure_ff_cols()`)
   - Compute `FF-Helix %` via `auxiliary.ff_helix_percent()`
   - Compute `FF Helix fragments` via `auxiliary.ff_helix_cores()`
   - **Function**: `auxiliary.py:ff_helix_percent()` (pure Python, no external tools)

5. **Secondary Structure Provider** (`services/secondary_structure.py:get_provider()`)
   - If `request.run_psipred && USE_PSIPRED`:
     - Create PSIPRED input files (`psipred.create_psipred_input()`)
     - Run PSIPRED via Docker (`psipred.run_psipred()`)
     - Parse outputs (`psipred.process_psipred_output()`)
   - **Output**: DataFrame columns `Helix fragments (Psipred)`, `Psipred helix %`, `Psipred beta %`

6. **TANGO Processing** (if `request.run_tango && USE_TANGO`)
   - **Input Preparation** (`tango.py:create_tango_input()`)
     - Filter sequences (min length 5, sanitize ambiguous AAs)
     - Check cache (`get_all_existed_tango_results_entries()`)
     - Write input files to `backend/.run_cache/Tango/work/`:
       - `Tango_input_fmt1.txt` (inline params)
       - `Tango_input_fmt2.txt` (space-separated)
       - `Tango_input_fmt3.txt` (TSV)
   
   - **Execution** (`tango.py:run_tango_simple()`)
     - Create run directory: `backend/.run_cache/Tango/out/run_YYYYMMDD_HHMMSS/`
     - Generate script: `run_dir/Tango_run.sh`
       - Uses absolute path to `backend/Tango/bin/tango`
       - Each line: `"$BIN" <ENTRY> nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="<SEQ>" > "<ENTRY>.txt"`
     - Execute script: `bash Tango_run.sh` (cwd=run_dir)
     - **Output**: `run_dir/<ENTRY>.txt` per peptide
     - **Metadata**: `run_dir/run_meta.json` (diagnostics on failure)
   
   - **Parsing** (`tango.py:process_tango_output()`)
     - For each Entry in DataFrame:
       - Read `run_dir/<ENTRY>.txt`
       - Parse header table or fallback numeric extraction
       - Extract tracks: Beta, Helix, Turn, Aggregation
     - Compute metrics:
       - `SSW fragments` (secondary structure switch segments)
       - `SSW score` (average score)
       - `SSW diff` (helix-beta difference)
       - `SSW helix percentage`, `SSW beta percentage`
     - Merge into DataFrame (Entry-aligned mapping)
   
   - **SSW Prediction** (`tango.py:filter_by_avg_diff()`)
     - Compute threshold: mean/median of valid `SSW diff` values
     - For each row: `SSW prediction = 1 if diff <= threshold else -1`
     - **Gate**: Only compute for rows with valid TANGO metrics (not None)

7. **Biochemical Calculations** (`calculations/biochem.py:calculate_biochemical_features()`)
   - Compute `Charge` (net charge at pH 7)
   - Compute `Hydrophobicity` (Kyte-Doolittle scale)
   - Compute `Full length uH` (hydrophobic moment)

8. **FF Flags** (`server.py:apply_ff_flags()`)
   - `FF-Secondary structure switch` = 1 if `SSW prediction == 1 && Hydrophobicity >= avg_H`
   - `FF-Helix (Jpred)` = 1 if `Helix (Jpred) uH >= avg_uH` (JPred disabled, always -1)

9. **UI Normalization** (`services/normalize.py:normalize_rows_for_ui()`)
   - Convert DataFrame rows to camelCase JSON
   - Add provider status metadata
   - Convert fake defaults (-1, 0.0) to null based on provider status
   - **Output**: List of dicts with camelCase keys

10. **Response** (`server.py:execute_uniprot_query()`)
    - Return `{"rows": [...], "meta": {...}}`
    - Meta includes: `provider_status`, `row_count`, `use_tango`, `use_psipred`

11. **Frontend Display** (`UniProtQueryInput.tsx`)
    - Call `onQueryExecuted(rows, meta)`
    - Navigate to `/results` page
    - Display dataset in `Results.tsx` with charts and ranking

### Key Functions Called

- `parse_uniprot_query()` - Query parsing
- `build_uniprot_export_url()` - URL construction
- `read_any_table()` - TSV parsing
- `normalize_cols()` - Column normalization
- `create_tango_input()` - TANGO input preparation
- `run_tango_simple()` - TANGO execution
- `process_tango_output()` - TANGO parsing
- `filter_by_avg_diff()` - SSW prediction
- `calculate_biochemical_features()` - Biochemical calculations
- `normalize_rows_for_ui()` - UI normalization

### Environment Flags

- `USE_TANGO` (default: `true`) - Enable TANGO processing
- `USE_PSIPRED` (default: `true`) - Enable PSIPRED processing
- `TANGO_MODE` (default: `simple`) - Runner mode
- `TANGO_RUNTIME_DIR` - Override runtime directory

### Inputs/Outputs

**Inputs:**
- Query string (e.g., `"amyloid organism_id:9606"`)
- Query controls: `reviewed`, `length_min`, `length_max`, `sort`, `size`, `run_tango`, `run_psipred`

**Outputs:**
- DataFrame with columns: Entry, Sequence, Length, Charge, Hydrophobicity, Full length uH, FF-Helix %, SSW prediction, SSW score, SSW diff, SSW helix percentage, SSW beta percentage
- JSON response: `{"rows": [...], "meta": {...}}`

### On-Disk Paths

- **Input Files**: `backend/.run_cache/Tango/work/Tango_input_fmt*.txt`
- **Run Directory**: `backend/.run_cache/Tango/out/run_YYYYMMDD_HHMMSS/`
- **TANGO Outputs**: `run_dir/<ENTRY>.txt`
- **TANGO Binary**: `backend/Tango/bin/tango` (absolute path resolved)

---

## Flow 2: Manual Peptide Upload → Analysis → Tango → Display

### Entrypoint
- **Frontend**: `ui/src/pages/Upload.tsx` → `UploadDropzone` component
- **API Endpoint**: `POST /api/upload-csv` (backend/server.py:352)

### Step-by-Step Flow

1. **File Upload** (`UploadDropzone.tsx`)
   - User drops CSV/TSV/XLSX file
   - Frontend calls `POST /api/upload-csv` with FormData

2. **File Parsing** (`server.py:upload_csv()`)
   - Read file bytes
   - Parse via `read_any_table()` (auto-detects delimiter, handles BOM)
   - **Input**: Raw file bytes
   - **Output**: DataFrame

3. **Column Normalization** (`services/normalize.py:normalize_cols()`)
   - Same as Flow 1, step 3

4. **FF-Helix Computation** (`server.py:ensure_ff_cols()`)
   - Same as Flow 1, step 4

5. **Secondary Structure Provider** (`services/secondary_structure.py:get_provider()`)
   - Same as Flow 1, step 5 (always runs if `USE_PSIPRED`)

6. **TANGO Processing** (if `USE_TANGO`)
   - Same as Flow 1, step 6
   - **Difference**: No `request.run_tango` flag (always runs if enabled)

7. **Biochemical Calculations** (`calculations/biochem.py:calculate_biochemical_features()`)
   - Same as Flow 1, step 7

8. **FF Flags** (`server.py:apply_ff_flags()`)
   - Same as Flow 1, step 8

9. **UI Normalization** (`services/normalize.py:normalize_rows_for_ui()`)
   - Same as Flow 1, step 9

10. **Response** (`server.py:upload_csv()`)
    - Return `{"rows": [...], "meta": {...}}`
    - Meta includes: `provider_status`, `jpred_rows`, `ssw_rows`, `valid_seq_rows`

11. **Frontend Display** (`Upload.tsx`)
    - Call `ingestBackendRows(rows, meta)`
    - Navigate to `/results` page
    - Display dataset in `Results.tsx`

### Key Functions Called

Same as Flow 1, except:
- `upload_csv()` instead of `execute_uniprot_query()`
- No UniProt query parsing

### Environment Flags

Same as Flow 1.

### Inputs/Outputs

**Inputs:**
- CSV/TSV/XLSX file with columns: Entry (or Accession), Sequence (required), Length (optional)

**Outputs:**
- Same as Flow 1

### On-Disk Paths

Same as Flow 1.

---

## Flow 3: Re-run/Refresh Using Cached Inputs

### Entrypoint
- **Frontend**: `ui/src/pages/Results.tsx` → "Re-analyze" button (if implemented)
- **API Endpoint**: `POST /api/upload-csv` with same file (or `GET /api/example?recalc=1`)

### Step-by-Step Flow

1. **Cache Check** (`tango.py:get_all_existed_tango_results_entries()`)
   - Scan latest run directory: `backend/.run_cache/Tango/out/run_*/`
   - Collect Entry IDs from existing `.txt` files
   - **Output**: Set of Entry IDs with cached results

2. **Input Filtering** (`tango.py:create_tango_input()`)
   - For each row in DataFrame:
     - If Entry in cache and `force=False`: Skip
     - Else: Add to records list
   - **Output**: Filtered records list (only new/missing entries)

3. **TANGO Execution** (`tango.py:run_tango_simple()`)
   - Same as Flow 1, step 6
   - **Difference**: Only processes new entries (cache hit rate logged)

4. **Output Merging** (`tango.py:process_tango_output()`)
   - Parse new run directory
   - Merge with existing DataFrame
   - **Note**: Old cached results remain in DataFrame (not overwritten unless `force=True`)

5. **SSW Prediction** (`tango.py:filter_by_avg_diff()`)
   - Recompute threshold using all rows (cached + new)
   - Update `SSW prediction` flags for all rows

6. **Response** (`server.py:upload_csv()`)
   - Return updated DataFrame with merged results

### Key Functions Called

- `get_all_existed_tango_results_entries()` - Cache check
- `create_tango_input()` - Input filtering
- `run_tango_simple()` - TANGO execution (partial)
- `process_tango_output()` - Output merging

### Environment Flags

Same as Flow 1.

### Inputs/Outputs

**Inputs:**
- Same DataFrame as previous run
- `force` flag (default: `False`) - Force re-computation

**Outputs:**
- Updated DataFrame with merged results (cached + new)

### On-Disk Paths

- **Cache Directory**: `backend/.run_cache/Tango/out/run_*/` (latest run)
- **New Run Directory**: `backend/.run_cache/Tango/out/run_YYYYMMDD_HHMMSS/` (new run)

---

## Common Patterns

### Path Resolution

**Absolute Paths (Recommended):**
- TANGO binary: `os.path.abspath(os.path.join(TANGO_DIR, "bin", "tango"))`
- Run directory: `os.path.abspath(run_dir)`
- Generated scripts: Use absolute binary path in `_write_simple_bat()`

**Relative Paths (Legacy, Problematic):**
- Some legacy code uses `../..` from transient run directories
- **Fix**: Use absolute paths (see `FAILURE_MODES.md`)

### Error Handling

**Silent Failures (Must Fix):**
- TANGO produces 0 outputs for N inputs → No error returned to UI
- **Fix**: Add fatal check in `process_tango_output()` (see `FAILURE_MODES.md`)

**Graceful Degradation:**
- TANGO binary missing → Provider status: `UNAVAILABLE`, continue without TANGO
- PSIPRED Docker image missing → Provider status: `OFF`, continue without PSIPRED
- UniProt API timeout → Return 504 with error message

### Provider Status

**Status Values:**
- `OFF` - Provider disabled in environment
- `UNAVAILABLE` - Provider failed (binary missing, execution error, parse error)
- `PARTIAL` - Provider ran but only partial results (0 < parsed_ok < requested)
- `AVAILABLE` - Provider ran successfully (parsed_ok == requested)

**Status Propagation:**
- Backend sets `provider_status` in response meta
- Frontend displays provider status badges
- Rows with unavailable providers have null fields (not fake defaults)

