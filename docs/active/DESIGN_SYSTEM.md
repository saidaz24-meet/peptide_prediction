# PVL Design System — v1.0 Proposal

**Status**: DRAFT — Needs Said's approval before implementation
**Created**: 2026-03-30
**References**: Stripe, Kalshi, Cluely, Precognition, AlphaFold DB 2025

---

## 1. Color Palette

### Primary — Purple Signature
Purple as accent/signature, not the entire UI. Prof. Landau's preference.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--pvl-purple-50` | `#f5f3ff` | — | Subtle purple bg |
| `--pvl-purple-100` | `#ede9fe` | — | Hover states |
| `--pvl-purple-500` | `#8b5cf6` | `#a78bfa` | Primary buttons, links, active tabs |
| `--pvl-purple-600` | `#7c3aed` | `#8b5cf6` | Primary hover |
| `--pvl-purple-700` | `#6d28d9` | — | Pressed state |

### Neutrals — Warm Gray (not cold blue-gray)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `#fafaf9` | `#0c0a09` | Page background |
| `--surface` | `#ffffff` | `#1c1917` | Cards, panels |
| `--surface-raised` | `#ffffff` | `#292524` | Modals, dropdowns |
| `--border` | `#e7e5e4` | `#292524` | Card borders, dividers |
| `--border-subtle` | `#f5f5f4` | `#1c1917` | Subtle separators |
| `--text-primary` | `#1c1917` | `#fafaf9` | Headings, body |
| `--text-secondary` | `#78716c` | `#a8a29e` | Descriptions, captions |
| `--text-muted` | `#a8a29e` | `#78716c` | Placeholders, disabled |

### Semantic Colors — Calmer versions

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--success` | `#16a34a` | `#4ade80` | Yes badges, positive indicators |
| `--success-bg` | `#f0fdf4` | `#052e16` | Success backgrounds |
| `--warning` | `#d97706` | `#fbbf24` | Moderate scores, cautions |
| `--warning-bg` | `#fffbeb` | `#451a03` | Warning backgrounds |
| `--error` | `#dc2626` | `#f87171` | High aggregation, errors |
| `--error-bg` | `#fef2f2` | `#450a0a` | Error backgrounds |
| `--info` | `#2563eb` | `#60a5fa` | Info banners, links |
| `--info-bg` | `#eff6ff` | `#172554` | Info backgrounds |

### Data Visualization — Okabe-Ito (colorblind-safe, Nature-recommended)

| Index | Color | Hex | Usage |
|-------|-------|-----|-------|
| 1 | Orange | `#E69F00` | TANGO/aggregation |
| 2 | Sky Blue | `#56B4E9` | S4PRED helix |
| 3 | Green | `#009E73` | FF-Helix candidate |
| 4 | Yellow | `#F0E442` | Moderate/neutral |
| 5 | Deep Blue | `#0072B2` | SSW regions |
| 6 | Vermillion | `#D55E00` | High aggregation |
| 7 | Pink | `#CC79A7` | FF-SSW overlap |
| 8 | Purple (PVL) | `#8b5cf6` | Primary/selected |

---

## 2. Typography

### Font Stack

| Role | Font | Fallback | Source |
|------|------|----------|--------|
| **Headings** | Inter | system-ui, sans-serif | Google Fonts (Stripe, Vercel use Inter) |
| **Body** | Inter | system-ui, sans-serif | Same — consistency |
| **Monospace** | JetBrains Mono | ui-monospace, monospace | Google Fonts (sequences, numbers) |

### Size Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-display` | 36px | 700 | 1.1 | Page titles (home hero) |
| `--text-h1` | 24px | 600 | 1.3 | Section headings |
| `--text-h2` | 18px | 600 | 1.4 | Card titles |
| `--text-h3` | 15px | 500 | 1.5 | Subsection labels |
| `--text-body` | 14px | 400 | 1.6 | Body text |
| `--text-sm` | 13px | 400 | 1.5 | Table cells, secondary text |
| `--text-xs` | 11px | 500 | 1.4 | Badges, captions, labels |
| `--text-mono` | 13px | 400 | 1.4 | Sequences, numbers (JetBrains Mono) |

### Writing Style
- No dashes in copy. Use periods or commas.
- Empathetic, team-oriented tone. "We analyze your peptides" not "The system processes input."
- Section titles: short, clear, action-oriented. "Your Results" not "Analysis Results Dashboard."

---

## 3. Background Patterns

### Dot Grid (Primary — Home, Upload)
Pure CSS radial-gradient implementation:
```css
.bg-dots {
  background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

### Subtle Grid (Data pages — Results, PeptideDetail)
```css
.bg-grid {
  background-image:
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

### Clean (Compare, Help, About)
No pattern — solid `var(--background)`.

---

## 4. Spacing & Layout

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Inline padding, tiny gaps |
| `--space-2` | 8px | Badge padding, tight gaps |
| `--space-3` | 12px | Input padding |
| `--space-4` | 16px | Card padding (small), section gaps |
| `--space-6` | 24px | Card padding (normal), column gaps |
| `--space-8` | 32px | Section spacing |
| `--space-12` | 48px | Page section margins |
| `--space-16` | 64px | Hero spacing |

### Layout
- Content max-width: `1280px` (data tables can go full width)
- Card border-radius: `12px`
- Button border-radius: `8px`
- Badge border-radius: `6px`
- Input border-radius: `8px`

### Shadows (light mode only — dark mode uses borders)
| Level | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.06)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.08)` |

---

## 5. Animation & Micro-interactions

### Library: Framer Motion (already installed)

| Animation | Duration | Easing | Pattern |
|-----------|----------|--------|---------|
| Page transition | 300ms | `[0.4, 0, 0.2, 1]` | Fade + subtle Y translate |
| Card hover | 200ms | ease-out | `scale(1.01)` + shadow increase |
| Tab switch | 250ms | spring | Content fade, indicator slide |
| Number count-up | 800ms | spring | KPI cards on first render |
| Skeleton shimmer | 1.5s | linear infinite | Loading states |
| Toast enter | 300ms | spring | Slide from right |
| Collapsible | 250ms | ease-out | Height + opacity |

### KPI Number Animation
Use `motion.dev`'s `AnimateNumber` or `useSpring` + `useTransform`:
```tsx
<motion.span>{Math.round(springValue.get())}</motion.span>
```
Spring config: `{ mass: 1, stiffness: 75, damping: 15 }`

---

## 6. Component Tokens

### Buttons
| Variant | Light BG | Light Text | Dark BG | Dark Text |
|---------|----------|-----------|---------|-----------|
| Primary | `#8b5cf6` | `#ffffff` | `#a78bfa` | `#0c0a09` |
| Secondary | `#f5f5f4` | `#1c1917` | `#292524` | `#fafaf9` |
| Ghost | transparent | `#78716c` | transparent | `#a8a29e` |
| Destructive | `#dc2626` | `#ffffff` | `#f87171` | `#0c0a09` |

### Cards
- Light: `bg-white border border-stone-200 shadow-sm rounded-xl`
- Dark: `bg-stone-900 border border-stone-800 rounded-xl`
- Hover: `shadow-md transition-shadow duration-200`

### Badges
- Compact: `text-[11px] font-medium px-2 py-0.5 rounded-md`
- Status colors use semantic tokens (success/warning/error)
- "Yes"/"No" badges: green-on-light-green / gray-on-light-gray

### Tables
- Header: `bg-stone-50 dark:bg-stone-900 text-xs font-medium uppercase tracking-wider text-stone-500`
- Row hover: `hover:bg-stone-50 dark:hover:bg-stone-900/50`
- Sticky header on scroll
- Monospace for all numeric cells

### Tabs
- Style: Segment control (pill on selected tab, not underline)
- Active: `bg-white dark:bg-stone-800 shadow-sm text-stone-900`
- Inactive: `text-stone-500 hover:text-stone-700`
- Container: `bg-stone-100 dark:bg-stone-900 rounded-lg p-1`

---

## 7. Page-Specific Design

### Home
- Hero with dot pattern background
- Large heading: "Peptide Visual Lab"
- Subtitle: empathetic, not technical. "Explore peptide aggregation, structure, and fibril formation — all in one place."
- Two CTAs: "Upload Dataset" (primary), "Try Quick Analyze" (secondary)
- Feature cards below with icons

### Results
- Tab bar (Data Table | Ranking | Charts) as segment control
- KPI cards with number count-up animation on load
- Subtle grid background
- Data table with sticky header, row hover, column tooltips

### PeptideDetail
- Tabbed: Structure | Properties | Aggregation
- Dual track viewer (helix + SSW) in Structure tab
- Collapsible subsections within each tab
- Auto-expand sections with notable findings

### Sidebar
- Collapsed: 56px wide, icons only, tooltip on hover
- Expanded: 240px, icon + label
- Toggle button at bottom
- Active item: purple left border + purple-tinted background

---

## 8. Footer Credits

```
© 2026 Peptide Visual Lab

Platform Development — Said Azaizah
Algorithms & Prediction Pipeline — Dr. Peleg Ragonis-Bachar
Infrastructure & Scientific Guidance — Dr. Alexander Golubev

Technion · DESY · EMBL
```

---

## Implementation Order

1. **Theme foundation**: CSS variables, fonts, Tailwind config
2. **Component tokens**: Button, Card, Badge, Table, Tabs restyling
3. **Sidebar**: Collapsible toggle
4. **Home page**: Hero, feature cards, dot pattern
5. **Results page**: KPI animations, tab segment control, table styling
6. **PeptideDetail**: Tabbed layout, dual track viewer
7. **Remaining pages**: Upload, Compare, QuickAnalyze, Help, About
8. **Polish**: Page transitions, loading states, responsive
