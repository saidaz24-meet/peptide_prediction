# Export & Report Redesign — Brief for the Next Developer

> **Audience**: The dev who picks up the export surfaces (shortlist PDF, per-peptide report, figure pack) and lifts them from "minimal-viable" to "researcher-grade publication asset."
>
> **Status**: All three exports work and ship today. They are correct, deterministic, and citable. They are not yet beautiful. This brief tells you what to upgrade, in what order, and how to know you're done.

---

## 1. What ships today

| Export | Trigger | File | Format | What's good | What's not |
|---|---|---|---|---|---|
| **Shortlist PDF** | `/results` → ⋯ menu → "Export shortlist PDF" | `ui/src/lib/report.ts` | jsPDF landscape A4 | Deterministic, single-file, includes Smart Ranking weights | Rows = top-N from the rank slider (default 10, max ~50). No charts. No SSW colour key. No methods footnote. |
| **Per-peptide HTML report** | `PeptideViewer` / `PeptideDetail` → "Report (.html)" | `ui/src/lib/peptideHtmlReport.ts` | Self-contained HTML | Opens cold in any browser, sequence colours intact, downloadable | No print stylesheet — prints chunky. No comparison context (cohort vs population). No figure exports. |
| **Per-peptide PDF report** | `PeptideViewer` / `PeptideDetail` → "Report (.pdf)" | `ui/src/lib/peptideReport.ts` (panel system) | jsPDF multi-page | Panel architecture (cover, classification, biochem, agg curves) — extensible cleanly | Mol3D not embedded. Charts re-rendered with jsPDF primitives instead of vector-exported. |
| **Figure pack** | `ExportFigurePackButton` → "Export figure pack" | `ui/src/lib/figurePack.ts` | ZIP of SVG + HTML | Publication-grade SVG, bundled cover + methods page | No PNG companions for journals that reject SVG. No DPI option. |
| **CSV / TSV / XLSX** | `/results` → ⋯ menu → "Export CSV/TSV/XLSX" | `ui/src/lib/csvExport.ts` + backend `services/export.py` | Tabular | 4-line provenance header (B15/E4) | None — these are fine as-is. |

## 2. What "publication-grade" means for an export surface

Researchers reuse PVL exports as supplementary material in papers, slides in conference talks, and figures in grant proposals. The bar is:

1. **Self-contained**: opens without network, in any modern browser/PDF reader. No CDN fonts, no external `<img src>`, no JS hydration.
2. **Citable**: includes the version + dataset + threshold + commit SHA + Zenodo DOI footer on every page. Today only the CSV/TSV/XLSX prelude has this — extend to PDF + HTML.
3. **Print-clean**: A4 + Letter render the same. Page breaks land between sections, not mid-figure. Headers/footers are stable.
4. **Colour-blind safe**: do not rely on hue alone. The SSW magenta + FF-Helix blue pair already passes Deuteranopia; verify the full pack.
5. **Branded**: a clean PVL header + version + "Generated YYYY-MM-DD" in the same place on every page. Not glamorous, just **consistent**.

## 3. The priority order (do them in this order)

### Tier 1 — Shortlist PDF (highest-visibility, lowest-effort)

This is the export Said gets pinged about in conversations. Fix this first.

- [ ] **Make the row count obvious + adjustable from the export click**. Today it silently uses the rank slider's `topN`. Add a "Rows to include" dropdown in the export dialog (10 / 25 / 50 / all). Show the count in the filename (`pvl_shortlist_50_2026-06-29.pdf`).
- [ ] **Add a methods footer to page 1** — the same 4-line provenance prelude the CSV/TSV/XLSX exports get (Method = PVL <version>, Thresholds = ..., Exported at = ...).
- [ ] **Add a one-page "How to read this" appendix** — a thumbnail-sized 4-class legend (Helix · FF-Helix · SSW · FF-SSW), a one-sentence definition each, the SSW magenta swatch, and a TANGO peak ≥ 5% line. This is what a reviewer or collaborator needs to interpret the table.
- [ ] **Add the Smart Ranking equation block** at the bottom of page 1 — "Composite = Σ wᵢ · zᵢ where wᵢ ∈ ..." with the user's current weights. Today the weights are stored but not surfaced in the PDF.
- [ ] **Render a small bar chart for each top peptide's composite score breakdown** instead of just the number. A 200×40 px sparkline per row, three slices (µH / hydrophobicity / SSW score). Researchers see at a glance which signal drove a rank.
- [ ] **Sequence colouring in the row** — same Helix/SSW/Coiled-coil residue colours as the sequence track, but rendered as monospace tspan colours so the PDF is still text-searchable.

### Tier 2 — Per-peptide PDF report (biggest user surface)

This is what gets emailed to collaborators. It needs to look like a publication figure.

- [ ] **Embed the Mol3D snapshot** on page 1, top right. Today the PDF skips Mol* entirely. Capture the iframe as a PNG via `html2canvas` and embed at 300 DPI.
- [ ] **Cover page redesign** — peptide ID, sequence in monospace with residue colouring, the 4-class badge row, KPI tile row (length, charge, hydrophobicity, µH), and the same provenance footer.
- [ ] **Per-residue probability chart** — currently the S4PRED P(H)/P(E)/P(C) curves are drawn with jsPDF line primitives. Replace with a real chart via `chartjs-to-image` (server-render the same recharts spec) or `dom-to-svg` (extract the live chart's SVG and embed).
- [ ] **Aggregation heatmap** — same upgrade. Today rendered as filled rectangles with jsPDF; replace with SVG inclusion so colours and axes are vector and look like the in-app version.
- [ ] **Smart Ranking context block** — show the peptide's rank position vs cohort (e.g. "Rank 7 of 118 by composite, percentile 94" with a faded mini-histogram).
- [ ] **Print + screen stylesheet** — generate two layouts: one for A4 print, one for screen viewing. jsPDF supports both via `@media print` if you embed the HTML preview, or split into two presets.

### Tier 3 — Per-peptide HTML report (Cowork's Q15 ship)

- [ ] **Print stylesheet** — `@media print` block that hides interactive elements (the SSW toggle, the Mol* iframe → replace with a captured SVG/PNG), enforces page breaks before each major section, and adds a print-only header/footer with the provenance line.
- [ ] **Comparison context** — embed a small radar chart comparing this peptide's biochem vector (µH, charge, hydrophobicity, length) against the dataset median + Peleg-118 median. Reuse the radar code from `BiochemComparison.tsx`.
- [ ] **Inline citations + DOI** — at the top right of page 1, render the Zenodo concept DOI as a clickable + visible badge, the PVL version, the commit SHA short hash, the threshold preset, and the export timestamp.
- [ ] **Embeddable variant** — strip the chrome to a single `<section>` that researchers can paste into supplementary HTML for papers. Surface via `?embed=1` query param on the report URL.

### Tier 4 — Figure pack (publication assets)

- [ ] **PNG companions** for every SVG figure at 300 DPI and 600 DPI. Some journals reject SVG; provide PNG so the author doesn't have to convert.
- [ ] **TIFF for the agg heatmap** — a few high-impact journals require TIFF for raster art. `canvas-to-tiff` works in-browser.
- [ ] **Methods page rewrite** — currently a plain-text list. Make it a one-page summary with the algorithm citation key + the threshold values + the commit SHA. Reviewers paste this into the supplementary methods.
- [ ] **Per-figure caption proposals** — each figure gets a `caption.md` next to it in the ZIP. Pre-written captions the author can edit (e.g. "Figure S1. Per-residue aggregation propensity for peptide X — TANGO output, threshold 5%, computed with PVL v1.0.0 (DOI XXXXX)." ). Saves authors 20 minutes.

---

## 4. Architectural pointers

### Where to add changes

- **Shortlist PDF**: `ui/src/lib/report.ts` — single function `exportShortlistPDF`. Add a wrapper that takes an options object instead of positional args; gradually deprecate the positional signature.
- **Per-peptide PDF**: `ui/src/lib/peptideReport.ts` — already a panel architecture (see `Panel` interface line 64). Add new panels in this format:
  ```typescript
  const Mol3DSnapshotPanel: Panel = {
    id: "mol3d-snapshot",
    title: "3D Structure",
    render: (doc, peptide, data, ctx) => { /* ... */ },
  };
  ```
  Register in the `PANELS` array. The driver loops panels and emits pages.
- **HTML report**: `ui/src/lib/peptideHtmlReport.ts` — single self-contained generator. The print CSS additions go inline in the `<style>` block at the top of the generated HTML.
- **Figure pack**: `ui/src/lib/figurePack.ts` + `ui/src/lib/figurePackPanels/*` — bundled into a ZIP via `JSZip`. New file formats slot in as new panel exports.

### Shared utilities

- **Provenance footer**: `ui/src/lib/exportProvenance.ts` — single source of truth for the 4-line `# Method = …` block used by CSV/TSV/XLSX. Extract a generic `getProvenanceLines(): string[]` and call from PDF/HTML too.
- **Colour tokens**: `ui/src/lib/sswColor.ts` (SSW magenta) + `ui/tailwind.config.ts` (helix blue, ff-helix green). Import here — never hardcode hex in export code.
- **Composite score breakdown**: the math lives in `ui/src/stores/rankingStore.ts`. Reuse the `computeRanking` function — do not re-derive the formula in the export module.

### Test layer

For each export change, add to `ui/src/lib/__tests__/`:
- A unit test that the generator returns a non-empty blob.
- A snapshot test on the PDF page count + the first 200 bytes of the data URL.
- For HTML: a `@testing-library` render that asserts the provenance line appears, the title is correct, and `/print/i` styles exist when `?print=1`.

CI runs these via `npx vitest run` — they catch regressions cheaply.

---

## 5. Done definition (per tier)

You are done with Tier N when:

1. A researcher in the lab can email a peer the export and the peer can read it without a PVL session open, on a phone, on print, and on a presentation slide — and **the data interpretation is unambiguous**.
2. A reviewer (paper / grant) can paste it as supplementary material without rewriting.
3. The provenance line at the bottom of every page lets a future reader reproduce the analysis exactly (version + thresholds + dataset).
4. New vitest cases pass. Existing 672 frontend tests still pass.
5. A PR title like `feat(export): tier-2 per-peptide PDF redesign` includes screenshots of the before/after PDF.

---

## 6. What you should NOT do

- **Don't add server-side rendering.** Today every export is pure-frontend (jsPDF, JSZip, html2canvas). That's a feature — the user's data never leaves the browser. Keep it that way.
- **Don't introduce a heavy dependency** (LaTeX, headless Chrome, server PDF service). The current bundle is < 1 MB gzipped. We're not big enough to take that hit.
- **Don't refactor the panel architecture** in `peptideReport.ts` even though it could be more elegant — it's understood by everyone who's edited PVL. Add new panels; don't restructure the existing ones.
- **Don't break determinism.** Same peptide + same version + same thresholds must produce the same bytes for any export. This is part of the citable-permalink guarantee. Any time-based or random style must be seeded by the run's `runId`.

---

## 7. Where to start

Open `ui/src/lib/report.ts`, scroll to line 192 (`.slice(0, Math.max(1, topN))`), and trace the function backward. That single line is what makes today's PDF look like "top 10 with no chart." Fixing it is your hello-world.

Once you have the row-count dropdown shipped (Tier 1 first checkbox), you've already moved the needle for every PVL user who exports a shortlist. The rest is upgrade tiers on top of that win.
