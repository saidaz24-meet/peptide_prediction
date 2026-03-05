---
name: pvl-frontend-patterns
description: React/TypeScript frontend patterns for PVL. Use when working on any UI component, page, store, or frontend test. Covers Zustand, shadcn/ui, Recharts, and type safety rules.
user-invocable: false
---

# PVL Frontend Patterns

## Component Structure
```typescript
// Props as explicit interface, export function (NOT const arrow)
interface MyComponentProps {
  peptides: Peptide[];
}

export function MyComponent({ peptides }: MyComponentProps) {
  // 1. Hooks at top
  // 2. Derived state (useMemo)
  // 3. Handlers
  // 4. JSX return
}
```

## CRITICAL: Numeric Fallback Rule
**ALWAYS use `??` not `||` for numeric values.** `||` treats `0` as falsy:
```typescript
// WRONG: ffHelixPercent: 0 becomes null
const value = data.ffHelixPercent || null;

// CORRECT: only null/undefined trigger fallback
const value = data.ffHelixPercent ?? null;
```

## Zustand Stores
Three stores: `datasetStore`, `thresholdStore`, `chartSelectionStore`.
```typescript
export const useMyStore = create<MyState>((set, get) => ({
  value: initial,
  setValue: (v) => {
    const state = get();  // Read before mutate
    set({ value: v, derived: compute(state, v) });
  },
}));
```
- Immutable updates: `{ ...state, [key]: value }`
- `persist()` middleware for localStorage with `migrate()` versioning
- Use `get()` to read current state

## Data Flow
```
API fetch (lib/api.ts) → peptideMapper → datasetStore.setPeptides() → components
```
- Vanilla `fetch()` with custom `ApiError` class — no Axios
- React Query installed but used sparingly (UniProt only)
- `API_BASE` from `VITE_API_BASE_URL` env var

## Type Safety
- Canonical types: `types/peptide.ts` (maps to backend `api_models.py`)
- Mapper: `lib/peptideMapper.ts` transforms API → frontend types
- SSW values: `type SSWPrediction = -1 | 0 | 1 | null`
- Optional fields: `fieldName?: type | null`

## Styling
- **Tailwind CSS** utility classes only — no CSS modules
- **shadcn/ui**: Card, Button, Badge, Tabs, Table, Dialog, Slider
- **lucide-react** icons: `import { Icon } from 'lucide-react'`
- **framer-motion**: `<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>`
- Theme CSS variables in `index.css` (`--helix`, `--primary`, etc.)

## Charts
- **Recharts** for standard charts (Bar, Line, Scatter)
- **Raw SVG** for custom (HelicalWheel, PositionBars)
- Colors from `lib/chartConfig.ts` (`CHART_COLORS`)
- Always wrap in `<ResponsiveContainer width="100%" height={N}>`

## Imports — @/ alias = src/
```typescript
import { useState, useMemo } from 'react';         // React
import { useNavigate } from 'react-router-dom';     // External
import { BarChart } from 'recharts';                 // Charts
import { useDatasetStore } from '@/stores/datasetStore';  // Local
import { Peptide } from '@/types/peptide';
import { Button } from '@/components/ui/button';     // shadcn
```

## Routing
react-router-dom v6. `useNavigate()`, `useParams<{id: string}>()`.
Routes: `/` `/upload` `/results` `/peptides/:id` `/quick` `/compare` `/help`

## Visual Debugging
After UI changes, compare against reference screenshots in the screenshots directory (path in MEMORY.md `External Resources`). Use the Read tool to view screenshots and verify:
- Layout hasn't shifted unexpectedly
- Data displays correctly (especially 0 vs null vs missing)
- Charts render with correct colors and labels
- Responsive behavior on different widths

When the user mentions screenshots or visual debugging, read the screenshot files directly — Claude can view images.

## Testing
Vitest + jsdom. Tests in `src/lib/__tests__/`.
```typescript
import { describe, it, expect } from 'vitest';
function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide { ... }
```
