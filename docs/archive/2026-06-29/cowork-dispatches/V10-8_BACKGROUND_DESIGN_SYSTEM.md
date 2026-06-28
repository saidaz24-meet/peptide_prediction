# Cowork V10-8 — Background design system

**Status**: Queued (parked-list easy win for post-Peleg-signoff polish).
**Trigger**: ready-to-dispatch the moment Cowork has capacity.
**Discipline**: PRE-FLIGHT v2 mandatory — read existing `BgDotGrid.tsx`, `index.css`, `tailwind.config.ts` first; build reusable primitives, no one-off backgrounds.

---

## Why this matters

Every PVL page today uses one of two backgrounds: flat `bg-background` or `BgDotGrid` (subtle dot pattern). That's fine but bland. We need a **scientific** visual identity that signals "research instrument" instead of "generic SaaS dashboard" — without sliding into "biotech marketing landing page."

This dispatch creates a small system of 3 reusable background scenes, each tied to a domain concept the user understands. Pages can opt-in to a scene by importing one component.

---

## The system: 3 named scenes

### scene-sequence-motif

**Concept**: faint amino-acid letter glyphs floating at low opacity behind page content. Subtle, peptide-themed.

**Implementation**:
- Reusable component: `ui/src/components/scenes/SceneSequenceMotif.tsx`
- SVG-based: 30-40 random letter glyphs (A K L V F R E I — the most common AAs in our datasets) positioned with deterministic pseudo-random placement
- Animation: glyphs drift slowly with `framer-motion`, randomized vertical sway at 0.3-1.0 amplitude with 8-20s periods so no two glyphs sync
- Color: `hsl(var(--foreground) / 0.04)` in light mode, `hsl(var(--foreground) / 0.06)` in dark mode
- Performance: `pointer-events: none`, `aria-hidden`, single component re-rendering at 60fps
- Respects `prefers-reduced-motion: reduce` → glyphs stay static
- Mobile: same glyph density but smaller font-size; scene scales down clean at 375px
- **Use on**: `/results` page hero, `/peptides/:id` page hero (where a peptide is the page's subject)

### scene-helix-mesh

**Concept**: gentle 3D helix-spiral wireframe in the corners or as a watermark behind the title area. Conveys "secondary structure" without being literal about it.

**Implementation**:
- Reusable component: `ui/src/components/scenes/SceneHelixMesh.tsx`
- SVG-based path: helical sine-wave curve parameterised by `(t, amplitude, period)`. Single `<motion.path>` whose `d` attribute interpolates over a 12-second loop
- Color: `hsl(var(--helix) / 0.10)` — uses the existing helix CSS variable so the scene auto-themes
- Position: absolute, top-right of the page hero region; mirrored variant for top-left available via prop
- Performance: pure SVG, no canvas, no requestAnimationFrame loop (framer-motion handles)
- Respects `prefers-reduced-motion: reduce` → path holds final-frame static
- **Use on**: `/help` page (the page that EXPLAINS secondary structure), `/about` page

### scene-aggregate-cluster

**Concept**: cluster of small circles (representing fibril nuclei) very faintly clumping/dissipating. Conveys "aggregation" without being literal.

**Implementation**:
- Reusable component: `ui/src/components/scenes/SceneAggregateCluster.tsx`
- SVG-based: 18-25 circles of radius 4-10px positioned with a deterministic Poisson-disc sampler so they look organic
- Animation: each circle independently expands/contracts opacity 0.6 ↔ 1.0 with 10-25s periods
- Color: `hsl(var(--ff-ssw) / 0.06)` — uses the existing FF-SSW CSS variable
- Performance: same as the others
- Respects `prefers-reduced-motion: reduce` → circles hold static
- **Use on**: `/quick` page (where users analyze ONE sequence — the aggregation theme is the dominant scientific question), `/uniprot` search results

---

## CSS token additions

Add to `ui/src/index.css` under `@layer base`:

```css
@layer base {
  :root {
    /* Background scene opacity tokens — auto-themed for light/dark */
    --scene-glyph-opacity: 0.04;
    --scene-helix-opacity: 0.10;
    --scene-cluster-opacity: 0.06;
  }
  .dark {
    --scene-glyph-opacity: 0.06;
    --scene-helix-opacity: 0.14;
    --scene-cluster-opacity: 0.10;
  }
}
```

Each scene reads its opacity from the CSS variable so dark mode auto-bumps without component-level branching.

---

## Page wiring

Add a single optional `scene` prop to the shared page-wrapper component (`ui/src/components/PageHero.tsx` or wherever each page consolidates its title region):

```tsx
type Scene = "sequence-motif" | "helix-mesh" | "aggregate-cluster" | "none";

function PageHero({ scene = "none", children }: { scene?: Scene; children: ReactNode }) {
  return (
    <div className="relative">
      {scene === "sequence-motif" && <SceneSequenceMotif />}
      {scene === "helix-mesh" && <SceneHelixMesh />}
      {scene === "aggregate-cluster" && <SceneAggregateCluster />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
```

Pages opt in by passing the prop:
- `Results.tsx` → `<PageHero scene="sequence-motif">`
- `PeptideDetail.tsx` → `<PageHero scene="sequence-motif">`
- `Help.tsx` → `<PageHero scene="helix-mesh">`
- `About.tsx` → `<PageHero scene="helix-mesh">`
- `Quick.tsx` → `<PageHero scene="aggregate-cluster">`
- `UniProtSearch.tsx` → `<PageHero scene="aggregate-cluster">`
- `Landing.tsx` → already gets its own custom hero from V10-7; leave `scene="none"`

---

## Acceptance test (Said browser eyes)

When this dispatch lands:
- `/results` has faint letter glyphs floating behind the KPI row
- `/help` has a gentle helix wireframe behind the title section
- `/quick` has subtle clustering circles behind the input form
- Light/dark mode both look intentional — neither has scene elements that "shout"
- Mobile at 375px: scenes scale down clean, never push content
- `prefers-reduced-motion: reduce` → all scenes static (no motion)
- Lighthouse Performance ≥ 80 on every page that adopts a scene (no regression from the BgDotGrid baseline)
- Storybook entry for each scene component so future developers can preview without spinning the app

## Discipline

- PRE-FLIGHT v2: read `index.css`, `tailwind.config.ts`, `BgDotGrid.tsx`, the existing page heroes.
- All 3 scene components live in `ui/src/components/scenes/` — new directory.
- Tests: 1 vitest spec per scene asserting that `aria-hidden="true"` and `pointer-events: none` are set (these are decorative).
- No emojis in production copy.
- No new npm deps without flagging T1.

## What this UNBLOCKS

- The "feels like a research instrument" visual identity that V10-7's hero alone can't carry — the rest of the app stays bland by comparison if only the landing is upgraded.
- A reusable scene primitive future surfaces (Compare page V2, Cohort dashboard V2) can opt into without re-inventing background art.
- The Phase D5 (V4 transformative differentiators) work later — those bigger visual ideas can build on this scene primitive.
