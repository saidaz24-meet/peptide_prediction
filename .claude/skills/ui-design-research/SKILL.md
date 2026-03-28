---
name: ui-design-research
description: "Auto-triggered when designing or modifying UI components. Research-first methodology for scientific data visualization."
user_invocable: true
auto_trigger: true
file_patterns:
  - "ui/src/components/**/*.tsx"
  - "ui/src/pages/**/*.tsx"
---

# UI/UX Design Research Skill — PVL

## When This Activates

Auto-triggers when editing PVL frontend components. Enforces research-first approach for scientific visualization interfaces.

## Research-First Protocol

Before creating or significantly modifying any UI component:

1. **Identify the pattern** — What type of visualization? (chart, table, dashboard, detail view, comparison, filter panel)
2. **Study references** — Research how top scientific tools implement this:
   - Bioinformatics tools: UniProt, AlphaFold, Galaxy, BLAST interfaces
   - Data dashboards: Observable, Grafana, Metabase patterns
   - Search web for best-in-class scientific data visualization
3. **Propose before building** — Show 2-3 approaches with tradeoffs
4. **Get approval** — Wait for Said before writing code

## PVL Design Principles

- **Scientific accuracy first** — visualization must be truthful to data
- **Publication-ready** — charts should be exportable for papers
- **Tailwind + shadcn/ui** for all styling
- **Recharts** for data charts + raw SVG for custom visualizations
- **ResponsiveContainer** always wraps chart components
- **Dark/light theme** support
- **Color coding must be colorblind-safe** — never rely on red/green alone

## Data Visualization Rules

- **Numeric fallback:** Always use `??` not `||` (0 is falsy!)
- **SSW values:** -1 | 0 | 1 | null — each has distinct visual treatment
- **FF data everywhere:** If SSW/S4PRED data is shown, FF equivalent must also be shown
- **Thresholds:** Visual indicators must update when threshold presets change
- **Tooltips:** Every data point should have an informative tooltip

## Component Quality Checklist

Before any UI component is done:
- [ ] Responsive at desktop and tablet sizes
- [ ] Data accuracy verified (compare with backend response)
- [ ] Loading state with skeleton
- [ ] Error state with retry
- [ ] Empty state (no data message)
- [ ] Colorblind-safe palette
- [ ] Tooltips on all data points
- [ ] Export-friendly (screenshot/SVG export where applicable)
- [ ] FF data shown alongside SSW/S4PRED data
- [ ] Thresholds respected and visually indicated
