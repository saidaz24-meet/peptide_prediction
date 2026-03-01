---
name: pvl-data-pipeline
description: PVL prediction data pipeline. Use when working with peptide data flow, TANGO output, S4PRED predictions, FF-Helix calculations, normalization, or debugging single-vs-batch consistency issues.
user-invocable: false
---

# PVL Data Pipeline

## Pipeline Flow (Both Single & Batch)
```
Input → DataFrame → FF-Helix → TANGO → S4PRED → Biochem → FF Flags → Normalize → API Response
```

### Step-by-step:
1. **Create DataFrame** with Entry, Sequence, Length columns
2. **ensure_ff_cols(df)** — `auxiliary.ff_helix_percent()` + `ff_helix_cores()` per row
3. **ensure_computed_cols(df)** — ensure all computed columns exist
4. **TANGO** (if enabled):
   - `tango.run_tango_simple(records)` — runs binary
   - `tango.process_tango_output(df, run_dir)` — parses output, adds SSW columns
   - `tango.filter_by_avg_diff(df, mode, stats)` — computes SSW prediction flags
5. **S4PRED** (if enabled):
   - `s4pred.run_s4pred_database(df, mode, trace_id)` — runs PyTorch model
   - `s4pred.filter_by_s4pred_diff(df)` — computes S4PRED SSW predictions
6. **calc_biochem(df)** — Charge, Hydrophobicity, μH
7. **resolve_thresholds()** + **apply_ff_flags(df, thresholds, mode)** — FF-SSW and FF-Helix flags
8. **_finalize_ui_aliases(df)** + **finalize_ff_fields(df)** — clamp FF %, convert -1→None
9. **normalize_rows_for_ui(df)** — DataFrame → camelCase API response dicts

## Entry Points
| Flow | Route | Service |
|------|-------|---------|
| Single | `api/routes/predict.py:14` | `services/predict_service.py:154` |
| Batch | `api/routes/upload.py:24` | `services/upload_service.py:599` |

## FF-Helix Calculation (auxiliary.py)
- Sliding window of `core_len=6` residues
- Per-residue helix propensity from `_HELIX_PROP` dict (Chou-Fasman scale)
- If window mean propensity >= `threshold=1.0`, residues marked as "in core"
- FF-Helix % = (residues in any qualifying window) / total_length * 100
- Pure function: deterministic, no external dependency

## FF Flags (dataframe_utils.py:apply_ff_flags)
- **FF-SSW flag**: Based on SSW prediction + hydrophobicity threshold
- **FF-Helix flag**: Based on helix μH comparison with cohort average
- Thresholds configurable via `resolved_thresholds` dict
- Returns actual thresholds used in `meta.thresholds`

## Normalization (normalize.py)
```
DataFrame row → row.to_dict() → PeptideSchema.parse_obj() → .to_camel_dict()
  → create_provider_status_for_row()
  → _convert_fake_defaults_to_null()    # Nullify fields if provider OFF
  → _sanitize_for_json()                # NaN/inf → None
  → PeptideRow.model_validate()          # Final schema check
```

## Key Column Mappings (CSV → API)
| DataFrame Column | API Key | Type |
|-----------------|---------|------|
| Entry | id | str |
| Sequence | sequence | str |
| SSW prediction | sswPrediction | -1/0/1/null |
| SSW score | sswScore | float/null |
| FF-Helix % | ffHelixPercent | float/null |
| Full length uH | muH | float/null |
| Charge | charge | float/null |

## Single vs Batch MUST Match
These shared functions guarantee identical results:
- `auxiliary.ff_helix_percent()` — pure, deterministic
- `auxiliary.get_corrected_sequence()` — AA sanitization
- `tango.process_tango_output()` — stateless parser
- `calc_biochem()` — pure calculation
- `apply_ff_flags()` — same thresholds → same flags
- `normalize_rows_for_ui()` — same PeptideSchema mapping

**Invariant**: Same sequence + same config → identical output in single and batch.

## Debugging Data Issues
1. Check provider status: Is TANGO/S4PRED actually running or OFF?
2. Check `_convert_fake_defaults_to_null()`: Does it nullify fields you expect to have data?
3. Check threshold mode: Are FF flags computed with expected thresholds?
4. Check SSW diff: `None` is valid (no helix-beta overlap), not "missing data"
5. Check single-item threshold: Uses fallback 0.0 when batch size <= 1
