# PVL Future Implementations

**Last Updated**: 2026-02-13
**Purpose**: Actionable list of remaining features, ordered by priority. Work through these items one by one. Items marked BLOCKED need external input before starting.

---

## Phase A: Paper-Ready (Immediate)

### A1. UniProt Cross-Links
**Status**: DONE (2026-02-12) | **Effort**: 2h | **Blocked**: No
**What**: Make peptide IDs (UniProt accessions) clickable links to uniprot.org.
**Files**: `PeptideTable.tsx`, `PeptideDetail.tsx`
**Details**: Detect IDs matching `^[A-Z][0-9][A-Z0-9]{3}[0-9]$` or `^[A-Z][0-9][A-Z0-9]{3}[0-9]-\d+$` patterns and wrap in `<a href="https://www.uniprot.org/uniprotkb/{id}">`.

### A2. Publication-Ready SVG Export
**Status**: DONE (2026-02-12) | **Effort**: 4h | **Blocked**: No
**What**: Add "Download SVG" button for key visualizations (helical wheel, charts).
**Files**: `HelicalWheel.tsx`, `ResultsCharts.tsx`, new `lib/svgExport.ts`
**Details**: Extract SVG element's outerHTML, set explicit font declarations, wrap in proper XML header. Offer both SVG and high-res PNG via canvas rendering.

### A3. Example Datasets
**Status**: DONE (2026-02-12) | **Effort**: 3h | **Blocked**: No
**What**: Ship 3–5 curated example datasets so new users can explore immediately.
**Files**: New `public/examples/` directory, `Upload.tsx` or `Index.tsx`
**Details**: Include Staphylococcus dataset (exists), human amyloid peptides (curate from UniProt), antimicrobial peptides (APD3 database). Add "Try example data" button on Upload page.

### A4. bio.tools Registration
**Status**: NOT STARTED | **Effort**: 1h | **Blocked**: No (need live URL)
**What**: Register PVL in the ELIXIR bio.tools registry for discoverability.
**Details**: Submit at https://bio.tools/register. Requires: name, description, homepage URL, EDAM topic (topic_0121: Proteomics), operation (operation_2479: Protein sequence analysis), input/output formats.

### A5. Zenodo DOI
**Status**: NOT STARTED | **Effort**: 1h | **Blocked**: No (need GitHub release)
**What**: Get a permanent citable DOI via Zenodo.
**Details**: Link GitHub repo to Zenodo, create a release → automatic DOI. Update CITATION.cff with DOI.

---

## Phase B: User Adoption Features (3–6 months)

### B1. Async Job Queue (Celery + Redis)
**Status**: NOT STARTED | **Effort**: 24h | **Blocked**: Needs VM resources
**What**: Replace synchronous prediction with background jobs. `POST /api/upload-csv` returns `{jobId, status: "queued"}`, poll `GET /api/jobs/{jobId}` for progress.
**Why**: Current synchronous architecture caps at ~30s per request (proxy timeout). Batch predictions with TANGO for 500+ peptides need async processing.
**Files**: New `backend/worker.py`, `backend/api/routes/jobs.py`, `docker-compose.yml` (add Redis + worker services)
**Stack**: Celery + Redis (free, well-documented, Docker-ready)
**Dependencies**: Docker Compose running on DESY VM

### B2. Cohort Comparison Dashboard
**Status**: DONE (2026-02-13) | **Effort**: 16h | **Blocked**: No
**What**: Side-by-side comparison of two datasets (e.g., mutant vs wild-type) with shared axes and overlay distributions.
**Files**: `pages/Compare.tsx`, `AppSidebar.tsx`, `App.tsx`
**Details**: Upload comparison CSV via same API pipeline. Side-by-side KPI delta table, overlay histograms (hydrophobicity, length), scatter plot overlay (H vs μH). Accessible via sidebar "Compare" link.

### B3. Plotly.js Scientific Charts
**Status**: NOT STARTED | **Effort**: 12h | **Blocked**: No
**What**: Add Plotly.js for advanced scientific visualizations: per-residue aggregation heatmaps, 3D scatter (H × μH × FF-Helix%, colored by SSW), publication-quality interactive plots.
**Files**: New chart components in `components/charts/`
**Package**: `react-plotly.js` + `plotly.js-basic-dist` (~200KB gzipped)
**Note**: Use alongside Recharts (not replacing), specifically for visualizations Recharts can't do.

### B4. AlphaFold DB Integration
**Status**: DONE (2026-02-13) | **Effort**: 16h | **Blocked**: No
**What**: Fetch predicted structures from AlphaFold DB API, embed Mol* viewer for 3D context.
**Files**: `lib/alphafold.ts`, `components/AlphaFoldViewer.tsx`, `pages/PeptideDetail.tsx`
**API**: `https://alphafold.ebi.ac.uk/api/prediction/{uniprot_id}` (free, no auth)
**Details**: Auto-fetches structure metadata for valid UniProt accessions. Shows pLDDT confidence metrics + distribution bars. Lazy-loads EBI Mol* 3D viewer via iframe (zero npm deps). PDB download link included.

### B5. Server.py Refactor
**Status**: NOT STARTED | **Effort**: 16h | **Blocked**: No
**What**: Extract the 1,500-line monolith into focused service modules.
**Target**:
```
server.py (100 LOC) — Only imports and mounts routers
api/routes/*.py — Thin HTTP handlers
services/upload_pipeline.py — CSV → calculations → normalization
services/predict_pipeline.py — Single sequence pipeline
services/uniprot_pipeline.py — UniProt query execution
```
**Risk**: High — touches core orchestration. Needs comprehensive test coverage first.

### B6. DuckDB Result Cache
**Status**: NOT STARTED | **Effort**: 12h | **Blocked**: No
**What**: Persist prediction results to disk using DuckDB. Serve cached responses for repeated queries.
**Files**: New `backend/cache.py`, modify `server.py`
**Why**: Currently results are lost when the backend restarts. DuckDB is serverless (single file), fast for analytics, and zero-config.

### B7. Progressive Disclosure UI
**Status**: DONE (2026-02-13) | **Effort**: 8h | **Blocked**: No
**What**: Add "Simple/Advanced" mode toggle. Simple shows top-level metrics only. Advanced shows full table, threshold sliders, per-residue curves.
**Files**: `Results.tsx`, new `stores/uiPreferences.ts`

### B8. Ranked Shortlist PDF Report
**Status**: DONE (2026-02-13) | **Effort**: 8h | **Blocked**: No
**What**: Generate a formatted PDF report from the weighted shortlist, including per-peptide summaries, charts, and methodology notes.
**Files**: `lib/report.ts` (enhanced with `exportShortlistPDF`)
**Details**: Data-driven PDF with header, summary stats, top-N table, methodology notes. Legacy screenshot export kept as fallback. html2canvas code-split via dynamic import.

---

## Phase C: Platform Scale (1–2 years)

### C1. Proteome Precomputation
**Effort**: 40h | **Blocked**: Needs K8s
**What**: Precompute predictions for top 10 organisms (~10% of UniProt) via K8s CronJobs → Parquet → DuckDB. Enables millisecond queries for common proteins.

### C2. Kubernetes Deployment
**Effort**: 24h | **Blocked**: Needs DESY K8s access
**What**: Helm chart with backend, Celery workers, Redis, Caddy ingress. Horizontal scaling.

### C3. ESMFold/AlphaFold On-Demand Prediction
**Effort**: 24h | **Blocked**: Needs GPU access
**What**: On-demand structure prediction for novel sequences not in AlphaFold DB.

### C4. Plugin Architecture
**Effort**: 16h | **Blocked**: No
**What**: Allow external prediction tools to register as providers via a standardized interface.

### C5. Mol* 3D Viewer (Full Integration)
**Effort**: 20h | **Blocked**: No
**What**: Full molecular visualization with MolViewSpec annotations, custom coloring by PVL predictions.

---

## Blocked Items (Waiting for DESY Team)

| Item | Waiting For | Contact | Notes |
|------|-------------|---------|-------|
| TANGO Linux binary | Peleg | License + binary | macOS binary works locally, need Linux for VM |
| Domain name | DESY IT | DNS assignment | Caddy config ready, just needs `DOMAIN=x.desy.de` |
| VM SSH access | DESY IT | Access approval | DEPLOYMENT_SPEC.md ready (4-core/8GB Phase 1) |
| GitLab migration | DESY IT | Repo creation | Mirror strategy documented |
| K8s namespace | DESY IT | Cluster access | Phase C only, not urgent |
| Peleg's FF-Helix changes | Peleg | Threshold values | May change FF-Helix scoring parameters |

---

## Technical Debt (Fix When Touching These Files)

| ID | Issue | Priority | When to Fix |
|----|-------|----------|-------------|
| TD-01 | JPred column names in dataframe_utils.py, biochem.py | LOW | During B5 refactor |
| TD-02 | server.py ~1500 lines | MEDIUM | B5 (dedicated task) |
| TD-03 | normalize.py duplicate fallback logic ~700 lines | MEDIUM | B5 (dedicated task) |
| TD-04 | Mixed import patterns (local vs top-level) | LOW | B5 (dedicated task) |
| TD-05 | ~~canonical.py orphaned~~ | ~~LOW~~ | DONE — deleted (confirmed zero imports) |
| TD-06 | ~~ColumnMapper component unused~~ | ~~LOW~~ | DONE — deleted (confirmed unused) |
| TD-07 | Global mutable state (provider_tracking) not thread-safe | MEDIUM | B1 (Celery migration) |

---

## Recently Completed (2026-02-13)

- [x] S4PRED SequenceTrack component (colored residues + hover probabilities)
- [x] Navigation sidebar (collapsible, mobile-responsive)
- [x] Classification Summary replacing broken threshold tuner
- [x] FF-Helix documentation on Help page + Scientific Notes section
- [x] FASTA export (single + bulk)
- [x] Remove debug endpoints (/api/debug/config, /api/test-sentry)
- [x] TANGO subprocess timeout (3600s → 300s)
- [x] CITATION.cff
- [x] Tooltip decimal precision fix
- [x] Helical wheel diagram (SVG, HeliQuest colors, μH arrow)
- [x] CSS --beta and --coil variables (fixed invisible P(Beta) line)
- [x] UniProt cross-links (clickable IDs, gated to valid accessions)
- [x] Publication-ready SVG/PNG export (helical wheel + all charts)
- [x] Example datasets (3 curated sets with "Try example data" button)
- [x] About page updated (new features, fixed broken Sentry test button)
- [x] ROADMAP.md updated (strategic analysis, completed work history)
- [x] SSW labeling: all SSW references labeled TANGO/S4PRED source
- [x] EvidencePanel: dual predictor display with disagreement warning
- [x] S4PRED Helix % in PositionBars, RadarChart, EvidencePanel
- [x] meanMuH + meanS4predHelixPercent in DatasetStats
- [x] SSW pie chart: "Uncertain" label for sswPrediction=0 (not "Not available")
- [x] CSV exports include S4PRED Helix, S4PRED SSW, FF flags
- [x] Production debug cleanup (20+ console.log/DEBUG_TRACE removed)
- [x] Table header tooltips (7 scientific columns with researcher-friendly explanations)
- [x] S4PRED Helix KPI card (5th card, "context-dependent" subtitle)
- [x] FF-Helix vs S4PRED interpretation alert (amber box when discrepancy detected)
- [x] S4PRED dominant structure summary (avg composition: Coil/Beta/Helix)
- [x] Table column visibility toggle (dropdown with per-column checkboxes)
- [x] Table overflow-x-auto (horizontal scroll fallback for narrow screens)
- [x] Default hidden columns: Species, S4PRED SSW (less critical for first glance)
- [x] SSW predictor agreement stats (TANGO vs S4PRED agreement % under pie chart)
- [x] **CRITICAL**: Fixed S4PRED availability check case sensitivity bug (always returned 0)
- [x] Fixed hydrophobicity KeyError crash on non-standard amino acids (X, O, J)
- [x] Fixed hydrophobic moment TypeError (None * float) on unknown residues
- [x] Added O→K (pyrrolysine) and J→L (Leu/Ile) to get_corrected_sequence()
- [x] TANGO Linux hardening: platform-gated macOS xattr, microsecond run dirs, UTF-8 I/O
- [x] 21 new tests for non-standard amino acid handling (235 total passing)
- [x] Progressive disclosure: 3-tab layout (Data Table default | Ranking | Charts)
- [x] Result persistence: full peptide data survives page refresh (Zustand persist to localStorage)
- [x] TANGO per-residue curves in API (tangoAggCurve, tangoBetaCurve, tangoHelixCurve)
- [x] Aggregation heatmap (AggregationHeatmap.tsx): per-residue bar chart with peak/hotspot stats
- [x] S4PRED pre-sanitization: non-standard AAs (X, O, J) corrected via get_corrected_sequence()
- [x] **Deep Audit Hardening**: segment slicing off-by-one, muH NaN guard, normalize.py PARTIAL fix, localStorage quota, radar chart NaN fix
- [x] B8: Ranked shortlist PDF report (data-driven jsPDF: summary + top-N table + methodology)
- [x] B2: Cohort comparison dashboard (overlay histograms, H vs μH scatter, KPI delta table)
- [x] B4: AlphaFold DB integration (pLDDT metrics, Mol* 3D viewer via iframe, PDB download)

---

*Phase A complete (A4/A5 need live URL). Phase B: 4/8 done, B1/B6 blocked on deployment. Continue with B3 or B5 next.*
