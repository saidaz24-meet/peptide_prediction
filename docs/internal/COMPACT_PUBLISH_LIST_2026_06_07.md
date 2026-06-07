# Compact publish-ready list — every TODO across the project (2026-06-07)

**Source sweep**: `ROADMAP.md` (19 phases, ~80 items), `ALEX_BACKLOG.md` (~70 items), `KNOWN_ISSUES.md` (33 issues), `COWORK_V10_DESIGN_QUEUE.md` (V10-1→8), `PELEG_FOLLOWUP_DOC_V2.md` (open Qs), `TECH_PLATFORM_VISION.md` ADR-001..010, `MASTER_PRIORITY_ROADMAP_2026_06_07.md`, `FUNCTIONAL_DISPATCH_2026_06_07.md`, in-flight T2/T3 PR scope, plus the Ragonis-Bachar paper + Peleg's own repo.

**Goal**: Said decides per row. The recommendation column is my proposal. The decision column is the actual call. Items marked **publish-blocker** must finish before PVL is paper-ready; everything else is optional or parkable.

---

## §A — DO NOW (publish-blockers + quick wins, ≤ 2 days total)

| # | Item | Effort | Reason it's here | Recommendation |
|---|---|---|---|---|
| A1 | **T2 backend FF threshold fix** (in flight) — dataset-derived means matching Peleg `main.py:147-170` | 4-6h | Scientific correctness; without it every batch returns wrong FF flags | **DO** — blocker |
| A2 | **T3a PR-A residue colour sweep** (in flight) — Mol3DViewer + BackboneViewer + AggregationHeatmap consume fragment columns | 3-4h | Fixes the black-G bug for every 3D/overlay view, not just SequenceTrack | **DO** — blocker |
| A3 | **T3a PR-B KPI redesign + table reorder + FF-% drop** (in flight) | 3-4h | Peleg symmetry rule + "% is feature not class" | **DO** — blocker |
| A4 | **T3b PR-C Active Thresholds + correlation matrix + ranking + Help 4 sections** (waits on T2) | 4-5h | Surfaces the corrected numbers + Peleg's verbatim Help text | **DO** — blocker |
| A5 | **Batch B hard-reject route enforcement** (>40 aa → 422, not soft-skip) | 2h | Peleg said "must be hard cutoff not warning" | **DO** — quick |
| A6 | **Batch B TANGO stretch method** (now I have her code — `auxiliary.get_secondary_structure_segments` with TANGO aggregation array, `avg_limit=0`) | 3-4h | Peleg's Q4 unblocked by paper repo read | **DO** — quick |
| A7 | **Batch B UniProt keyword chips on every row** | 4h | Researchers screening AMPs need keyword visibility | **DO** — small |
| A8 | **Batch B AMP-downweight ranking toggle** | 2h | Opt-in slider against UniProt antimicrobial annotation | **DO** — small |
| A9 | **Batch B signed-charge handling** in cohort comparison (PELEG-Q-FIX-022) | 2h | Currently `|charge|` loses sign | **DO** — small |
| A10 | **Validation re-run** on Staphylococcus 2023 + Ragonis-Bachar 2022 cohorts with corrected pipeline | 1h | Needed for paper Results + bio.tools claim | **DO** — blocker |
| A11 | **Paper draft v1 done** (Intro + Methods committed today) | done | First-draft scientific manuscript | **DONE 2026-06-07** |
| A12 | **A4 bio.tools packet finalized** with all 3 ORCIDs (Peleg + Landau + Said) | done | Submission packet ready | **DONE 2026-06-07** |
| A13 | **A5 Zenodo metadata + CITATION.cff** with all 3 ORCIDs + Ragonis-Bachar bib entry | done | Zenodo deposit ready | **DONE 2026-06-07** |
| A14 | **pvl-cli/README.md** rewritten as user guide (24 → 250 lines) | done | CLI publishable | **DONE 2026-06-07** |
| A15 | **`SELF_HOST_GUIDE.md`** for institute IT | done | Institute-deployment ready | **DONE 2026-06-07** |
| A16 | **v0.3.0 GitHub tag** triggering Zenodo DOI mint | 30min | DOI is bio.tools + JOSS prereq | **DO after A1-A4 land** |
| A17 | **bio.tools submission** | 20min | Paste packet at https://bio.tools/contribute | **DO after A16** |
| A18 | **JOSS paper submission** | 1-2h | Polish paper Results + Discussion + submit | **DO after A10** |
| A19 | **ISSUE-024** — UI notification when non-standard AAs are substituted in input | 1-2h | Existing P1 bug, scientific clarity | **DO** — small |
| A20 | **ISSUE-027** — Safari `crypto.randomUUID` polyfill for older Safari at `/quick` + `/database-search` | 1h | Blocks Safari users entirely | **DO** — quick |
| A21 | **ISSUE-028** — TANGO profile tooltip missing in Quick Analyze | 30min | Quick consistency fix | **DO** — trivial |
| A22 | **Phase O.1** — Dependabot/Renovate setup for npm + pip | 1h | Auto dependency rolls | **DO** — small |
| A23 | **Email Alex** re Maxwell SSH (drafts the email; Said sends) | 10min | Unblocks DESY VM migration | **DO** — must |
| A24 | **Email Peleg + Landau** with paper draft v1 for review + sign-off on author order | 15min | Authorship is a publishing prerequisite | **DO** — must |

**§A total estimated effort**: ~30-40 hours of focused work across T1/T2/T3. Realistic 2-3 days wall-clock with parallel terminals.

---

## §B — DO IF CAPACITY (mid-effort polish, finishable but not publish-blocking)

| # | Item | Effort | Reason it's here | Recommendation |
|---|---|---|---|---|
| B1 | **`pvl-py` PyPI release** — proper package metadata, PyPI upload | 6h | Makes `pip install pvl-py` real | **DO if 1 day free post-publish** |
| B2 | **`pvl-cli` PyPI release** — same | 4h | Makes `pip install pvl-cli` real | **DO if 1 day free post-publish** |
| B3 | **Cowork V10-7 landing page** quality push (hero refresh + demo loop + ecosystem bar) | 12-15h | Said called it out as priority; affects discoverability | **DO** — high leverage |
| B4 | **Cowork V10-8 background design system** | 8-10h | Pairs with V10-7 | **DO with V10-7** |
| B5 | **Cowork V10-1 About page redesign** (wave background, spread layout) | 6-8h | Original V10-1, still queued | **PARK unless V10-7/8 finish fast** |
| B6 | **Cowork V10-2 DrillDown panel polish** | 6h | Animation + empty-state polish | **PARK** — cosmetic |
| B7 | **Phase L.2 Hero polish + L.3 How-it-works + L.4 Trust/citations + L.5 Footer overhaul** | ~12h | Largely covered by V10-7 if we do it | **MERGE into V10-7** |
| B8 | **Phase S Sentry hardening** (S1-S10: source maps, release tagging, rich context, custom alerts, performance dashboard, replay tuning, cron monitoring, issue ownership, SDK upgrade) | ~15h | Better incident response post-launch | **DO S1+S2+S5 (4h), park rest** |
| B9 | **Phase O.2 daily VPS backup automation** (cron tarball of `data/`) | 2-3h | We have the script in SELF_HOST_GUIDE — just wire it on the VPS | **DO** — small |
| B10 | **Phase O.4 CONTRIBUTING.md community polish** | 2h | OSS community signal | **DO** — small |
| B11 | **Phase O.6 Monthly maintenance protocol doc** | 30min | Sustainability protocol | **DO** — trivial |
| B12 | **Phase E.1 GHCR pull-and-run workflow** + **E.2 docker-compose consolidation** | 4h | Eases self-host upgrades | **DO if VPS is a pain point** |
| B13 | **Phase F UniProt search enrichment** (better filters, save searches) | ~10h | UX upgrade not scientific | **PARK** — January MIT |
| B14 | **MCP client guides per assistant** (Claude Desktop, Cursor, Continue, Cline, Windsurf) | 4h | Helps the AI-engineer audience adopt | **DO** — small docs |
| B15 | **AI navigation assistant** (Task #73 — "how do I tune thresholds" guided answers) | ~20h | Distinct from RAG; reduces support load | **PARK** — January MIT |
| B16 | **B17/B18 self-host docs** — covered by SELF_HOST_GUIDE.md | done | Done in A15 | **DONE** |
| B17 | **B19 "Developers" navigation section** in UI | 4h | Surfaces CLI / pvl-py / MCP for developer audience | **DO** — small |
| B18 | **B20 "Run Locally / Self-Host" landing CTA** | 2h | Discoverability for institute audience | **DO with V10-7** |
| B19 | **Cowork V10-5 Help.tsx 4 sections** | covered by A4 | T3b PR-C handles this | **DONE in A4** |
| B20 | **Cowork V10-6 FF-Helix % rename audit** | covered by A3 | T3a PR-B handles this | **DONE in A3** |
| B21 | **ISSUE-007 Caddy switch for auto-HTTPS** | 1h | DESY VM transition prerequisite | **PARK until DESY VM unblocks** |
| B22 | **Phase H content + outreach** — schedule the 30-min intro demo with Peleg's old lab + 2-3 Technion postdocs (early August target) | meeting time | Single biggest adoption lever per `PELEG_ZOOM_BRIEFING §2` | **DO** — must after publish |

**§B total if all done**: ~70-80 hours. Realistic: pick 4-5 items (~25-35h) and let the rest park.

---

## §C — PARK FOR JANUARY MIT (long-arc, big lift, OR external-blocked)

| # | Item | Why parked | Re-evaluate trigger |
|---|---|---|---|
| C1 | **Phase C K8s deployment manifests** (multi-node clusters) | Blocked on DESY K8s namespace allocation; self-host Docker covers solo-institute use already | DESY allocates namespace OR PVL hits >50 concurrent users |
| C2 | **DESY VM migration** to `landau-webapp-dev` | Blocked on Maxwell SSH (Alex needs to add `azaizahs`); Hetzner VPS works fine | Maxwell access granted |
| C3 | **Phase E.6 multi-arch Docker build** (linux/amd64 + linux/arm64) | Blocked on DESY VM arch knowledge | DESY VM migration unblocks |
| C4 | **Phase G2 RAG / PubMed citation grounding** | Needs Peleg co-design on what "good cite-grounded answer" looks like; hallucinated-citation risk is real | Peleg co-design session scheduled |
| C5 | **Phase G3 generic AI/MCP platform** | Separate Alex project, not our scope | Out of scope |
| C6 | **Phase I Multi-Predictor Consensus** (Galagos-inspired multi-predictor) | Bigger architectural shift; requires picking a 2nd predictor + designing consensus rules | Peleg buys in on multi-predictor framing |
| C7 | **Phase D5 V4 transformative viz** (cross-α/β switch visualizer, time-dependent transition viewer) | Major design + dev effort; paper-grade but not paper-required | Post-publish, post-NAR-decision |
| C8 | **Phase D3 advanced visualizations parked items** | Old parked list; revisit when Cowork has bandwidth | Cowork capacity |
| C9 | **"Big Alex idea" of full automation infra** (self-healing infra, auto-remediation, full Ops platform) | Multi-month scope; PVL's scale doesn't justify it yet | PVL hits production-pain threshold |
| C10 | **Compare feature upgrade — support 5+ tables side-by-side** | Currently 2-cohort; expanding to N-cohort is bigger UI lift | User demand observed |
| C11 | **Alex Backlog UX1-UX5** (sidebar polish, scrolling, professional look, dark/light theme, minimizable bars) | Largely subsumed by V10-N polish | Combine with V10-1+V10-7 if Cowork picks them up |
| C12 | **Alex Backlog CH1-CH7** (pipeline diagrams, clickable diagram sections, "Helic West" rename) | Visual/design — bundle with V10-N | Combine with V10-N |
| C13 | **AlphaFold AF1-AF2** (research why AlphaFold DB returns longer sequence than UniProt) | Edge case investigation | Post-publish if anyone complains |
| C14 | **B14 Cohort Comparison: dual fresh upload** | Already supported for single upload; dual would be UX upgrade | Post-publish user demand |
| C15 | **B16 Load Testing infrastructure** (50/100/1000 concurrent on Hetzner) | Only matters if PVL hits real concurrent load | PVL hits >20 concurrent users |
| C16 | **B12-B13 Upload guidance + 2D Backbone (atom2svg)** | Nice-to-have not publish-blocker | Post-publish polish |
| C17 | **NAR Web Server 2027 paper** | Long arc; needs JOSS paper landed + corrected validation re-run + figure pack polish first | After JOSS accept |
| C18 | **Phase O.3 multi-region resilience** | Single-region is fine for >99% use cases | PVL hits cross-region demand |
| C19 | **Phase O.7 status page** | Only matters at >100 concurrent users | PVL hits scale threshold |
| C20 | **PVL rename brainstorm** | Said deprioritized; "PVL" works for now even though Peleg flagged SEO concern | Post-publish, if reach numbers underwhelm |
| C21 | **TANGO threshold filters MIN_HELIX_SCORE=0.3 + MIN_BETA_SCORE=0.6** (paper variants) | Optional filtering tier from paper §2; useful for power users only | Power user requests it |
| C22 | **Algorithm parity stay-corrected vs match-paper** decision on the 2 minor divergences | Pending T2 parity diagnostic | After T2 reports diagnostic numbers |

---

## §D — DECISIONS NEEDED FROM SAID (before §A items can complete)

| # | Decision | Why it matters | My recommendation | Said's call |
|---|---|---|---|---|
| D1 | **License**: MIT vs DESY-non-commercial vs dual | Blocks bio.tools "openSource" filter + JOSS submission entirely | **MIT** — open-source signal, removes commercial restriction blocker | _____ |
| D2 | **Version number for first Zenodo deposit**: v0.3.0 / v1.0.0 / other | Sets reference number cited in paper + bio.tools | **v0.3.0** — JOSS reviewers push back on 1.0 pre-peer-review | _____ |
| D3 | **Paper author order** | Locks acknowledgements + cite block | Said → Peleg → Landau (PI/corresponding) → Alex | _____ |
| D4 | **Paper title** (current placeholder: "PVL: a research-grade web platform...") | Locks at submission | Use placeholder until JOSS accepts then refine for NAR | _____ |
| D5 | **bio.tools final URL** — Hetzner now or wait for DESY VM | bio.tools allows URL updates; Hetzner is fine for first submission | **Submit on Hetzner now**, update post-DESY-migration | _____ |
| D6 | **Algorithm parity** — match-paper-bug (reproduce Ragonis-Bachar 2022 numerical output exactly) vs stay-corrected (mathematically right per our backend) | Affects whether PVL exactly reproduces published numbers | **Match-paper for v0.3.0**, add `?strict=corrected` flag for the mathematically-right variant. Document both. | _____ |
| D7 | **Demo intro session schedule** — early August target with Peleg's old lab | Single biggest adoption lever per Peleg's own ask | Said schedules with Peleg by July 1 | _____ |
| D8 | **`pvl-py` and `pvl-cli` PyPI package names** | First-publish commitment | `pvl-py` and `pvl-cli` exact strings (matches dir names + docs) | _____ |
| D9 | **Sentry plan** — current free tier or upgrade | S1+S2+S5 fit in free tier; S6 performance dashboard wants Team plan | **Stay on free tier**, defer perf dashboard | _____ |
| D10 | **Cowork capacity allocation** — V10-7+V10-8 (mid, ~20h) vs all V10-N (~50h) vs none until post-publish | Visual polish vs publish velocity tradeoff | **V10-7+V10-8 only** for now; rest parks to January | _____ |

---

## §E — POST-DESY-VM UNLOCKS (everything that wakes up after Maxwell SSH lands)

| # | Item | Effort | Why post-VM |
|---|---|---|---|
| E1 | **DESY VM migration** itself (4 secret edits + DNS swap) | 3-4h | Maxwell SSH required |
| E2 | **bio.tools URL update** to DESY domain | 5min | Stable canonical URL for citation chains |
| E3 | **MCP server move** to DESY-hosted endpoint (better latency for the AI-engineer audience) | 1h | Stable URL |
| E4 | **MCP maximizations**: persistent session memory across MCP queries (e.g. "the assistant remembers the user's dataset hash") | 6-8h | Requires stable server identity |
| E5 | **Phase E.6 multi-arch Docker** (linux/amd64 + linux/arm64) | 4h | Now we know the DESY VM arch |
| E6 | **Phase C K8s manifests** for multi-node | ~20h | DESY K8s namespace likely follows VM access |
| E7 | **Privacy-conscious deployment story** — "data never leaves DESY" — promote in bio.tools description | 30min copy update | Now true |
| E8 | **Increase MCP context budget** — DESY may have higher-spec hardware than Hetzner CX33 | tuning | Depends on actual DESY VM specs |
| E9 | **Sentry replay sampling tune** for higher-concurrency DESY load | 1h | Different traffic profile |

---

## §F — UNCONFIRMED ITEMS NEEDING SAID'S TEST/SIGN-OFF

Things I've shipped that haven't gotten Said's confirm-in-browser sign-off:

| # | Item | Live where | What to verify |
|---|---|---|---|
| F1 | Helix % duplicate removal from PeptideDetail (PR #76 branch + main pre-Zoom batch) | `/peptides/:id` | Top of page should show one "Helix (X%)" only, in SequenceTrack legend |
| F2 | SSW track fallback bug fix (PR #76) | `/peptides/P0C005` (TANGO-positive) vs `/peptides/P80955` (No SSW) | P80955 should NO LONGER show a full SSW bar at 100% |
| F3 | 4-track consolidation (PR #76) | `/peptides/:id` | Should see 2 tracks (S4PRED Helix + SSW), not 4 |
| F4 | Cohort comparison colour swap (Wave 2.6, landed) | `/results` | No-SSW = brown-orange, SSW = green, FF-SSW = darker green |
| F5 | FF-Helix vs Aggregation Max scatter legend + axis labels (Wave 2.6, landed) | `/peptides/:id` scatter | Axis labels visible, "Current peptide" + "Database" legend below |
| F6 | 40-aa pipeline cap warning copy rewrite (Wave 2.6, landed) | Upload + Quick Analyze with >40-aa sequence | Warning text says "surface-vs-structure problem" |
| F7 | AlphaFold-predicted structure title rename (Wave 2.6, landed) | `/peptides/:id` AlphaFold card | Title reads "AlphaFold-predicted structure" |
| F8 | KLVFFAE canary peptide in test suite (Wave 2.6, landed) | `make test` | Canary peptides include Abeta_16_22 = KLVFFAE |
| F9 | Black-G residue-colour-from-fragments fix (fix/residue-colour-from-fragments branch) | `/peptides/P01501` | G residue inside helix run should be helix-coloured |
| F10 | T2 FF threshold dataset-derived fix (in flight) | `/results` active thresholds panel | Should show "dataset mean over N peptides" instead of `0.5` static |
| F11 | T3 KPI redesign (in flight) | `/results` top row | 4 cards [Helix, FF-Helix, SSW, FF-SSW], Total as sub-header |
| F12 | T3 correlation matrix using SCORE not % (in flight) | `/results` correlation tab | TANGO + FF flags appear; helix metric is score, not percent |
| F13 | T3 ranking Fibril-Formation default preset (in flight) | `/results` ranking dropdown | "Fibril-Formation" is the default selection |
| F14 | T3 Help.tsx 4 sections (in flight) | `/help` | 4 sections Helix → FF-Helix → SSW → FF-SSW with Peleg's verbatim text |
| F15 | T3 HowItWorks 2a/2b split (in flight) | `/` landing | Step 2 shows raw inputs (TANGO + S4PRED) above FF derivation |

---

## §G — Quick decision matrix for Said

**Three buttons** Said can press to lock the plan:

**Button A — "Ship publish-ready, park everything else"**:
- Do §A 1-24 (publish-blockers + must-do quick wins)
- Skip all of §B
- Park all of §C
- Total wall-clock: ~3-4 days to publish
- Output: JOSS-submitted PVL, bio.tools-listed, Zenodo-DOI'd, validated against Peleg's algorithm

**Button B — "Publish + V10-7/8 visual polish"** (my recommendation):
- Do §A 1-24
- Do §B 3-4 (V10-7 + V10-8 landing + backgrounds, ~20h)
- Do §B 8 (Sentry S1+S2+S5, ~4h)
- Do §B 9 (VPS backup automation, ~2h)
- Do §B 14 (MCP client guides, ~4h)
- Do §B 17-18 (Developers nav + Self-Host CTA, ~6h)
- Park everything in §C
- Total wall-clock: ~5-6 days to publish + visual polish landed
- Output: same as A + better-looking PVL + readable MCP install + automated backups

**Button C — "Publish + full §B" (most aggressive)**:
- Do everything in §A + §B
- Park §C
- Total wall-clock: ~10-14 days
- Output: same as B + PyPI releases (`pvl-py`, `pvl-cli`) + UniProt enrichment polish + every V10-N item

---

## §H — Items NOT on this list

Things I deliberately did not put in any bucket:
- **Rename PVL** — Said deprioritized; revisit only if reach numbers underwhelm post-publish
- **Hero copy "aggregation → fibril formation" sweep** — Said deprioritized
- **"Chameleon" terminology adoption** — Peleg dislikes the term per Said
- **NAR Web Server 2027 paper** — too long-arc, post-JOSS

---

## §I — Said's next 5 minutes

1. Read §G's three buttons. Pick one.
2. Read §D's 10 decisions. Fill in the right column.
3. Tell me which button + which §D decisions are confirmed.

I execute the chosen button as soon as you confirm. T2 and T3 keep running in parallel.
