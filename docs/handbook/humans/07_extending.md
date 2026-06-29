# Extending PVL

> **Audience.** A contributor who wants to *add* something — a predictor, a reference cohort, an export format — without breaking the invariants that keep single-sequence and batch results identical, the API contract stable, and the science reproducible. This page shows the real seams in the code, not a tour. Before you touch a schema field or a classification, read [the contracts and invariants reference](../agents/02_contracts_and_invariants.md). For where PVL sits among other tools, see [the landscape survey](../research/01_landscape.md).

Three walkthroughs. Each ends with the one or two ways people actually break things.

## Contents

- [1. Add a new aggregation predictor (Waltz, AGGRESCAN3D, PASTA 2.0)](#1-add-a-new-aggregation-predictor-waltz-aggrescan3d-pasta-20)
- [2. Add a third reference/comparison cohort](#2-add-a-third-referencecomparison-cohort)
- [3. Add a new export format (e.g. mmCIF/PNG alongside SVG)](#3-add-a-new-export-format-eg-mmcifpng-alongside-svg)
- [Before you open a PR](#before-you-open-a-pr)

---

## 1. Add a new aggregation predictor (Waltz, AGGRESCAN3D, PASTA 2.0)

This is the **[Phase I multi-predictor](09_glossary.md#p)** track (Tier 3 in the roadmap). The codebase is already pre-wired for it in two places — the trick is finding them.

### Backend seam — `backend/services/predict_service.py`

The single-sequence path is `process_single_sequence(...)`. Predictors are run by small private helpers that mutate the DataFrame in place and log warnings instead of raising:

- `_run_tango_for_single_sequence(df, entry_id, seq)`
- `_run_s4pred_provider(df)`

Each is gated by a settings flag read **dynamically** (`settings.USE_TANGO`, `settings.USE_S4PRED` — never cached at import). To add [Waltz](../research/01_landscape.md#2-waltz--waltz-db) you:

1. Add `USE_WALTZ` to `backend/config.py` (default off).
2. Write `backend/waltz.py` with a runner + parser, mirroring `backend/tango.py`'s record-in / DataFrame-out shape.
3. Add `_run_waltz_provider(df)` in `predict_service.py`, gated on `settings.USE_WALTZ`, called from `process_single_sequence` *and* from the batch path in `upload_service.py`. **Both call sites or none** — that is the single-vs-batch invariant.
4. Surface availability through `_build_provider_status_meta(...)` / `build_provider_meta` so the UI knows whether the provider ran, was off, or was unavailable.

New numeric columns flow out through `services/normalize.py`. Add the camelCase response key there and as an **additive, nullable** field in `schemas/api_models.py`. Do not repurpose an existing key.

### Frontend seam — `ui/src/lib/molstarOverlays.ts`

The 3D overlay layer was written to be forward-compatible. The file's own header documents the recipe, and `OverlayType` is a closed union waiting for new members:

```ts
export type OverlayType = "tango" | "s4pred-helix" | "ff-helix" | "ssw";
```

To add a Waltz overlay: add `"waltz"` to the union, add a color to `OVERLAY_COLORS`, write `extractWaltzOverlay(peptide)`, register it in `buildDefaultOverlays()`, and add a toggle in `Mol3DViewer`'s `OVERLAY_TOGGLES`. Because `OVERLAY_COLORS` is a `Record<OverlayType, string>`, TypeScript will *fail the build* until you supply the color — the union is your checklist.

### Things you should NOT do

- **Do not run the predictor in only one code path.** Adding it to `process_single_sequence` but forgetting the batch path in `upload_service.py` (or vice versa) silently violates "single and batch produce identical results." Same input must yield the same number whether it arrives via Quick Analyze or a CSV row.
- **Do not derive a *classification* from the new score in the UI.** A predictor may emit a flag (e.g. "Waltz amyloid: yes"). That boolean is computed once at the data layer and shipped; the UI renders it. Recomputing it in a React component breaks ADR-001 and will drift from the backend.

---

## 2. Add a third reference/comparison cohort

Today there are two bundled cohorts: `peleg_118` (118 validated fibril-forming peptides ≤40 aa) and `gold_standard` (Staphylococcus aureus 2023, 2,916 peptides). Adding a third — say a UniProt-short cohort — touches one backend registry and two UI registries.

### Backend — the precompute registry

The script is `backend/scripts/precompute_dataset.py`. The registry is a literal dict near the top:

```python
DATASETS: Dict[str, Dict[str, Any]] = {
    "peleg_118": { "title": ..., "source": ..., "output": ... },
    "gold_standard": { "title": ..., "source": ..., "output": ... },
}
```

To add a cohort:

1. Drop the curated input under `backend/data/reference_datasets/<id>.json` (or `.xlsx` — both loaders exist), following the JSON schema documented in `backend/data/reference_datasets/README.md`. Honor that schema's **null semantics**: missing fields are JSON `null`, never `"N/A"` or `-1`.
2. Add a `DATASETS["uniprot_short"]` entry with `source` and `output` (`backend/data/precomputed/<id>.json`).
3. Run `USE_TANGO=1 USE_S4PRED=1 python scripts/precompute_dataset.py uniprot_short`. The artifact has the **same shape as `POST /api/predict/batch`** — that is what makes the precompute path and the live path interchangeable.
4. Update `backend/data/reference_datasets/README.md` with the new dataset's N, length cap, curator, sources, and role.

### Frontend — two registries

There is no single registry; there are two, for two different surfaces. Both must learn the new id.

- **`ui/src/pages/Compare.tsx`** — the split-button registry `REFERENCE_DATASETS` (a `Record<string, { label; precomputeId; fallback? }>`). Add a `uniprot_short` entry pointing `precomputeId` at the new dataset and an optional CSV `fallback` for hosts without the artifact. Then add a menu item in the split-button dropdown (next to the existing `gold-standard-menu-item`).
- **`ui/src/lib/referenceDistributions.ts`** — the `QUICK_ANALYZE_DATASETS: ReferenceDatasetConfig[]` array used by single-peptide comparison tabs. There is already a disabled `uniprot_short` stub here; flip `disabled` off and point `csvUrl` at the served CSV once the distribution exists.

Note the standing tech-debt warning at the top of `referenceDistributions.ts`: its biochem formulas (Fauchère-Pliska, Eisenberg µH) are a **client-side copy** of `backend/biochem_calculation.py`. If your new cohort relies on changed constants, fix both or the client distribution drifts silently.

### Things you should NOT do

- **Do not give the cohort a different artifact shape.** If `precompute_dataset.py` emits anything other than the `/api/predict/batch` response shape, `mapApiRowToPeptide` in `Compare.tsx` throws per row and your cohort silently loads zero peptides. The artifact *is* the contract.
- **Do not register the id in only one UI surface.** A cohort that exists in `Compare.tsx` but not in `referenceDistributions.ts` (or vice versa) looks half-shipped: it appears in batch compare but not in single-peptide tabs. Wire both, or document the omission deliberately.

---

## 3. Add a new export format (e.g. mmCIF/PNG alongside SVG)

The export surfaces and their files are catalogued in `docs/active/EXPORT_REDESIGN_BRIEF.md` — read it first; it lists exactly what ships and what's missing. The relevant libs under `ui/src/lib/`:

| Export | File | Architecture |
|---|---|---|
| Shortlist PDF | `report.ts` | jsPDF, flat |
| Per-peptide PDF | `peptideReport.ts` + `peptideReportPanels/` | **panel system** |
| Per-peptide HTML | `peptideHtmlReport.ts` | self-contained HTML |
| Figure pack (ZIP of SVG) | `figurePack.ts` + `figurePackPanels/` | **panel system** |

The two extensible surfaces are the **panel systems**. In `figurePack.ts`, `generateFigurePack(options): Promise<FigurePanel[]>` assembles panels, each a pure function returning a standalone SVG string (see `figurePackPanels/{classificationTable,radarOverlay,aggregationProfile,methodsText}.ts`). `downloadSVGFiles(panels, coverSvg)` then writes the bundle.

To add a PNG companion (the brief's "journals that reject SVG" gap):

1. Add a rasterization step — render each panel's SVG to a `<canvas>` and `toBlob('image/png')`.
2. Extend the download orchestrator (`downloadSVGFiles` / the JSZip path) to add `*.png` alongside each `*.svg`. Do **not** change the `FigurePanel` interface unless every panel producer is updated — it is shared.
3. For a new per-peptide format, write a new `ReportPanel` and register it in `peptideReport.ts`'s panel import block; reuse the shared `drawDataTable` / `drawSectionHeading` primitives so headers and footers stay consistent.

Every export must carry the provenance footer (version + dataset + thresholds + commit SHA) — today only CSV/TSV/XLSX has it; the brief's Tier 1 is extending it to PDF/HTML. A new format inherits that requirement.

### Things you should NOT do

- **Do not introduce `||` for numeric/score fallbacks.** Export formatters touch every metric. A value of `0` (a real composite score, a 0% TANGO peak) is falsy — `score || "N/A"` erases legitimate zeros. Use `??` and the existing `fmt`/`fmtPct` null-guards in `report.ts`, which already test `=== null` before formatting.
- **Do not let an export pull from a non-deterministic source.** Exports are citable artifacts; the same state must produce a byte-comparable file. No timestamps inside figure SVGs, no `Math.random` panel ids, no re-querying live data mid-export. Read from the already-resolved peptide objects and thresholds passed in `options`.

---

## Before you open a PR

- Re-read [contracts and invariants](../agents/02_contracts_and_invariants.md): additive+nullable schema fields, camelCase keys, `null` not sentinels, classifications computed once at the data layer.
- Add the predictor/cohort/format to *both* the single and batch (or both UI) code paths, or none.
- `make ci` must pass; for backend changes run a single peptide through both `process_single_sequence` and the batch path and diff the outputs.
