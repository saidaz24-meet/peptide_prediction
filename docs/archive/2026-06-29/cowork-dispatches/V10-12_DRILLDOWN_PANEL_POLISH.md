# Cowork V10-12 — DrillDown slide-over panel polish

**Status**: Queued (parked-list item from V10-2 / Said's 2026-05-12 audit notes).
**Trigger**: ready-to-dispatch the moment Cowork has capacity.
**Discipline**: PRE-FLIGHT v2 mandatory — read `ui/src/components/drilldown/DrillDown.tsx` + the four inspector children (`SimilarPeptidesInspector.tsx`, `MetricInspector.tsx`, `PeptideInspector.tsx`, `ChartInspector.tsx`). Refactor in place.

---

## Why this matters

Said's 2026-05-12 browser audit flagged the DrillDown slide-over (the universal panel that opens for "Find similar peptides", "Inspect metric", "Inspect chart", "Inspect peptide"): *"panel works but feels dead. Empty-state copy is plain. Header has a single icon (Share) + the close X. Footer is two muted disabled buttons (SVG, CSV)."*

This is the panel users see most often after they click into anything from Results — it's the primary drill-down experience. Polish here cascades to every inspector flow.

---

## Five deliverables (smaller, scoped)

### 1. Better empty state on SimilarPeptidesInspector

**Current**: magnifying-glass icon + "No similar peptides found" + "This usually means the current peptide isn't in the vector index. The pre-loaded demo dataset is served via a fast-path JSON that skips the backend embedding step."

**Asks**:
- Keep the explanation copy (it's good — explains why the demo set doesn't populate similar)
- Add an actionable CTA: a styled "Run `make reindex-lance`" code block + a "Try with your own CSV upload" button that navigates to `/upload`
- Update the magnifying-glass illustration to something less generic — a faint 3-vector cluster suggesting "embeddings" would be on-brand

### 2. Header polish — title typography + inspector mode badge

**Current**: each inspector has a plain `<h3>` title and a single icon (Share) in the top-right.

**Asks**:
- Inspector mode badge: small pill in the top-left of the panel header showing the inspector mode in lowercase mono: `similar` · `metric` · `chart` · `peptide`. Tinted in the class colour pattern (similar = neutral, metric = primary, chart = secondary, peptide = ssw).
- Title block: bigger title in `text-base font-semibold`, with a subtle 1px gradient underline using the inspector-mode tint colour
- Subtitle row: "Reference: P01501" or "Metric: hydrophobicity" depending on mode — quiet, mono, muted-foreground

### 3. Stagger-in content animation

**Current**: Sheet slides in from the right; inner content appears all at once.

**Asks**:
- Use `framer-motion` `staggerChildren: 0.04` on the panel content container
- Header → results / body → footer fade in with 4-frame delay between each
- Total stagger budget: ~120ms — should feel snappy, not slow
- Respects `prefers-reduced-motion: reduce` — falls back to instant

### 4. Loading skeleton that matches result row shape

**Current**: generic spinner + plain "Searching for similar peptides…"

**Asks**:
- Replace with 5 skeleton rows where each row matches the actual result row shape: distance bar placeholder · accession placeholder · sequence placeholder · classification pill placeholder
- Skeleton uses `animate-pulse` Tailwind utility (already used elsewhere in app)
- Subtle: opacity 40%, not bright

### 5. Footer SVG + CSV buttons — wire OR delete

**Current**: two disabled muted buttons that look unfinished

**Asks**:
- For SimilarPeptidesInspector ONLY: wire the SVG export to download a single-panel SVG of the similarity cluster (use existing figurePack util `lib/figurePack/exportSimilarityCluster.ts` if it doesn't exist, create the stub); wire CSV to download `id, distance, sequence, helix, ffHelix, ssw, ffSsw` for the result set
- For OTHER inspectors: if the buttons would be misleading or empty, REMOVE them. Don't keep disabled placeholders that look broken.
- If wiring is non-trivial (Mol* viewer state export, etc.), put a clear "coming in v0.4" label INSIDE the disabled state so the user knows it's planned not broken

---

## Acceptance test (Said browser eyes)

- Click "Find similar peptides" on any peptide → panel slides in with stagger animation
- See the inspector-mode badge (`similar`) in the top-left of the header
- See the title with the new subtitle row "Reference: P01501"
- If no results: empty state has a code-block + actionable button, not just gray text
- If results: skeleton rows appear while loading, then real rows fade in row-by-row
- Hover a result row: clear visual response (border accent + subtle background)
- Footer buttons either work OR are removed OR have clear "coming in v0.4" labels — never disabled with no explanation
- Mobile at 375px: panel takes full screen width, all interactions still work

---

## Discipline

- PRE-FLIGHT v2: read all four inspector files first.
- DO NOT touch the data flow (`DrillDownProvider`, `useDrillDown` store). Visual layer only.
- DO NOT regress the double-X close button fix already in `0145c3a` (don't add a second close button).
- Keep `data-testid` attributes intact — there are existing test assertions in `ui/src/components/drilldown/__tests__/`.
- Stagger animation respects `prefers-reduced-motion: reduce`.
- Light + dark mode parity.
- No emojis.
- No new npm deps without flagging T1.

---

## What this UNBLOCKS

- A drill-down experience that signals "polished tool" instead of "WIP modal"
- Reusable inspector-mode badge + stagger animation pattern Cowork can apply to other slide-over UIs (filters panel, export dialog, settings panel)
- Footer wire-up that actually delivers the SVG / CSV exports researchers expect on a "Find similar" result set
