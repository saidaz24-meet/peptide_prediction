# Accuracy & Fallbacks: Provider Mapping Rules

## 🎯 Source of Truth Table

| UI Field | Primary Provider | Fallback(s) | Display Rule | Notes |
|----------|-----------------|-------------|--------------|-------|
| **SSW Prediction** (`sswPrediction`) | TANGO | None | `-1` = N/A, `0` = uncertain, `1` = positive | TANGO authoritative |
| **SSW Score** (`sswScore`) | TANGO | None | `null` if TANGO unavailable | From TANGO output |
| **SSW Diff** (`sswDiff`) | TANGO | None | `null` if TANGO unavailable | From TANGO output |
| **SSW Helix %** (`sswHelixPct`) | TANGO | PSIPRED helix % | `null` if both unavailable | TANGO preferred, PSIPRED fallback |
| **SSW Beta %** (`sswBetaPct`) | TANGO | PSIPRED beta % | `null` if both unavailable | TANGO preferred, PSIPRED fallback |
| **Helix %** (`helixPercent`) | PSIPRED | TANGO SSW helix % | `null` if both unavailable | PSIPRED preferred (more accurate) |
| **Beta %** (`betaPercent`) | PSIPRED | TANGO SSW beta % | `null` if both unavailable | PSIPRED preferred (more accurate) |
| **FF-Helix %** (`ffHelixPercent`) | FF-Helix heuristics | None (always computed) | `null` if sequence invalid | Always-on baseline, no provider dependency |
| **FF-Helix Fragments** (`ffHelixFragments`) | FF-Helix heuristics | None (always computed) | `[]` if none found | Always-on baseline |
| **Helix Segments (PSIPRED)** | PSIPRED | None | `null` if PSIPRED unavailable | From PSIPRED `.ss2` file |
| **Helix Segments (JPred)** | JPred | None | `null` (JPred disabled) | Currently disabled |
| **Charge** | Biochem calc | None | Always computed | Sequence-based |
| **Hydrophobicity** | Biochem calc | None | Always computed | Sequence-based |
| **μH (Full length)** | Biochem calc | None | Always computed | Sequence-based |

## 📊 Provider Status Rules

### TANGO Status Determination

**Location**: `backend/services/provider_tracking.py:determine_tango_status()`

```python
if not tango_enabled:
    return {"status": "not_configured", "reason": "TANGO disabled via USE_TANGO env"}
elif row.get("SSW prediction", -1) == -1:
    return {"status": "unavailable", "reason": "No TANGO output found"}
elif row.get("SSW score", -1) == -1:
    return {"status": "failed", "reason": "TANGO output incomplete"}
else:
    return {"status": "available"}
```

### PSIPRED Status Determination

**Location**: `backend/services/provider_tracking.py:determine_psipred_status()`

```python
if not psipred_enabled:
    return {"status": "not_configured", "reason": "PSIPRED disabled via USE_PSIPRED env"}
elif not psipred_output_available:  # Checks for Helix fragments (Psipred)
    return {"status": "unavailable", "reason": "No PSIPRED output found"}
else:
    return {"status": "available"}
```

### JPred Status Determination

**Location**: `backend/services/provider_tracking.py:determine_jpred_status()`

```python
# JPred is always disabled
return {"status": "not_configured", "reason": "JPred disabled (kept for reference only)"}
```

## 🔄 Fallback Math

### When TANGO is Unavailable

**SSW Prediction**: Set to `-1` (N/A)
- **Location**: `server.py:L404` (fills default if TANGO fails)
- **Display**: UI shows "N/A" or empty

**SSW Helix/Beta %**: Use PSIPRED if available
- **Location**: `mappers.ts:L112-113` (maps `helixPercent`/`betaPercent` from PSIPRED or TANGO)
- **Fallback Chain**: PSIPRED helix % → TANGO SSW helix % → `null`

### When PSIPRED is Unavailable

**Helix/Beta %**: Use TANGO SSW percentages
- **Location**: `mappers.ts:L112-113`
- **Fallback Chain**: PSIPRED → TANGO SSW → `null`

**SSW Prediction**: TANGO still authoritative (no PSIPRED fallback)
- **Note**: PSIPRED does NOT provide SSW prediction (only H/E/C curves)

### When Both TANGO and PSIPRED are Unavailable

**All secondary structure fields**: Set to `null`
- **Display**: UI shows "N/A" or empty
- **KPI Cards**: Show "Not available" (see `ResultsKpis.tsx:L66`)

**FF-Helix %**: Still computed (always-on baseline)
- **Location**: `auxiliary.py:ff_helix_percent()`
- **No provider dependency**

## 🧮 Exact Computation Rules

### FF-Helix % (Always-On Baseline)

**Location**: `backend/auxiliary.py:ff_helix_percent()`

```python
def ff_helix_percent(seq: str, core_len: int = 6, thr: float = 1.0) -> float:
    """
    Calculate percentage of residues in ≥core_len windows with mean helix propensity ≥ threshold.
    
    Algorithm:
    1. Get helix propensity for each residue (from _HELIX_PROP dict)
    2. Slide window of size core_len (default 6)
    3. Mark residues in windows where mean propensity ≥ threshold (default 1.0)
    4. Return percentage of marked residues (clamped to [0.0, 100.0])
    """
```

**No provider dependency** — always computed from sequence.

### TANGO SSW Prediction

**Location**: `backend/tango.py:filter_by_avg_diff()`

```python
def filter_by_avg_diff(df: pd.DataFrame, run_id: str, stats: dict):
    """
    Compute SSW prediction based on average difference threshold.
    
    Algorithm:
    1. Compute average hydrophobicity for non-SSW-positive peptides
    2. Mark peptide as SSW-positive (1) if:
       - SSW score > 0 AND
       - Hydrophobicity >= average hydrophobicity
    3. Otherwise mark as -1 (N/A) or 0 (uncertain)
    """
```

**TANGO authoritative** — no fallback.

### PSIPRED SSW Proxy (When TANGO Missing)

**Location**: `backend/psipred.py:_ssw_from_psipred()`

```python
def _ssw_from_psipred(df_ss2: pd.DataFrame):
    """
    Compute SSW-like prediction from PSIPRED H/E curves.
    
    Algorithm:
    1. Slide windows of size 8-20 residues
    2. Find windows where:
       - P(helix) >= 0.35 AND P(beta) >= 0.35 (chameleon condition)
       - |P(helix) - P(beta)| <= 0.15 (similar probabilities)
    3. Extend windows until condition breaks
    4. Return fragments, best score, best diff, helix %, beta %
    """
```

**Used only when TANGO unavailable** — fallback for SSW prediction.

### PSIPRED Helix Segments

**Location**: `backend/psipred.py:_segments()`

```python
def _segments(prob: pd.Series, thr: float = 0.5, minlen: int = 6) -> List[Tuple[int, int]]:
    """
    Find contiguous segments where probability >= threshold and length >= minlen.
    
    Algorithm:
    1. Scan probability series
    2. Mark start when prob >= threshold
    3. Mark end when prob < threshold or sequence ends
    4. Keep segments with length >= minlen
    """
```

**PSIPRED authoritative** — no fallback.

## 🎨 UI Display Rules

### KPI Cards (`ResultsKpis.tsx`)

| KPI | Field | Display Rule |
|-----|-------|--------------|
| **Total Peptides** | `stats.totalPeptides` | Always shows number |
| **SSW Positive** | `stats.sswPositivePercent` | Shows percentage (e.g., "35.2%") |
| **Avg Hydrophobicity** | `stats.meanHydrophobicity` | Shows number (e.g., "0.45") |
| **Avg FF-Helix** | `stats.meanFFHelixPercent` | Shows "Not available" if `ffHelixAvailable === 0`, else percentage |

### Table (`PeptideTable.tsx`)

- **Missing values**: Show empty cell or "N/A" (implementation-dependent)
- **SSW Prediction**: Show "Positive" (1), "Negative" (0), "N/A" (-1)
- **Percentages**: Show number with "%" or "N/A" if `null`

### Detail Page (`PeptideDetail.tsx`)

- **Segment Track**: Show segments if available, else show "No segments"
- **Metrics**: Show number or "N/A" if `null`

## 🔍 Provider Status Display (Future)

Currently, `providerStatus` is sent by backend but not displayed in UI. Optional enhancement:

- **Tooltip**: Show provider status on hover (e.g., "TANGO: available", "PSIPRED: unavailable (Docker not configured)")
- **Badge**: Color-coded badge next to predictions (green = available, yellow = failed, gray = unavailable)
- **Debug Panel**: Optional debug panel showing provider status for each peptide

## 📋 Fallback Chain Summary

```
SSW Prediction:
  TANGO → -1 (N/A)

SSW Helix %:
  TANGO → PSIPRED helix % → null

SSW Beta %:
  TANGO → PSIPRED beta % → null

Helix % (unified):
  PSIPRED → TANGO SSW helix % → null

Beta % (unified):
  PSIPRED → TANGO SSW beta % → null

FF-Helix %:
  FF-Helix heuristics (always computed) → null (if sequence invalid)

Helix Segments:
  PSIPRED → null

Charge/Hydrophobicity/μH:
  Biochem calc (always computed) → null (if sequence invalid)
```

## ⚠️ Known Issues

1. **Mapper Missing Fallback**: `mappers.ts` does NOT implement PSIPRED → TANGO fallback for `helixPercent`/`betaPercent`
   - **Current**: Only maps `sswHelixPct`/`sswBetaPct` from TANGO
   - **Fix**: Add fallback logic to use PSIPRED if TANGO unavailable

2. **Provider Status Not Mapped**: `mappers.ts` does NOT include `providerStatus` from backend
   - **Fix**: Add `providerStatus` to mapper output

3. **Fake Defaults in DataFrame**: Some fallback logic still uses `-1`/`0`/`"-"` instead of `pd.NA`
   - **Fix**: Use `pd.NA` at DataFrame level, convert to `null` during normalization

---

**Next**: See [CONTINUATION_PLAN.md](./CONTINUATION_PLAN.md) for concrete PRs to fix these issues.

