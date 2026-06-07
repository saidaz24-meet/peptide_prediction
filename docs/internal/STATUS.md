# PVL — Where We Are Standing (2026-05-12)

**Branch**: `wave-2-ai-platform` · **Local commits ahead of main**: 36 · **Tests**: 1089/1089 passing (509 backend + 34 MCP + 546 frontend) · **NOT pushed**

This doc answers "where are we, what's next, what blocks us, when is this done." It is canonical and updated after every dispatch cycle. Other docs (ROADMAP, MASTER_PUSH_PLAN, DECISIONS) are the detailed plans. THIS doc is the dashboard.

---

## §0 — Top line in one paragraph

**Wave 1 shipped to main 2026-05-07** (`5d2ad3f` via PR #4). **Wave 2 in flight on local branch** — MCP server, vector similarity search end-to-end (LanceDB + ESM-2), PDF report, demo polish, About-page Peleg credit. **3 research briefs landed** (vector store, embeddings, AI workflow). **17 ADRs ACCEPTED**. Said hasn't done a live browser test yet — that's the #1 risk per `feedback_simplicity_and_testability.md`. Need to manually verify each chunk before more accumulates.

---

## §1 — DOING NOW (terminals already dispatched, work in progress or just landed)

| Terminal | Last delivery | What needs your eyes |
|---|---|---|
| **T2** | ✅ §G run_metadata in CSV/JSON exports (`ad7e0b5`, +18 tests, ADR-013) | None — backend-only chunk. T1 verified all tests + schema strictness. |
| **T3** | ✅ §I CsvExportDialog with run_metadata preview (`931ad2d`, +21 tests) | 🎨 60s browser test below |
| **T5 (manual)** | ✅ RB-005 deep brief + ADR-020 PROPOSED (`8704723`) | 1-min skim of RB-005 §1 TL;DR + §6 recommendations |
| **Cowork** | Idle since V9 | N/A |
| **T-PEL** | Idle | N/A |

---

## §2 — READY TO START (no blockers, T1 dispatches)

These ship without waiting on anyone. Ordered by impact × (1/cost). T1 dispatches in parallel where possible.

| # | Chunk | Owner | Time | Live test |
|---|---|---|---|---|
| 1 | **RB-004 Top-5 workflow upgrades** | T1 (canonical-doc + config work, fits CEO scope) | 5.5h total | After each: see §6 per-upgrade test |
| 2 | **T2 §G — `run_metadata` in CSV/JSON exports** (ADR-013) | T2 | 4h | Download CSV from Results → expect `# pvl_version`, `# run_timestamp`, etc. header block. pandas `pd.read_csv(file, comment='#')` should still parse normally. |
| 3 | **T3 §I — run-metadata preview dialog** (blocked on #2) | T3 | 2h | Click Export CSV → expect modal showing what metadata will be embedded, with confirm/cancel. |
| 4 | **T2 §H — FASTA bulk upload backend** (ADR-013) | T2 | 8h | `curl -X POST localhost:8000/api/predict/batch -H 'Content-Type: text/x-fasta' --data-binary @example.fasta` → expect N peptides analyzed. |
| 5 | **T3 §F — FASTA bulk upload UI** (blocked on #4) | T3 | 3h | Drag a `.fasta` file onto Upload page → expect "12 sequences detected" preview, then full Results page populates. |
| 6 | **T2 §I — MCP backend route gaps** (`get_peptide_detail`, `rank_candidates`, `compare_cohorts`) | T2 | 8h | In Claude Desktop with PVL MCP: "Get the peptide details for P02743" → expect tool call to `get_peptide_detail`, returns biochem + classification fields. |
| 7 | **T2 §B — pvl-py real package** (unlocks RB-001 #5 Jupyter export) | T2 | 12h | `pip install -e ./pvl-py && python -c "import pvl; df = pvl.analyze('GIGAVLKVL'); print(df)"` → expect DataFrame with TANGO + S4PRED columns. |
| 8 | **T2 §C — pvl-cli real package** | T2 | 8h | `pvl analyze examples/example_dataset.csv --top 10` → expect ranked table printed to stdout. |
| 9 | **T3 §H — gold-standard accuracy badge** (ADR-014, Peleg cleared) | T3 (needs T2 to ship threshold-curve JSON) | 6h | Results page shows new card: "Staphylococcus 2023 benchmark (N=66): X% sensitivity at current thresholds" — citation to Peleg/Technion. |
| 10 | **Manual MCP integration test** | Said local box | 30 min | See `docs/active/MCP_RUNBOOK.md` §2.3 — install MCP in Claude Desktop, run 4 verification prompts. |
| 11 | **Visual test punch list** (PDF Report button + Find Similar button + demo mode + coachmark) | Said local box | 25 min | See guide I gave earlier — clear localStorage, walk the golden path, flag anything broken. |
| 12 | **Push Wave 2 to GitHub** | Said via gh CLI or browser | 5 min | After punch list empty: tag `v0.2.0-rc1`, push, watch CI go green, no force pushes. |

---

## §3 — WAITING ON SAID (need a human-touch decision or input)

These do NOT ship until Said answers. Surfacing for visibility.

| Question | Why blocked | Where it unblocks |
|---|---|---|
| **Top friction in last 2 weeks of Wave 2** | T5-DEEP-001 mission §A.3 — calibrates workflow recommendations to YOUR pain, not generic best practice | After answer, T5 deep mission can start |
| **Paid SaaS tolerance for personal productivity** | T5-DEEP-001 §A.4 — clarifies whether Linear/Sunsama/etc are options | Same |
| **AI-platform vision — what does "strong AI" actually mean for PVL?** | §5 below has my honest take. You said this is the question. | Determines Phase G2 scope |
| **First-AI-interaction users would find most valuable** | T5-DEEP-001 §A.12 — picks G2 MVP target | After answer, T2 can spec G2 implementation |
| **Tamarind Bio / Galagos.ai personal read** | T5-DEEP-001 §A.7, §A.8 — competitive context | After answer, T5 can do informed competitive analysis |
| **Email Peleg about reviewing Wave 2** | Tests + manual verification + iteration loop with her drives "majority of work" per your phrasing | Triggers Peleg review cycle |
| **Email Alex about Phase G2 vs G3 priority post-G1-shipping** | Phase G next steps | After answer, T1 sequences G2 spec |
| **Decide push to GitHub now or after RB-004 top-5 lands** | Trade-off: ship cleanness vs. push-cost-tax | Triggers v0.2.0-rc1 tag |

---

## §4 — WAITING ON PELEG (review cycles add majority of work)

Peleg's reviews drive the majority of remaining work for v1.0. Each review cycle is typically 1-3 weeks for her to deliver feedback + 1-2 weeks for us to integrate + re-verify. Below are the cycles we should trigger.

| Review cycle | When to trigger | What we want from her | Expected churn |
|---|---|---|---|
| **Wave 2 features (similarity, MCP, PDF, demo, About credit)** | After Wave 2 pushes to GitHub | Does Find Similar return scientifically meaningful results? Is the About page credit phrasing accurate? Does MCP server respect her 4-category axioms? | 2-5 FIXes likely |
| **G2 RAG explanation feature** | Before shipping G2 MVP | Domain axioms approval — what AI can/cannot say about a peptide. Hallucination guard sign-off. | Critical — gates G2 launch |
| **Methods paper draft** | After v0.2 stable | Manuscript review, predictor parameter justifications, dataset description | Multiple rounds, weeks |
| **Threshold-curve accuracy badge** | After T2 ships threshold-curve JSON | Verify the sensitivity numbers we display are statistically defensible | Cycle of 1-2 weeks |
| **Tool-paper venue + framing** | After v1.0 feature freeze | JOSS vs Bioinformatics Advances vs NAR Web Server Issue — her preference + co-author input | One major decision |
| **Bench validation roundtrip** | Post-v1.0 | Does PVL output match her wet-lab results on new peptide sets? | Open-ended, may surface new fixes |

**Don't wait for her perfection** (your directive 2026-05-12): ship what we find best, get review fast, iterate. The 70-item ALEX_BACKLOG already shows the pattern works.

---

## §5 — WAITING ON DESY / ALEX (external partner)

| Item | Status | What we need |
|---|---|---|
| **DESY K8s cluster access** | Pending Alex | Wave 5 deploy target. Currently on Hetzner CX33. Without K8s, scaling story is "vertical VPS only." |
| **DESY email activation** (ALEX_BACKLOG OP1, OP2) | Pending Said | Needed for grant applications and DESY internal communications. |
| **DESY internal RA funding ask** | Pending Said + Alex | TOP_CEO_RECOMMENDATIONS — highest-leverage funding ask available. Cover during MIT semesters. |
| **AI/LLM compliance at DESY** | Pending Alex | Is there a no-cloud-LLM mandate? Data residency requirements? Audit log standards? Blocks G2 RAG design. |
| **Alex review of Phase G2 architecture** | Pending after T5-DEEP-001 brief | Confirm scientific RAG design + hallucination guards align with his vision. |
| **Alex's input on G3 (scientific OpenClaw) long-term** | Pending | Is it still the long-term target? Has thinking evolved? |

---

## §6 — ON HOLD (external systems, not blocking current work)

| Item | Status | Trigger to start |
|---|---|---|
| **Zenodo DOI** | Awaiting v0.2 stable | When v0.2 pushes to main with feature freeze |
| **JOSS paper submission** | Phase A.1 in ROADMAP | After Zenodo DOI + manuscript draft + Peleg + Alex review |
| **ELIXIR bio.tools registration** | Phase A.2 | After JOSS published OR Zenodo DOI + minimum-viable docs |
| **bio.tools curator engagement** | Phase A.3 | Same |
| **GitHub community / contributor recruitment** | Phase H | Post-JOSS — CONTRIBUTING.md is already in place |
| **Phase I multi-predictor consensus** (Galagos-inspired) | Strategic, post-v1.0 | Wait for Wave 2 stability + funding clarity |

---

## §7 — The honest answer to your AI-platform question

You asked: *"are we building ai from 0? are we just connecting openai to ours? what is the long term plan? I don't want ai to be just a buzzword."*

**Short answer**: we are **not** building AI from zero, and we are **not** just bolting on OpenAI. PVL's AI integration is doing three concrete things, each with measurable user value:

### 7.1 — What we are doing (concrete, not buzzword)

| Layer | Status | What it actually does for the user |
|---|---|---|
| **(1) Existing trained ML models AS the analysis engine** | ✅ Shipped (TANGO, S4PRED, ESM-2 via ADR-017) | These ARE the science. Researchers use PVL because TANGO predicts aggregation, S4PRED predicts structure, ESM-2 finds similar peptides via biological embedding. Not AI buzz — the predictors are validated published research. |
| **(2) MCP server — researchers query PVL through THEIR existing LLM** (ADR-009) | ✅ Shipped commit `80a514f` | A researcher in Claude Desktop types *"find me top 5 amyloid candidates from S.aureus length 10-50"* — their Claude calls PVL's tools, returns analyzed peptides. No new chatbot. PVL becomes a tool any AI agent can use. **This is the real differentiator** — no competitor has it. |
| **(3) Scientific RAG with PubMed citations** (Phase G2) | Not started, 40-60h | *"Why is P02743 a strong amyloid candidate?"* → AI queries PVL for P02743's data, retrieves cited papers from PubMed, generates an explanation with REAL citations (never fabricated). Hallucination-guarded by tool-call gating: AI cannot claim things PVL doesn't compute. |

### 7.2 — What we are NOT doing (the buzzword traps to avoid)

- **Not training our own LLM**. That's a $10M+ effort and not PVL's value.
- **Not building "PVL ChatBot in the corner of the dashboard"**. That's superficial. The MCP-as-front-door pattern is more powerful and reusable.
- **Not using AI to predict aggregation propensity**. TANGO already does that, validated and published. AI without training data would be worse.
- **Not letting AI generate "scientific interpretations" without citation backing**. Peleg's FIX-013 (killing ConsensusTier) made this rule. RAG must cite real papers or stay silent.
- **Not adding AI for AI's sake**. Every AI feature must answer "what specifically does this do that a researcher couldn't do faster without AI?"

### 7.3 — The "actual value of AI for PVL" framework (your test)

Before any AI feature ships, it must pass:

1. **Frustration test**: does this make a slow workflow fast? (E.g., NL search instead of clicking through UI.)
2. **Citation test**: if it generates text, is every claim backed by a paper PVL retrieved? (No model "memory" citations.)
3. **Peleg test**: would she approve the underlying scientific claim? Domain axioms reviewed before launch.
4. **Replaceability test**: if all the AI bits broke tomorrow, does PVL's core value still exist? (Yes — UI + REST API + predictors stand alone.)

### 7.4 — Where T5 deep research helps you decide G2 specifically

T5-DEEP-001 (the prompt I already wrote) will tell you:
- Which architecture for RAG fits PVL (vs alternatives)
- How citation-hallucination is prevented in scientific tools that already do this (Elicit, Consensus.app, SciSpace)
- Whether to start with feature (a) NL search depth, (b) explanation with citations, (c) cohort comparison reasoning, or (d) methods-paragraph drafting
- Tamarind Bio competitive analysis — what they do well, what gaps exist
- DESY/compliance constraints on cloud LLMs

**My recommendation, without T5 yet**: ship **(b) "explain why this peptide is risky, with PubMed citations"** as G2 MVP. It's the single feature no peptide tool has, it shows up in user demos beautifully, and the hallucination-guard pattern (tool-call → retrieved paper → cited sentence) is well-established. ~40h. Wave 3 candidate.

---

## §8 — Full path to v1.0 (everything until "platform fully done")

This is the long view. Each waves runs roughly 2-4 weeks.

| Wave | Goal | Status |
|---|---|---|
| **Wave 0** | Foundation green CI + Peleg P-wave fixes | ✅ Shipped |
| **Wave 1** | MCP server foundation + ADRs + research briefs scaffold | ✅ Shipped 2026-05-07 |
| **Wave 2** | AI platform surfaces (MCP, similarity, PDF, demo, BibTeX, About credit, hooks) | ⚠️ ~60% done, end-to-end §D + §E shipped, §B/§C/§G/§H pending |
| **Wave 0.3** | Workflow infrastructure (hooks, AGENTS.md, COLLAB.md, HANDOFF.md) — RB-004 | 🟡 Ready to dispatch, T1 ships next |
| **Wave 3** | Phase G2 Scientific RAG MVP | Pending T5 deep research + Alex sign-off |
| **Wave 4** | RB-001 feature group (FASTA + metadata-CSV + Jupyter export) | Partially in Wave 2; remainder Wave 4 |
| **Wave 5** | DESY K8s deploy + observability hardening | Blocked on Alex / DESY |
| **Wave 6** | Phase A — JOSS paper + Zenodo DOI + ELIXIR bio.tools registration | After v0.2 stable + 1 month of community use |
| **Wave 7** | Phase G3 scientific OpenClaw — Alex's long-term vision (200h+, separate repo candidate) | Post-v1.0, post-MIT |
| **Wave 8** | Phase I — multi-predictor consensus (Galagos-inspired) | Post-v1.0 strategic |
| **Wave H** | Marketing, content, community — adoption funnel | Continuous from v0.2 onward |

### Concrete done-criteria for v1.0

PVL is "fully done v1.0" when ALL these are true:

1. JOSS paper published
2. Zenodo DOI live
3. ELIXIR bio.tools registered + curator-reviewed
4. Phase G2 RAG live + Peleg-approved
5. Deployed on DESY K8s OR stable Hetzner VPS with documented runbook
6. `pvl-py` and `pvl-cli` published to PyPI
7. ≥10 external citations OR ≥1 lab using PVL routinely
8. Manuscript + supplementary materials reviewed by Peleg + Alex
9. Said HANDOFF.md complete (so 2h/month MIT mode is viable)
10. ≥3 months of green Sentry baseline (no recurring P0 errors)

Realistic timeline: **v0.2 (Wave 2 + workflow infra + G2 MVP) by July 2026; v1.0 by November 2026 if all reviews land cleanly.**

---

## §9 — Per-chunk manual test discipline (going forward)

Per `feedback_simplicity_and_testability.md`, every commit T1 makes from now on ends with:

```
🧪 Manual test
Open: <specific URL or run command>
Click: <specific action>
Expect: <specific observable outcome>
Failure mode: <what would indicate a bug>
```

If Said can't test a chunk because something's not wired or backend missing — T1 catches that BEFORE committing, not after.

---

## §10.5 — Ops infrastructure shipped 2026-05-12

| Item | Commit | Effect |
|---|---|---|
| Auto-deploy workflow `.github/workflows/deploy.yml` | `18f7b78` | Every push to main auto-deploys to VPS; deploy target = secrets, switching hosts = secret-edit only |
| 6 GitHub Secrets configured (`DEPLOY_HOST`, `_USER`, `_PATH`, `_SSH_KEY`, `_COMPOSE_FILE`, `_HEALTHCHECK_URL`) | (repo settings) | Workflow knows where to ship; dedicated SSH key generated, local private copy purged |
| `allow_auto_merge: true` on repo | (gh api) | `gh pr merge --auto --merge` works for future PRs |
| nginx Docker-DNS resolver + index.html no-cache | `f00167e` | Kills 502-after-deploy and stale-chunk-404 classes permanently |
| CodeRabbit tuned to ~1 email/PR | `601f802` | Said directive — chatbot email spam reduced ~75% |
| **T6 GitHub/Ops terminal** added to AGENTS.md | (this commit) | Owns all GitHub PR mgmt, Dependabot triage, CI failures, deploy ops, releases. Reads `T6-INSTRUCTIONS.md` (gitignored) at session start. |

---

## §10 — Workflow upgrades — what shipped (proactive, no permission asked)

Per `feedback_t1_proactive_workflow_evolution.md`, T1 ships these inline. Said opts-out if disagrees.

| # | Item | Commit | Status |
|---|---|---|---|
| 1 | `.claude/hooks/stop-test-gate.sh` — Stop hook | `60c5a96` | ✅ Shipped |
| 2 | `AGENTS.md` at project root | `60c5a96` | ✅ Shipped |
| 3 | `ADR-018` (multi-terminal protocol) + `ADR-019` (hook quality gates) | `60c5a96` | ✅ ACCEPTED |
| 4 | `docs/active/COLLAB.md` + `make changelog-peleg` | `1de05c0` | ✅ Shipped |
| 5 | `.cursor/rules/ui-visual.mdc` | `50e9c96` | ✅ Shipped |
| 6 | PRE-FLIGHT v2 additions in `COWORK_PROMPTS_PELEG.md` PROMPT 0 | (file gitignored, local) | ✅ Updated |
| Deferred | `Hook A` TS typecheck on PostToolUse + `Hook C` npm install guard | — | PROPOSED (ADR-019) — ship when demand observed |
| Pending | `docs/active/HANDOFF.md` pre-MIT template (4h) | — | Schedule before August 2026 |

**RB-004 top-5 complete.** Workflow infrastructure baseline now in place for MIT-mode operation.

---

## §11 — Open questions surfaced for next decision cycle

These accumulate. T1 brings them back when relevant context arrives.

- Push timing: rc1 tag now or after RB-004 top-5 lands?
- Should we add a T-OPS terminal spec (RB-004 recommendation) or fold its responsibilities into existing T2?
- Should Cowork V10 polish round happen before push, or after Peleg review feedback?
- Does T-PEL need an explicit reactivation when next Peleg feedback batch arrives, or does T1 absorb that role now?
