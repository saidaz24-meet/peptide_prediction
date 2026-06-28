# Cowork V10-7 — Landing page quality push

**Status**: Queued (parked-list easy win for post-Peleg-signoff polish).
**Trigger**: ready-to-dispatch the moment Cowork has capacity. Said pastes this verbatim into a Cowork prompt; no Claude rewriting needed.
**Discipline**: PRE-FLIGHT v2 mandatory — read existing `ui/src/pages/Landing.tsx` first; refactor in place; no parallel `LandingV2.tsx`.

---

## Why this matters

The landing page is the 30-second impression a peer scientist gets when they click a PVL link from a paper or a tweet. Today it's adequate but not memorable. We have ~6 weeks before publish and this is the single highest-leverage visual artifact. After Peleg signs off the science, the landing page becomes the gating factor between "interesting-looking research tool" and "I want to try this."

This dispatch is for visual polish only — no API changes, no new pipeline features. Stripe-level calm, research-grade gravity.

---

## Three deliverables (all on `ui/src/pages/Landing.tsx`)

### 1. Hero refresh

**Current state** (2026-06-07): two-column hero with a centered "Peptide Visual Lab" title + tagline + two CTA buttons (Quick Analyze / Database Search) on the left, and an animated/static graphic on the right.

**Asks**:
- **Title typography** — "Peptide Visual Lab" feels like a card title today. Make it hero-scale (text-5xl on mobile → text-7xl on lg, font-bold tracking-tight, with a subtle gradient sweep). DESY · Landau Group should sit underneath as a quiet badge row.
- **Tagline** — current copy "All-in-one peptide aggregation and structure prediction" reads like the README. Replace with a single sentence that names the scientific problem: *"Single web tool combining aggregation, secondary structure, and fibril-forming helix detection for peptide researchers."* Then a smaller line: *"v0.3.0 · Open source · Zenodo DOI {{DOI}} · JOSS in submission"* (placeholder values for DOI and JOSS link until they're live).
- **CTA buttons** — keep the two primary buttons (Quick Analyze, Database Search). Add a tertiary "View Demo Dataset" link that loads the preloaded Staphylococcus 2023 cohort or a similar showcase set. The demo gives a researcher a way to evaluate without typing a single peptide.
- **Subtle wave/gradient background** — Stripe-level calm. CSS-only gradient with `@keyframes` mask-image edge motion. No Three.js, no canvas. Mobile-safe at 375px.

### 2. 40-second demo loop above the fold

**Current state**: no demo loop. The right column is either a static graphic or a small animation.

**Asks**:
- Replace the right-column visual with a **40-second muted autoplay video loop** showing the canonical research flow:
  1. Paste a sequence into Quick Analyze
  2. KPI cards appear
  3. Click a peptide row → PeptideDetail
  4. Hover a residue → ResidueHover popup
  5. Open the 3D viewer
  6. Click Export PDF
- The video should be **15-20 MB max** (h.264, 1080p, target 5 Mbps). Hosted in `ui/public/demo/landing_loop_v030.mp4`. Cowork records this on a clean macOS browser; T1 reviews + approves before merge.
- **Caption underneath**: "What PVL does, in 40 seconds — no signup required."
- **Reduced-motion fallback**: when `prefers-reduced-motion: reduce` is set, swap the video for a static 4-frame storyboard image.

### 3. Five-surface ecosystem bar

**Current state**: nothing explains that PVL is more than a website. The 5 surfaces (Web · Python package · CLI · MCP server · Docker self-host) are documented in ECOSYSTEM_GUIDE.md but invisible on the landing.

**Asks**:
- Add a horizontal bar **below the hero, above "How It Works"** showing the 5 surfaces as small cards with icons:
  - Web (Globe icon) → "Use at https://94.130.178.182 — no install"
  - Python (Code icon) → `pip install pvl-py` (gray out as "coming soon" if PyPI not live)
  - CLI (Terminal icon) → `npx pvl analyze peptide.fa`
  - MCP (Plug icon) → "Use PVL from Claude Desktop / Cursor / Continue"
  - Self-host (Docker icon) → "docker compose up — see SELF_HOST_GUIDE.md"
- Each card is clickable and routes to the relevant docs section. Subtle hover with border accent. Light + dark mode parity.
- Spacing: max-w-6xl mx-auto; gap-4; grid-cols-2 sm:grid-cols-3 lg:grid-cols-5.

---

## Acceptance test (Said browser eyes)

When this dispatch lands:
- `/` loads with a hero that feels research-platform-grade, not phone-on-laptop
- The 40-second demo video autoplays muted in the right column
- The 5-surface ecosystem bar sits between the hero and "How It Works"
- "DESY · Landau Group" appears as a quiet badge under the title
- The tagline mentions the scientific problem (aggregation + structure + FF), not just the tool name
- `prefers-reduced-motion: reduce` swaps the video for a storyboard
- Mobile at 375px: hero stacks, demo video scales down, ecosystem bar becomes 2-col grid
- Lighthouse score: Performance ≥ 80, Accessibility ≥ 95

## Discipline

- PRE-FLIGHT v2: read existing `Landing.tsx`, `HowItWorks.tsx`, `ECOSYSTEM_GUIDE.md` first. Refactor in place.
- No new npm deps without flagging T1.
- No emojis in production copy.
- Light + dark mode both render.
- Said reviews the video before merge — Cowork pings T1 with the .mp4 URL.

## What this UNBLOCKS

After this lands, the publish-readiness checklist gets:
- A landing page worth sending to a journal editor
- A demo video peer reviewers can share
- A "this is more than a website" signal that justifies the JOSS / NAR positioning
