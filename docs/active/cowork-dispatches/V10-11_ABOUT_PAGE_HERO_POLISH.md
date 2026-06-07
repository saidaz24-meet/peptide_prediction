# Cowork V10-11 — About page hero + section polish

**Status**: Queued (parked-list item; About page got content overhaul in PR #91, this is the visual layer).
**Trigger**: ready-to-dispatch the moment Cowork has capacity.
**Discipline**: PRE-FLIGHT v2 mandatory — read `ui/src/pages/About.tsx`, `ui/src/components/WaveBackground.tsx`, `ui/src/components/DatasetCreditCard.tsx`, the four credit blocks. Refactor in place.

---

## Why this matters

PR #91 (UI content audit) updated About page CONTENT — author order is correct, Peleg's ORCID is fixed, Prof. Landau is added, Key Features lists v0.3.0 deliverables. Now the page needs VISUAL polish to match the content level.

Today About has:
- A wave background (good — kept it)
- Hero title "Peptide Visual Lab" at text-7xl (good — kept it)
- "DESY · Landau Group" subtitle (good)
- Then immediately drops into the four credit blocks in plain `<Card>` containers stacked vertically

The credit blocks look like a TODO list, not a research-paper author block. Same with Key Features (good content, plain Card visual).

---

## Three deliverables

### 1. Credits card visual upgrade

**Current**: four vertical text blocks inside one `<Card>`. Each block: name + affiliation + role + ORCID link.

**Asks**:
- Each credit gets its own subtle "author card" treatment: small avatar circle (or initials in a circle if no photo), name in larger font, affiliation in monospace pill, role in body text, ORCID as a styled badge with the green ORCID logo (use the inline SVG, not an image)
- Order STAYS Ragonis-Bachar → Azaizah → Golubev → Landau — this is the canonical citation order per CITATION.cff and is wrong to reorder
- Each card hovers subtly on mouseover (border accent in the class colour pattern — Peleg uses helix purple, Said uses primary, Alex uses ssw blue, Landau uses ff-ssw red as a recognizable identity)
- Mobile at 375px: cards stack vertically with smaller avatars (or initial circles). No layout break.

### 2. Section dividers + scroll-reveal

**Current**: sections (About, Credits, Dataset, Key Features, Providers) are all `<Card>`s in a single column.

**Asks**:
- Subtle horizontal divider between sections (use the helix-mesh wireframe from V10-8 if that ships first, OR a 1px gradient line in the class colours)
- Each `<Card>` fades in on scroll using `framer-motion` `whileInView` + `viewport={{ once: true, amount: 0.2 }}`
- Respects `prefers-reduced-motion: reduce` — falls back to instant render
- This is consistent with V10-3 scroll-triggered animations dispatched earlier

### 3. ORCID + affiliation badges

**Current**: ORCID link is a small `<a>` underline; affiliation is a `<p>` of text-xs muted.

**Asks**:
- ORCID badge: inline SVG of the green ORCID logo + the 16-digit ID, with a styled rounded border. Hover state: full underline + ORCID's signature green colour.
- Affiliation pill: small rounded pill with a faint border, lowercase mono font, hover state shows full institution name + city in a tooltip
- These are reusable as `<OrcidBadge orcidId="0000-0002-0979-8165" />` and `<AffiliationPill name="Technion" full="Technion — Israel Institute of Technology" location="Haifa, Israel" />` so they ship as exportable components for use elsewhere (e.g. PeptideDetail authorship blocks for dataset credits)

---

## Acceptance test (Said browser eyes)

- `/about` loads with the same hero + four credit cards
- Each credit has its own visual identity (initial circle, accent colour, ORCID badge)
- ORCID badges all link to the right ORCID URLs (verify with PR #91's test assertions)
- Scroll down the page → each `<Card>` fades in once
- Mobile at 375px: credit cards stack cleanly, avatars scale down, no horizontal scroll
- `prefers-reduced-motion: reduce` → animations replaced with instant render
- Light + dark mode parity

---

## Discipline

- PRE-FLIGHT v2: read About.tsx + the credit-related test file (`ui/src/pages/__tests__/About.test.tsx`) to make sure the testIds (`credit-said`, `credit-peleg`, `credit-alex`, `credit-landau`, `said-orcid`, `peleg-orcid`, `landau-orcid`) survive.
- DO NOT change credit ORDER. Don't change credit CONTENT — that was a Peleg-sensitive update in PR #91.
- New `OrcidBadge` + `AffiliationPill` components in `ui/src/components/badges/`. Not sprinkled inline across credits.
- Light + dark mode parity.
- No emojis.

---

## What this UNBLOCKS

- An About page that signals "research instrument" instead of "side project"
- Reusable `OrcidBadge` + `AffiliationPill` for PeptideDetail dataset credits and the PDF report cover
- A pattern Cowork can replicate on the Landing page (V10-7) and the eventual JOSS publication landing
