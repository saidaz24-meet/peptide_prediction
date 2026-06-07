# PVL — Top CEO Recommendations

**Author**: T1, drafted 2026-05-07. **For**: Said Azaizah.
**Scope**: high-level founder/CEO recommendations for PVL's next 12-24 months.
Complements but does not duplicate `TECH_PLATFORM_VISION.md`.

---

## §1 — Executive summary (5 headlines)

1. **Survive the academic year, don't grow during it.** Solo scientific OSS tools die from feature debt accumulated when the maintainer was busy. Set hard "no new features during MIT semesters" rule. Use that rule to filter every feature request.

2. **Become MCP-native before MCP becomes ubiquitous.** Anthropic's MCP is now adopted by Claude Desktop, Cursor, Windsurf, Continue, and (rumored) ChatGPT. PVL's transformative differentiator isn't another web UI — it's being the peptide-analysis tool every LLM agent already knows how to call. Ship MCP server in summer 2026 (v0.2).

3. **Don't write the paper. Ship the citation hook.** Zenodo DOI on every release + bio.tools listing + CITATION.cff = anyone can cite PVL whether or not Peleg's paper is published. The paper is multiplier, not gate. Decouple your platform momentum from her writing pace.

4. **Skip funding applications until you have usage data.** PVL has 887 tests but 0 documented external users. Without 6-12 months of bio.tools / GitHub stars / academic citations to point to, grant applications are weak. Defer NIH/NSF/Wellcome until v0.2 or later. Apply for Mozilla Open Source Awards / Sloan Foundation tools-grants only after you have ≥3 external citations.

5. **Hedge maintenance with AI tooling, not contributors.** Recruiting human contributors is a part-time job you don't have. Instead: CodeRabbit (PR review), Sentry Seer (issue triage), Dependabot (deps), GitHub Copilot Workspace (code-mode dev). Each is 1-time setup that compounds during semesters.

---

## §2 — Sustainability lessons from solo / small-team scientific OSS

The pattern that distinguishes survivors from abandoned tools:

| Tool | Why it survived | Lesson for PVL |
|---|---|---|
| **BLAST** (Altschul et al.) | Anchored to a journal paper that became a field-defining citation; NCBI hosting decoupled it from the original authors. | Get cited *once* in a high-impact venue; let an institution host it. PVL's DESY hosting is the equivalent. |
| **BioPython** | Moved to a community project (Open Bioinformatics Foundation) early; original authors stepped back. | Don't gate-keep. Make `CONTRIBUTING.md` clear, then let the work happen. |
| **Bowtie / Bowtie2** (Langmead) | Kept the algorithm simple, the I/O standardized (SAM/BAM), and the maintenance bar low. | Standardize on FASTA/CSV/FASTA in/out; resist proprietary formats. |
| **Mol\*** (RCSB + EBI + ETH consortium) | Consortium structure spreads maintenance load; aligned with the open structure-bio ecosystem. | PVL adopting Mol\* (ADR-008) ties you to a permanent ecosystem. |
| **AlphaFold / AlphaFold DB** (DeepMind + EBI) | Killed every competitor by being free + accurate + hosted. | The "free + better + hosted" combo wins; PVL's path is to own the *integration* layer. |
| **HMMER** (Eddy lab) | One PI, 30+ years; survived by being scoped narrowly + integrating with everything (Pfam, InterPro). | Don't expand scope. Be the best at one thing. |
| **Tools that died**: ICM-Browser, NPSA, AntheProt — single-PI tools whose grants ended and migration to modern web standards was abandoned. | Avoid: vendor-locked frontends, unmaintained dependencies, custom protocols when standards (REST/MCP/Mol\*) exist. |

**Pattern**: tools survive when their maintenance burden is *less than* the value they provide to the maintainer or the institution. PVL needs to lower its maintenance burden via observability + AI tooling, while keeping value high via the AI/MCP integration story.

---

## §3 — Business model recommendation

**Decision**: stay 100% open-source MIT-licensed with optional **paid hosting / support tier** activated only if usage warrants.

**Why this and not other models**:

| Model | Verdict | Why |
|---|---|---|
| **Pure OSS, free forever (current)** | ✅ Default for v0.1 → v0.5 | No friction for academic adoption. Path of least resistance to bio.tools + JOSS-equivalent recognition. |
| **Open-core (free OSS + paid commercial features)** | ❌ Bad fit | Splits codebase, adds licensing complexity, creates a "second-class user" feeling that hurts academic adoption. |
| **Paid hosting + free OSS code (Hashicorp / Sentry model)** | 🟡 Defer to v1.0 | Could work if PVL gets institutional adoption. Requires a 24/7 hosted instance, customer support channel, billing. Don't take this on during MIT. |
| **Foundation / non-profit** | 🟡 Defer to v1.0 | Apache Software Foundation / NumFOCUS / OBF (Open Bioinformatics Foundation) all accept incubation projects. **Apply to NumFOCUS or OBF for fiscal sponsorship after v0.2 ships** — they handle donation infrastructure, you keep maintaining. |

**Concrete recommendation**: stay free + open through v0.x. After v1.0 (or after first lab signs up to use PVL daily and asks for SLA), revisit paid-support tier. **Don't pre-monetize**.

---

## §4 — Funding paths ordered by feasibility (for Said's situation)

**Important**: don't apply for any of these until PVL has external traction (≥3 citations, ≥1 institutional adoption, ≥1 year on bio.tools).

| Source | Feasibility now | Feasibility post-v0.2 | Notes |
|---|---|---|---|
| **DESY internal grants / Helmholtz Open Science fund** | ⭐⭐⭐ | ⭐⭐⭐⭐ | Alex is at DESY. Ask Alex which DESY internal funds support open-science software. Likely the easiest first ask. |
| **Mozilla Open Source Awards (MOSS)** | ⭐⭐ | ⭐⭐⭐ | $20-100K. Requires 1+ year of project history + community traction. Apply after v0.2. |
| **Israeli Innovation Authority (Tnufa, MAGNET)** | ⭐⭐ | ⭐⭐⭐ | Israeli funding. Requires Israeli registration; Said is Israeli + Technion-affiliated. Tnufa supports tech-transfer of academic work. |
| **Wellcome Open Research / Trust** | ⭐ | ⭐⭐ | UK-focused but accepts global. Strong fit for biomedical OSS. £30-300K. |
| **CZI Essential Open Source for Science** | ⭐ | ⭐⭐⭐ | Chan Zuckerberg Initiative funds essential OSS. Apply when bio.tools adoption is documented. $50-250K, 2-year cycles. |
| **NIH R01 / R21** | ❌ | ⭐⭐ | Said isn't in a US university yet. Could co-PI through Peleg's Technion contacts later. R21 ($275K, 2yr) more realistic than R01. |
| **NSF SBIR (small business)** | ❌ | ⭐ | Requires US incorporation. Defer indefinitely. |
| **Sloan Foundation Tools / Methods** | ⭐ | ⭐⭐⭐ | $50-500K. Requires demonstrated impact. Apply after JOSS paper publishes. |
| **Y Combinator OSS Pilot** | ⭐ | ⭐⭐ | Equity-light track. Strong fit if PVL goes commercial; less so if you stay academic-aligned. |
| **GitHub Sponsors** | ⭐⭐ | ⭐⭐⭐ | Passive ($50-500/month from individual academics who use the tool). Set up now, don't expect much for 2 years. |

**Action item**: ask Alex via Wave C email which DESY internal program could fund a part-time RA to maintain PVL during MIT semesters. That's the highest-leverage funding ask available to Said today.

---

## §5 — Strategic partnerships

**Pursue actively** (low cost, high leverage):

- **EBI / Mol\* consortium**: Already aligned (ADR-008 — PVL adopts Mol\*). Reach out to the Mol\* team after v0.2 with a "PVL is the first peptide-tool to overlay aggregation on Mol\* structures — would you mention us in your registry?" email. They maintain the canonical Mol\* tutorials list.
- **AlphaFold DB / EBI structures team**: PVL pulls AlphaFold structures already. After v0.2 + bio.tools listing, reach out re: cross-linking from AlphaFold DB peptide pages to PVL.
- **Open Bioinformatics Foundation (OBF)**: Apply for affiliated-project status after v0.2. Free, gives PVL governance legitimacy + access to OBF mailing lists where labs discover tools.
- **bio.tools community curators**: Once registered, engage with their curation team — they often promote well-curated tools in newsletter.

**Avoid / approach with caution**:

- **Schrödinger / OpenEye / commercial pharma platforms**: very different incentive structures. They'll be happy to integrate PVL one-way (their UI calls your API) without giving anything back. Wait until you have leverage.
- **Recursion / pharma startups**: same caution; they may want exclusivity or licensing changes.
- **Academic-industry consortia (SMARTbio, Pistoia Alliance)**: high overhead, slow output. Worth exploring only after v1.0.

**Concrete "do this in next 60 days"**:
1. Add a "Compatible with Mol\*" badge to the README.
2. List PVL's UniProt + AlphaFold integration on bio.tools (per Guide C).
3. After v0.2, send the Mol\* team a 1-paragraph email about the integration.

---

## §6 — Technology choices that age well (audit of PVL's current stack)

**Will age well 5+ years** (keep, double down):
- ✅ **MCP standard** (planned G1) — Anthropic-aligned, multi-vendor. Becoming the LLM tool-call protocol.
- ✅ **Mol\*** — institutional consortium maintains it. Will outlive any single team.
- ✅ **Docker / Compose** — universal deployment artifact since 2014. Won't change.
- ✅ **Pydantic v2** — Python typing standard. Ecosystem effect.
- ✅ **FastAPI** — async Python web standard. Will be around in 2030.
- ✅ **Recharts / D3-based viz** — D3 is generational; Recharts is one wrapper among many but interchangeable.
- ✅ **shadcn/ui** — primitive-on-Tailwind pattern. Ages well because it's just code in your repo (no library lock-in).
- ✅ **PostgreSQL / DuckDB** (when you adopt) — both have decade-plus longevity.

**Watch for replacement** (currently fine but check yearly):
- ⚠️ **Recharts** — alternatives (Visx, Tremor, Apache ECharts) are faster + more flexible. Consider Visx for any new chart in v0.2.
- ⚠️ **Vite** — currently dominant, but Turbopack and Rspack are catching up. Stay on Vite unless build perf becomes a complaint.
- ⚠️ **TANGO binary (Linux 64-bit)** — original tool is from 2004. Already a maintenance liability. Long-term: port the algorithm to Python or replace with newer aggregation predictor (Pasta3, Camsol).

**Avoid / has aged poorly** (not in PVL — keep avoiding):
- ❌ Custom protein-format parsers when BioPython exists.
- ❌ Bespoke molecular viewers (NGL Viewer, JSMol) when Mol\* exists.
- ❌ jQuery / Backbone / Angular 1 frontends in scientific tools.
- ❌ Heroku / Now / non-standard PaaS lock-in.

**Decision**: stack is healthy. Recurring 6-month review item.

---

## §7 — Citation strategy (passive, low-maintenance)

**Citations PVL accumulates without maintenance**:
1. **Zenodo DOI** (auto-generated per release) — single citation across all PVL versions.
2. **bio.tools entry** — counts as a software citation under MIRI / FAIR principles.
3. **CITATION.cff** in the repo — GitHub auto-prompts users to cite when they fork/star.
4. **Reproducibility permalinks** (V4-1) — every analysis has a URL that includes "Generated by PVL v0.1.2"; users who paste this link in their papers are de-facto citing.

**Citations that take active effort** (defer until summer 2026+):
- JOSS paper (Peleg writes; Said does not).
- Twitter / Bluesky thread when v0.1.0 ships (1-time effort, lasting attention).
- Conference presentation (ISMB July, RECOMB May, PSB January) — pick one for 2027.

**Action items now**:
- [ ] CITATION.cff polished (Said does Guide D — ORCID iDs).
- [ ] Reproducibility ribbon's citation dialog includes BibTeX template ✅ already done.
- [ ] After Zenodo connects, pin the latest DOI badge in README ✅ Guide A/B.

---

## §8 — Commercialization triggers (signals to watch for)

Stay open while signals are ❄️ cold. Re-evaluate when ≥2 signals turn 🔥 hot:

| Signal | ❄️ Cold | 🔥 Hot |
|---|---|---|
| **Pharma/biotech integrating PVL** | None | A pharma asks for SLA / paid support |
| **Daily active users** | <20 | >200 |
| **Citations per year** | <5 | >20 |
| **Time spent on user support** | <1h/week | >5h/week |
| **External feature requests** | <2/month | >10/month |
| **Said's bandwidth post-MIT** | "I have weekends" | "I want this to be my full-time work" |

**Decision rule**: until at least 2 signals are hot, stay free + open. The fastest way to kill a young scientific tool is to charge for it before it has community lock-in.

---

## §9 — Burnout prevention protocol for MIT semesters

Concrete, calendar-blocked, sustainable:

### Weekly (every Sunday, ~30 min)
- 10 min: scan Sentry dashboard for new errors (skim, ignore noise).
- 10 min: review CodeRabbit + Dependabot PRs from the week. Auto-merge greens. Defer reds.
- 10 min: glance at GitHub Issues / Discussions. Reply only to "blocking" tags. Defer everything else with a "ship in summer" template.

### Monthly (first Saturday, ~45 min)
- Run the maintenance protocol from `docs/active/MAINTENANCE_PROTOCOL.md` (Phase O.6, to be created).
- Update Sentry alert thresholds if noise increased.
- Manual smoke test: Quick Analyze + CSV upload + UniProt query.
- Update the changelog.
- Tweet/Bluesky one thing if there was meaningful change (passive citation accrual).

### Quarterly (during semester breaks, ~3-4 hours)
- Review TECH_PLATFORM_VISION technology radar. Move items between adopt/plan/parked.
- Review ROADMAP. Defer items that are still TODO with no urgency.
- Bump major dependencies if Dependabot has been opening PRs.

### Each summer (~80-120 hours over 2-3 weeks)
- One major release with batched features (v0.2 / v0.3 / v0.4).
- Bio.tools listing refresh.
- One conference presentation (target ISMB, RECOMB, or PSB).

### Hard rules (Said's own protection)
- ❌ **Never accept "urgent" feature requests during semesters.** Reply: "Thanks — added to v0.X backlog, ships in summer."
- ❌ **Never promise turnaround time on issues.** State explicitly in CONTRIBUTING.md: "Maintained part-time; expect responses in 1-4 weeks."
- ❌ **Never feel guilty about being slow.** The original SciPy maintainer slowed down for years; the project was fine.
- ✅ **Take 1 month off PVL completely each year.** December? Set Sentry to mute, archive Slack notifications.

---

## §10 — Top 5 decisions Said should make in the next 30 days

1. **Pick MCP server target ship date**: summer 2026 vs. winter 2026? Recommend summer (when you have bandwidth), targeting v0.2 release. Block 80h on the calendar now.

2. **Pick one funding ask to pursue with Alex**: ask Alex specifically for the name of a DESY-internal open-science fund that could pay a part-time RA for PVL. Wave C email asks this. Decide by Day 14.

3. **Pick foundation affiliation strategy**: apply to OBF (Open Bioinformatics Foundation) for affiliate-project status, or stay independent. Recommend OBF after v0.2 ships. Decide later, not now.

4. **Pick conference target for 2027**: ISMB (July), RECOMB (May), or PSB (January). Recommend ISMB — biggest peptide community. Submit poster abstract February 2027. Decide by August 2026.

5. **Pick "no" defaults for incoming requests during semesters**: write a CONTRIBUTING.md template response: "Thanks for the suggestion. PVL is maintained part-time during semesters; this fits the v0.X backlog and will be addressed in a summer release. Contributions welcome via PR." Save as a GitHub-saved-reply.

---

## §11 — Top 5 decisions Said should DEFER (and what data to wait for)

1. **Whether to commercialize PVL**: defer until ≥200 daily active users OR a pharma asks. Watch GitHub stars, Sentry session counts, bio.tools "uses" count.

2. **Whether to pursue NIH / NSF grants**: defer until co-PI relationship with a US institution is established. Could happen at MIT — Said may have access to MIT advisors who'd co-PI. Earliest realistic submission: Year 2 of MIT.

3. **Whether to build a pvl-cli + pvl-py community**: defer until at least one external user requests CLI features. Right now scaffolds exist (B17, B18) but no demand.

4. **Whether to host a managed PVL service (paid SaaS)**: defer indefinitely. Said cannot run a 24/7 service during MIT.

5. **Whether to integrate Phase G2 RAG / Phase I multi-predictor in v0.2**: defer between them — pick ONE for v0.2, other for v0.3. Don't try both in a single summer release. Recommend MCP+G1 for v0.2 (highest leverage), Phase I for v0.3.

---

## §12 — One-line summary

> Build the platform so well during the next 30 days that you can ignore it for 6 months at a time during MIT, and it still keeps shipping for the people who depend on it.

That's the CEO mandate.

---

**Living document**. Said reviews quarterly. Updates land via PR.
