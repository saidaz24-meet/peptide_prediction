# Field Analysis — Peptide Data Structures

**Created**: 2026-02-01
**Purpose**: Complete inventory of all field names across backend and frontend for data contract unification.

---

## 1. Field Inventory by Category

### 1.1 Aggregation Predictions (TANGO Results)

| Context | Field Name | Type | Values | Notes |
|---------|------------|------|--------|-------|
| CSV/DataFrame | `SSW prediction` | int | -1, 0, 1 | Secondary Structure Switch classification |
| CSV/DataFrame | `SSW score` | float | 0.0+ | Aggregation score |
| CSV/DataFrame | `SSW diff` | float | any | Score differential |
| CSV/DataFrame | `SSW helix percentage` | float | 0-100 | % helix content from TANGO |
| CSV/DataFrame | `SSW beta percentage` | float | 0-100 | % beta content from TANGO |
| CSV/DataFrame | `Beta prediction` | list[float] | 0-100 | Per-residue beta curve |
| CSV/DataFrame | `Helix prediction` | list[float] | 0-100 | Per-residue helix curve |
| CSV/DataFrame | `Turn prediction` | list[float] | 0-100 | Per-residue turn curve |
| CSV/DataFrame | `Aggregation prediction` | list[float] | 0-100 | Per-residue aggregation curve |
| Backend API | `sswPrediction` | int | -1, 0, 1 | camelCase canonical |
| Backend API | `sswScore` | float | 0.0+ | camelCase canonical |
| Backend API | `sswDiff` | float | any | camelCase canonical |
| Backend API | `sswHelixPercentage` | float | 0-100 | camelCase canonical |
| Backend API | `sswBetaPercentage` | float | 0-100 | camelCase canonical |
| Frontend UI | `sswPrediction` | SSWPrediction | -1, 0, 1 | Matches backend |
| Frontend UI | `chameleonPrediction` | SSWPrediction | -1, 0, 1 | **DEPRECATED** alias |
| Frontend UI | `sswScore` | number | 0.0+ | Matches backend |
| Frontend UI | `sswDiff` | number | any | Matches backend |
| Frontend UI | `sswHelixPct` | number | 0-100 | **INCONSISTENT** - should be `sswHelixPercentage` |
| Frontend UI | `sswBetaPct` | number | 0-100 | **INCONSISTENT** - should be `sswBetaPercentage` |
| Frontend UI | `tango.agg` | number[] | per-residue | Nested object |
| Frontend UI | `tango.beta` | number[] | per-residue | Nested object |
| Frontend UI | `tango.helix` | number[] | per-residue | Nested object |
| Frontend UI | `tango.turn` | number[] | per-residue | Nested object |

### 1.2 Secondary Structure Predictions (FF-Helix, PSIPRED, JPred)

| Context | Field Name | Type | Values | Notes |
|---------|------------|------|--------|-------|
| CSV/DataFrame | `FF-Helix %` | float | 0-100 | Local helix propensity calculation |
| CSV/DataFrame | `FF Helix fragments` | list[[int,int]] | segments | 1-indexed start/end |
| CSV/DataFrame | `FF-Secondary structure switch` | int | -1, 1 | **BOOLEAN FLAG** |
| CSV/DataFrame | `FF-Helix (Jpred)` | int | -1, 1 | **BOOLEAN FLAG** (JPred disabled) |
| CSV/DataFrame | `Helix fragments (Jpred)` | list | segments | (JPred disabled) |
| CSV/DataFrame | `Helix score (Jpred)` | float | 0+ | (JPred disabled) |
| CSV/DataFrame | `Helix fragments (Psipred)` | list | segments | PSIPRED output |
| CSV/DataFrame | `Helix (Jpred) uH` | float | any | Hydrophobic moment |
| CSV/DataFrame | `Beta full length uH` | float | any | Beta hydrophobic moment |
| Backend API | `ffHelixPercent` | float | 0-100 | camelCase canonical |
| Backend API | `ffHelixFragments` | list | segments | camelCase canonical |
| Frontend UI | `ffHelixPercent` | number | 0-100 | Matches backend |
| Frontend UI | `ffHelixFragments` | Array<[number,number]> | segments | Matches backend |
| Frontend UI | `helixPercent` | number | 0-100 | **UNIFIED** (PSIPRED > TANGO) |
| Frontend UI | `betaPercent` | number | 0-100 | **UNIFIED** (PSIPRED > TANGO) |
| Frontend UI | `jpred.helixFragments` | Array<[number,number]> | segments | (JPred disabled) |
| Frontend UI | `jpred.helixScore` | number | 0+ | (JPred disabled) |
| Frontend UI | `psipred.pH` | number[] | per-residue | P(helix) |
| Frontend UI | `psipred.pE` | number[] | per-residue | P(beta) |
| Frontend UI | `psipred.pC` | number[] | per-residue | P(coil) |
| Frontend UI | `psipred.helixSegments` | Array<[number,number]> | segments | PSIPRED output |

### 1.3 Biophysical Properties

| Context | Field Name | Type | Values | Notes |
|---------|------------|------|--------|-------|
| CSV/DataFrame | `Charge` | float | any | Net charge at pH 7.4 |
| CSV/DataFrame | `Hydrophobicity` | float | any | Mean hydrophobicity |
| CSV/DataFrame | `Full length uH` | float | any | Hydrophobic moment (alpha) |
| Backend API | `charge` | float | any | camelCase canonical |
| Backend API | `hydrophobicity` | float | any | camelCase canonical |
| Backend API | `muH` | float | any | **μH** - Greek letter in name |
| Frontend UI | `charge` | number | any | Matches backend |
| Frontend UI | `hydrophobicity` | number | any | Matches backend |
| Frontend UI | `muH` | number | any | Matches backend |

### 1.4 Identity & Metadata

| Context | Field Name | Type | Notes |
|---------|------------|------|-------|
| CSV/DataFrame | `Entry` | str | UniProt accession |
| CSV/DataFrame | `Sequence` | str | Amino acid sequence |
| CSV/DataFrame | `Length` | int | Sequence length |
| CSV/DataFrame | `Protein name` | str | Full protein name |
| CSV/DataFrame | `Organism` | str | Species |
| Backend API | `id` | str | Mapped from Entry |
| Backend API | `sequence` | str | Matches |
| Backend API | `length` | int | Matches |
| Backend API | `name` | str | Mapped from Protein name |
| Backend API | `species` | str | Mapped from Organism |
| Frontend UI | All same as Backend | - | Consistent |

### 1.5 Provider Status

| Context | Field Name | Type | Notes |
|---------|------------|------|-------|
| Backend API | `providerStatus` | object | Contains tango, psipred, jpred |
| Backend API | `providerStatus.tango.status` | enum | 'OFF', 'UNAVAILABLE', 'PARTIAL', 'AVAILABLE' |
| Frontend UI | `providerStatus` | ProviderStatus | Matches backend |

---

## 2. Duplicate/Inconsistent Fields (Same Concept, Different Names)

### 2.1 SSW Percentage Fields
| Backend | Frontend | Problem |
|---------|----------|---------|
| `sswHelixPercentage` | `sswHelixPct` | **Name mismatch** |
| `sswBetaPercentage` | `sswBetaPct` | **Name mismatch** |

### 2.2 Deprecated Aliases
| Current | Deprecated Alias | Deadline |
|---------|------------------|----------|
| `sswPrediction` | `chameleonPrediction` | 2025-04-01 (PASSED) |

### 2.3 Boolean-as-Integer Flags
| Field | Current | Should Be |
|-------|---------|-----------|
| `FF-Secondary structure switch` | -1, 1 | `boolean` |
| `FF-Helix (Jpred)` | -1, 1 | `boolean` (dead code) |

### 2.4 Missing Data Representation
| Field | Current | Should Be |
|-------|---------|-----------|
| SSW fields | `-1` for missing | `null` |
| FF fields | `-1` for missing | `null` |
| Provider unavailable | `-1` / empty | `null` |

---

## 3. Dead Code (JPred)

**All JPred fields are dead code** — `USE_JPRED = False` is hardcoded.

Fields to remove:
- `Helix fragments (Jpred)`
- `Helix score (Jpred)`
- `FF-Helix (Jpred)` flag
- `Helix (Jpred) uH`
- `jpred.*` nested object in frontend

---

## 4. Proposed Canonical Field Names

### Naming Rules Applied:
1. **Descriptive, not abbreviated** (except established conventions like `pH`)
2. **Consistent types**: `boolean` not `-1/1` for flags
3. **No 'N/A' or `-1`**: Use `null` for missing
4. **snake_case for Python, camelCase for TypeScript**

### 4.1 Aggregation Result (TANGO)

| Python (snake_case) | TypeScript (camelCase) | Type | Description |
|---------------------|------------------------|------|-------------|
| `aggregation_prediction` | `aggregationPrediction` | int (-1, 0, 1) | Final classification |
| `aggregation_score` | `aggregationScore` | float \| null | Raw score |
| `aggregation_diff` | `aggregationDiff` | float \| null | Score differential |
| `helix_percentage` | `helixPercentage` | float \| null | 0-100 |
| `beta_percentage` | `betaPercentage` | float \| null | 0-100 |
| `aggregation_curve` | `aggregationCurve` | list[float] \| null | Per-residue |
| `helix_curve` | `helixCurve` | list[float] \| null | Per-residue |
| `beta_curve` | `betaCurve` | list[float] \| null | Per-residue |
| `turn_curve` | `turnCurve` | list[float] \| null | Per-residue |

### 4.2 Secondary Structure Result

| Python (snake_case) | TypeScript (camelCase) | Type | Description |
|---------------------|------------------------|------|-------------|
| `ff_helix_percent` | `ffHelixPercent` | float \| null | 0-100, local propensity |
| `ff_helix_segments` | `ffHelixSegments` | list[[int,int]] \| null | 1-indexed segments |
| `is_structure_switch` | `isStructureSwitch` | bool | FF flag (was -1/1) |

### 4.3 Biophysical Properties

| Python (snake_case) | TypeScript (camelCase) | Type | Description |
|---------------------|------------------------|------|-------------|
| `charge` | `charge` | float \| null | Net charge |
| `hydrophobicity` | `hydrophobicity` | float \| null | Mean hydrophobicity |
| `hydrophobic_moment` | `hydrophobicMoment` | float \| null | μH value |

### 4.4 Provider Status

| Python (snake_case) | TypeScript (camelCase) | Type | Description |
|---------------------|------------------------|------|-------------|
| `provider_status` | `providerStatus` | ProviderStatus | Per-row status |

---

## 5. Migration Path

### Phase 1: Backend Canonical Names
1. Update `backend/schemas/api_models.py` with new field names
2. Update `backend/services/normalize.py` to emit new names
3. Keep old names as deprecated aliases for one release

### Phase 2: Frontend Alignment
1. Update `ui/src/types/api.ts` to match backend
2. Update `ui/src/types/peptide.ts` for UI model
3. Update mapper to handle both old and new names

### Phase 3: Remove Deprecated
1. Remove `chameleonPrediction` everywhere
2. Remove JPred fields
3. Remove `-1` as missing value indicator
