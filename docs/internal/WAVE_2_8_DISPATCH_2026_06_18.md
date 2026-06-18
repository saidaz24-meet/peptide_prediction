# Wave 2.8/2.9 dispatch plan — 2026-06-18

T1 (CEO) coordination doc. Sub-terminals (T2, T3, T4) and Cowork each get a self-contained brief below. Said verifies each shipped fix against the per-item "what to check live" recipe before merging.

---

## 0. Status board

| Stream | Status | Notes |
|--------|--------|-------|
| T1 (CEO) | active | Orchestrating, integrating, smoke tests |
| T2 (Frontend) | **brief ready below** | Quick Analyze plot rework + TANGO panel + per-tool strip |
| T3 (Backend) | **brief ready below** | Pre-compute datasets, paired t-test, NDJSON streaming endpoint |
| T4 (Perf) | **brief ready below — pending perf research return** | 22× gap profile + fix |
| Cowork | **3 paste-ready prompts below** | Mol* SSW overlay, NDJSON UI hook, biochem DB-tabs |
| Research (background) | 3 launched, 2 returned, 1 pending | Mol* + SSE done; perf pending |
| OQ → Peleg sync | 6 questions queued | Hold until next sync |

---

## 1. Verification checklist for everything shipped in this session

**Run locally first** before merging:

```bash
cd ui && npm run dev   # http://localhost:5173
# In a separate terminal:
cd .. && uvicorn backend.api.main:app --reload --port 8000
```

Then walk this list end-to-end. ⬜ each box.

### Homepage (`/`)

| ID | What to check | Pass criteria |
|----|---------------|---------------|
| A4 | Hero tagline | Reads "…for peptide secondary structure switching and fibril formation." NO "aggregation" before "structural switching" |
| A6 | Hero sequence panel | Shows `GVGDLIRKAVSVIKNIV` (17 aa Uperin 3.5) typing animation, not 42-aa Amyloid-β |
| H5 | First feature card | Title "Secondary Structure Prediction"; body says "Utilizing S4PRED, TANGO and internal threshold to determine secondary structure" |
| H6 | "Analyze Peptide Datasets at Scale" subtitle | Mentions "biochemical calculations" and "thresholds determined according to the given database" |
| H7 | Algorithm tabs — S4PRED tab | Body credits TANGO + fibril-formation; bullet list shows Helix · SSW · FF-Helix · FF-SSW, NOT H/E/C |
| H8 | "Built for Researchers" testimonial | Mentions SSW as first-of-kind, non-beta fibril formation, DB analysis + viz |
| H1–H4 | "How It Works" cards | 5 numbered steps (1, 2, 3, 4, 5 — no 2a/2b). Step 3 reads "Classify Fibril-formation candidates". Step 4 description contains "Classification analysis" (not "Classification sets") |
| A5 | Pipeline diagram | "Fibril-formation" node sits BELOW S4PRED+TANGO (not parallel to them). Final node before Export is "Rank" (NOT "Rank & Merge") |

### Quick Analyze (`/quick`)

| ID | What to check | Pass criteria |
|----|---------------|---------------|
| A7 | Example chips | Three chips: **Uperin 3.5** · LL-37 · KLVFF. NO "Amyloid-β(25-35)" chip |
| Q1 | Name placeholder | Empty Name field shows "e.g. Uperin 3.5", NOT "e.g. Amyloid-beta" |
| Q18 | Back link top of page | Reads "Back to batch results" (lowercase b) — only visible if datasetStore has peptides |
| Q19 | Leave dialog | Trigger by clicking Logo while results visible. Dialog body: "Your prediction results will be lost. Are you sure?" — NO "hasn't been saved to a dataset" line |
| A3 | Leave Anyway destination | Press Leave Anyway → lands on `/` (homepage), NOT on stale `/results` |
| A2 | Threshold input typing | Open "Advanced: Threshold Configuration". Click into "Minimal S4PRED helix score" field, **type a number** (e.g. `0.85`). Value should accept directly without the digits getting eaten between keystrokes |
| A1 | Threshold panel | "TANGO aggregation threshold" row is **gone** entirely from the Fibril-formation thresholds section |
| Q4 | µH label | Reads "Hydrophobic moment (µH)" — NOT "uH (Hydrophobic moment)" |
| Q5 | µH + Hydrophobicity info popovers | Both info icons mention "Fauchère, J. and Pliska, V. 1983" |
| Q2 | Helix tooltip pattern | "Minimal S4PRED helix score" info shows "To make secondary structure prediction more strict, this number should be closer to 1. Value range 0-1." Same pattern for "Minimal % helix content" |
| Q3 | SSW threshold tooltip | "S4PRED maximum helix and beta difference" info shows "In batch mode, this value is determined automatically according to the input database." Same for TANGO maximum helix and beta difference |
| Q10 | Quick Analyze results — Biochem block | After analyzing Uperin 3.5, scroll to "Biochemical feature comparison". Shows ONLY Hydrophobicity, Hydrophobic moment, Charge. NO "S4PRED helix %" row |

### Upload (`/upload`)

| ID | What to check | Pass criteria |
|----|---------------|---------------|
| B1 | Dropzone format hint | Reads "CSV · TSV · XLSX · FASTA" (with dot separators, all four) |
| B2 | Example dataset chips | First chip is "Fibril-forming peptides (118)". Click it → preview shows 118 rows from Peleg-118 |
| B5/B6 | Length warning bands | Upload a CSV with mixed lengths: include sequences of 2 aa, 50 aa, 90 aa. Warning shows three separate lines — one for <4, one for 40-80 ("results may be less reliable"), one for >80 ("rows will be skipped") |

### Peleg-118 dataset

| ID | What to check | Pass criteria |
|----|---------------|---------------|
| Dataset shipped | `backend/data/reference_datasets/peleg_118_fibril_validated.json` exists | `python3 -c "import json; print(json.load(open('backend/data/reference_datasets/peleg_118_fibril_validated.json'))['n_peptides'])"` prints `118` |
| Dataset README | `backend/data/reference_datasets/README.md` documents schema + categories | open and skim |
| CSV mirror | `ui/public/example/peleg_118_fibril_forming.csv` exists | 119 lines (header + 118 rows) |

### Docs handed to Peleg

| ID | What to check | Pass criteria |
|----|---------------|---------------|
| Paper methods | `docs/active/PAPER_METHODS_REFERENCE.md` | Skim §1 algorithms, §3 web platform, §5 AI tools, §7 reproducibility. Anything you want adjusted, edit before sending |
| Peleg notes triage | `docs/active/PELEG_NOTES_2026_06_18.md` | 67 items in 9 sections + 6 open questions |
| Handoff | `docs/active/HANDOFF.md` | Read as if you're a brand-new dev. Anything unclear? |
| Meeting capture | `docs/active/MEETING_2026_06_18.md` | Confirm action items reflect Said's intent |

---

## 2. T2 — Frontend brief (Quick Analyze + plot rework)

**Scope**: solo on UI-only work. No backend changes.
**Branch**: `wave-2.9/quick-analyze-rework`
**Estimated time**: 1.5 days.

### Items
- Q6 — 4-class KPI strip at top of Quick Analyze results (%Helix · %FF-Helix · %SSW · %FF-SSW)
- Q9 — per-tool result strip between sequence and biochem block (color-coded chips per algorithm)
- Q12 — TANGO panel rename: "TANGO Aggregation Profile" → "Tango Secondary Structure and Aggregation Probabilities"
- Q12 — Reorder: secondary structure plot FIRST, aggregation plot SECOND (currently aggregation first)
- Q12 — Y-axis 0-100 (currently 0-1)
- Q13 — TANGO secondary structure plot: match S4PRED line-graph style (3 series P(Helix)/P(Beta)/P(Coil), x = residue, y = probability)
- Q14 — Aggregation–Structure Overlay: unify hide/show toggles (single row above both plots OR one per plot under title)
- Q16 — Aggregation–Structure Overlay: add TANGO Helix series (currently only Beta)
- Q17 — Aggregation series color → `#E040FB` (magenta) — distinct from helix-blue / beta-orange
- B11 — KPI cards (Results dashboard): hover-help tooltips for SSW / FF-SSW acronyms
- B12 — Venn diagram: render the count inside each region

### Prompt to paste into T2's terminal

```
You are T2 (Frontend). Read `docs/active/PELEG_NOTES_2026_06_18.md` items Q6, Q9, Q12, Q13, Q14, Q16, Q17, B11, B12.

Work only on the frontend. No backend changes.

For each item:
1. Find the file via grep first.
2. Make the smallest possible change.
3. Update the corresponding test in `ui/src/components/__tests__/`.
4. Run `npx vite build` after each item to confirm green.

Stack notes (from `ui/CLAUDE.md`):
- Tailwind only, shadcn/ui components (Card, Button, Badge, Tabs).
- Recharts for charts; raw SVG for custom.
- Color tokens: `hsl(var(--helix))` / `hsl(var(--beta))` / `hsl(var(--coil))`. Add `--ssw` for the new magenta if you wire B16/Q17.
- Chart line-graph reference: `S4PREDChart.tsx` is the style target for Q13.

Specific gotchas:
- Q12 y-axis 0-100: TANGO raw scores are 0-50ish typically; setting domain [0, 100] makes the plot look sparse. Confirm with `useDatasetStore` that the value range is what you think.
- Q13: do NOT replace the existing bar chart wholesale — add a toggle "Bar / Line view" so reviewers can A/B during the Peleg sync.
- Q17 magenta = `#E040FB` (per research: chameleon-sequence convention).

After each fix, write a one-line verify recipe (URL + click path + pass criteria) so Said can verify in browser. Append to `docs/internal/WAVE_2_8_DISPATCH_2026_06_18.md` §1.

PR title format: `feat(quick-analyze): Q.X — short description`.
Open a single PR per item OR one PR per item cluster (Q12-Q13-Q14-Q16-Q17 as one TANGO-panel PR is fine).

When done, message T1 with the list of opened PRs.
```

### Manual verification (Said does these after T2 ships)

For each item, T2 writes a recipe of the form:
```
Q.X — [URL] → [click path] → [observable]
Pass when: [exact text or visual]
```

---

## 3. T3 — Backend brief (precompute + paired t-test + streaming)

**Scope**: backend only. Owns `backend/services/`, `backend/api/routes/`, `backend/data/`.
**Branch**: `wave-2.9/backend-precompute-streaming`
**Estimated time**: 2 days.

### Items
- **M2** — Pre-compute Peleg-118 + Gold + Uperin datasets to `backend/data/precomputed/*.json`
- B3 — Column auto-detection (case-insensitive `Sequence`/`peptide`/`seq` match)
- B4 — XLSX header-row skip when first cell is non-sequence text
- B7 — NDJSON streaming endpoint `/api/predict/stream` (per research §2 below)
- B15 — Export header includes thresholds + `pvl_version`
- B19 — Paired t-test compute for cohort comparison (Welch's t-test for unpaired distributions, paired t-test if pre/post within same dataset)
- E4 — Display "Method = TANGO + S4PRED + FF-Helix" in export header

### Prompt to paste into T3's terminal

```
You are T3 (Backend). Read `docs/active/PELEG_NOTES_2026_06_18.md` items M2, B3, B4, B7, B15, B19, E4.

Work only on the backend (`backend/`). No frontend changes — but expose endpoints/schemas the frontend can consume.

Order of work:
1. **M2 first** — `make precompute-datasets` Makefile target that runs the full TANGO + S4PRED + classification pipeline on `backend/data/reference_datasets/peleg_118_fibril_validated.json` and writes `backend/data/precomputed/peleg_118.json` with the SAME normalized shape as `/api/predict` returns. Also do `gold_2023.json` (find inputs in `memory/reference_gold_standard_dataset.md`) and `uperin_frog.json` (5 Uperin peptides from Peleg-118). Stamp `precomputed_at` (UTC ISO-8601) and `pvl_version` at the top.
2. **B3 + B4** — `backend/services/dataframe_utils.py`. Add `auto_detect_sequence_column(headers)` with case-insensitive match priority: sequence > Sequence > seq > Seq > peptide. Add `should_skip_first_row(rows)` that returns True if row[0][seq_col_idx] is not a valid peptide sequence (any character outside A-Z minus B/J/O/U/X/Z is allowed; whitespace or "Sequence" string returns True).
3. **B7** — New route `POST /api/predict/stream` returning `media_type="application/x-ndjson"`. Implement per the pattern in `docs/internal/WAVE_2_8_DISPATCH_2026_06_18.md` §6 (NDJSON header/row/error/footer events; `anyio.sleep(0)` for cancellation hand-off; `X-Accel-Buffering: no` header). KEEP existing `/api/predict` unchanged.
4. **B19** — `backend/services/cohort_stats.py` new module. `welch_t_test(a: list[float], b: list[float]) -> {t: float, p: float, df: float}`. Use scipy.stats.ttest_ind(equal_var=False). Add a thin route `POST /api/cohorts/compare` taking two cohort IDs and a metric name, returning the test result.
5. **B15 + E4** — `backend/services/export.py` (or wherever the CSV export lives). Add a header block:
   ```
   # Method = TANGO + S4PRED + FF-Helix
   # PVL version = <pvl_version>
   # Thresholds = <json-encoded thresholds>
   # Exported at = <iso-8601>
   ```
   Then the column header row, then data rows.

Tests:
- Add pytest cases for M2 (verify artifact shape matches `/api/predict` schema), B3/B4 (auto-detect + skip), B7 (stream returns NDJSON lines parseable as JSON), B19 (Welch's t on known inputs matches scipy), B15 (export header lines present).

After each item, write a curl one-liner Said can run to verify. Append to dispatch doc §1.

PR strategy: separate PRs for M2 / dataframe-utils / streaming / cohort-stats / export-provenance. Each <500 LOC.
```

### Manual verification

```bash
# M2
make precompute-datasets
ls -la backend/data/precomputed/
python3 -c "import json; d=json.load(open('backend/data/precomputed/peleg_118.json')); print(d['pvl_version'], d['precomputed_at'], len(d['entries']))"

# B7 streaming
curl -N -X POST http://localhost:8000/api/predict/stream \
  -H "Content-Type: application/json" \
  -d '{"peptides":[{"id":"u1","sequence":"GVGDLIRKAVSVIKNIV"}],"config":{}}' \
  | head -20

# B19 cohort stats
curl -X POST http://localhost:8000/api/cohorts/compare \
  -H "Content-Type: application/json" \
  -d '{"a":"peleg_118","b":"uperin_frog","metric":"muH"}'
```

---

## 4. T4 — Perf brief (22× gap)

**Status**: Research returned. Top fix (#1 OMP/torch oversubscription) **already shipped this session** — see §6.3 + `backend/_perf_init.py`. T4's job is now to validate the impact on prod and decide which of fixes #2–#6 to apply next.

### Prompt to paste into T4's terminal

```
You are T4 (Performance Engineer). Your mission: validate the OMP/torch fix already shipped to main (commit pending), then decide which residual fix to apply next.

CONTEXT:
- T1 already shipped fix #1 (OMP_NUM_THREADS=1 + torch.set_num_threads(1)) — see backend/_perf_init.py + Dockerfile.backend env block. 624/624 backend tests pass locally.
- This was the #1 expected source of the 22× gap (PyTorch ensemble × OMP default threads × thread-pool × workers oversubscription on a 4-vCPU box).
- Read docs/internal/WAVE_2_8_DISPATCH_2026_06_18.md §6.3 for the full fix list and rationale.

PHASE 1 — validate the shipped fix on prod.

1. Deploy the latest main to the Hetzner VPS (root@94.130.178.182) — `docker compose pull && docker compose up -d --no-deps backend`.
2. Confirm the fix loaded:
   docker exec <pvl-backend> python -c "import torch; print('threads=', torch.get_num_threads(), 'interop=', torch.get_num_interop_threads())"
   Expected: threads=1, interop=1.
3. Confirm env vars:
   docker exec <pvl-backend> env | grep -E 'OMP|MKL|OPENBLAS'
   Expected: OMP_NUM_THREADS=1, MKL_NUM_THREADS=1, OPENBLAS_NUM_THREADS=1.
4. Run a 100-peptide timing test (use the Peleg-118 dataset as input):
   - Submit via curl to /api/predict.
   - Time start-to-end wall clock.
   - Repeat 3×, take median.
5. Compare against the pre-fix baseline. If unknown, run with `OMP_NUM_THREADS=4` overridden (`docker exec -e OMP_NUM_THREADS=4 ...`) as a regression check.
6. Capture a py-spy flame graph for 60s during a fresh 100-peptide run:
   PID=$(docker inspect -f '{{.State.Pid}}' <pvl-backend>)
   sudo py-spy record -o pvl_after.svg -d 60 -p $PID
7. Capture pidstat thread CPU + context-switches:
   pidstat -t -p $PID 2 30 > pidstat_after.txt
8. Diff with Mac terminal numbers Said reported (1 min / 1k peptides).

DELIVERABLE for Phase 1: write `docs/internal/PERF_PROFILE_2026_06_18.md` with:
- Before/after timings for 100-peptide batch.
- Flame graph (SVG attached).
- pidstat output.
- Decision: which of fixes #2–#6 to ship next, with expected impact.

PHASE 2 — apply next fix.
- If Phase 1 shows <3× improvement: the OMP fix didn't land OR another bottleneck is bigger. Investigate via flame graph hotspots.
- If 3–8× as expected: ship fix #2 (uvicorn --workers 1) AND #5 (GZipMiddleware). Skip #4 (orjson) for now since the JSON serialization cost is dwarfed by predict cost.
- If close to local Mac speed: declare victory, document.

PHASE 3 — long-run.
- If the gap is still >2× after all quick wins: consider TANGO batching (single TANGO invocation for many peptides — needs verification of current behavior), or moving to a worker queue (Celery) for big batches.
- Document recommendations in PERF_PROFILE_2026_06_18.md §"Future work".
```

---

## 5. Cowork — paste-ready prompts

Cowork is best for *focused visual rewrites* where the design is clear and the implementation is moderately complex. Three prompts ready to dispatch.

### 5.1 Cowork prompt — Mol* SSW residue overlay (B16)

```
Add an SSW (secondary structure switching) residue overlay to PVL's Mol* 3D viewer in `ui/src/components/AlphaFoldViewer.tsx`. The overlay highlights residues where the backend has flagged structural switching, parallel to the existing helix coloring.

REQUIREMENTS:
1. Use Mol* `Overpaint` (NOT a new ColorTheme) — overlays on top of the existing secondary-structure theme without replacing it.
2. Helper functions in a new file `ui/src/lib/molstarOverlay.ts`:
   - `applySSWOverlay(plugin, sswResidueMask: number[], chainId = 'A')`
   - `clearSSWOverlay(plugin)`
3. Use `setStructureOverpaint` from `molstar/lib/mol-plugin-state/helpers/structure-overpaint`, with `Script.getStructureSelection` + `Q.core.set.has` to convert the residue index array into a Loci.
4. SSW color: `Color(0xE040FB)` (vivid magenta — chameleon-sequence convention).
5. UI: add a `<Toggle pressed={showSSW} onPressedChange={setShowSSW}>Show SSW residues</Toggle>` next to the existing structure controls.
6. Read `peptide.sswResidueMask` (an array of 1-based residue indices) from the peptide prop. If undefined or empty, disable the toggle with a tooltip "No SSW residues detected".
7. The toggle should not flicker — `setStructureOverpaint` is incremental; do not re-mount the viewer.

REFERENCE CODE:

import { Script } from 'molstar/lib/mol-script/script';
import { StructureSelection } from 'molstar/lib/mol-model/structure';
import { Color } from 'molstar/lib/mol-util/color';
import { setStructureOverpaint } from 'molstar/lib/mol-plugin-state/helpers/structure-overpaint';

const SSW_COLOR = Color(0xE040FB);

export async function applySSWOverlay(plugin, mask: number[], chainId = 'A') {
  const ref = plugin.managers.structure.hierarchy.current.structures[0];
  if (!ref || !mask.length) return;
  await setStructureOverpaint(plugin, ref.components, SSW_COLOR, async (structure) => {
    const sel = Script.getStructureSelection(Q =>
      Q.struct.generator.atomGroups({
        'chain-test':   Q.core.rel.eq([Q.struct.atomProperty.macromolecular.label_asym_id(), chainId]),
        'residue-test': Q.core.set.has([Q.core.type.set(mask), Q.struct.atomProperty.macromolecular.label_seq_id()]),
      }),
      structure,
    );
    return StructureSelection.toLociWithSourceUnits(sel);
  });
}

TESTING:
- Add a vitest case in `ui/src/components/__tests__/AlphaFoldViewer.test.tsx` that mocks the plugin manager and asserts the overlay helper is called with the right mask when the toggle flips on.
- Manually verify with Uperin 3.5 (Quick Analyze → click into PeptideDetail) — magenta residues should appear/disappear as the toggle flips, with helix-blue coloring preserved underneath.

OUT OF SCOPE:
- Don't change the existing secondary-structure coloring.
- Don't introduce a new ColorTheme registration.

Deliverable: PR `feat(mol3d): SSW residue overlay (B16)`.
```

### 5.2 Cowork prompt — NDJSON streaming UI hook (M4 frontend)

```
Add progressive results rendering to PVL's batch upload flow. Build the frontend hook that consumes the NDJSON stream that T3 will expose at `POST /api/predict/stream`.

ENDPOINT CONTRACT:
- Request: same JSON body as `/api/predict` (peptide list + threshold config).
- Response: `application/x-ndjson` — one JSON object per line. Types:
  - `{"type": "header", "total": N}` — sent first
  - `{"type": "row", "index": i, "entry": <normalized PeptideEntry>}` — sent per finished peptide
  - `{"type": "error", "index": i, "id": "...", "message": "..."}` — per-peptide failure
  - `{"type": "footer", "done": true}` — sent last
- Backpressure: server pull-drives — slow consumer pauses the pipeline.

DELIVERABLES:
1. New file `ui/src/hooks/useStreamingPredict.ts` with this shape:

   export type StreamEvent =
     | { type: "header"; total: number }
     | { type: "row"; index: number; entry: PeptideEntry }
     | { type: "error"; index: number; id: string; message: string }
     | { type: "footer"; done: true };

   export function useStreamingPredict(onEvent: (e: StreamEvent) => void) {
     // Use fetch() + ReadableStream + TextDecoder + buf.split("\n") + buf.pop() partial-line preservation.
     // Return { start(body), cancel() }.
   }

2. Wire it into `ui/src/pages/Upload.tsx`:
   - When peptide count > 100, use `useStreamingPredict` instead of the existing single POST.
   - On each `row` event, push to `datasetStore` via a new action `appendEntry(entry)`.
   - On `header`, set `datasetStore.expectedTotal = total` so progress bar shows "X / total".
   - On `footer`, mark the job complete.
   - On `error` events, accumulate into `datasetStore.failedPeptides` for the UI to surface.
3. Add to `ui/src/components/AnalysisProgress.tsx`:
   - Show "X of N peptides processed" while streaming.
   - Show inline error list when `failedPeptides.length > 0`.

GOTCHAS (FROM RESEARCH):
- Chunk boundaries DO NOT align with newlines. Always preserve the last partial line in `buf` between reads.
- `fetch()` body reader read loop: `while (true) { const {value, done} = await reader.read(); if (done) break; ... }`.
- AbortController + `signal` for cancel.
- Do NOT use `EventSource` — it's GET-only with a URL cap.

TESTS:
- vitest with a mock `ReadableStream` that emits a chunk crossing a newline boundary mid-payload. Assert all events parse.

OUT OF SCOPE:
- Don't change `/api/predict` (non-streaming path) behavior for small batches.
- Don't implement the backend route — T3 owns that.

Deliverable: PR `feat(upload): NDJSON streaming hook + progressive rendering (M3/M4)`.
```

### 5.3 Cowork prompt — Quick Analyze biochem DB-tabs (Q11)

```
Add clickable database-comparison tabs to PVL's Quick Analyze biochem block, per Peleg (PDF1 p20).

CURRENT STATE:
- `ui/src/components/BiochemComparison.tsx` shows a single comparison to "the database" (whatever's in `useDatasetStore`).
- For Quick Analyze (single peptide), there's no implicit batch database; the comparison block currently auto-disables.

REQUIRED STATE:
- Above the radar / percentile bars, show a row of pressable tabs:
  - "UniProt short peptides"
  - "Fibril-forming short peptides"
- Default selected: "Fibril-forming short peptides".
- Clicking a tab fetches the reference distribution from a new endpoint (T3 will expose `GET /api/reference-distributions/{dataset_id}/{metric}` — for now stub-fetch from `/example/peleg_118_fibril_forming.csv` and compute means/std client-side).
- The radar + percentile bars below the tabs update to show the comparison vs the selected database.
- Title above tabs: "Compare with database:" — bold, same font size as the section title.

UI DETAILS:
- shadcn/ui `<Tabs>` component, NOT `<Toggle>`.
- Underline-style active state.
- Mobile: stack vertically below 480px.
- Loading state when switching tabs: skeleton bars (not spinner).

PROPS:
- BiochemComparison should accept optional `comparisonDatasets: {id: string; label: string}[]` and `defaultDatasetId: string`.
- If `comparisonDatasets` not passed, behave as today (single implicit comparison).
- Quick Analyze passes the 2 named datasets above.

OUT OF SCOPE:
- Don't change the radar / percentile bar rendering itself.
- The cohort comparison page (`/compare`) keeps its current single-dataset behavior — this is Quick Analyze only.

Deliverable: PR `feat(quick-analyze): clickable database comparison tabs (Q11)`.
```

---

## 6. Reference research output (for sub-terminal context)

### 6.1 NDJSON streaming recommendation (research summary)

**Pick**: NDJSON over chunked HTTP (`StreamingResponse`), not SSE.

**Why**: SSE's `EventSource` is GET-only with a ~2KB URL cap — Quick Analyze can pass that, batch upload can't. SSE's killer feature (Last-Event-ID auto-reconnect) is wasted on a finite, one-shot pipeline run. WebSocket is over-engineered. Chunked HTTP keeps the same `PeptideEntry` JSON shape as `/api/predict`, so small batches transparently fall back to the non-streaming endpoint.

**Backend pattern (FastAPI)**:

```python
from fastapi.responses import StreamingResponse
import anyio, json

@router.post("/api/predict/stream")
async def predict_stream(req: PredictRequest):
    async def gen():
        try:
            yield json.dumps({"type": "header", "total": len(req.peptides)}) + "\n"
            for i, pep in enumerate(req.peptides):
                try:
                    entry = await anyio.to_thread.run_sync(run_predict_one, pep, req.config)
                    yield json.dumps({"type": "row", "index": i, "entry": normalize_entry(entry)}) + "\n"
                except Exception as e:
                    yield json.dumps({"type": "error", "index": i, "id": pep.id, "message": str(e)}) + "\n"
                await anyio.sleep(0)  # cancellation hand-off
            yield json.dumps({"type": "footer", "done": True}) + "\n"
        except anyio.get_cancelled_exc_class():
            return
    return StreamingResponse(
        gen(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

**Frontend pattern (React)**:

```ts
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "";
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";  // preserve partial line
  for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
}
```

**nginx delta** (Hetzner reverse proxy):

```nginx
location /api/predict/stream {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_buffering off;          # CRITICAL — default ON kills streaming
    proxy_cache off;
    proxy_read_timeout 600s;
    gzip off;                     # gzip buffers entire response
    proxy_set_header Connection "";
}
```

**Top gotchas**:
- `proxy_buffering on` (nginx default) batches the entire response — symptom is "everything arrives at once". Most common cause of failed streaming.
- Don't gzip the stream.
- Chunks split across newlines — keep the partial line.
- `StreamingResponse` bypasses Pydantic `response_model` — `json.dumps` each line yourself.
- Heartbeat ping every 15s if any single peptide can take >30s (some proxies kill idle connections).

### 6.2 Mol* SSW overlay recommendation (research summary)

**Pick**: `Overpaint` via `setStructureOverpaint`. NOT a new `ColorTheme`.

**Why**: `Overpaint` overlays per-loci color on top of the existing theme; helix coloring stays intact under SSW residues. A new `ColorTheme` would replace the whole secondary-structure coloring.

**Color**: `#E040FB` magenta. Established ChSeq convention for "chameleon"/switching sequences. Max hue distance from helix-blue and beta-orange.

(Code snippet in §5.1 Cowork prompt.)

### 6.3 22× perf gap — root cause + fixes (research returned)

**Top finding**: agent inspected the code and reframed the priors. TANGO is invoked ONCE per batch (not 1k times), so subprocess fork-storm is NOT the bottleneck. The dominant suspect is **PyTorch / OpenMP thread oversubscription** on the S4PRED 5-BiLSTM ensemble.

**The math**: 5 BiLSTMs × default torch intra-op (= `os.cpu_count()` = 4 on CX33) × `ThreadPoolExecutor(max_workers=4)` × 2 uvicorn workers = up to **160 threads on 4 cores** during a concurrent request. Even a single-request profile spawns 5×4 = 20 OMP threads on 4 cores. Context-switch and L1/L2 thrash dominate runtime.

**Quick-win fixes (ranked by expected impact)**:

| # | Fix | Expected impact | Status |
|---|-----|-----------------|--------|
| 1 | Pin `OMP_NUM_THREADS=1`, `MKL_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1` + `torch.set_num_threads(1)` + `torch.set_num_interop_threads(1)` | **3–8×** | ✅ **shipped this session** (`backend/_perf_init.py` + `Dockerfile.backend` env block + `backend/tools/s4pred/model.py` belt-and-braces). 624/624 backend tests pass. |
| 2 | Drop uvicorn from `--workers 2 --threads 4` to `--workers 1 --threads 4` on the 4-vCPU box (avoids 2× oversubscription) | 1.5–2× | not yet shipped — Dockerfile CMD change |
| 3 | TANGO poll loop: replace `while proc.poll() is None: sleep(0.5)` with `proc.wait()` (frees thread-pool slot faster) | 1.2–1.5× | not yet shipped — `backend/tango.py:506-526` |
| 4 | Swap stdlib `json` → `orjson` (or `ORJSONResponse` on `/api/predict`) | 1.5× on tail (per-residue float arrays) | not yet shipped |
| 5 | Add `GZipMiddleware` to the FastAPI app | 5–10× on network bytes | not yet shipped |
| 6 | nginx: `proxy_buffering off; proxy_read_timeout 1800;` on `/api/predict*` | unblocks streaming + prevents 504 on long runs | required for B7 streaming endpoint anyway |

**Profiling recipe** for T4 (Phase 1) to validate fixes:

```bash
# Confirm thread oversubscription BEFORE fix
docker exec <pvl> python -c "import torch; print(torch.get_num_threads(), torch.get_num_interop_threads())"
# Expected after fix: (1, 1) — currently anything else on prod

# py-spy flame graph during a 1k-peptide batch
PID=$(docker inspect -f '{{.State.Pid}}' <pvl-backend>)
sudo py-spy record -o pvl_before.svg -d 120 -p $PID  # before deploy
# Re-deploy with the fix, re-run:
sudo py-spy record -o pvl_after.svg -d 120 -p $PID   # after

# pidstat for thread-level CPU + ctx-switch
pidstat -t -p $PID 2 60

# perf for IPC + cache misses
perf stat -p $PID -- sleep 30

# strace for sanity-check on subprocess count
sudo strace -p $PID -f -e trace=clone,execve -c -o /tmp/clone.log &
# fire request, wait, then:
# expected: ~1 clone() per batch for TANGO, not 1000
```

**Expected combined speedup**: 5–10× from the OMP fix alone; 10–20× combined with #2 + #5. The remaining 2× gap likely accounts for the CX33 shared-vCPU disadvantage vs M-series Apple Silicon — irreducible unless we migrate to dedicated cores.

**Sources**: [PyTorch CPU threading docs](https://docs.pytorch.org/docs/stable/notes/cpu_threading_torchscript_inference) · [PyTorch issue #3146](https://github.com/pytorch/pytorch/issues/3146) · [orjson README](https://github.com/ijl/orjson) · [Geekbench M2 vs Hetzner](https://browser.geekbench.com/processors/apple-m2).

---

## 7. Sequencing — what unblocks what

```
T3.M2 (precompute Peleg-118) ──────────► T2.Q11-data (biochem DB tabs can use real artifact)
                                      └► Cowork.5.3 (biochem DB tabs full impl)

T3.B7 (NDJSON endpoint) ───────────────► Cowork.5.2 (streaming UI hook)
                                      └► T2 dashboard progress UI

T4 Phase 1 (profile) ──────────────────► T1 reads report, decides fix order
                                      └► T4 Phase 2 (apply fixes)

Cowork.5.1 (Mol* overlay) — independent, can run in parallel any time
```

---

## 8. What T1 does this week

- ✅ Wave 2.8 page-1 closeout (this turn).
- 🟡 Verify shipped fixes in browser (§1 of this doc) — Said does this.
- 🟡 Dispatch T2, T3, Cowork briefs above.
- 🟡 Hold T4 Phase 2 until perf research returns.
- 🟡 Open GitHub Issues for the OQ list (6 questions) — send to Peleg in next sync.
- 🟡 Track all open PRs daily, merge in order of completion.

---

## 9. Open questions for Peleg (next sync — DO NOT block on these)

| OQ | Question |
|----|----------|
| OQ1 | "Colid-coil" — typo for "Coiled-coil"? If so, do we mean 3-state coil (irregular) or coiled-coil motif (two-helix wrap)? Affects Q7 residue coloring. |
| OQ2 | "Rank & Merge" — landed as "Rank". Confirm? |
| OQ3 | Aggregation series color — research suggests magenta `#E040FB`. OK? |
| OQ4 | What does the y=0.5 dashed line in Aggregation-Structure Overlay represent? |
| OQ5 | SSW Mol* color — research suggests magenta `#E040FB`. OK? |
| OQ6 | Hide/show toggle layout — single row above both plots, or per-plot under title? |
| A8 | "AlphaFold-predicted structure" title was Peleg-approved 2026-06-03 (Drive comment 17). 2026-06-18 meeting note says delete. Confirm direction. |
