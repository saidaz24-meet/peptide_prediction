# Peleg follow-up — Packet 2: everything PVL became since the redesign

**Purpose**: companion to `PELEG_FOLLOWUP_TECHNICAL_PACKET.md` (which answers her PDF). This packet covers what Claude chat asked for: everything we built that *isn't* tied to her review, so she has a complete picture of where PVL is — plus the MCP decision rationale, and our commitment level on the validation findings.

**Said**: hand both packets to Claude chat together. Tell it: "Packet 1 answers her PDF; Packet 2 brings her up to speed on everything else and includes the MCP centerpiece. The email should weave them — not two separate sections."

**Reference cutoff**: 2026-04-01 — date Phase D1 visual redesign (Stripe-level light-first landing, sidebar redesign) shipped. Everything *after* this is fair game.

---

## §0 — Quick frame for Peleg (humanize this)

Since the last full review, PVL went from "a working web tool with good visuals" to "an open, AI-extensible scientific platform with reproducibility built into every analysis." The visible work in her PDF was one slice of that. The bigger story: PVL now has a multi-surface architecture (web + AI integration + Python package + CLI), every analysis encodes its own provenance into the URL, the prediction layer has formal contracts pinned to tests, and the codebase is in a state where external reviewers (Codex, CodeRabbit) can audit it line-by-line.

She should know all of this when she's evaluating whether PVL is paper-ready and what citation-grade claim we can make.

---

## §1 — New scientific & functional capabilities (what a researcher sees)

These are visible on the live site and not in her PDF. Each is one-line.

### Analysis surfaces

- **AlphaFold 3D structure overlay (Mol*).** When a peptide has a UniProt accession, PVL fetches the AlphaFold-predicted structure and renders it via Mol*. TANGO aggregation peaks, S4PRED helix segments, and FF-Helix candidate regions are painted onto the 3D model. Users can rotate, zoom, color by classification, and screenshot.
- **Reproducibility-as-permalink.** Every analysis state — dataset hash, predictor versions, active thresholds, ranking weights, selected peptide — encodes into the URL. Paste a URL into a paper, the reviewer sees exactly your view. Citation block + BibTeX auto-generates from the same state.
- **Smart Candidate Ranking with proportional weights.** Multi-signal ranking: hydrophobicity, charge, µH, FF-Helix %, S4PRED helix score, SSW score, TANGO aggregation max. Weight sliders sum to 100. Presets: Equal / Helix Focus / Switch Focus / Amyloid Focus. Direction toggles per metric.
- **Cohort comparison dashboard.** Side-by-side comparison of two cohorts (mutant vs wild-type, treated vs control) with overlay distributions and KPI delta table. Statistical tests: chi-squared for proportions, t-test for continuous.
- **FASTA bulk upload.** Drag-drop `.fasta` / `.fa` files alongside CSV/TSV/XLSX. Browser-side preview ("N sequences detected, first 3 entries shown") before submit.
- **UniProt direct query.** Search by accession, keyword, organism, or compound (`keyword:antimicrobial AND organism_id:9606`). Pagination handled. Returns canonical PVL row format.
- **Sliding-window biochemistry profiles.** Per-residue hydrophobicity, charge, µH, plus customizable window size. Standard for AMP/amphipathic-helix work.
- **Helical wheel projection (Schiffer-Edmundson).** 18-residue axial view with hydrophobic-moment direction vector. SVG + PNG export per peptide.

### Workflow surfaces

- **Threshold tuner with live re-classification.** Move a slider, see KPIs and the candidate list update without re-running the predictors. All threshold metadata persists into the permalink so the URL reproduces the threshold state.
- **Quick Analyze.** Single-sequence path: paste, predict, see the full per-residue + biochemistry view in seconds. No file upload needed.
- **Database Search.** Indexed in-memory search across the current cohort by accession, gene name, organism, sequence pattern.
- **Re-run / Reproduce button.** One-click re-execution of the previous analysis with identical parameters. Useful when reviewing a paper figure or sharing a permalink internally.
- **Cancel-in-flight.** Long analyses can be cancelled mid-stream. Backend acknowledges and stops cleanly; sidebar pill reflects state.
- **Sidebar job indicator.** A persistent status pill that survives page navigation. Lets a researcher start an analysis, browse other peptides while it runs, and come back when it's done.

### Export & publication

- **One-click paper figure pack.** Multi-panel SVG bundle ready for journal supplements: classification table, multi-peptide radar overlay, aggregation propensity profile, methods text with active thresholds. Cover page and reproducibility permalink embedded in the methods panel.
- **PDF shortlist report.** Top-N ranked candidates with active thresholds and methods summary.
- **BibTeX with methods.** Auto-generated methods text + citation block. Drops directly into a manuscript.
- **Per-chart SVG/PNG export.** Every chart has a download button. SVGs are journal-ready vector graphics.
- **FASTA / CSV export.** Filtered candidate lists out as FASTA for next-step assays or CSV for spreadsheet workflows.

### Quality-of-life

- **Progressive disclosure on PeptideDetail.** Open layout, classification pills first, function annotation collapsible, AlphaFold + biochemistry profiles below. Avoids the "everything visible at once" overwhelm.
- **Light-first design with dark-mode auto-detect.** Stripe-quality typography (Inter for prose, JetBrains Mono for sequences). Calm animations (Framer Motion with smooth ease curves).
- **Mobile-responsive.** All pages render down to 375 px. Tested with actual researchers on phones.
- **Provider status surfaced everywhere.** If TANGO is OFF or unavailable, the user sees it as a badge on every relevant row + a top-of-page warning. No silent failures.
- **Sentry observability.** Every error in the live app reports to Sentry with full breadcrumbs, session replay (errors only), version correlation, and release tagging. Said + the team see issues before users report them.
- **Sentry source maps + CodeRabbit AI review on every PR.** Issues are debuggable to specific lines in TypeScript source; every PR gets an AI second-opinion before merge.

---

## §2 — Architectural moves (what the platform became)

These are the strategic shifts. Important context for how Peleg should think about PVL's identity.

### Multi-surface, not just a web app

PVL is now four surfaces sharing one canonical scientific pipeline:

1. **Web app** — what Peleg has been reviewing. The visible product.
2. **MCP server (Phase G1 — already live)** — see §4 below. Any AI assistant that speaks Model Context Protocol (Claude Desktop, Cursor, Continue, others coming) can invoke PVL's tools: list peptides, get peptide detail, rank candidates, compare cohorts, find similar peptides. This means a researcher with Claude Desktop installed can say "find me amyloid candidates in my latest batch" and Claude does the PVL call directly.
3. **`pvl-py` Python package (scaffolded, paper-push timing)** — `pip install pvl` then `from pvl import predict` for in-notebook use. Useful for biophysics/structural-bio groups working in Jupyter.
4. **`pvl-cli` (scaffolded)** — `pvl predict input.fasta --threshold-preset strict --out results.csv` for HPC / pipeline integration. Useful for screening at scale.

All four surfaces hit the same backend services. Single source of truth. No drift.

### Reproducibility built into the schema

- **Permalink encodes**: dataset hash + PVL version + predictor versions + active thresholds + ranking weights + active tab + selected peptide.
- **CITATION.cff** ships with the repo. Versions tracked.
- **MIT LICENSE** as of 2026-05-20 (was inconsistent — Peleg may want to weigh in on a DESY-research alongside license — see Packet 1 §9).
- **API contracts** declared in Pydantic schemas (`backend/schemas/api_models.py`). Frontend + backend pinned to the same shape via `make contract-check`.

### Formal scientific contracts pinned to tests

This is new since her PDF — every classification rule has a regression test:

- **FF-SSW axiom** (`ffSswFlag → sswPrediction`) — 9 invariant tests pin the contract. The fix that closed her FF-SSW Slack question (`P85089`, `P0C005` displaying contradictions) is now impossible to regress silently.
- **Mirror axiom** (`ffHelixFlag → s4predHelixPrediction`) — same coverage.
- **Per-predictor verdict preservation** (4 new tests today, 2026-05-20) — TANGO's raw subprocess output is preserved verbatim through the schema and rendered honestly in the UI even when the unified mask disagrees. The Anoplin case that triggered this is pinned.
- **Single-vs-batch parity** (existing) — single-peptide Quick Analyze and batch upload MUST produce byte-identical results for the same sequence + thresholds.
- **Null semantics** (`-1 = predicted negative`, `null = no data`) — enforced at the API serialization boundary by `_enforce_ff_axioms` defense layer.
- **Canary peptide suite** (13 tests, landed 2026-05-21) — see Packet 1 §11 and below.

### Vector similarity search (Phase D, ESM-2)

LanceDB-backed embedding store. ESM-2 8M (Lin et al., Science 2023) generates a 320-dim embedding per peptide. Users can query "find peptides similar to my reference." Currently best-effort indexing (runs in a background thread after each analysis — no impact on critical-path latency). Wave 2 work, shipped post-redesign.

### Observability

- **Sentry**: source maps, version correlation, release tagging, custom alerts, replay sampling (errors only — quota-safe).
- **CodeRabbit**: AI review on every PR.
- **CI/CD** with auto-deploy to the VPS on every merge to main.
- **GitHub Actions** deploy workflow is host-agnostic — switching to DESY VM is a 4-secret edit, not a code change. Pre-emptive design choice when the Hetzner VPS is replaced.

---

## §3 — Quality, rigor, and the codebase as a whole

These matter for the paper because external reviewers will ask "is this maintained, tested, and scientifically auditable?"

- **1214 tests passing** as of 2026-06-03:
  - 606 backend (pytest, deterministic, no network, USE_TANGO=0 USE_S4PRED=0 friendly for CI speed)
  - 608 frontend (Vitest + jsdom)
  - 14 canary peptide tests pinning predictions against literature (incl. KLVFFAE / Aβ16-22 added Wave 2.6)
  - 13 axiom invariant tests
- **`npx tsc --noEmit`** clean across all of `ui/src`
- **CI green on every PR** for the entire history since the redesign
- **CodeRabbit AI review** on every PR — second opinion before merge
- **TDD-first workflow** documented in `CLAUDE.md` (test first, minimal impl, refactor, edge cases)
- **Open-source MIT** as of 2026-05-20 — citation-ready, JOSS-eligible, Zenodo DOI path queued
- **CONTRIBUTING.md + AGENTS.md** govern multi-terminal contribution model (T1 orchestrator, T2 backend, T3 frontend, T5 research, T6 ops, T-PEL Peleg-feedback processor, plus Cowork for visuals)

For a paper supplement, the relevant claim is: "PVL is open-source, MIT-licensed, has 1214 deterministic tests covering the prediction contract, and is built with formal axioms enforced at the API boundary that make scientific regressions impossible to ship silently." Reviewers can clone the repo and audit any prediction line-by-line.

---

## §4 — THE MCP DECISION (the centerpiece per Claude chat)

This is the question Claude chat asked Said to answer. Said: this is your framing — feel free to push back on the rationale per option below.

### The fork-in-the-road moment (2026-04-15ish)

After the D1 redesign shipped, the question became: **what's PVL's distribution model?** A working web app is necessary but not sufficient. Researchers don't change tools easily. We needed a path that meets them where they are.

We weighed seven realistic options:

### Option A — Just a public shareable link (simplest)

**The pitch**: PVL lives at a URL. Researcher visits, uses tool. Word-of-mouth spreads adoption.

**Why we did this** (we kept it as the baseline): zero friction, no auth, no install, instant trial. The live URL is the front door — required.

**Why it's insufficient on its own**: no programmatic access, no integration with downstream pipelines, no AI-assisted workflows, no way for a researcher's existing tools to call PVL automatically. A tool that only works through a browser tab in 2026 is invisible to the AI-native workflows researchers are increasingly using.

### Option B — Full SaaS with auth, plans, billing

**The pitch**: Stripe-style. User accounts, history, saved analyses, paid tiers for compute.

**Why we ruled it down**: cultural fit. Academic biophysics/structural-bio groups expect open tools. Asking Peleg's collaborators (or Alex's EMBL/DESY contacts) to create an account + pay a subscription before they can use PVL would kill adoption. The MIT-licensed open-source path is the right cultural choice for our audience. We can revisit if there's ever a non-academic use case asking for it.

**What we kept from this**: the user-history idea, but solved differently — via reproducibility permalinks. Researchers don't need accounts to save state; they save URLs.

### Option C — White-label embedding for other labs

**The pitch**: provide an embeddable widget + theming so other labs can drop PVL into their internal apps.

**Why we ruled it down**: it sounds appealing but creates a maintenance hell. Every embedder pins a snapshot of PVL; bug fixes don't propagate. Each lab's "version of PVL" diverges. No central observability — we can't see what's failing in the field. Also: most academic labs don't have a "web infrastructure team" to embed anything.

**What we kept from this**: the open-source repo + `docker compose up` self-host path covers the same use case without the diverged-snapshot problem. A lab that wants PVL on their internal network clones the repo and deploys their own — they get our updates by pulling.

### Option D — MCP wrapper (where we landed for AI integration)

**The pitch**: Model Context Protocol is Anthropic's open spec for letting AI assistants discover and invoke tools. We write an MCP server that exposes PVL's analysis primitives (`get_peptide_detail`, `rank_candidates`, `compare_cohorts`, `find_similar`, `analyse_sequence`). Any MCP-aware AI assistant — Claude Desktop, Cursor, Continue, future Copilot variants — can call PVL on the user's behalf.

**Why we picked this**: it's the single move with the highest leverage on adoption. A researcher running Claude Desktop with the PVL MCP server installed can say, in plain English, "screen these 50 sequences for amyloid candidates" and Claude orchestrates the calls, formats the results, and lets them iterate. We don't have to build the chat UI — Claude / Cursor / etc. already did. We just expose the science.

**Where we landed**: **Shipped and live as of 2026-05-12**. The MCP server is at `mcp_server/pvl_mcp/`, pip-installable (`cd mcp_server && pip install -e .`), with two transports (stdio for desktop assistants, SSE for web/remote clients). README documents config for Claude Desktop, Cursor, Continue, Cline, and Windsurf. Any researcher who installs and configures it gets PVL as a natural-language-callable tool in their assistant today — no waiting on roadmap, no future timeline. This is Peleg's Drive Comment 23 confirmation: "So.. if I am understanding correctly this is something you already implemented?" — yes.

**Tradeoff**: requires the researcher to do a one-time install + assistant config. We accept this friction because the alternative (no AI integration) is worse, and the install is a single `pip install` plus a JSON config block.

### Option E — Standalone AI chat app

**The pitch**: build a PVL-branded chatbot UI on top of an LLM. "PVL Chat" — type in plain English, get answers.

**Why we ruled it down**: massive engineering effort to build a chatbot that competes with Claude Desktop / ChatGPT / Cursor UI. Maintenance burden for an undifferentiated wrapper. The science is what's hard, not the chat UI — and Anthropic et al. ship better chat UI than we ever will.

**What we kept from this**: the goal (let researchers query PVL in natural language) is met by Option D — they use *their* AI assistant, with PVL as a tool. Better separation of concerns.

### Option F — Benchling / ELN plugin

**The pitch**: Benchling is the dominant electronic-lab-notebook platform in biopharma. Build a plugin that lets Benchling users call PVL on sequences in their notebook.

**Why we ruled it down for now**: Benchling-locked. Requires their developer-program approval. Doesn't help the majority of structural biology / academic labs that don't use Benchling (DESY, Technion, most EMBL groups use other tooling or none at all). Also: Benchling is a closed commercial product; we're MIT-licensed open-source. Cultural mismatch.

**Future-defer**: revisit when (a) MCP is established + working, (b) a Benchling-shop collaborator actually asks for it. The MCP work gives us a strong base to add ELN-specific surfaces later without rewriting.

### Option G — PubMed/PMC federation (RAG over papers — Alex's vision, Phase G2)

**The pitch**: cite-grounded AI responses. When the AI says "this peptide is likely amyloidogenic," it cites a paper. Built on top of PubMed + PMC + maybe BioRxiv full-text.

**Why this is queued, not shipped**: real engineering effort (vector DB at journal scale, citation-grounding logic, hallucination guardrails) AND requires the kind of scientific co-design that needs Peleg + Alex in the loop. We don't want to ship a citation system that confidently mis-cites — that would be worse than no citation. So it's queued behind: the MCP base (Option D, done), the validation methodology (T5, done), and Peleg's input on what "good" looks like for cite-grounded scientific assistance.

**Timing**: Wave 3+, after Maxwell access lands + DESY VM migration so we have the compute headroom.

### Where this lands net

PVL's distribution model = **public web app (front door for researchers) + MCP server (back door for AI-native workflows) + open-source repo (self-host for labs that need it) + Python/CLI ecosystem (for in-notebook + HPC integration)**. Four surfaces, one pipeline, all open. The MCP move is the most strategically novel of the four — most peptide-prediction tools are web-only.

For Peleg's understanding: this isn't ambition for ambition's sake. The MCP surface meaningfully increases the chance that PVL gets used in actual research workflows in 2026-2027, when AI-native scientific tooling is the default not the exception. We're betting that AI-native distribution is the right bet for academic tools and don't want to ship a tool that's already legacy on launch day.

---

## §5 — Validation finding commitment level (the answer Claude chat asked for)

**Question**: on "disclose, don't retune" for FF-Helix / FF-SSW — are you 95% committed (and inviting Peleg to push back at the margins), or 70% (genuinely open to her saying "actually, let's retune")?

**Answer**: **95% committed on "no threshold cutoff fixes this." 60-70% open on "the right framing or feature set might fix it differently."**

Two-part stance:

### Part A — 95% committed: threshold tuning is not the answer

The validation evidence is hard:

- **F1 ≤ 0.385 across all hydrophobicity cutoffs from 0 to 1.5** on the labeled subset. We ran the sweep. No cutoff inside our search space rescues the metric.
- **The biology says it shouldn't**: PSM-α1 vs PSM-α2 differ by Δhydro = 0.008, ΔµH = 0.012. The signal that experimentally distinguishes them is below any threshold we'd defensibly draw.
- **The 97% AMP-positive rate is systematic**, not noise. We're not seeing a few outliers — we're seeing a structural class of peptides that hits our rule trivially.

Peleg can push back at the margins — for example, "are you sure you tested cutoffs at 1.7 and 2.0?" — and we'll rerun the sweep. But the position "the current threshold rules can be tuned to discriminate AMPs from amyloid formers" is one we'll defend hard, with the brief's data.

### Part B — Peleg's resolved positions (2026-05-22 Drive comments)

**Updated 2026-06-03** — Peleg replied to all four exploratory items above. Their status:

1. **Feature engineering** (UniProt keyword surfacing) — **APPROVED with a caveat**. Drive Comment 8: keyword chips on each peptide row are valuable. AMP-downweight in the ranker should be opt-in (toggle off by default) — she does not want this auto-applied. Wave 2.6 backend work scheduled.
2. **Different scoring rule entirely** — **REJECTED by Peleg in Drive Comment 9**: *"at this point this is really not feasible. in order to test a new set of features we need much much more examples than what we have."* Dropping this path; PVL stays with the current sequence-derived heuristic + threshold approach.
3. **Splitting the positive class** — **REJECTED in Drive Comment 10**: *"Not sure how it is different than what we already have. we already provide a secondary structure switch flag, and an fibril forming secondary structure switch flag."* PVL already has the broader SSW and narrower FF-SSW pair — we were proposing to duplicate existing structure. Dropping.
4. **Different validation set** — **NOT AVAILABLE** per Drive Comment 11. Peleg's two reasons: (a) most published work doesn't try to characterize multi-state SSW behavior, so there's no second labeled dataset she trusts; (b) fibril formation is conditional on environmental conditions, so any "did not form fibrils" call is provisional. Staphylococcus 2023 is what we use. The paper limitations section will state this explicitly.

So of the four exploratory items, only the first (UniProt keyword chip + opt-in downweight) survives. Wave 2.6 ships that.

### The framing question

The §11.7 disclosure paragraph (in Packet 1) uses "amphipathic conformational switch candidate" as the alternative interpretation. **We're open to better phrasing from her.** Specifically:

- Is "amphipathic conformational switch candidate" the right scientific term? Or does she prefer something like "amphipathic α-helical candidate" / "candidate amphipathic peptide" / something else?
- The 97% AMP positive rate: state it directly in the UI tooltip, or keep that depth for Help.tsx + the validation brief?

These are wording questions, not science questions. She'll have strong opinions; we'll defer to them.

---

## §6 — New open questions for Peleg (beyond her PDF)

Things we'd like her input on that weren't in her review document:

1. **DESY-research license alongside MIT?** We switched to MIT 2026-05-20. If DESY policy or her institutional comfort prefers a dual-license (MIT for community + DESY-research for closer collaborators), tell us — we can layer it. See Packet 1 §9.
2. **AlphaFold structural overlay framing.** We overlay TANGO peaks + S4PRED helix segments onto AlphaFold structures via Mol*. Reviewers might object that AlphaFold structures aren't experimental. How do we want to frame this in the UI + paper? Options: "predicted structure" disclaimer banner / link to AlphaFold confidence scores / restrict overlay to high-pLDDT regions only.
3. **Reproducibility-as-permalink scientific framing.** This is novel for a peptide-prediction tool. Worth its own paragraph in the paper. Wants her view on how to position it: "deterministic reproducibility" / "reviewer-friendly state-encoding" / "citable URL"?
4. **MCP exposure scope.** The MCP server currently exposes get_peptide_detail, rank_candidates, compare_cohorts, find_similar, analyse_sequence. Are there other primitives she'd want exposed? Or anything she'd want NOT exposed (e.g. the Beta % calculation since she flagged it)?
5. **Canary peptide suite — additions?** We have 13 canaries (4 amyloid positive controls, 5 known-FP AMPs, 2 negative controls, 2 metadata). She knows the field — are there 2-3 specific peptides she'd add that are diagnostic of common failure modes she's seen in other tools?
6. **Paper figure pack panel choices.** Current panels: Classification Table, Multi-peptide Radar, Aggregation Profile, Methods + Reproducibility Permalink. Is there a 5th she'd want as default? (Helical wheel of selected? Per-residue secondary structure ribbon? Sequence alignment?)
7. **Validation set ownership.** The Staphylococcus 2023 set is from her group, with experimental TEM Fibrils labels. Is the framing "PVL validated against the Ragonis-Bachar / Landau group benchmark" the right attribution? Or should we cite the public release / a different framing?

---

## §7 — What's in flight / coming next (transparency)

Honest about where we are. She'll appreciate knowing.

### Landing this week (Wave 2.5 lock-in)

- **Tab persistence** (B1) — reloading `/results` stays on the tab the user was on
- **Threshold persistence via permalink-decode** (B2) — shareable URLs restore filter state
- **Quick Analyze badge symmetry** (B3) — Helix/SSW/FF-Helix/FF-SSW all visible, with a "default thresholds" pill when no cohort loaded
- **Progress stage labels** (B4b) — researcher sees "Running TANGO" / "Running S4PRED" / "Computing biochemistry" instead of opaque spinner
- **Backend perf** (B4a) — S4PRED warm-up at startup eliminates the first-request cold-load
- **Large-dataset resilience** (LD2) — 3K+ sequences auto-disable TANGO with a clear warning
- **11-item Peleg cosmetic sweep** (F1-F11) — covers her PDF items not in the already-fixed list
- **Validation suite + canaries** (T5 today) — committed to CI

### Blocked / waiting

- **DESY VM migration** (Maxwell access for `azaizahs` pending Alex's IT request). The auto-deploy workflow is host-agnostic — switching is 4 secrets, zero code change. We're ready the day Maxwell access lands.
- **Phase G2 PubMed RAG** — Alex's long-term AI vision (cite-grounded responses). Queued behind validation methodology + Maxwell access.
- **Paper submission (JOSS)** — paused until Wave 2.5 lands + Peleg signs off on the disclosure paragraph framing.

### Deferred (Wave 3+)

- **Cohort Comparison full upload flow** (Alex CO1/CO2) — both cohorts upload independently, persistence across navigation
- **Head-to-head competitor benchmark** (AGGRESCAN, PASTA 2.0, AmyloDeep) — the "how do you compare" question paper reviewers will ask
- **Tools tab with PDB structural integration** (Alex's request)
- **AMP-discrimination feature** (UniProt keyword enrichment) — only if Peleg says it's worth pursuing
- **Mobile UX polish, deeper Plotly.js charts** — Phase D2+

### Out of scope (not on roadmap)

- A SaaS PVL with paid tiers (cultural mismatch)
- A standalone PVL chatbot UI (Option E above — Claude Desktop / Cursor already do better)
- Closed-source PVL (open is the strategic move)

---

## What NOT to put in the Peleg email

- Internal task IDs (B1-B11, F1-F11, ISSUE-032, etc.) — convert to user-visible descriptions.
- Terminal names (T1-T6, Cowork) — internal organizational structure.
- Wave numbers ("Wave 2.5") unless the email genuinely benefits from a timeline anchor.
- The phrase "scientific integrity bug" — too dramatic; just say "the FF-SSW question you raised in Slack led us to a deeper fix where the underlying SSW columns were being read from different sources."
- Specific commit SHAs / code paths.
- Status emojis (🔴 / ✅ etc) — internal.

---

## Length target for Claude chat

This packet + Packet 1 together are ~6000 words of technical raw material. The humanized email should be **2500-3500 words** — comprehensive enough that Peleg has the full picture, short enough to read in one sitting. Lead with §11 from Packet 1 (the validation findings — the biggest news). Then weave in the MCP decision tree from this packet's §4 (the strategic story she should know). Then the rest from both packets is supporting detail.

If Claude chat needs to cut, the things it can drop without harm:
- §1 long lists (just summarize as "AlphaFold 3D overlay, reproducibility permalinks, smart ranking, FASTA upload, paper figure pack, cohort comparison")
- §6 question 6 (paper figure panel choices — minor)
- §7 "Out of scope" list

The things it must keep:
- The validation findings (Packet 1 §11)
- The MCP decision (this packet §4)
- The commitment-level stance (this packet §5)
- The new open questions (this packet §6)
- Said's voice on closing — he writes that himself.
