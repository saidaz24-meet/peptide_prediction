---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality for PVL scientific visualization
user_invocable: false
auto_trigger:
  - file_pattern: "ui/src/components/**/*.tsx"
  - file_pattern: "ui/src/pages/**/*.tsx"
---

# Frontend Design Skill — PVL

When building or modifying UI components for PVL, follow these principles.

## Design Identity

PVL is a **scientific research instrument**, not a consumer app. Design should communicate:
- **Precision** — data accuracy is paramount
- **Clarity** — complex biochem data made immediately readable
- **Professional** — publication-ready visualizations
- **Modern** — clean, minimal, app-like experience

## Design Tokens (from ui/src/index.css)

- Use CSS variables from the existing theme system
- Dark/light mode via `class="dark"` on root
- shadcn/ui components from `ui/src/components/ui/`
- Tailwind only — no inline styles, no new CSS files

## Component Patterns

- Use shadcn/ui primitives — never build custom buttons, dialogs, inputs from scratch
- Use `lucide-react` for icons: `import { Icon } from "lucide-react"`
- Toast notifications via `sonner`
- Loading states via shadcn `Skeleton`
- All data tables use the existing table component patterns

## Scientific Visualization Rules

1. **Color scales must be colorblind-safe** — use viridis/plasma palettes, avoid red-green only
2. **Charts must have axis labels and units** — never bare numbers
3. **Tooltips on every data point** — researchers need exact values
4. **Export-ready** — charts should look good in a paper (white background option)
5. **No scary colors for normal values** — red only for genuine warnings, not low scores

## Cowork Handoff Criteria

If a task involves:
- Designing a new page layout from scratch
- Creating 3+ new components
- Major visual redesign of existing page
- Complex responsive layout work

→ **Generate a Cowork prompt instead of implementing in Claude Code**

Include in the prompt: screenshots of current state, design tokens, component library reference, Zustand store interfaces, and exact acceptance criteria.

## Before Building

1. Check existing components in `ui/src/components/` for reuse
2. Check Recharts patterns already in use (PeptideDetail, Results pages)
3. Consider if this is a Cowork task (see criteria above)
4. Test at 375px, 768px, 1440px
