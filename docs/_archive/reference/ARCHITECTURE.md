# Architecture: How the Web App Works

## 📐 Route Map (URLs → Pages → Components)

```
/ (Index.tsx)
  └─ Landing page with example dataset button
     └─ Calls: fetchExampleDataset() → /api/example

/upload (Upload.tsx)
  ├─ UploadDropzone → accepts CSV/TSV/XLSX
  ├─ DataPreview → shows parsed headers/rows
  ├─ ColumnMapper → optional column remapping
  └─ On submit: uploadCSV(file) → /api/upload-csv
     └─ Navigates to /results on success

/quick (QuickAnalyze.tsx)
  ├─ Single sequence input form
  └─ On submit: predictOne(sequence, entry?) → /api/predict
     └─ Shows result inline (no navigation)

/results (Results.tsx)
  ├─ ResultsKpis → 4 KPI cards (Total, SSW+, Avg H, Avg FF-Helix)
  ├─ ResultsCharts → Distribution/scatter/radar charts
  ├─ PeptideTable → Sortable table with all peptides
  ├─ Legend → Color coding guide
  ├─ CorrelationCard → (imported but NOT rendered — dead code)
  └─ Export buttons → CSV shortlist, PDF report

/peptides/:id (PeptideDetail.tsx)
  ├─ SegmentTrack → visual segment overlay
  ├─ PositionBars → (exists but may not be used)
  └─ Detailed metrics display

/metrics/:metricId (MetricDetail.tsx)
  └─ Deep dive into specific metric

/help (Help.tsx)
/about (About.tsx)
```

## 🔄 Data Flow Diagrams

### Upload Flow (CSV → Results)

```
1. User uploads CSV
   └─ Upload.tsx → uploadCSV(file)
      └─ POST /api/upload-csv
         └─ server.py:upload_csv()
            ├─ read_any_table() → pd.DataFrame
            ├─ normalize_cols() → canonical headers
            ├─ ensure_ff_cols() → FF-Helix % (always computed)
            ├─ [IF USE_PSIPRED] psipred.run_psipred() → out/run_*/
            ├─ [IF USE_TANGO] tango.run_tango_simple() → out/run_*/
            │  ├─ process_tango_output() → merge into DataFrame
            │  └─ filter_by_avg_diff() → SSW prediction
            ├─ calc_biochem() → Charge, Hydrophobicity, μH
            ├─ apply_ff_flags() → FF flags
            ├─ normalize_rows_for_ui() → camelCase dicts + providerStatus
            └─ Returns: {rows: [...], meta: {...}}

2. Frontend receives response
   └─ datasetStore.ingestBackendRows(rows, meta)
      ├─ mapBackendRowToPeptide(row) for each row
      │  └─ lib/mappers.ts:mapBackendRowToPeptide()
      │     └─ Returns: Peptide (TypeScript type)
      ├─ set({peptides: mapped, meta})
      └─ calculateStats()
         └─ Computes: totalPeptides, sswPositivePercent, meanHydrophobicity, etc.

3. Results page renders
   └─ Results.tsx reads from useDatasetStore()
      ├─ ResultsKpis(stats) → KPI cards
      ├─ ResultsCharts(peptides) → Charts
      └─ PeptideTable(peptides) → Table
```

### QuickAnalyze Flow (Single Sequence)

```
1. User enters sequence
   └─ QuickAnalyze.tsx → predictOne(sequence, entry?)
      └─ POST /api/predict
         └─ server.py:predict()
            ├─ create_single_sequence_df(sequence, entry)
            ├─ [IF USE_TANGO] tango.run_tango_simple([(entry, seq)])
            │  └─ process_tango_output() → merge
            ├─ calc_biochem() → biochem features
            ├─ normalize_rows_for_ui(is_single_row=True)
            │  └─ Returns: single dict (capitalized keys, NOT camelCase)
            └─ Returns: {...} (single row dict)

2. Frontend receives response
   └─ QuickAnalyze.tsx displays inline
      └─ Uses raw dict keys (Entry, Sequence, Charge, etc.)
         └─ NOTE: Different format than /api/upload-csv (capitalized vs camelCase)
```

### Results Load Flow (KPIs/Charts/Table)

```
1. Results.tsx mounts
   └─ Reads from useDatasetStore()
      ├─ peptides: Peptide[]
      ├─ stats: DatasetStats | null
      └─ meta: DatasetMetadata | null

2. KPI Cards
   └─ ResultsKpis(stats)
      ├─ stats.totalPeptides
      ├─ stats.sswPositivePercent (or chameleonPositivePercent)
      ├─ stats.meanHydrophobicity
      └─ stats.meanFFHelixPercent (shows "Not available" if ffHelixAvailable === 0)

3. Charts
   └─ ResultsCharts(peptides)
      ├─ Hydrophobicity distribution
      ├─ Hydrophobicity vs μH scatter
      ├─ Chameleon distribution
      └─ Cohort radar

4. Table
   └─ PeptideTable(peptides)
      ├─ Sortable columns
      ├─ Row click → navigate to /peptides/:id
      └─ Filters/search
```

## 📊 State Contracts

### TypeScript Types (`ui/src/types/peptide.ts`)

```typescript
// Core peptide model
type Peptide = {
  id: string;                    // Required
  sequence: string;               // Required
  length: number;                // Required
  
  // Basic biophysics (optional, but usually present)
  hydrophobicity?: number;
  charge?: number;
  muH?: number;                  // Full length μH
  
  // SSW (Secondary Structure Switch) — TANGO authoritative
  sswPrediction: SSWPrediction;  // -1 | 0 | 1 (required, defaults to -1)
  chameleonPrediction?: SSWPrediction; // Backward compat alias
  sswScore?: number;
  sswDiff?: number;
  sswHelixPct?: number;          // SSW helix percentage
  sswBetaPct?: number;           // SSW beta percentage
  
  // FF-Helix (always computed, no provider dependency)
  ffHelixPercent?: number;       // 0.0-100.0
  ffHelixFragments?: Array<[number, number]>;
  
  // Unified secondary structure (PSIPRED preferred, TANGO fallback)
  helixPercent?: number;         // Preferred: PSIPRED; fallback: sswHelixPct
  betaPercent?: number;          // Preferred: PSIPRED; fallback: sswBetaPct
  
  // Provider status (Principle B: mandatory)
  providerStatus?: {
    tango: {status: "available"|"failed"|"unavailable"|"not_configured", reason?: string};
    psipred: {status: ...};
    jpred: {status: ...};
  };
  
  // Optional nested structures
  jpred?: {helixFragments?: ..., helixScore?: ...};
  psipred?: {pH?: number[], pE?: number[], pC?: number[], helixSegments?: ...};
  tango?: {agg?: number[], beta?: number[], helix?: number[], turn?: number[]};
};

// Dataset-level stats
type DatasetStats = {
  totalPeptides: number;
  sswPositivePercent: number;    // % with sswPrediction === 1
  meanHydrophobicity: number;
  meanCharge: number;
  meanFFHelixPercent: number;    // Only counts defined values
  meanLength: number;
  ffHelixAvailable?: number;     // Count of peptides with ffHelixPercent defined
  sswAvailable?: number;           // Count of peptides with sswPrediction !== -1
  // Backward compat aliases
  chameleonPositivePercent?: number;
  chameleonAvailable?: number;
};

// Backend metadata
type DatasetMetadata = {
  use_jpred?: boolean;            // Always false (JPred disabled)
  use_tango?: boolean;
  jpred_rows?: number;            // Always 0
  ssw_rows?: number;              // Count of rows with SSW prediction
  valid_seq_rows?: number;
};
```

### API Contract (`backend/server.py`)

#### POST `/api/upload-csv`
**Request**: `multipart/form-data` with `file: File`

**Response**:
```json
{
  "rows": [
    {
      "id": "P12345",
      "sequence": "MKTAY...",
      "length": 150,
      "hydrophobicity": 0.45,
      "charge": 2.0,
      "muH": 0.32,
      "sswPrediction": 1,
      "chameleonPrediction": 1,  // Backward compat
      "sswScore": 0.85,
      "sswHelixPercentage": 35.2,
      "sswBetaPercentage": 28.1,
      "ffHelixPercent": 42.5,
      "ffHelixFragments": [[5, 12], [20, 28]],
      "providerStatus": {
        "tango": {"status": "available"},
        "psipred": {"status": "unavailable", "reason": "Docker not configured"},
        "jpred": {"status": "not_configured"}
      }
    }
  ],
  "meta": {
    "use_jpred": false,
    "use_tango": true,
    "jpred_rows": 0,
    "ssw_rows": 120,
    "valid_seq_rows": 150
  }
}
```

#### POST `/api/predict`
**Request**: `multipart/form-data` with `sequence: string`, `entry?: string`

**Response**: Single dict with **capitalized keys** (Entry, Sequence, Charge, etc.)
- **NOTE**: Different format than `/api/upload-csv` (capitalized vs camelCase)
- This is intentional for QuickAnalyze.tsx compatibility

#### GET `/api/example?recalc=0`
**Response**: Same shape as `/api/upload-csv`

### Store Contract (`ui/src/stores/datasetStore.ts`)

```typescript
interface DatasetState {
  rawData: ParsedCSVData | null;      // Original CSV parse
  peptides: Peptide[];                // Mapped peptides
  columnMapping: ColumnMapping;       // User remapping
  stats: DatasetStats | null;          // Computed stats
  meta: DatasetMetadata | null;       // Backend metadata
  
  isLoading: boolean;
  error: string | null;
  
  // Actions
  ingestBackendRows(rows: BackendRow[], meta?: DatasetMetadata): void;
  calculateStats(): void;
  getPeptideById(id: string): Peptide | undefined;
}
```

## 🔗 Component Dependencies

```
App.tsx
├─ Routes
│  ├─ Index → fetchExampleDataset()
│  ├─ Upload → UploadDropzone → uploadCSV()
│  ├─ QuickAnalyze → predictOne()
│  ├─ Results → ResultsKpis, ResultsCharts, PeptideTable
│  └─ PeptideDetail → SegmentTrack
└─ useDatasetStore (Zustand)
   └─ mapBackendRowToPeptide() (lib/mappers.ts)
      └─ Uses: types/peptide.ts
```

## 📁 Repo Tree (Annotated)

```
peptide_prediction/
├─ backend/
│  ├─ ✔︎ server.py                    # FastAPI entry point
│  ├─ ✔︎ tango.py                     # TANGO runner (host/Docker)
│  ├─ ✔︎ psipred.py                   # PSIPRED runner (Docker, best-effort)
│  ├─ ✔︎ auxiliary.py                 # FF-Helix calc, sequence utils
│  ├─ ✔︎ biochemCalculation.py        # Charge, Hydrophobicity, μH
│  ├─ ✔︎ calculations/biochem.py     # Extracted biochem logic
│  ├─ ✔︎ schemas/
│  │  ├─ peptide.py                   # PeptideSchema (Pydantic)
│  │  └─ provider_status.py           # ProviderStatus schemas
│  ├─ ✔︎ services/
│  │  ├─ normalize.py                 # normalize_rows_for_ui()
│  │  ├─ provider_tracking.py         # Provider status determination
│  │  └─ cache.py                     # Sequence hash caching (ready, not used)
│  ├─ ○ Tango/
│  │  ├─ bin/tango                    # macOS binary
│  │  ├─ work/                        # Input files
│  │  └─ out/run_*/                   # Per-run outputs
│  ├─ ○ Psipred/
│  │  ├─ work/                        # FASTA inputs
│  │  └─ out/run_*/                   # Per-run outputs
│  ├─ ✂︎ jpred.py                     # Legacy (disabled, kept for reference)
│  ├─ ✂︎ batch_process.py             # Legacy batch script
│  └─ ✂︎ Analysing_final_results.py   # Incomplete (syntax error)
│
├─ ui/
│  ├─ ✔︎ src/
│  │  ├─ main.tsx                     # Entry point
│  │  ├─ App.tsx                      # Router setup
│  │  ├─ types/peptide.ts             # TypeScript types
│  │  ├─ stores/datasetStore.ts       # Zustand store
│  │  ├─ lib/
│  │  │  ├─ api.ts                    # API client (uploadCSV, predictOne)
│  │  │  ├─ mappers.ts                # mapBackendRowToPeptide()
│  │  │  └─ report.ts                  # PDF export
│  │  ├─ pages/
│  │  │  ├─ ✔︎ Index.tsx              # Landing
│  │  │  ├─ ✔︎ Upload.tsx             # CSV upload
│  │  │  ├─ ✔︎ QuickAnalyze.tsx       # Single sequence
│  │  │  ├─ ✔︎ Results.tsx             # Main results page
│  │  │  ├─ ✔︎ PeptideDetail.tsx      # Per-peptide detail
│  │  │  └─ ○ MetricDetail.tsx        # Metric deep dive
│  │  └─ components/
│  │     ├─ ✔︎ ResultsKpis.tsx        # KPI cards
│  │     ├─ ✔︎ ResultsCharts.tsx      # Charts
│  │     ├─ ✔︎ PeptideTable.tsx       # Sortable table
│  │     ├─ ✔︎ SegmentTrack.tsx      # Segment visualization
│  │     ├─ ✔︎ ColumnMapper.tsx       # Column remapping
│  │     ├─ ✂︎ CorrelationCard.tsx   # Imported but not rendered
│  │     ├─ ✂︎ EvidencePanel.tsx     # Exists but unused
│  │     └─ ✂︎ PositionBars.tsx     # Exists but unused
│
└─ docs/                              # This audit documentation
```

**Legend**:
- ✔︎ **Must-keep runtime**: Core functionality
- ○ **Optional UX**: Nice-to-have features
- ✂︎ **Removable**: Dead code, legacy, unused

## 🔄 Sequence Diagrams

### Upload CSV → Results

```
User          Upload.tsx    API (/upload-csv)    tango.py      datasetStore    Results.tsx
  │                │                │                │              │              │
  │─[Select CSV]──>│                │                │              │              │
  │                │─[uploadCSV()]──>│                │              │              │
  │                │                │─[read_any_table]│              │              │
  │                │                │─[normalize_cols]│              │              │
  │                │                │─[ensure_ff_cols]│              │              │
  │                │                │─[USE_TANGO?]───>│              │              │
  │                │                │                │─[run_tango_simple]│          │
  │                │                │                │─[process_tango_output]│       │
  │                │                │<─[rows, meta]──│              │              │
  │                │<─[response]───│                │              │              │
  │                │─[ingestBackendRows]─────────────>│              │              │
  │                │                │                │─[mapBackendRowToPeptide]      │
  │                │                │                │─[calculateStats]              │
  │                │                │                │              │              │
  │                │─[navigate(/results)]─────────────────────────────────────────>│
  │                │                │                │              │              │
  │                │                │                │              │<─[useDatasetStore]
  │                │                │                │              │─[Render KPIs/Charts/Table]
```

### QuickAnalyze (Single Sequence)

```
User      QuickAnalyze.tsx    API (/predict)    tango.py      QuickAnalyze.tsx
  │              │                  │                │              │
  │─[Enter seq]──>│                  │                │              │
  │─[Submit]─────>│─[predictOne()]──>│                │              │
  │              │                  │─[create_single_sequence_df]│    │
  │              │                  │─[USE_TANGO?]───>│            │
  │              │                  │                │─[run_tango_simple]│
  │              │                  │                │─[process_tango_output]│
  │              │                  │<─[single dict]─│            │
  │              │<─[response]──────│                │            │
  │              │─[Display inline]────────────────────────────────>│
```

## 🎯 Key Architectural Decisions

1. **Monolith Repo**: FastAPI serves built UI (single deploy unit)
2. **Per-Run Temp Dirs**: TANGO/PSIPRED outputs in timestamped `run_*/` dirs (no collisions)
3. **Provider Status**: Mandatory field in every response (Principle B)
4. **No Fake Defaults**: Missing values are `null`, not `-1` or `0` (Principle C)
5. **FF-Helix Always-On**: Computed from sequence (no provider dependency)
6. **PSIPRED Best-Effort**: Skips cleanly if Docker/image/DB missing
7. **TANGO Host-First**: Prefers macOS binary, Docker optional (env flag)
8. **Type Safety**: TypeScript types in frontend, Pydantic schemas in backend
9. **CamelCase API**: Backend returns camelCase (except `/api/predict` which uses capitalized keys)

## ⚠️ Known Divergences from Architecture Proposal

1. **Provider Status**: ✅ Implemented (backend sends, frontend types exist, but mapper ignores it)
2. **Fake Defaults**: ⚠️ Partial (normalization converts to null, but DataFrame still has `-1`/`0`/`"-"`)
3. **Structured Logs**: ❌ Missing (uses `print()` statements)
4. **Postgres**: ❌ Not implemented (cache.py ready but not integrated)
5. **Docker Toggle**: ⚠️ Partial (TANGO has env flag, PSIPRED always tries Docker)
6. **Background Queue**: ❌ Not implemented

---

**Next**: See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for what's implemented vs missing.

