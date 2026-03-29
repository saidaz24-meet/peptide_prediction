# Cowork Prompt: PVL UI Redesign — Threshold Panel + Table Column Reorg

## Project Context

PVL (Peptide Visual Lab) is a React + TypeScript + Tailwind + shadcn/ui scientific research tool for peptide analysis. It predicts aggregation propensity, structural switching, and fibril-forming helix content.

**Stack**: React 18, TypeScript 5, Vite, Tailwind CSS, shadcn/ui components, Recharts, Zustand stores, lucide-react icons.

**Design identity**: Professional scientific research instrument. Clean, minimal, modern. NOT a consumer app. Publication-ready visualizations. Colorblind-safe palettes.

**Current state**: The threshold configuration panel is a flat grid of inputs with no grouping, misleading labels ("Dangerous Max"), and no explanations. The data table has redundant tool labels (TANGO/S4PRED) that researchers don't need.

---

## Task 1: Redesign Threshold Configuration Panel

### Current problems:
- Flat grid of 6 inputs with no logical grouping
- "Dangerous Max (%)" label is misleading and scary — DELETED
- No explanations of what each threshold does or how it affects results
- No section headers
- No info icons

### Requirements:

Design a threshold panel with THREE sections, each with a title:

**Section 1: "SSW Thresholds"**
- Min SSW Residues (integer, default 3) — "Minimum residues in structural switching window"
- SSW Max Difference — "Maximum allowed difference between avg beta and avg helicity"

**Section 2: "FF-Helix Thresholds"**
- μH Cutoff (float, default 0.0) — "Minimum hydrophobic moment for FF-Helix classification"
- Hydrophobicity Cutoff (float, default 0.0) — "Minimum hydrophobicity for FF-Helix classification"

**Section 3: "General Thresholds"**
- Agg Per-Residue % (float, default 5.0) — "Minimum aggregation per residue for flagging"
- % of Length Cutoff (integer, default 20) — "Percentage of sequence length for aggregation flagging"
- Min Prediction % (new, float, default 50) — "If less than this % of amino acids are predicted as something, flag it"
- Min S4PRED Helix Score (new, float) — "Minimum S4PRED helix prediction score"

### Design guidelines:
- Each section has a subtle border or background differentiation
- Each threshold has a small info icon (Eye or Info from lucide-react) that shows a tooltip with the description AND how changing it affects results
- Use shadcn/ui Input, Label, Tooltip components
- Collapsible sections (open by default)
- Keep the "Threshold Mode" dropdown (Recommended / Custom) at the top
- When mode is "Recommended", show values as read-only with a subtle badge

### Component structure:
```
ThresholdConfigPanel
├── Threshold Mode selector (Recommended / Custom)
├── SSW Thresholds (collapsible)
│   ├── Min SSW Residues [input] [info icon]
│   └── SSW Max Difference [input] [info icon]
├── FF-Helix Thresholds (collapsible)
│   ├── μH Cutoff [input] [info icon]
│   └── Hydrophobicity Cutoff [input] [info icon]
└── General Thresholds (collapsible)
    ├── Agg Per-Residue % [input] [info icon]
    ├── % of Length Cutoff [input] [info icon]
    ├── Min Prediction % [input] [info icon]
    └── Min S4PRED Helix [input] [info icon]
```

---

## Task 2: Redesign Results Table Column Order

### Current problems:
- TANGO/S4PRED labels everywhere (redundant for researchers)
- Important columns not prioritized on the left
- Bio calc columns scattered

### New column order (left to right):

**Left side (important / decision columns):**
1. ID (Entry)
2. Length
3. Helix (yes/no) — S4PRED helix as binary, show automatically
4. SSW (badge)
5. FF-Helix (badge)
6. FF-SSW (badge)

**Right side (bio calculations):**
7. Helix % (was "S4PRED Helix %")
8. Charge
9. Hydrophobicity (H)
10. μH
11. FF-Helix %

**Far right (optional, shown via column toggle):**
12. Organism
13. Gene Name (from UniProt, when available)
14. Function (from UniProt, when available)

### Design guidelines:
- Binary columns (Helix, SSW, FF-Helix, FF-SSW) use compact badges: green "Yes" / gray "No" / muted "N/A"
- No "TANGO" or "S4PRED" prefix on any column header
- Tooltips on column headers explain the full name
- Column toggle button lets users show/hide columns

---

## Constraints

- Use ONLY existing shadcn/ui components: Card, Button, Badge, Input, Label, Tooltip, Collapsible, Alert
- Use lucide-react icons: Info, Eye, ChevronDown, ChevronRight
- Tailwind CSS only — no custom CSS files
- TypeScript strict mode
- Must work with existing Zustand stores (thresholdStore, datasetStore)
- Dark mode compatible (use CSS variables from existing theme)

## File paths:
- Component: `ui/src/components/ThresholdConfigPanel.tsx`
- Table: `ui/src/components/PeptideTable.tsx`
- Threshold types: `ui/src/lib/thresholds.ts`
- Threshold store: `ui/src/stores/thresholdStore.ts`
- Peptide types: `ui/src/types/peptide.ts`

## Output format:
Generate complete TypeScript/React component code for:
1. `ThresholdConfigPanel.tsx` — redesigned with grouped sections + info icons
2. Column order changes for `PeptideTable.tsx` (just the column definitions, not the full 1000+ line file)
