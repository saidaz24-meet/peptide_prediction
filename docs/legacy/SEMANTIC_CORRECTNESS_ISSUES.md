# Semantic Correctness Issues - Potential Bugs

This document identifies bugs where the program may run without errors but produce incorrect results.

## 1. CSV Parsing - Header Canonicalization Issues

### Issue: Overly Permissive Header Matching

**Location**: `backend/server.py::canonicalize_headers()` lines 272-279

**Problem**: The `canonicalize_headers()` function uses substring matching (`if low in opts`) which can cause false matches.

```python
for canon, opts in HEADER_SYNONYMS.items():
    hit = next((orig for orig, low in lower.items() if low in opts), None)
```

**Bug Scenario**:
- A CSV with column "Entry ID (Primary)" would match both "entry" synonyms (which includes "entry id") AND "id" synonyms
- First match wins, so ambiguous columns get misclassified
- If two columns match the same canonical name, only one gets renamed, causing data loss

**Test Case**:
```python
# Test: Ambiguous column names
df = pd.DataFrame({
    "Entry": ["P12345"],
    "Entry ID (Primary)": ["P12345"],
    "Sequence": ["ACDEFG"]
})
df_renamed = canonicalize_headers(df)
# Expected: Both columns handled correctly
# Actual: Only one "entry" column exists, data from "Entry ID (Primary)" lost or misassigned
assert "Entry ID (Primary)" not in df_renamed.columns or df_renamed["entry"].iloc[0] != "P12345"
```

**Fix**: Use exact matching or word-boundary matching instead of substring:
```python
# Option 1: Exact match first, then substring
hit = next((orig for orig, low in lower.items() if low == canon or low in opts), None)

# Option 2: Use word boundaries for substring matching
import re
pattern = re.compile(r'\b' + re.escape(low) + r'\b', re.IGNORECASE)
hit = next((orig for orig, low in lower.items() if any(pattern.search(opt) for opt in opts)), None)
```

---

### Issue: CSV Delimiter Auto-Detection Failure

**Location**: `backend/server.py::read_any_table()` lines 291-310

**Problem**: The function tries multiple parsing strategies but doesn't preserve row alignment between attempts. If `sep=None` fails and falls back to TSV/CSV, rows may be parsed differently.

**Bug Scenario**:
- A CSV with commas inside quoted fields: `"Entry","Sequence","Description"` with `"P12345","ACDEFG","Note, with comma"`
- `sep=None` might parse incorrectly, then fallback to `sep=","` might split on the internal comma
- Row count or alignment changes between attempts

**Test Case**:
```python
# Test: CSV with commas in quoted fields
csv_content = b'''Entry,Sequence,Description
"P12345","ACDEFG","Note, with comma"
"P67890","HIJKLM","Normal note"'''

df = read_any_table(csv_content, "test.csv")
# Expected: 2 rows, Description column preserved
# Actual: May have 3 rows or Description split incorrectly
assert len(df) == 2
assert df.iloc[0]["Description"] == "Note, with comma"
```

**Fix**: Use `quoting=csv.QUOTE_ALL` and proper quote handling:
```python
import csv
return pd.read_csv(io.BytesIO(raw), sep=",", encoding="utf-8-sig", 
                   quoting=csv.QUOTE_ALL, quotechar='"')
```

---

## 2. DataFrame Row Alignment - ID Mismatch Risks

### Issue: Tango Output Processing Relies on Row Order, Not ID Matching

**Location**: `backend/tango.py::process_tango_output()` lines 615-684

**Problem**: The function iterates DataFrame rows in order and looks up Tango output files by Entry ID. If the DataFrame is filtered, sorted, or has duplicates between creation and processing, rows won't align with output files.

**Critical Bug Scenario**:
1. `create_tango_input()` creates files: `P12345.txt`, `P67890.txt` (in DataFrame order)
2. Between creation and processing, DataFrame is filtered: row with P67890 removed
3. `process_tango_output()` iterates remaining rows, looks for P12345.txt (correct) but then next row expects different ID
4. Results get shifted: Row 1 gets Row 2's Tango results

**Test Case**:
```python
# Test: Row alignment after DataFrame filtering
df_original = pd.DataFrame({
    "Entry": ["P12345", "P67890", "P11111"],
    "Sequence": ["ACDEFG", "HIJKLM", "NOPQRS"]
})

# Create Tango inputs (writes P12345.txt, P67890.txt, P11111.txt)
records = tango.create_tango_input(df_original, set(), force=True)

# Filter DataFrame (removes middle row)
df_filtered = df_original[df_original["Entry"] != "P67890"].copy()

# Process outputs - BUG: expects P12345, P11111 but file order is P12345, P67890, P11111
tango.process_tango_output(df_filtered)

# Expected: Row 0 gets P12345 results, Row 1 gets P11111 results
# Actual: Row 0 gets P12345, Row 1 gets P67890 results (wrong peptide!)
assert df_filtered.iloc[1]["Entry"] == df_filtered.iloc[1]["SSW prediction"]  # Should match P11111
```

**Fix**: Match by Entry ID, not row order:
```python
# Instead of iterating and assuming order alignment:
for _, row in database.iterrows():
    entry = str(row.get(KEY) or "").strip()
    out_file = os.path.join(run_dir, f"{_safe_id(entry)}.txt")
    # ... process and append to lists

# Use direct assignment:
for _, row in database.iterrows():
    entry = str(row.get(KEY) or "").strip()
    out_file = os.path.join(run_dir, f"{_safe_id(entry)}.txt")
    res = __get_peptide_tango_result(out_file)
    analysed = __analyse_tango_results(res) or {}
    # Assign directly to row, not append to list
    database.loc[database[KEY] == entry, "SSW prediction"] = analysed.get("SSW_avg_score", -1)
    # ... etc
```

---

### Issue: JPred Result Dictionary Lookup Can Fail Silently

**Location**: `backend/jpred.py::process_jpred_output()` lines 195-233

**Problem**: The function looks up results by `row["Entry"]` in a dictionary. If the Entry key doesn't exist in the dictionary, it raises `KeyError`, but this is caught or handled inconsistently.

**Bug Scenario**:
- JPred output files have Entry IDs like `"P12345_1"` (with suffix)
- DataFrame has Entry IDs like `"P12345"` (without suffix)
- Dictionary lookup fails, but code continues with undefined `peptide_jpred_results`

**Test Case**:
```python
# Test: Entry ID mismatch between DataFrame and JPred outputs
df = pd.DataFrame({
    "Entry": ["P12345", "P67890"],
    "Sequence": ["ACDEFG", "HIJKLM"]
})

# Simulate JPred outputs with different ID format
jpred_results = {
    "P12345_1": {"Jpred_prediction": ["H", "H", "E"], "Jpred_conf": [8, 9, 7]}
}

# When processing:
# peptide_jpred_results = jpred_results_dict[row["Entry"]]  # KeyError: "P12345"
# Code crashes or continues with undefined variable
```

**Fix**: Add defensive lookup with fallback:
```python
for _, row in database.iterrows():
    entry = row["Entry"]
    peptide_jpred_results = jpred_results_dict.get(entry)
    if not peptide_jpred_results:
        # Append defaults, skip, or try ID variants
        jpred_helix_by_residue.append([])
        jpred_helix_scores.append(-1)
        continue
    # ... rest of processing
```

---

## 3. NaN and Empty Value Handling

### Issue: Mean Calculation on Empty DataFrame Returns NaN, Breaks Comparisons

**Location**: `backend/server.py::apply_ff_flags()` lines 424-434

**Problem**: If all rows have `SSW prediction == 1`, the filtered DataFrame for calculating `ssw_avg_H` is empty, and `.mean()` returns `NaN`. Comparisons with `NaN` always return `False`, so all flags become `-1` incorrectly.

**Bug Scenario**:
- Upload dataset where ALL peptides are chameleon-positive (SSW prediction == 1)
- `df[df["SSW prediction"] != 1]` is empty DataFrame
- `ssw_avg_H = empty_df["Hydrophobicity"].mean()` returns `NaN`
- `r["Hydrophobicity"] >= ssw_avg_H` is always `False` when `ssw_avg_H` is `NaN`
- All FF-Secondary structure switch flags become `-1` (incorrect)

**Test Case**:
```python
# Test: All rows have SSW prediction == 1
df = pd.DataFrame({
    "Entry": ["P1", "P2", "P3"],
    "Sequence": ["ACDEFG", "HIJKLM", "NOPQRS"],
    "SSW prediction": [1, 1, 1],
    "Hydrophobicity": [0.5, 0.6, 0.7]
})

apply_ff_flags(df)

# Expected: Flags calculated using some threshold (maybe all peptides, or skip flag)
# Actual: All flags are -1 because ssw_avg_H is NaN
assert not all(df["FF-Secondary structure switch"] == -1)  # Should have some 1s
```

**Fix**: Handle empty filtered DataFrame:
```python
def apply_ff_flags(df: pd.DataFrame):
    non_ssw = df[df["SSW prediction"] != 1]
    if len(non_ssw) > 0:
        ssw_avg_H = non_ssw["Hydrophobicity"].mean()
    else:
        # Fallback: use all rows if no non-SSW peptides
        ssw_avg_H = df["Hydrophobicity"].mean()
    
    # Similar for jpred_avg_uH
    jpred_rows = df[df["Helix (Jpred) uH"] != -1]
    if len(jpred_rows) > 0:
        jpred_avg_uH = jpred_rows["Helix (Jpred) uH"].mean()
    else:
        jpred_avg_uH = -1  # Can't calculate threshold
    # ... rest of logic
```

---

### Issue: Empty Sequence Produces NaN But Logic Continues

**Location**: `backend/server.py::calc_biochem()` lines 394-422

**Problem**: When sequence is empty or invalid, `calc_biochem()` appends `float("nan")` to lists, then assigns to DataFrame columns. Later code may not handle NaN properly (e.g., comparisons, aggregations).

**Bug Scenario**:
- Row has empty Sequence: `""` or `"nan"` as string
- `sanitize_seq()` returns empty string, `get_corrected_sequence()` also returns empty
- `charges.append(float("nan"))`, `hydros.append(float("nan"))`, etc.
- Later: `apply_ff_flags()` does `r["Hydrophobicity"] >= ssw_avg_H` where `r["Hydrophobicity"]` is `NaN`
- Comparison returns `False`, flag set to `-1`, but this masks the real issue (invalid sequence)

**Test Case**:
```python
# Test: Empty sequence produces NaN values
df = pd.DataFrame({
    "Entry": ["P1", "P2"],
    "Sequence": ["ACDEFG", ""],  # Empty sequence in row 1
    "Length": [6, 0]
})

calc_biochem(df)

# Expected: Row 1 has NaN for all biochem values
# Actual: Row 1 has NaN, but later code doesn't handle it
assert pd.isna(df.iloc[1]["Hydrophobicity"])

# But then:
apply_ff_flags(df)  # May fail or produce incorrect flags due to NaN
```

**Fix**: Either skip rows with invalid sequences or use a sentinel value:
```python
if not seq:
    # Option 1: Skip row
    continue  # But this breaks row alignment!
    
    # Option 2: Use sentinel (-1 or None)
    charges.append(-1)  # Instead of NaN
    hydros.append(-1)
    # ... etc, then handle -1 explicitly in downstream code
```

---

### Issue: Missing Dictionary Key Access Without .get()

**Location**: `backend/jpred.py::process_jpred_output()` line 213

**Problem**: Direct dictionary access `jpred_results_dict[row["Entry"]]` raises `KeyError` if Entry not in dictionary. No error handling.

**Test Case**:
```python
# Test: Entry ID not in JPred results dictionary
df = pd.DataFrame({
    "Entry": ["P12345", "P99999"],  # P99999 not in JPred results
    "Sequence": ["ACDEFG", "HIJKLM"]
})

jpred_results_dict = {"P12345": {"Jpred_prediction": [...], "Jpred_conf": [...]}}

# When processing row with P99999:
# peptide_jpred_results = jpred_results_dict[row["Entry"]]  # KeyError: "P99999"
process_jpred_output(df, "test")
# Program crashes or produces incomplete results
```

**Fix**: Use `.get()` with default:
```python
for _, row in database.iterrows():
    entry = row["Entry"]
    peptide_jpred_results = jpred_results_dict.get(entry)
    if not peptide_jpred_results:
        # Append defaults
        jpred_helix_by_residue.append([])
        jpred_helix_scores.append(-1)
        jpred_helix_percentage.append(0)
        continue
    # ... rest of processing
```

---

## 4. Numeric Calculation Edge Cases

### Issue: Division by Zero in Hydrophobic Moment for Empty Segments

**Location**: `backend/biochemCalculation.py::hydrophobic_moment()` line 47

**Problem**: Function divides by `len(hydro)` but if sequence is empty (after sanitization), `len(hydro)` is 0, causing `ZeroDivisionError`. However, there's an assert that should catch this, but the assert may not be triggered if sanitization happens elsewhere.

**Actually Protected**: The function has `assert len(peptide_sequence) > 0`, so this is caught. But the calling code in `auxiliary.py::get_avg_uH_by_segments()` may pass empty segments.

**Test Case**:
```python
# Test: Empty segment sequence
seq = "ACDEFG"
segments = [[1, 1]]  # Start == end, empty segment

result = auxiliary.get_avg_uH_by_segments(seq, segments)
# Calls biochemCalculation.hydrophobic_moment("") on empty segment
# Assert fails or returns 0/0

# Expected: Returns -1 (invalid)
# Actual: May crash or return NaN
```

**Actually Safe**: `get_avg_uH_by_segments()` checks `if seg_seq:` before calling, so this is handled. But edge case exists if segment is exactly one character that gets filtered out.

---

### Issue: Fauchere_Pliska Dictionary Missing Amino Acids

**Location**: `backend/biochemCalculation.py::__get_hydrophobic_moment_vec()` line 20

**Problem**: Dictionary lookup `Fauchere_Pliska.get(aa)` returns `None` for amino acids not in dictionary. When `None` is used in calculations, it propagates and breaks math.

**Bug Scenario**:
- Sequence contains non-standard amino acid like `"X"` (unknown) or `"B"` (D/N ambiguous)
- `Fauchere_Pliska.get("X")` returns `None`
- `hydro.append(None)` creates list with `None` values
- `sum_cos += hv * math.cos(...)` where `hv` is `None` → TypeError or incorrect result

**Test Case**:
```python
# Test: Non-standard amino acid
seq = "ACDXEFG"  # X is unknown amino acid

# In __get_hydrophobic_moment_vec:
hydro = []
for aa in seq:
    hydro.append(Fauchere_Pliska.get(aa))  # Returns None for 'X'
# hydro = [0.31, 1.54, -0.77, None, -0.64, ...]

# In hydrophobic_moment:
sum_cos += hv * math.cos(rad_inc)  # TypeError: unsupported operand type(s) for *: 'NoneType' and 'float'
```

**Fix**: Use default value:
```python
hydro.append(Fauchere_Pliska.get(aa, 0.0))  # Default to 0.0 for unknown
# Or filter out unknown amino acids before calculation
```

---

### Issue: Hydrophobicity Function Has Wrong Return Type Annotation

**Location**: `backend/biochemCalculation.py::hydrophobicity()` line 63

**Problem**: Function signature says `-> tuple` but returns `statistics.mean()` which returns `float`. This is a type mismatch but doesn't cause runtime error - it's just misleading.

**Test Case**:
```python
# Test: Return type
result = biochemCalculation.hydrophobicity("ACDEFG")
assert isinstance(result, float)  # Actually returns float
# But signature says -> tuple, which is wrong
```

**Fix**: Change signature to `-> float`.

---

## 5. Segment Index Alignment Issues

### Issue: 1-Indexed vs 0-Indexed Confusion in Segment Processing

**Location**: `backend/auxiliary.py::get_avg_uH_by_segments()` lines 331-332

**Problem**: Function converts segments from 1-indexed to 0-indexed: `start, end = segment[0] - 1, segment[1]`. But if segments are already 0-indexed (from some sources), this causes off-by-one errors.

**Bug Scenario**:
- JPred returns segments as 1-indexed: `[[1, 5], [10, 15]]` (positions 1-5, 10-15)
- Tango returns segments as 0-indexed: `[[0, 4], [9, 14]]` (same positions)
- Function always subtracts 1, so Tango segments become `[[-1, 4], [8, 14]]` (wrong)

**Test Case**:
```python
# Test: Segment indexing assumption
seq = "ACDEFGHIJKLMNOP"  # 15 characters, 0-indexed: 0-14
segments_1indexed = [[1, 5], [10, 15]]  # Positions 1-5, 10-15 in 1-indexed
segments_0indexed = [[0, 5], [9, 15]]   # Same positions in 0-indexed

# Function assumes 1-indexed:
result1 = auxiliary.get_avg_uH_by_segments(seq, segments_1indexed)
# start=0, end=5 → correct substring "ACDEF"

result2 = auxiliary.get_avg_uH_by_segments(seq, segments_0indexed)
# start=-1, end=5 → incorrect! IndexError or wrong substring
assert result1 == result2  # Should be equal but won't be
```

**Fix**: Document expected format or detect/index:
```python
# Option 1: Accept parameter for indexing
def get_avg_uH_by_segments(sequence: str, segments: list, one_indexed: bool = True) -> float:
    for segment in segments:
        start, end = segment[0], segment[1]
        if one_indexed:
            start, end = start - 1, end
        # ... rest
```

---

### Issue: Segment End Index Out of Bounds

**Location**: `backend/auxiliary.py::get_avg_uH_by_segments()` line 332

**Problem**: Function checks `start < end <= len(sequence)` but `end` is used in slice `sequence[start:end]` which is exclusive. So `end == len(sequence)` is valid for slicing but the check allows it. However, if `end > len(sequence)`, the slice silently truncates instead of erroring.

**Test Case**:
```python
# Test: Segment end beyond sequence length
seq = "ACDEFG"  # length 6
segments = [[1, 10]]  # end=10 > len(seq)

result = auxiliary.get_avg_uH_by_segments(seq, segments)
# Condition: start=0, end=10, len=6
# Check: 0 <= 0 < 6 and 0 < 10 <= 6  # Second part fails, segment skipped
# But if end=7:
segments = [[1, 7]]  # end=7 == len(seq), should be valid
# Check: 0 < 7 <= 6  # Fails! But seq[0:7] is valid Python (returns full string)
```

**Fix**: Adjust bounds check:
```python
if 0 <= start < len(sequence) and start < end <= len(sequence):
    seg_seq = sequence[start:end]  # end can equal len(sequence), slice is exclusive
```

Actually, the current check is correct because `end` in slice is exclusive, so `end == len(sequence)` gives `seq[start:len]` which is valid. But the check `end <= len(sequence)` allows `end == len` which is correct.

---

## 6. Frontend Mapping Issues

### Issue: Length Calculation Fallback Can Be Wrong

**Location**: `ui/src/lib/api.ts::normalizeRow()` line 127

**Problem**: If `Length` is missing, fallback calculates from `Sequence`. But if Sequence contains non-amino-acid characters (spaces, numbers), length will be wrong.

**Test Case**:
```javascript
// Test: Sequence with non-AA characters
const row = {
  Entry: "P12345",
  Sequence: "ACD EFG 123",  // Contains spaces and numbers
  // Length missing
};

const peptide = normalizeRow(row);
// length = String("ACD EFG 123").length = 11
// But actual amino acid sequence length is 6 (ACDEFG)

assert peptide.length === 6;  // Fails, gets 11
```

**Fix**: Sanitize sequence before calculating length:
```javascript
const seq = String(getAny(row, ["sequence", "Sequence"], "") || "");
const seqClean = seq.replace(/[^A-Za-z]/g, "");  // Remove non-letters
const length = num(getAny(row, ["length", "Length"], seqClean.length)) ?? seqClean.length;
```

---

### Issue: Type Coercion in Numeric Comparisons

**Location**: `ui/src/lib/api.ts::normalizeRow()` line 100

**Problem**: `chameleonPrediction` uses `Number()` then `|| -1`. If value is `0`, `Number(0) || -1` becomes `-1` (incorrect), because `0` is falsy.

**Test Case**:
```javascript
// Test: SSW prediction value of 0
const row = {
  Entry: "P12345",
  sswPrediction: 0  // Valid value meaning "not chameleon"
};

const peptide = normalizeRow(row);
// chameleonPrediction = (Number(0) as -1|0|1) || -1
// Number(0) is 0, but 0 || -1 = -1 (wrong!)
// Expected: 0 (not chameleon)
// Actual: -1 (unknown/not available)

assert peptide.chameleonPrediction === 0;  // Fails, gets -1
```

**Fix**: Use nullish coalescing or explicit check:
```javascript
const raw = getAny(row, [...], -1);
const numVal = Number(raw);
const chameleonPrediction = (numVal === 0 || numVal === 1) ? numVal : -1;
// Or:
const chameleonPrediction = (numVal >= 0 && numVal <= 1) ? numVal : -1;
```

---

## Summary of Test Cases Needed

1. **CSV parsing with ambiguous headers** - Multiple columns matching same canonical name
2. **CSV with commas in quoted fields** - Delimiter detection edge cases
3. **DataFrame filtering between Tango input creation and processing** - Row alignment
4. **Entry ID format mismatch** - JPred outputs vs DataFrame entries
5. **All rows have SSW prediction == 1** - Empty mean calculation
6. **Empty sequences producing NaN** - Downstream NaN handling
7. **Missing Entry in JPred dictionary** - KeyError handling
8. **Non-standard amino acids** - Missing dictionary values
9. **Segment indexing (0 vs 1-indexed)** - Off-by-one errors
10. **Frontend length calculation with non-AA characters** - Incorrect length
11. **Frontend type coercion of 0 values** - Falsy value handling

