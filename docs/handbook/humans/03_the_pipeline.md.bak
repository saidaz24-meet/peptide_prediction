# The PVL Prediction Pipeline — End to End

> One request, one peptide, every step. Pin this page to your tabs while you're learning the codebase.

## Contents

- [The 30-second version](#the-30-second-version)
- [The actual ordered stages](#the-actual-ordered-stages)
- [Where the deterministic guarantee comes from](#where-the-deterministic-guarantee-comes-from)
- [What the precompute path is (and isn't)](#what-the-precompute-path-is-and-isnt)
- [When the pipeline returns null](#when-the-pipeline-returns-null)
- [When you want to verify any of this](#when-you-want-to-verify-any-of-this)
- [See also](#see-also)

## The 30-second version

```
Researcher                 Frontend                 Backend                Predictors
───────────                ────────                 ───────                ──────────
clicks Analyze   ────────► POST /api/predict ────► UploadService ──► tango.run_tango_simple
                                                         │              s4pred.predict
                                                         │              biochem (charge, µH, hydrophobicity)
                                                         │              FF-Helix classifier
                                                         │              FF-SSW classifier
                                                         ▼
                                                  normalize_rows_for_ui
                                                         │
                          PeptideViewer ◄──── PeptideRow (JSON) ◄──┘
```

Same path for single sequence and batch — the contract is `RowsResponse` in both directions.

## The actual ordered stages

When you POST a sequence (or upload a CSV / FASTA / XLSX), it walks this sequence of stages. Stage timings are wired into Sentry so you can see them in production traces.

### 1. Parse the request
`backend/api/routes/predict.py` reads the body. For `/api/predict` it's a Form-encoded single sequence; for `/api/predict/batch` it's a raw FASTA or CSV body keyed by `Content-Type`. For `/api/upload-csv` it's a multipart upload. All three converge on the same `pd.DataFrame` with at minimum `Entry` + `Sequence` columns.

### 2. Normalize column names
`backend/services/normalize.py:normalize_cols(df)` runs a three-tier header match (exact canonical → synonym list → word-boundary regex) so a column called "Protein_Name" or "protein name" both end up as canonical `Name`. Ambiguous headers raise `HTTPException(400)` — they don't silently pick one.

### 3. Biochem (always runs, instant)
`backend/calculations/biochem.py` computes:
- **Charge** at pH 7.4 from the canonical pKa table
- **Hydrophobicity** as the mean Fauchère-Pliska value across the peptide
- **µH (Eisenberg)** as the magnitude of the hydrophobic moment around the helical wheel

These are deterministic + ~microseconds per peptide — they never fail.

### 4. FF-Helix classifier (always runs after biochem)
`backend/services/dataframe_utils.py:ensure_ff_cols` applies the FF-Helix rule:

> FF-Helix candidate iff **S4PRED predicts ≥ `helix_pct_threshold` residues as H** AND **µH ≥ `mu_h_threshold`**.

Default thresholds come from `backend/config.py` (literature-default); per-database thresholds can override.

### 5. Provider cache split
`backend/services/provider_cache.py:split_cached_uncached` checks a DuckDB cache at `/data/cache/provider_cache.duckdb` keyed by `seq_hash(sequence)`. Rows whose TANGO + S4PRED + biochem are all cached become "hits" and skip the predictor calls. Rows missing any cached predictor become "misses" and continue to the predictors.

The precompute script bypasses this entirely (`force_recompute=True`) because it IS the cache source-of-truth — see [ISSUE-034 fix](../../active/KNOWN_ISSUES.md).

### 6. TANGO (subprocess, deterministic)
`backend/tango.py:run_tango_simple(records)` writes each peptide as a one-line input file, spawns the [TANGO](02_the_science.md#2-tango) Fortran binary, parses the output `*.txt` files back into the DataFrame as per-residue arrays:

- `tangoAggCurve[i]` — % aggregation propensity at residue i
- `tangoBetaCurve[i]` — % β-strand probability
- `tangoHelixCurve[i]` — % helix probability

These curves drive the aggregation heatmap. Auto-disabled for runs > `MAX_PEPTIDES_PER_RUN_WITH_TANGO` (default 500) to keep wall-clock under 30 s for typical research uploads.

### 7. S4PRED (PyTorch ensemble, batched)
`backend/s4pred.py:predict(records)` runs a 5-model BiLSTM ensemble on each sequence. Batched forward (#117 perf fix) processes ~5–10 sequences per second on the prod VPS CPU. Output per residue:

- `s4predPHCurve[i]` — P(helix)
- `s4predPECurve[i]` — P(strand/β)
- `s4predPCCurve[i]` — P(coil)
- `s4predSsPrediction[i]` — argmax label "H" / "E" / "C"

[S4PRED](02_the_science.md#3-s4pred) is the **primary helix predictor** (PSIPRED was removed per ADR-006). It also produces `s4predSswFragments` — regions where the predictor sees a structural switch zone.

### 8. SSW + FF-SSW classifiers
After TANGO + S4PRED both populate, the SSW classifier (`backend/services/dataframe_utils.py`) computes the canonical mask:

> **SSW(i) = TANGO predicts β-aggregation at residue i OR S4PRED predicts helix-to-strand switch at residue i**

This is the union (`TANGO ∪ S4PRED`), not intersection — fixed in Wave 2.5 ISSUE-032. The aggregate `sswPrediction` is `1` if any residue is SSW-positive.

FF-SSW then applies:

> FF-SSW candidate iff **SSW AND µH ≥ `mu_h_threshold`**.

The [axiom](02_the_science.md#8-the-axioms) `FF-SSW ⊆ SSW` is enforced at the normalize layer — a violation raises in tests and would fail CI.

### 9. Normalize for the UI
`backend/services/normalize.py:normalize_rows_for_ui(df)` converts pandas types → JSON-safe Python:

- `numpy.float32` → `float`
- `numpy.bool_` → `bool`
- `pd.NA` / `numpy.nan` → `None` (never `-1` or `"N/A"` — the only sentinel allowed is `null`)
- Flag columns use `-1` only for "not assigned" (a separate state from "false") — exception, documented.

Output is a list of `PeptideRow` dicts matching `backend/schemas/api_models.py:PeptideRow`. Pydantic validates each row strictly (`extra="forbid"` — B-CONTRACT).

### 10. Wrap in `RowsResponse`
`backend/schemas/api_models.py:RowsResponse` adds:
- `meta.runMetadata` (PVL version, predictors used + versions, threshold preset, dataset id, permalink seed)
- `meta.providerStatusSummary` (per-predictor `AVAILABLE / OFF / UNAVAILABLE` + counts)
- `meta.warnings` (TANGO auto-disabled large dataset, non-standard AA substitutions, row truncations)
- `meta.thresholds` (the resolved threshold values for this run)
- `meta.traceId` (Sentry-correlated)
- `meta.runId` (deterministic hash of inputs + config — basis for the permalink)

This is what the frontend ingests.

### 11. Frontend mapping
`ui/src/lib/peptideMapper.ts:mapApiRowToPeptide` runs the inverse normalization → strongly-typed `Peptide` interface from `ui/src/types/peptide.ts`. Then `ui/src/stores/datasetStore.ts:ingestBackendRows` writes the peptides to the Zustand store. Every page that subscribes to the store re-renders.

## Where the deterministic guarantee comes from

Same input + same `pvl_version` + same threshold config = byte-identical output. This is the [single-vs-batch invariant](../agents/02_contracts_and_invariants.md) from `CLAUDE.md`. Test that locks it: `backend/tests/test_single_vs_batch_consistency.py`.

What can break it:
- Mutating any predictor binary or weight file (S4PRED weights are SHA-checked in CI)
- Adding non-deterministic ops (`numpy.random` without a seed — banned)
- Changing the canonical pKa or hydrophobicity table without an ADR

## What the precompute path is (and isn't)

`backend/scripts/precompute_dataset.py` runs steps 1–10 against a curated reference dataset and saves the resulting `RowsResponse` as a JSON file under `backend/data/precomputed/`. The endpoint `GET /api/precomputed/{id}` serves this artifact directly — no predictor calls — so example-button loads are < 1 s on prod.

The precompute path opts out of the cache split (step 5) and the TANGO budget gate (step 6) via two flags on `process_upload_dataframe`. See `ISSUE-034` for the why.

## When the pipeline returns null

Three legitimate `null` states the UI must handle:
1. **Predictor OFF** — `USE_TANGO=0` or `USE_S4PRED=0` env var. All TANGO / S4PRED fields are `null`; provider status is `OFF`. The 4-class classification falls back to whatever is computable from biochem + FF-Helix alone.
2. **Predictor UNAVAILABLE** — runner failed (subprocess crashed, weights missing). Fields are `null`; provider status is `UNAVAILABLE`; the row gets a per-row warning in `meta.warnings`.
3. **Per-row failure** — e.g. sequence too short for S4PRED. The row stays in the response with the failing predictor's fields set to `null`; the row's `providerStatus` field records the per-row failure mode.

The UI never displays `-1`, `"N/A"`, or empty string — always `null` → em-dash or "—" in the cell.

## When you want to verify any of this

The smoke test:

```bash
curl -sS -X POST http://localhost:8000/api/predict \
  -F "sequence=LKLLKLLLKLLLKLL" \
  | python3 -m json.tool | head -50
```

Walks every output field of one peptide through the pipeline, deterministically. Use it as the canonical reference when you're debugging "is this number right?"

## See also

- `humans/02_the_science.md` — the algorithms, with citations
- `agents/02_contracts_and_invariants.md` — the protected surfaces (api_models.py, the 4-class axioms)
- `active/PAPER_METHODS_REFERENCE.md` — the same content as a paper Methods section
