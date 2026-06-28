# Cowork V10-10 — Export / HTML download surfaces redesign

**Status**: Queued (parked-list item, was task #55 in the original wave roadmap).
**Trigger**: ready-to-dispatch the moment Cowork has capacity.
**Discipline**: PRE-FLIGHT v2 mandatory — read `figurePack.ts`, `figurePackPanels/*`, `ExportFigurePackButton.tsx`, `peptideReport.ts`, `CsvExportDialog.tsx` first. Refactor in place.

---

## Why this matters

Today PVL has four export surfaces, each with its own visual identity:

| Surface | Trigger | Output | Issue |
|---|---|---|---|
| **PDF report** (single peptide) | "PDF Report" button on PeptideDetail | A4 PDF with cover + biochem + interpretation | Cover page is plain; interpretation copy was updated to Peleg's terminology (PR #91) but visual still looks 2020 |
| **CSV export** | Results page → Export | CSV file with API column names | Works fine; could use a metadata header block |
| **Figure pack HTML** (single peptide OR dataset) | "Figure pack" button | Standalone HTML bundle (cover + panels) | Cover panel is rough; panel headers inconsistent typography; methods text bottom-aligned awkwardly |
| **FASTA export** | Results page → Export FASTA | Multi-line FASTA | Headers include species/name but no clear formatting standard |

A reviewer who downloads a figure pack, a PDF, and a CSV today sees three different visual identities. We need ONE export design language.

---

## Three deliverables

### 1. Unified export design language

Create one shared style spec (CSS variables + SVG colour palette + font stack) that every export surface uses:

- **Typography**: Inter Variable (already in app) for body, JetBrains Mono for sequences and code
- **Header style**: PVL wordmark + "v0.3.0" version pill + ISO date + permalink QR code top-right
- **Footer style**: Citation block (BibTeX one-liner) + Zenodo DOI link + bio.tools link
- **Class colour palette**: Helix purple · FF-Helix green · SSW blue · FF-SSW red — must match the in-app `--helix` / `--ff-helix` / `--ssw` / `--ff-ssw` CSS tokens
- **Light mode only** for exports — reviewers print these; dark export panels print as black rectangles

Define this in `ui/src/lib/exportTheme.ts` as a single export const. All four export surfaces import from there.

### 2. Cover-page redesign (figure pack + PDF report)

Current cover pages are different on the two surfaces — figure pack uses a heavy banner; PDF uses just title text. Unify:

- **Title block**: "Peptide Visual Lab" wordmark (matches landing-page hero font scale) over the analysis date
- **Subject block**: peptide ID + sequence (mono, wrapped at 60 chars) for single-peptide, OR "X peptides analyzed" for batch
- **Citation block**: BibTeX-format citation hooks already in `lib/figurePackPanels/methodsText.ts`. Surface them prominently — a researcher copying this page into a paper supplement gets the cite they need.
- **Reproducibility block**: small panel with PVL version, build SHA, timestamp, permalink URL, ALL clickable / scannable
- **QR code** to the permalink (use existing `qrcode` lib or add lightweight `qrcode.react` — flag T1 if adding dep)

### 3. Per-panel header consistency

The figure pack has ~5 panels (cover + classification + biochem + aggregation + methods). Each panel currently has its own header style. Standardize:

- Single `<PanelHeader>` SVG fragment with: panel number, panel title, peptide ID (or "Dataset"), and a small underline accent in the class colour token
- Panel sizes: standardize to A4 portrait (210 × 297mm) at 96 DPI = 793 × 1122 px, so the full pack prints cleanly as a multi-page PDF
- Each panel ends with the same footer: "PVL v0.3.0 · github.com/saidaz24-meet/peptide_prediction · CC-BY 4.0"

---

## Acceptance test (Said browser eyes)

When this dispatch lands:
- Generate a figure pack on `/peptides/P01501` — cover page feels like a research-paper figure, not a dashboard screenshot
- Download a PDF report — first page looks identical in style to the figure pack cover
- Open the PDF + the figure pack HTML side by side — both use the same colours, same typography, same citation block format
- The permalink QR code on the cover renders + scans cleanly
- All four export surfaces (PDF, figure pack, CSV header, FASTA header) all reference "v0.3.0" + correct build SHA
- Print the figure pack → multi-page PDF prints cleanly at A4 portrait

---

## Discipline

- PRE-FLIGHT v2: read every file mentioned above before touching anything.
- DO NOT change the export DATA (column names, classification logic, threshold values) — only the visual + metadata layer.
- ALL exports use `PVL_VERSION` and `BUILD_SHA` from `ui/src/stores/reproducibilityStore.ts` — never hardcode version strings. (PR #91 cleaned up the "0.1.0" survivors; don't re-introduce them.)
- One reusable `exportTheme.ts` per the spec above. Don't sprinkle colour tokens across each panel.
- Light + dark mode parity: PVL UI has dark mode; the exports themselves are light-only by design (research convention).
- No emojis in production copy / exports.
- No new npm deps without flagging T1 (`qrcode.react` is the one likely candidate; pre-approve if you ask).

---

## What this UNBLOCKS

- A figure pack a reviewer can drop into a Nature supplement without reformatting
- A PDF report that signals "scientific instrument" not "auto-generated dashboard PDF"
- A unified export visual identity across all four surfaces so future export types (Mol* viewer state, AlphaFold-overlay PNG) can slot into the same theme
