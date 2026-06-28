# Cowork V10-9 — KPI card logo redesign (4-card symmetric row)

**Status**: Queued (Said's explicit ask 2026-06-08 after the KPI symmetry batch shipped).
**Trigger**: ready-to-dispatch the moment Cowork has capacity.
**Discipline**: PRE-FLIGHT v2 mandatory — read `ResultsKpis.tsx` first; refactor logos in place; do NOT touch the numeric values, the click handlers, or the symmetric-row layout that just shipped from Peleg's Zoom feedback.

---

## Why this matters

Said's 2026-06-08 feedback: *"the helix is good now after refreshing... whats next... also add it as a task as part of cowork for the future to redesign the logos for those 4 cards because now it doesnt look the best."*

The 4 KPI cards now read **% Helix · % FF-Helix · % SSW · % FF-SSW** in symmetric order (per Peleg's Drive comment 22 / Q5). Numbers + click-to-filter behaviour are correct; only the **visual identity** of each card needs a polish pass.

Today the cards use small generic icons in the top-right corner (helix waveform, generic check, etc.) that don't read as a coherent set. A research-grade tool should have a small but instantly recognisable visual identity per class.

---

## The four classes (recap so designer doesn't have to look it up)

| Class | Scientific meaning | Current colour token |
|---|---|---|
| **Helix** | Peptide has at least one detected α-helix segment from Peleg's gap-smoothed segment finder (Ragonis-Bachar 2022 algorithm, S4PRED-driven) | `--helix` (purple) |
| **FF-Helix** | Helix-class peptide whose hydrophobic moment μH exceeds the dataset-derived μH-positive mean. Subset of Helix. Peleg's fibril-formation gate | `--ff-helix` (green) |
| **SSW** | Secondary-Structure-Switch: peptide where |helix score − β-strand score| ≤ max-gap threshold. Indecisive between helix and β-sheet — the conformational chameleon class | `--ssw` (blue) |
| **FF-SSW** | SSW-class peptide whose mean hydrophobicity exceeds the dataset-derived hydrophobicity-positive mean. Subset of SSW. Peleg's fibril-formation gate for switchers | `--ff-ssw` (red/orange) |

The Helix → FF-Helix and SSW → FF-SSW relationships are **strict subsets** by Peleg's axiom. The logo set should hint at this nesting (e.g. FF-Helix logo could be a Helix logo with an aggregation-arrow accent).

---

## Three deliverables

### 1. Four custom SVG class glyphs

**Replaces**: the current generic Lucide icons in the top-right of each card.

**Asks**:
- **Helix glyph**: a stylised α-helix spiral (NOT a sine wave — should read as a 3-turn helix viewed from the side, with subtle 3D depth)
- **FF-Helix glyph**: the Helix glyph + a small aggregation arrow / dot cluster radiating outward (visual hint that "this helix folds AND aggregates"). Same colour family as Helix but with an FF-Helix-token accent.
- **SSW glyph**: TWO overlapping shapes — one helical, one β-strand zigzag — fading into each other. Conveys "neither one nor the other; switch". Subtle ↔ motif between them.
- **FF-SSW glyph**: the SSW glyph + the same aggregation arrow / dot cluster as FF-Helix. Visual parity is important — researchers should see "FF-X" and immediately know it's a fibril-forming subset.

**Implementation**:
- Each glyph as a single SVG component in `ui/src/components/icons/`: `IconHelix.tsx`, `IconFFHelix.tsx`, `IconSSW.tsx`, `IconFFSSW.tsx`
- Each accepts a `size` prop (default 24) and a `className` so the consumer can override colour via Tailwind's `text-*` utilities
- Glyphs inherit `currentColor` from the parent text colour — KPI cards already wrap them in the class-colour text token
- No external image files — everything inline SVG so they ship with the bundle and Lighthouse stays clean

### 2. Card layout micro-polish

**Current state**: each card has top-right icon + big number + class label underneath + descriptive sub-text.

**Asks**:
- **Logo placement**: keep top-right, but enlarge from 16px → 28px. A small icon today gets lost on dense displays.
- **Logo backdrop**: subtle 40px circular tinted backdrop behind each logo using the class colour at ~10% opacity. Helps the four cards read as a coherent set even when scanned peripherally.
- **Number typography**: keep current scale; the layout itself doesn't need to change.
- **Active state**: when a card is clicked (filtered), give it a 2px ring in the class colour + 5% backdrop wash. Same pattern across all 4 cards.
- **Hover state**: subtle border accent in the class colour. Don't change the cursor — already a pointer.

### 3. Storybook entries + screenshot test

**Asks**:
- One Storybook entry per icon component, plus one for the whole `ResultsKpis` row
- One Chromatic / playwright snapshot test of the 4-card row at 1280px wide (default desktop) and at 375px (mobile) so future visual regressions are caught
- The snapshot test lives under `ui/src/components/__tests__/ResultsKpis.visual.test.tsx`

---

## Acceptance test (Said browser eyes)

When this dispatch lands:
- `/results` 4 KPI cards each show their custom class glyph in the top-right
- Helix and FF-Helix glyphs are visually related (FF-Helix = Helix + aggregation accent)
- SSW and FF-SSW glyphs are visually related (same family pattern)
- All 4 cards feel like a coherent set, not 4 random icons
- Click-to-filter still works, but now also shows a class-coloured ring as the active state
- Mobile at 375px: glyphs scale down clean; cards stack vertically without overlap
- Light + dark mode parity: glyphs inherit `currentColor` correctly
- Lighthouse Performance ≥ 80 (no regression — inline SVG is faster than img tags)

---

## Discipline

- PRE-FLIGHT v2: read `ResultsKpis.tsx`, `lib/chartConfig.ts` (for the class colour tokens), the existing 4 vitest specs on `ResultsKpis.test.tsx`. Refactor in place.
- DO NOT touch the symmetric 4-class card order, the click handlers, the data flow from `useDatasetStore`, or the "Total Peptides as sub-header" pattern that just shipped from Peleg's Zoom feedback.
- All 4 icon components live in `ui/src/components/icons/` — new convention; only reused by KPI cards initially but the directory exists for future class glyphs.
- No new npm deps. Inline SVG only.
- Light + dark mode both render.
- No emojis in production copy.

---

## What this UNBLOCKS

- The "this is a serious research tool" first impression on `/results` — today's icons look like generic dashboard chrome.
- A visual identity per class that flows through to PeptideDetail page badges, PDF report cover, and the Help page section headers.
- Composability: the same glyph set can be used as small inline indicators in the PeptideTable column headers later.

---

## What this DOES NOT do

- Does not redesign the cards' numeric typography (already correct)
- Does not change the symmetric Helix → FF-Helix → SSW → FF-SSW order (Peleg's axiom)
- Does not touch the Total-Peptides sub-header line
- Does not touch the click-to-filter behaviour
- Does not touch the data flow or any store
