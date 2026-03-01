---
description: Trace a single peptide sequence through the entire prediction pipeline, showing every intermediate result. Useful for debugging and verifying single-vs-batch consistency.
argument-hint: <sequence>
---

# Trace Peptide: $ARGUMENTS

Run the sequence `$ARGUMENTS` through each pipeline stage and show the intermediate results.

## Step 1: Validate input
- Check sequence contains only valid amino acid characters (ACDEFGHIKLMNPQRSTVWY + ambiguous BXZJUO)
- Show corrected sequence after `auxiliary.get_corrected_sequence()`
- Show length

## Step 2: FF-Helix calculation (always runs, no external deps)
Run in Python:
```python
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -c "
import auxiliary
seq = '$ARGUMENTS'.upper().strip()
corrected = auxiliary.get_corrected_sequence(seq)
ff_pct = auxiliary.ff_helix_percent(corrected)
ff_cores = auxiliary.ff_helix_cores(corrected)
print(f'Corrected sequence: {corrected}')
print(f'Length: {len(corrected)}')
print(f'FF-Helix %: {ff_pct}')
print(f'FF-Helix cores: {ff_cores}')
"
```

## Step 3: Biochemical calculations
```python
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -c "
import pandas as pd
from calculations.biochem import calculate_biochemical_features
df = pd.DataFrame([{'Entry': 'TEST', 'Sequence': '$ARGUMENTS'.upper().strip(), 'Length': len('$ARGUMENTS'.strip())}])
calculate_biochemical_features(df)
for col in ['Charge', 'Hydrophobicity', 'Full length uH']:
    print(f'{col}: {df.iloc[0].get(col, \"N/A\")}')
"
```

## Step 4: Full single-sequence API call (if backend running)
If the dev server is running on localhost:8000, call:
```bash
curl -s -X POST http://localhost:8000/api/predict \
  -F "sequence=$ARGUMENTS" -F "entry=TRACE_TEST" | python3 -m json.tool
```

## Step 5: Show results summary
Present a clear table:
| Field | Value |
|-------|-------|
| Sequence | ... |
| Length | ... |
| FF-Helix % | ... |
| Charge | ... |
| Hydrophobicity | ... |
| muH | ... |

If TANGO/S4PRED are OFF, note which fields would be populated when enabled.
