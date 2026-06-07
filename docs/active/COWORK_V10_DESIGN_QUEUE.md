# Cowork V10 — Design polish queue (post-push)

> Said's redesign asks from browser-audit 2026-05-12 (screenshots at 5:04 + 5:07). Bundle into V10 prompts for Cowork after the Wave 2 push lands. Each item below becomes its own Cowork prompt with the standard PROMPT 0 + PRE-FLIGHT v2 framing.

---

## V10-1 — About page redesign (wave background, spread layout, no back button)

**Page**: `ui/src/pages/About.tsx`
**Current screenshot**: 2026-05-12 at 5:07 — content is in a narrow centered column on a flat tan background. Page looks like a phone-on-laptop layout. Back button at top is unnecessary (sidebar handles navigation).

**Redesign asks**:
1. **Wave background** — a subtle animated wave / fluid gradient across the entire viewport behind the content. NOT loud — Stripe-level calm. Research-grade: should feel like a research-platform homepage, not a kid's app. Suggested approaches to research:
   - SVG path with `framer-motion` `<motion.path>` animating `d` attribute over a sine-wave parameterization
   - Three.js / OGL water-surface shader (too heavy — reject)
   - CSS-only gradient with `@keyframes` + `mask-image` for wavy edge (lightweight winner)
   - Reference: Vercel landing pages, Linear marketing pages, RCSB PDB hero waves
2. **Kill the back button** at the top of the page — sidebar handles navigation already.
3. **Spread the layout** — use the full viewport width with a generous max-w-5xl or max-w-6xl content frame. Right now content is squeezed center while the background floats only in the middle, creating the "phone on laptop" effect Said called out.
4. **Hero treatment** — "Peptide Visual Lab" should feel like a hero, not a card title. Larger typography, the wave background, the DESY · Landau Group subtitle as a quiet pill.
5. **Credits section** — the existing 3-up grid (Said / Peleg / Alex) is fine structurally; live it up with subtle hover states, ORCID badges as proper Badge components, lab-affiliation pills.
6. **Predictor providers footnote** — keep but de-emphasize. Don't compete with credits visually.

**Discipline**:
- PRE-FLIGHT mandatory: existing `About.tsx` is the target. REFACTOR in place, do NOT create a parallel `AboutV2.tsx`.
- Wave background should be a NEW reusable component (`ui/src/components/WaveBackground.tsx`) since it's a primitive we'll reuse on Help, Landing, possibly Results hero.
- Mobile responsive at 375px — wave must not break the layout on narrow screens.
- Light + dark mode both render.
- No new npm deps without flagging T1.

**Acceptance test (Said browser eyes)**:
- /about renders with full-width wave background
- "Peptide Visual Lab" feels hero-scale
- No back button at top of page
- Credits remain 3-up, readable, with ORCID links
- Said's title says "Lead developer" (already fixed in commit 0145c3a — preserve this)

---

## V10-2 — DrillDown slide-over polish (give the panel life)

**Component**: `ui/src/components/drilldown/DrillDown.tsx` + its inspector children (`SimilarPeptidesInspector.tsx`, `MetricInspector.tsx`, `PeptideInspector.tsx`, `ChartInspector.tsx`)
**Current screenshot**: 2026-05-12 at 5:04 — panel works but feels dead. Empty-state copy is plain. Header has a single icon (Share) + the close X. Footer is two muted disabled buttons (SVG, CSV).

**Redesign asks**:
1. **Better empty state** for SimilarPeptidesInspector — when no results, show a friendly "Index not populated yet — run `make reindex-lance`" with an inline command or even an action button. Not just a magnifying-glass icon and gray text.
2. **Header polish** — title typography, subtle gradient or accent line under the title, badge showing the inspector mode ("Similar" / "Metric" / "Chart" / "Peptide").
3. **Animation on open** — Sheet already slides; add a brief stagger on the inner content (header → results → footer) using framer-motion `staggerChildren`.
4. **Loading state** — skeleton rows that match the actual result row shape (avatar + sequence + distance bar), not a generic spinner.
5. **Result row hover** — subtle scale or border accent on hover; clear "click to switch" affordance.
6. **Footer SVG + CSV buttons** — currently disabled in DrillDown.tsx footer. Either wire them OR remove them. They look unfinished as disabled.

**Discipline**:
- PRE-FLIGHT mandatory: target existing files, refactor in place.
- The double-X close button bug already fixed in `0145c3a` — preserve the SheetContent built-in close.
- No emojis in production copy (per AGENTS.md).

**Acceptance test (Said browser eyes)**:
- Open Find Similar on any peptide → panel feels alive (animated entrance, polished header, clear loading skeleton)
- Empty state has actionable copy + visible CTA
- Hover over a result row → clear visual response
- Footer buttons either work or are gone

---

## V10-3 — Scroll-triggered card animations across the app (future, lower priority)

**Scope**: app-wide
**Said's exact ask**: *"when we scroll each card makes animation when we reach it only not all at once etc and we should make this really very good to use."*

**Approach**:
1. **Standard intersection-observer hook** — `ui/src/hooks/useInView.ts` (research existing — react-intersection-observer is well-maintained, ~12kb; or hand-rolled IntersectionObserver in ~30 lines is simpler and dep-free).
2. **Animation primitive** — `framer-motion` `<motion.div>` with `whileInView` + `initial={{ opacity: 0, y: 20 }}` + `viewport={{ once: true, amount: 0.2 }}`. This is the industry-standard pattern (Vercel, Linear, Stripe use this).
3. **Apply selectively** — KPI cards on Results, peptide rows in PeptideTable, chart cards in ResultsCharts. NOT page-level (avoid jank). NOT modals or always-visible chrome.
4. **Performance** — `once: true` so animations don't re-fire on scroll back. `amount: 0.2` triggers when 20% visible. Test on mobile.

**Discipline**:
- Each animated component pattern should live in ONE reusable wrapper: `ui/src/components/animations/AnimateOnView.tsx`. Don't sprinkle framer-motion hooks across every component.
- Light + dark mode behavior identical.
- Respects `prefers-reduced-motion` — when set, animations turn into instant fade (no movement).

**Acceptance test (Said browser eyes)**:
- Scroll down /results — each KPI card / chart / peptide row animates in once as it enters view
- Scroll back up — already-animated cards don't re-animate (jarring)
- On a mid-2020 MacBook Pro, the animations should be 60fps smooth — no jank
- If you've toggled "Reduce motion" in macOS preferences, animations become instant

---

## V10-4 — Transition + smoothness audit (future, with V10-3)

**Scope**: route transitions + scroll behavior

1. **Route-change transition** — existing `PageTransition.tsx` is fine, but tune the timing to feel less like "fade-and-swap" and more like a calm push.
2. **Smooth scroll** — `html { scroll-behavior: smooth; }` is set somewhere; verify and tune. When clicking an anchor link from STATUS / About / Help, scroll should feel calm (~400-600ms ease-out).
3. **Anchor jump cards** — when clicking a peptide in the table, the detail page should already be at scrollTop=0 (verify ScrollToTop component works for query-param-only navigation too).
4. **Loading transitions** — when navigating between pages, the Suspense fallback (the centered spinner) should fade in/out, not flash.

**Discipline**:
- This is purely a polish round — no new architecture, no new components, just tuning existing motion.
- Use `prefers-reduced-motion` everywhere.

---

---

## V10-5 — Help page 4-section rewrite (Peleg Drive 2026-06-03)

**Page**: `ui/src/pages/Help.tsx`
**Driver**: Peleg's Drive comment — current Help has 2 sections (FF-Helix and SSW prediction); she wants 4 explicit sections.

**Peleg's exact text to use verbatim for the four section bodies**:

> **Alpha-helix secondary structure**
> Determined by s4pred predictions and threshold.
>
> **Fibril-forming alpha helix**
> Determined by the uH threshold. If a peptide is predicted to be helical (as described above) and its uH is higher than the threshold uH, it will be predicted as a potential alpha-helical fibril-forming peptide.
>
> **Secondary structure switch**
> Determined by Tango and/or s4pred. Peptide will be predicted as secondary structure switch if the difference between averaged scores of helicity and extended beta are lower than the maximum gap threshold. Meaning, for these sequences the secondary structure prediction tools were indecisive or predicted scores similar for both secondary structures.
>
> **Fibril-forming secondary structure switch**
> Determined by the hydrophobicity threshold. If a peptide is predicted to be a secondary structure switch (as described above) and its hydrophobicity is higher than the threshold hydrophobicity, it will be predicted as a potential secondary structure switch fibril-forming.

**Design discipline**:
- Use 4 separate `<section>` blocks with the same visual treatment — each section gets a header (the class name as it appears in the rest of PVL: "Helix", "FF-Helix", "SSW", "FF-SSW") plus a one-line subtitle ("Alpha-helix secondary structure", "Fibril-forming alpha helix", etc.) plus Peleg's body text.
- Ordering: **Helix → FF-Helix → SSW → FF-SSW**. This mirrors the cohort-comparison ordering on /results and the Q5 symmetry-of-treatment principle Peleg corrected.
- Each section gets the same colour accent as its corresponding badge on PeptideTable (brown-orange for "No-finding" reference, light green for Helix/SSW, darker green for FF-Helix/FF-SSW — pulled from `index.css` `--ff-helix` / `--ff-ssw` / etc.).
- No icons inside the section bodies — keep these as scientific definitions, not marketing copy.
- The existing "Insights you can extract" callout should appear **once** at the top of the Help page, above the 4 sections, not embedded inside them.

**Two open questions blocking final ship** (T1 will confirm with Peleg, do NOT guess):
1. Should the SSW section reference both **maximum gap threshold** AND **minimum % SS content** thresholds, or only the gap threshold?
2. For FF-SSW, the body says "hydrophobicity is higher than the threshold hydrophobicity" — confirming the gate is hydrophobicity (not μH). Cowork: render exactly as written; T1 will validate post-Zoom.

**Out of scope for V10-5**:
- The "FF-Helix %" → "Helix %" column rename (that's V10-6).
- Insights / use-case copy refresh (that's a separate Wave 2.7 copy task).

**Files**:
- `ui/src/pages/Help.tsx` only.

**Acceptance**:
- 4 distinct section blocks, ordering as above, body text verbatim from Peleg.
- `npx tsc --noEmit` clean.
- Screen reader: each section heading should announce the class name first ("Helix"), then the long form ("Alpha-helix secondary structure") as the subtitle — so a researcher scanning headings hears the PVL term first.
- Mobile-responsive at 375px (no horizontal scroll, headings wrap correctly).

---

## V10-6 — "FF-Helix %" → "Helix %" terminology audit

**Driver**: Peleg's Drive answer 2026-06-03 — *"There should be only two terms: Helix and FF-Helix. The % should just be another feature indicating what percentage of the sequence was predicted to be helical and should be treated as a separate variable/parameter."*

**Mission**: every place the UI presents "FF-Helix %" as a feature label, rename to "Helix %" (or "S4PRED helix content" where the longer label fits the layout). The class flag **FF-Helix** stays exactly as it is — this is purely about the percent-value label.

**Search scope** (Cowork should grep these):
```
grep -rn "FF-Helix %\|FFHelix %\|ffHelixPercent" ui/src --include="*.tsx" --include="*.ts"
```
Known hit list as of 2026-06-03 (verify nothing else exists):
- `ui/src/components/PeptideTable.tsx` — column header + tooltip text
- `ui/src/components/charts/AACompositionGrouped.tsx` — grouping labels (only the `% helix` axis, NOT the class names)
- `ui/src/components/ResultsCharts.tsx` — chart titles + descriptions
- `ui/src/pages/PeptideDetail.tsx` — the FF-Helix vs Aggregation Max scatter axis label
- `ui/src/components/PeptideRadarChart.tsx` — radar axis label
- Smart Candidate Ranking — the weight slider in `ThresholdConfigPanel.tsx` or wherever the metric label "FF-Helix %" appears as a sliding-axis name.

**Rename rules** (apply consistently):
| Current label | New label |
|---|---|
| "FF-Helix %" (as a column/feature header) | "Helix %" |
| "FF-Helix %" (in a long tooltip body) | "S4PRED helix content" |
| "FF-Helix" (the class flag/badge) | **NO CHANGE — keep FF-Helix** |
| `ffHelixPercent` (the data field name) | **NO CHANGE — internal data shape stays** |

**Do NOT rename**:
- The TypeScript field `ffHelixPercent` (would break the backend contract).
- The badge text "FF-Helix" on PeptideTable when shown as a class flag (e.g. the green pill that signals "this peptide is an FF-Helix candidate").
- Any threshold-related code (`MIN_HELIX_PERCENT_CONTENT` etc.).
- The cohort-comparison chart group label "FF-Helix" (that's the class group, not the percent feature).

**Tooltips**: update the column tooltip so a researcher hovering "Helix %" reads: *"S4PRED helix content — percentage of residues predicted helical by S4PRED. This is a feature, not a class label. The candidate flag is FF-Helix (see column to the right)."* — the parenthetical helps Peleg's "two terms only" framing land.

**Files**:
- ~5-7 frontend files; no backend changes.

**Acceptance**:
- `grep -rn "FF-Helix %" ui/src --include="*.tsx"` returns 0 hits (or only the ones inside comments documenting the rename).
- `npx tsc --noEmit` clean.
- All 13 vitest specs that touch PeptideTable / Smart Ranking pass.
- Smoke-test on /results: the Helix-grouping cohort chart still says "FF-Helix" as a group name (it's the class). The Smart Ranking slider that was "FF-Helix %" now says "Helix %".

---

## V10-7 — Landing page quality push (homepage focus)

**Page**: `ui/src/pages/Index.tsx` (or wherever the current home lives).

**Driver**: Said's brief — "MSc student lands here from Google, decides in 8 seconds whether to upload their CSV." Current home is good; it needs to be best-in-class. Discoverability (Peleg PPT Comment 25 + Zoom-prep §3.7) routes through this page first.

**Brief**:
1. **Hero**: one sentence that answers "what is PVL". Use Peleg's framing — the α-helix → β-sheet switch is the differentiator vs. tools that predict β-sheet propensity directly. Don't lead with "all-in-one"; lead with *what we're uniquely able to predict*.
2. **Above-the-fold demo**: a 40-second silent demo loop showing a sequence going through Quick Analyze → Results → Peptide Detail. No narration, just smooth playback. Auto-plays on viewport entry, pauses on scroll-away, respects `prefers-reduced-motion`.
3. **5-surface ecosystem bar**: visible row showing "Web · CLI · pvl-py · MCP · Docker" with one-line value props. Each link routes to the relevant docs page (Wave 2.7 will produce those docs — for now, links can go to GitHub README sections).
4. **Social-proof bar**: contributor avatars (Said as lead developer, Dr. Peleg Ragonis-Bachar as algorithm collaborator, Dr. Alexander Golubev as scientific advisor) + the DESY / Technion / MIT-license badges.
5. **Three-card "who is PVL for"** below the demo: researcher (biology team), data scientist (programmatic users), AI engineer (MCP audience). One sentence each.
6. **Footer CTA**: paired buttons — "Run a quick analysis" (routes to /quick) + "Read the science" (routes to /about or, post-paper, to the JOSS/NAR paper). Both styled to look weighted equally — researcher mode and proof mode.

**Design discipline**:
- Light-first, no jumpy animations, no auto-playing audio.
- The hero typography should match the rest of the redesigned PVL — same `text-h1` token, same colour scale.
- No marketing-speak ("revolutionize", "unleash", "powerful"). Calm scientific tone.
- Mobile-first: the demo loop must work at 375px (smaller scrubber, same content).

**Out of scope**:
- The name change (Phase 3.7 of Zoom prep — wait until name decided).
- A "pricing" section (we are open-source MIT, no SaaS — confirmed in Zoom prep §3.6).
- An email-capture form (no email gating — confirmed).

**Files**:
- `ui/src/pages/Index.tsx` + any new components for hero, demo player, ecosystem bar, social proof.

**Acceptance**:
- Hero loads in <1.5s on 4G; demo loop preloads progressively.
- All copy approved by T1 before commit.
- `npx tsc --noEmit` clean.
- Lighthouse score ≥90 on Performance, Accessibility, Best Practices.

---

## V10-8 — Background design system (cohesive visual ID)

**Driver**: Said's brief — "scientific tool, not decorative noise."

**Mission**: define a 3-token background system that the whole site uses consistently:
- `bg-canvas` — the default off-white (current `--background`).
- `bg-elevated` — the panel surface for cards (subtle off-white shift, current `--surface-1`).
- `bg-deep` — the hero / home-only deep tone, with an optional subtle peptide silhouette pattern.

Plus three optional decorative "scene" tokens used sparingly:
- `scene-sequence-motif` — faint ribbon-trace SVG, used behind the About page hero.
- `scene-helix-mesh` — animated helix mesh (CSS-only, paused with `prefers-reduced-motion`), used on /quick when no result is loaded.
- `scene-aggregate-cluster` — static SVG cluster pattern, used on /results header.

**Design discipline**:
- Patterns at 5-8% opacity max. They must NOT compete with chart strokes (CHART_COLORS) or with peptide-class badges.
- All three "scene" tokens are opt-in per page, not global.
- Light-first; dark-mode variants are required for each.
- `prefers-reduced-motion` disables `scene-helix-mesh` animation entirely.

**Files**:
- `ui/src/index.css` (CSS variables).
- `ui/tailwind.config.ts` (token mapping).
- Up to 3 new SVG assets in `ui/src/assets/` (peptide motif, helix mesh, aggregate cluster).

**Acceptance**:
- Three background tokens used consistently on /, /results, /quick, /about, /help, /peptides/:id, /upload, /compare.
- `npx tsc --noEmit` clean.
- Visual audit: no chart bar/line ever shares an HSL family with the background pattern below it.

---

## Trigger conditions

- **V10-1 → V10-4**: original queue from Wave 2 polish. Pick order: V10-1 (About) → V10-2 (DrillDown) → V10-3 (scroll anims) → V10-4 (transitions).
- **V10-5 (Help page)**: TRIGGER NOW — Wave 2.6 landed (PR #75), Peleg's exact text is in this doc. Cowork can start as soon as available. T1 paste-checks Peleg's body text post-Zoom (Q-Help confirmations in `PELEG_ZOOM_PREP_2026_06_04.md` §5).
- **V10-6 ("FF-Helix %" rename)**: TRIGGER NOW — entirely UI-side, no Peleg dependency. Pair with V10-5 so they land in one PR.
- **V10-7 (Landing page)**: wait for V10-5 + V10-6 to land; this is the bigger visual lift and benefits from the cleaned-up classification language.
- **V10-8 (Background system)**: bundle with V10-7 since the landing page is where most new backgrounds appear.

Each is its own atomic Cowork prompt with PROMPT 0 + PRE-FLIGHT v2 framing. T1 writes the V10-N prompts when triggered. Cowork executes one at a time. T1 reviews + commits.
