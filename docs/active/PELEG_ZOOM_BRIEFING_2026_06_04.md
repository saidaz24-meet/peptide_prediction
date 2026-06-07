# Pre-Zoom briefing — 4 things to understand before the call

Tight, no-fluff. Read in 10 minutes. Internalize, then walk into the call.

---

## §1 — MCP vs RAG vs PubMed/PMC federation (the thing I kept blurring)

### The clean separation

**MCP** = a transport. It's HOW an AI assistant talks to PVL.
**RAG** = a grounding technique. It's HOW the AI gets *real citations* instead of inventing fake ones.
**PubMed/PMC federation** = WHERE the citations come from (the literature corpus).

They are orthogonal. They stack:
- MCP today (✅ shipped 2026-05-12) — the AI can press buttons in PVL.
- RAG tomorrow (Phase G2, queued) — the AI can read papers and cite them.
- MCP + RAG = the AI runs a PVL analysis *and* explains it with cited literature.

### What MCP does (already live)

MCP exposes PVL's analysis tools to any AI assistant that speaks the Model Context Protocol — Claude Desktop, Cursor, Continue, Cline, Windsurf. The tools are:
- `analyse_sequence` (single peptide)
- `get_peptide_detail` (deep dive on one)
- `rank_candidates` (Smart Ranking across a list)
- `compare_cohorts` (FF-Helix-positive vs negative biochem comparison)
- `find_similar` (sequence similarity)

A researcher who installs PVL's MCP server says into their AI: *"Screen these 50 sequences for amyloid candidates and rank by FF-Helix score."* The assistant orchestrates the tool calls, gets back JSON, presents it. The data comes from PVL.

**Limit of MCP alone**: the AI can answer *PVL questions* — "what's the FF-Helix score of this peptide?" — but cannot answer *literature questions* — "has anyone published on this peptide?"

### What RAG adds (queued, Phase G2)

RAG = Retrieval-Augmented Generation. Three steps:
1. **Retrieve**: query PubMed/PMC for relevant papers (using the peptide sequence + class + score as query terms). Hand back the top N abstracts.
2. **Augment**: insert those abstracts into the LLM's context window.
3. **Generate**: the LLM answers the user's question *grounded in those abstracts*, citing them by PMID.

Without RAG: *"This peptide is amyloidogenic."* (no source — could be made up)
With RAG: *"This peptide is amyloidogenic per Balbach et al. 2000 (PMID 11052685), consistent with the KLVFFAE fragment work in Tycko 2014 (PMID 24905028)."*

### Question types RAG would answer (concrete)

- *"What do we know about this sequence from the literature?"*
- *"Has anyone experimentally tested this peptide for fibril formation? What conditions?"*
- *"Are there structural studies — NMR, X-ray, cryo-EM — on this peptide family?"*
- *"What organism / protein family is this sequence from?"*
- *"What's the prior on this peptide being amyloidogenic, based on similar sequences in the literature?"*

### Why this isn't shipped yet

Two hard problems:
1. **Hallucinated citations.** A bare LLM will confidently invent "Smith et al. 2018, PMID 12345678" that doesn't exist. RAG with weak retrieval cites the *wrong* paper. Both are worse than "I don't know" in a scientific tool.
2. **Corpus curation.** We need to build a literature vector database (which embedding model? Re-indexed how often? Filtered to which journals? Pre-prints included?). This is engineering plus scientific co-design — needs Peleg's input on what "good cite-grounded answer" looks like in our domain.

### Single-line script for Peleg

> "MCP is shipped — it lets an AI run PVL. RAG is queued — when it ships, the AI will also cite real papers from PubMed when it explains a peptide. They stack: MCP gives the analysis, RAG gives the literature context. The hard problem with RAG is preventing hallucinated citations, which is why I want your input on what 'good' looks like before I commit to the engineering."

---

## §2 — How we reach young researchers (concrete, not "post on LinkedIn")

### Why LinkedIn isn't enough

LinkedIn reaches PIs, not students. MSc/PhD students searching for tools land on three places: **bio.tools**, **Google Scholar**, **a peer's recommendation in lab Slack**. Our job is to be present in all three.

### The 10-step adoption sequence

1. **Decide the name** (Zoom decision — current shortlist: FibrilLens, AmyloPath, ChameleonPep, Helix2Sheet, SwitchScope, PepMorph).
2. **Register the domain** (`name.app`, `name.science`, or `name.bio`).
3. **Get the Ragonis-Bachar / Rayan DOI from Peleg** → cite it everywhere → ask her to reference PVL in any new submission. One citation from her lab is worth 50 LinkedIn posts.
4. **Register the bio.tools entry** with full structured metadata (description, EDAM ontology terms for "fibril formation prediction", input/output formats, license, biotool topics). bio.tools is THE canonical bioinformatics directory — students literature-search it.
5. **Cut a Zenodo release** linked to the GitHub tag → get a citable DOI → indexed by Google Scholar within weeks → appears in citation chains.
6. **Submit a JOSS paper** for the software publication (open, fast, free, no APC). JOSS has its own RSS feed that bioinformatics people watch.
7. **Schedule a 30-minute intro demo** with Peleg's old lab + 2-3 Technion postdocs. One hands-on session with 10 PhD students moves the needle more than 100 social posts.
8. **Post on the right communities**: r/bioinformatics, BioStars, Bioinformatics Stack Exchange. One quality answer with a PVL link reaches the long tail.
9. **Reach out to PhD program mailing lists**: Tel Aviv U, Technion, Weizmann, Hebrew U structural biology / biochemistry programs. Single email to each program coordinator.
10. **Become the default reference** in literature reviews — happens organically once steps 3-6 are in place and one or two papers cite PVL.

### "SEO / algorithm maximizing" — what that actually means

It's mostly four things:
1. **The name must be searchable.** "PVL" returns 50 unrelated meanings. A specific scientific name (e.g. "FibrilLens") returns us. This is why Peleg said rename.
2. **Schema.org structured data** on the homepage (`SoftwareApplication` markup). Lets Google understand the site is a scientific tool, not a blog.
3. **Backlinks from authoritative sites**: bio.tools entry, Zenodo record, JOSS paper, GitHub README. Each backlink raises domain authority for organic search.
4. **Open Graph + Twitter Card meta** so any shared link renders with a preview, not a blank URL.

There is no magic algorithm. There is "do these four things in the right order and Google ranks you within 3 months."

### Concrete ask for Peleg

> "Would you co-host a 30-minute intro demo with your old lab and 2-3 Technion postdocs in early August? Hands-on with their actual sequences. That's the single biggest adoption lever I can think of, and it costs you half a Tuesday afternoon."

### What I'd skip

- Paid Google Ads (waste of money for a scientific tool — Google ads do not move PhD students).
- LinkedIn boost posts (same — students aren't on LinkedIn).
- Twitter/X campaign (post organically, don't pay).

---

## §3 — The thresholds — where each one comes from

Minimalistic. One line per threshold: what it gates, default value, what the default is *based on*.

### Group A — Helix detection (S4PRED-driven)

| Threshold | Default | Gates | Source of default |
|---|---|---|---|
| `MIN_S4PRED_SCORE` | 0.5 | Per-residue: is this residue counted as "helical"? | Peleg's "for now" value — needs experimental retesting |
| `MIN_HELIX_PERCENT_CONTENT` | 0 (%) | Sequence-level: does the peptide qualify as Helix class? | Peleg default — 0 means "any non-zero content counts" |

### Group B — Helix segment detection (used by both Helix and SSW)

| Threshold | Default | Gates | Source of default |
|---|---|---|---|
| `MIN_SEGMENT_LENGTH` | 5 residues | Minimum continuous run to be called a "fragment" | Peleg — short enough to catch β-hairpin precursors |
| `MAX_GAP` | 3 residues | Two fragments separated by ≤ this many residues get merged into one | Peleg — explains why a single non-helical residue surrounded by helix still gets the helix colour |

### Group C — SSW classification (helix-beta indecision)

| Threshold | Default | Gates | Source of default |
|---|---|---|---|
| `S4PRED_MAX_HELIX_BETA_DIFF` | 0.03 | If \|P(helix) − P(beta)\| < this for S4PRED, sequence is "indecisive" → SSW candidate | Peleg "needs to be tested" — empirical |
| `TANGO_MAX_HELIX_BETA_DIFF` | 3 | Same rule, TANGO scores | Peleg "needs to be tested" — empirical |
| `MIN_SS_PERCENT_CONTENT` | 0 (%) | Minimum % secondary-structure content for SSW classification | Peleg default — 0 means no floor |

### Group D — FF-Helix candidate gating

| Threshold | Default | Gates | Source of default |
|---|---|---|---|
| `FF_HELIX_THRESHOLD` | 1.0 | Per-window Fauchère-Pliska helix propensity ≥ this counts as helix-prone | Standard Fauchère-Pliska scale — propensity > 1.0 = above average |
| `FF_HELIX_CORE_LEN` | 6 residues | Sliding window size for the propensity calc | Standard for short-segment helix prediction |
| `PELEG_DEFAULT_HELIX_UH_THRESHOLD` | 0.388 | μH cutoff for FF-Helix candidate (when no cohort to compute database mean) | **Ragonis-Bachar & Rayan calibration** (NOT Eisenberg) — Peleg-confirmed 2026-05-22; DOI pending |

### Group E — FF-SSW candidate gating

| Threshold | Default | Gates | Source of default |
|---|---|---|---|
| `PELEG_DEFAULT_HYDRO_THRESHOLD` | 0.417 | Hydrophobicity cutoff for FF-SSW candidate (single-sequence fallback) | **Ragonis-Bachar & Rayan calibration** — DOI pending |

### Group F — Pipeline length cap (NEW, Peleg-set 2026-06-03)

| Threshold | Default | Gates | Source of default |
|---|---|---|---|
| `PEPTIDE_LENGTH_HARD_MAX` | 40 aa | Above this, sequence is skipped — surface-vs-structure problem | Peleg explicit, 2026-06-03 |
| `PEPTIDE_LENGTH_USER_OVERRIDE_MIN` | 10 aa | Lowest value user can override to | Peleg explicit |
| `PEPTIDE_LENGTH_USER_OVERRIDE_MAX` | 40 aa | Highest value user can override to | Peleg explicit |
| `PEPTIDE_LENGTH_TANGO_MIN` | 5 aa | TANGO's hard minimum | TANGO documentation |

### The honest summary line for Peleg

> "Two-tier sourcing. The FF-Helix μH and FF-SSW hydrophobicity defaults come from your computational work with Bader — Ragonis-Bachar & Rayan calibration, which is what we cite. The segment-detection rules (5 residues minimum, gap ≤ 3) are your defaults. The classification thresholds (0.03 helix-beta diff for S4PRED, 3 for TANGO) are 'needs to be tested' — empirical, flagged. The length cap (40 aa) is your new direction. Everything user-adjustable, every change traceable."

---

## §4 — Negative controls — what Peleg is missing, in one paragraph

### The misunderstanding, plain

When she sees "negative controls" in our doc, Peleg reads it as a **biological claim** — *"these peptides do not form fibrils."* And she's right that this is a wrong claim to make. Fibril formation is environmentally conditional. "Did not form fibril in tested conditions X" does not mean "will not form fibril in any condition." So if we asserted "Poly-GS is a negative control for amyloid", that would be scientifically sloppy.

But that's **not what they were doing in our test suite.** They are *software regression tests*. Their job: if we change PVL's code, the calculated FF-Helix value for Poly-GS must not drift. They're testing the *software*, not making biological claims about the *peptides*.

The communication gap is one word: "control" implied biological control. We meant "canary in the code mine".

### What to say to her, short

> "You're right that there's no true negative control in the fibril field — and that's why we shouldn't call them that. The Poly-GS and Poly-E entries in our test suite are software regression tests, not biological assertions. Their job is to fail loudly if a code refactor accidentally changes the FF-Helix calculation. We picked low-feature sequences for stable numeric outputs across versions, not because we're claiming they can't form fibrils. We're renaming them 'regression canaries' to drop the misleading 'control' language. The biological framing in the paper uses your wording: 'did not form fibrils in the conditions tested', and only where we actually have experimental data."

### If she presses on "regression canaries"

If she still doesn't like the new term, alternatives:
- "Reference fixtures"
- "Numerical regression set"
- "Calculation baselines"
- "Code-stability witnesses"

Let her pick.

### What NOT to do

- Don't argue that "negative control" is fine in software-testing jargon. It is, but the audience here is biological — she's right to push back.
- Don't try to convince her that we're using these for biological assertions. We're not, and saying we are makes us look careless.
- Don't bring this up unless she does. It's a doc-language fix, not a science fix.

---

## Quick cross-references

- The Zoom-prep doc (full, 4900 words): `docs/active/PELEG_ZOOM_PREP_2026_06_04.md`
- The 5-surface ecosystem reference: `docs/active/ECOSYSTEM_GUIDE.md`
- The V2 follow-up doc (her last batch of answers folded in): `docs/active/PELEG_FOLLOWUP_DOC_V2.md`
- Memory record of her 2026-06-03 answers: `~/.claude/projects/.../memory/project_peleg_authoritative_answers_2026_06_03.md`
