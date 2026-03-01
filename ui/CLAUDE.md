# Frontend — Claude Instructions

## Stack
React 18 + TypeScript 5 + Vite. Tailwind + shadcn/ui. Zustand for state. Recharts for charts.

## Component Pattern
```typescript
// Props as explicit interface, export function (not const arrow)
interface ThresholdTunerProps {
  peptides: Peptide[];
}

export function ThresholdTuner({ peptides }: ThresholdTunerProps) {
  // hooks at top, then derived state, then handlers, then JSX
}
```

## Zustand Stores
Three stores: `datasetStore` (peptides/stats), `thresholdStore` (presets), `chartSelectionStore`.
```typescript
export const useThresholdStore = create<ThresholdState>((set, get) => ({
  preset: 'original',
  active: { ...DEFAULT_THRESHOLDS },
  setPreset: (p) => {
    const state = get();
    set({ preset: p, active: { ...state.original } });
  },
}));
```
- Use `get()` to read state before mutations
- Immutable updates: `{ ...state, [key]: value }`
- `persist()` middleware for localStorage with `migrate()` versioning

## Styling
- **Tailwind only** — no CSS modules, no styled-components
- **shadcn/ui** components: Card, Button, Badge, Tabs, Table, Dialog, Slider
- **lucide-react** icons: `import { ArrowUpDown } from 'lucide-react'`
- **framer-motion** for animations: `<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>`
- Custom CSS variables for theme colors in `index.css` (`--helix`, `--primary`, etc.)

## Type Safety
- Canonical types in `types/peptide.ts` — maps to backend `api_models.py`
- `peptideMapper.ts` transforms API responses → frontend `Peptide` type
- **ALWAYS use `??` not `||` for numeric fallbacks** — `||` treats `0` as falsy

## Data Flow
```
API fetch (lib/api.ts) → peptideMapper → datasetStore.setPeptides() → components read from store
```
- Vanilla `fetch()` with custom `ApiError` class (no Axios)
- React Query installed but used sparingly (UniProt only)
- `API_BASE` from `VITE_API_BASE_URL` env var

## Charts
- **Recharts** for standard charts (BarChart, ScatterChart, etc.)
- **Raw SVG** for custom visualizations (HelicalWheel, PositionBars)
- Chart colors from `lib/chartConfig.ts` (`CHART_COLORS` constant)
- All charts wrapped in `<ResponsiveContainer width="100%" height={N}>`

## Routing
react-router-dom v6. Pages in `pages/`. Params via `useParams<{id: string}>()`.
Key routes: `/` `/upload` `/results` `/peptides/:id` `/quick` `/compare` `/help`

## Imports
```typescript
// React first, then external, then local with @/ alias
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar } from 'recharts';
import { useDatasetStore } from '@/stores/datasetStore';
import { Peptide } from '@/types/peptide';
import { Button } from '@/components/ui/button';
```

## Testing
Vitest + jsdom + @testing-library/react. Tests in `src/lib/__tests__/`.
```typescript
import { describe, it, expect } from 'vitest';
// Factory functions for test data
function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide { ... }
```

## Quick Reference
```bash
cd ui
npm run dev              # Dev server (port 5173)
npm run build            # Production build
npx vitest run           # All tests
npx tsc --noEmit         # Type check
npx prettier --write "src/**/*.{ts,tsx}"  # Format
```
