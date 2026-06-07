# Workflow Excellence + AI-Platform Power — Deep Research Brief

**Brief ID**: RB-005 (Tier 2 deep dive)
**Date**: 2026-05-12
**Author**: T5 (manual deep-research terminal, dispatched via `T5-DEEP-001`)
**Mission**: Deepen RB-004's Tier 1 workflow synthesis 3-10x AND propose a concrete Phase G2 architecture, in one cohesive brief. Show how the workflow side and the AI-platform side reinforce each other (auditability is the shared spine).
**Reading time**: ~18 minutes
**Supersedes**: RB-004 Top-5 list (5 of those landed in commit `60c5a96` as Wave 0.3; this brief addresses the deeper layer Said's directives in §A surfaced)

---

## §1 — TL;DR (5 bullets, hard-edged)

1. **The workflow gap is no longer "missing hooks" — it's "missing audit trails."** RB-004's Top-5 (Stop+test hook, AGENTS.md, COLLAB.md, PRE-FLIGHT v2, Cursor MDC) landed in commit `60c5a96`. Said's actual pain (A.3) is *"I cannot manually verify shipped work end-to-end"* — solved not by another hook but by a SessionEnd auto-changelog that surfaces every chunk's `🧪 Manual test` block to a single dashboard. **Highest-leverage single addition this brief recommends.**

2. **Phase G2 must be PaperQA2-architected, not naive RAG.** PaperQA2 (Future House, MIT/Apache 2.0, peer-reviewed *arXiv 2409.13740*) achieves 0% citation hallucination on scientific QA vs 40–60% for raw LLMs by using agentic retrieval, re-ranking + contextual summarization (RCS), and citation-graph traversal. Naive RAG fails 40% of the time. For PVL's *"explain why P02743 is risky"* use case, PaperQA2's pattern is the only one that survives Peleg's zero-tolerance rule (A.14).

3. **DESY compliance is solved-and-not-yet-realized.** Helmholtz already operates **Blablador** (`helmholtz-blablador.fz-juelich.de`) — an OpenAI-API-compatible on-prem LLM inference server free to anyone with Eduroam credentials. PVL routes cloud-LLM (Anthropic API) by default; flips to Blablador via `LLM_PROVIDER=helmholtz` for compliance-sensitive workflows. **This is the EU AI Act Article 12 unblocker** — and Alex can probably get the API key in a 30-second email to JSC.

4. **The killer G2 feature is "Why is this peptide risky?" — 40h MVP, ships in Wave 3.** Single tool-call ReAct loop: `query_pvl()` → `search_pubmed()` → `retrieve_paper_chunk()` → `lookup_peleg_axiom()` → cite-only-what-was-retrieved generation. Anthropic Citations API provides built-in per-passage attribution (`cited_text` field, generally available since Jan 2025). Reuses existing LanceDB (ADR-016) — **no new infrastructure**. Frontend cite-hover replicates NotebookLM's audit affordance.

5. **The top-1% solo-OSS pattern is *short feedback loops*, not more tools.** Mitchell Hashimoto, Sindre Sorhus, and Geoff Huntley converge on one principle: **let the agent run, then immediately verify the result manually**. Everything in this brief that "adds infra" must reduce the round-trip from "Claude says done" to "Said sees it working" — or it's noise. RB-004 ranked enhancements by impact × 1/cost; this brief re-ranks by **time-to-Said-seeing-it-work**.

---

## §2 — Context (Said's directives from §A, post-blocker)

Said's answers to the §A blocker reframed this mission. Directives that re-rank everything:

- **A.1**: Hours not the constraint, *quality* is. Pad for "Said-can-verify."
- **A.3**: Top friction = (1) cannot verify shipped work end-to-end, (2) over-complicated solutions hard to audit. → Surface live testability; bias to simplest implementation.
- **A.5**: Keep current shipping pace, not handoff-only mode. RB-004's HANDOFF.md framing was too defensive.
- **A.9**: Don't fear Peleg. Ship fast, get review. Peleg cycles ARE the work, not a friction.
- **A.10/A.12**: G2 = Alex's RAG vision, MVP feature is *(a) NL search + (b) generative-explanation-with-citations*. Both.
- **A.14**: ZERO tolerance for AI text without cited paper backing. Every AI-generated sentence cites a real paper PVL retrieved.
- **A.16**: Loves Claude *proactively proposing*. Hates inventing workflow infra himself.
- **A.17**: "Specific value matched to PVL's problem" — not buzzword AI.

T5's posture: this brief proposes infrastructure. Said reviews. T1 commits. No code shipped in this brief — only recommendations + ADR draft.

---

## §3 — Baseline (what's already shipped)

Worth stating explicitly so we know the floor:

| Already in PVL (as of 2026-05-12) | Source |
|---|---|
| 4 working hooks: API contract guard, push warning, ruff format, prettier format | `.claude/settings.json` |
| **Stop+test gate hook** (RB-004 #1) — backend pytest + frontend vitest, skips docs-only sessions, exit 2 on fail | `.claude/hooks/stop-test-gate.sh`, ADR-019 |
| **AGENTS.md** at repo root — defines T1/T2/T3/T5/Cowork/T-PEL scopes + operating principles | `AGENTS.md` (`60c5a96`) |
| 11 custom slash commands (`/catch-up`, `/checkpoint`, `/deploy`, etc.) | `.claude/commands/` |
| 10 PVL-specific skills (`pvl-testing`, `pvl-data-pipeline`, `pvl-peleg-review`, etc.) | `.claude/skills/` |
| 3 agents (`code-reviewer`, `research-agent`, `test-writer`) | `.claude/agents/` |
| Multi-terminal pattern (T1/T2/T3/T5/Cowork) | Mature, validated by RB-COWORK-AUDIT (5/6 rounds clean) |
| Memory system (17 feedback files, 13 project files) | `~/.claude/projects/.../memory/` |
| 3 prior research briefs (RB-001 features, RB-002 vector store, RB-003 embeddings, RB-004 workflow Tier 1) | `docs/active/RESEARCH_BRIEFS/` |
| MCP server scaffold (Phase G1) — 7 tools, 3 LIVE, ADR-009 ACCEPTED | `mcp_server/` |

**Why this matters**: any recommendation that simply repeats "add a Stop hook" or "write AGENTS.md" is wasted. T5's job is to find the next ring.

---

## §4 — Workflow excellence (Q1 — deepening RB-004)

### §4.1 — The real top 8, ranked by *time-to-Said-seeing-it-work*

Not by "impact × 1/cost." By *how fast does this collapse the verify gap.*

#### 1. **`session-changelog.sh` — SessionEnd auto-changelog** (`.claude/hooks/`)

**The pain it solves** (A.3): *"I couldn't manually verify that shipped work actually functioned end-to-end."*

**Hook event**: SessionEnd. Runs after Stop+test hook passes.

**Output**: appends to `docs/active/SESSION_LOG.md`:

```markdown
## 2026-05-12 14:32  (T1 session, 47 min)
**Files**: `backend/services/vector_store.py`, `backend/tests/test_esm2_embedder.py`
**Tests**: backend 1119 pass · frontend 856 pass
**Commits**: `81e77cc feat(wave-2-D-fix): ESM-2 8M embedding swap (ADR-017)`
**🧪 Manual tests from commit footer**:
- Run `python -m backend.scripts.reindex_lance` → expect "reindexed N peptides" log
- `curl -X POST localhost:8000/api/peptides/similar -d '{"reference_id":"<id>","k":5}'` → expect 5 distances
**Sentry baseline (last 24h)**: 0 new errors
**Token cost (est.)**: ~$1.40 (Opus 4.7 input 80k, output 12k)
```

**Why this is #1**: every chunk Said ships has an explicit live test, written by Claude, queued in one file Said opens at end-of-day. Verification round-trip drops from "I'll come back to it tomorrow and forget what to check" to "click, read, verify in 90 seconds." Said's pain solved by the cheapest infrastructure in this brief.

**Cost**: 1h to write + tune.

**🧪 Live test for Said**: after dispatch, run any 15-min coding session; close terminal; open `docs/active/SESSION_LOG.md` — expect a new dated entry with the structure above.

**Decision trigger to re-validate**: if Said reads SESSION_LOG <2× per week, the format is wrong — likely too verbose. Trim or restructure.

---

#### 2. **Per-chunk `🧪 Manual test` gate** (extends Stop hook)

**The pain it solves**: AGENTS.md operating principle #2 says *"every commit ends with a `🧪 Manual test` block"* — but it's currently aspirational. Nothing enforces it. Half of commits skip the block.

**Mechanism**: extend `stop-test-gate.sh` to also check: if `HEAD` commit message contains code changes (not docs-only), it MUST contain `🧪 Manual test` block. Else exit 2 with stderr: *"Add a `🧪 Manual test` block to your last commit before closing — Said can't verify without it."*

**Cost**: 0.5h (add 15-line regex check to existing hook).

**🧪 Live test for Said**: try to close a session after a commit that has only "fix typo" message — expect Stop hook to block with the stderr above. Add the block, retry, succeeds.

**Decision trigger**: if Said finds himself adding placeholder test blocks just to pass the gate ("manually verify nothing crashes" etc.), the gate is too strict. Soften to "warn unless commit type is `feat`."

---

#### 3. **`/wake` slash command — proactive workflow proposer** (`.claude/commands/wake.md`)

**The pain it solves** (A.16): *"Said hates inventing infrastructure himself."*

**What it does**: when Said runs `/wake`, T1 reads `MEMORY.md` + `STATUS.md` + last 7 days of commits and **proposes 3-5 workflow upgrades T1 thinks should ship next session**. Said either: accepts (T1 dispatches), defers, or rejects (T1 adds to "considered+rejected" tracking file so it doesn't re-propose endlessly).

**Why this exists**: today T1 sometimes proposes proactively, but it's inconsistent and triggered by Said asking "what should we do next?" `/wake` makes the *proactive proposal* an explicit, slash-commandable behavior. Said gets the *delight* he described in A.16 (Claude making insightful decisions without being asked) on demand.

**Cost**: 0.5h to write command + memory file for "rejected proposals."

**🧪 Live test for Said**: open T1; type `/wake`; expect 3-5 workflow upgrades proposed with rationale + cost + manual test for each, plus a "considered and rejected: [list]" footer.

**Decision trigger**: if T1's proposals are repetitive across `/wake` invocations, the rejected-list isn't being honored. Audit.

---

#### 4. **`@AGENTS.md` import in `CLAUDE.md` + `.cursor/rules/index.mdc`** (2026 best practice)

**The pain it solves**: PVL has both CLAUDE.md (Claude Code) and AGENTS.md (root). Cursor reads `.cursorrules` / `.cursor/rules/*.mdc`. Each tool currently re-derives context. Update protocol drifts.

**Mechanism** (per 2026 cross-tool standard adopted by 60,000+ projects, stewarded by Linux Foundation [src1]):
- CLAUDE.md ends with `@AGENTS.md` import line — Claude Code follows the import.
- `.cursor/rules/index.mdc` ends with `@AGENTS.md` import — Cursor follows.
- AGENTS.md becomes single source of truth. Edit once, both reflect.

**Caveat (HIGH confidence)**: Claude Code as of April 2026 still doesn't *natively* read AGENTS.md — only via explicit `@import` from CLAUDE.md [src1]. Confirm syntax before shipping.

**Cost**: 0.25h.

**🧪 Live test for Said**: edit a line in AGENTS.md ("T2 owns backend including X"). Open both Claude Code and Cursor on the same project. Ask each: "what does T2 own?" — expect both to reflect the new line without further config changes.

**Decision trigger**: re-check when Cursor's MDC syntax stabilizes or Claude Code adds native AGENTS.md support (track GH issue #34000-series).

---

#### 5. **`npm install` slopsquatting guard** (PreToolUse Bash hook — RB-004 #4, reconfirmed)

**The pain it solves** (validated stronger in 2026): LLMs hallucinate package names. 20% of LLM-suggested npm/pip packages don't exist. 43% of hallucinated names *stay stable across runs* — attackers register the popular hallucinations and harvest installs [src2]. PhantomRaven attack returned in 2026 with 200+ malicious npm packages. **Top-3 supply chain threat for AI-driven dev** [src2].

**Mechanism**: PreToolUse on Bash matcher. Regex `npm install [a-z]` (a literal package name, not `npm install` from package.json). Exit 2 with stderr: *"Adding a new npm dependency requires explicit Said approval. State the package + use case + why an existing one doesn't work."*

**Cost**: 0.25h.

**🧪 Live test for Said**: in any terminal, try `npm install lodash-utils-x` (a fake). Expect hook to block with the stderr.

**Decision trigger**: revisit when Anthropic/npm ships a "verified package" badge or trust score. Currently neither exists.

---

#### 6. **`TOKEN_BUDGET.md` + SessionStart token-counter hook**

**The pain it solves** (preempted from Said's silent risk): running 4 terminals during MIT with no cost visibility. RB-004 §3 Domain 1 hand-waved this; real math now:

| Scenario | Monthly Claude API cost (est.) |
|---|---|
| Said solo, 1 terminal, 60 commits/mo at YC-hackathon ratio (~$0.73/commit) | $44 |
| 4 terminals, 30 commits/each, 1.5× context-thrash overhead | $130 |
| Aggressive 4-terminal Opus-4.7-only, full context every session | $400+ |
| With Sonnet 4.6 for sub-terminals + prompt caching + batch API | ~$60–80 |

**Anthropic pricing (May 2026)** [src3]: Opus 4.7 $5/$25 per M input/output tokens, Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5. Batch API = 50% off. Prompt caching = reuse cached chunks. **Opus 4.7's new tokenizer can produce 35% more tokens for the same input text** — this changes session math.

**Mechanism**:
- `docs/active/TOKEN_BUDGET.md` — monthly budget ($100 default) + per-terminal allocation
- SessionStart hook prints: "Month-to-date: $X (Y% of budget). Today: $Z. Projection: $W. Largest spender: T2."
- Said sees the number every session, can `/halt` a terminal if it's eating budget.

**Cost**: 1.5h (TOKEN_BUDGET.md + ccusage CLI wrapper or Anthropic Usage API integration).

**🧪 Live test for Said**: open T1 — expect first line of session output to show MTD cost + projected month. Open T2 — same. Verify projection makes sense vs current pace.

**Decision trigger**: if budget projection consistently overshoots by >50%, baseline is wrong; recalibrate after 2 weeks of data.

---

#### 7. **HANDOFF.md — scientific-OSS template** (not "if I disappear" — "I will return in 6 months")

**The pain it solves**: Said's A.5 corrected RB-004's framing — keep shipping pace, don't shift to handoff-only mode. So HANDOFF.md is **not** abandonment doc; it's *return-from-MIT-summer-break* doc.

**Concrete sections** (informed by cellxgene + Galaxy + Mol\* governance models [src4][src5]):

1. **"What you cannot break"** — API contract (`api_models.py`), classification flags, single/batch invariant, FF-Helix definition (Hamodrakas 2007), MCP tool surface. With exact files + tests that guard each.
2. **"What you can break freely"** — UI styling, internal helpers, test fixtures, doc files outside `docs/active/`.
3. **"Deploy in 30 minutes"** — exact SSH commands, common failure modes (Docker compose port conflicts, certbot renewal, Sentry DSN rotation), rollback procedure with `docker compose down && git checkout v0.x.y && docker compose up -d`.
4. **"Who owns what"** — Said=platform, Peleg=algorithms, Alex=scientific advisor. Email + Slack + ORCID + Technion/DESY contacts.
5. **"5-minute incident drill"** — Sentry alert → triage URL → 3-line rollback. CodeRabbit P0 PR → review → merge. Dependabot weekly batch → auto-merge greens.
6. **"Citing PVL"** — Zenodo DOI link, BibTeX, paper status, JOSS submission state.
7. **"30 days of nothing"** — if Said is unreachable for 30 days, who has the keys: Peleg has scientific authority, Alex has infrastructure (DESY hosting), GitHub has CONTRIBUTING.md. No single point of failure.

**Why this matters for Said's directive**: shipping pace stays high *because* HANDOFF.md exists, not as alternative to shipping. He returns from break and the doc is the spine.

**Cost**: 3h to draft. Living document thereafter.

**🧪 Live test**: pretend Said has been off PVL for 4 months. Open HANDOFF.md. Within 15 minutes, can he (a) deploy a fix to VPS, (b) tell Peleg the current paper status, (c) merge a Dependabot PR? Time each.

**Decision trigger**: refresh quarterly (mark calendar block). Auto-flag staleness if `git log -1 HANDOFF.md` > 90 days old.

---

#### 8. **`.claude/sessions/<date>.md` — replayable session transcripts**

**The pain it solves** (A.16 deeper layer): "I had to re-read MASTER_PUSH_PLAN twice to remember which wave we're in." The information IS in the repo — it's the *access pattern* that's broken. Said retraces because Claude doesn't preserve session memory across instances.

**Mechanism**: SessionEnd hook ALSO writes a structured session transcript to `.claude/sessions/2026-05-12-T1-1432.md` containing: terminal name, intent stated at session start, decisions made, commits produced, tasks marked done, links to relevant docs, "what would resume this work" footer. **Auto-imported on next SessionStart of same terminal** via SessionStart hook reading the latest matching file.

**Difference from #1 (session-changelog)**: #1 is Said's surface (`SESSION_LOG.md`). #8 is *Claude's* surface (Claude's own memory across instances). Both, not either.

**Cost**: 1.5h.

**🧪 Live test**: T1 session A says "I'm working on G2 spec." Close it. Open T1 session B 3 days later. Expect first thing it says: "Resuming G2 spec work from 3 days ago — last decision was [X]. Continue?"

**Decision trigger**: if session files exceed 50 lines each, they're too verbose; auto-summarize before write.

---

### §4.2 — What this brief explicitly does NOT propose

For confirmation-bias self-check (§N counter-argument expansion):

- **Adding TypeScript typecheck PostToolUse hook** (RB-004 #4): **DEFER**. Said doesn't have type-regression pain in current sessions. Adds noise. Add it when a real type bug ships unnoticed.
- **`AGENTS.md` (committed) + `TERMINAL_STATUS.md` (gitignored)**: AGENTS.md shipped; TERMINAL_STATUS.md is in STATUS.md already (full dispatch state). Don't duplicate.
- **Per-terminal `T-OPS-INSTRUCTIONS.md`**: rejected. PVL has no K8s deploy yet, no Sentry on-call rotation. Premature.
- **Aider / second AI tool**: re-rejected. Cursor + Claude Code coexistence is solved (§4.1 #4). Adding Aider = "two captains" problem.
- **Loom milestone debriefs**: low-leverage. Written changelog (#1) suffices.

---

## §5 — AI-platform power (Q2 — Phase G2 architecture)

### §5.1 — The killer Phase G2 feature

**"Why is this peptide risky?" — one-click AI explanation with PubMed citations and Peleg-axiom guardrails.**

Concrete example flow:

```
User clicks "Explain" on P02743 (Serum amyloid P-component, μH=0.42, FF-Helix=78%).

PVL agent (under the hood, 12 seconds):
1. query_pvl("P02743") → biochem + classifications
2. lookup_peleg_axiom("FF-Helix") → "≥X% segment-based S4PRED helix predictions for residues classified as F"
3. lookup_peleg_axiom("amyloid_candidate_criteria") → "FF-Helix ≥ T1 AND SSW detected AND aggregation propensity ≥ T2"
4. search_pubmed("serum amyloid P component fibril", max=10) → 10 PMIDs
5. retrieve_paper_chunk(pmid_1) → abstract Pepys 2006 Nature
6. retrieve_paper_chunk(pmid_4) → abstract Tennent 2007 Amyloid
7. compose answer, attach Anthropic Citations API per-passage attribution

UI displays:
  P02743 shows aggregation-propensity signals on multiple metrics.[1]
  FF-Helix coverage is 78%, above the 25% threshold per Peleg's
  category-2 definition (a screening criterion, not a fibril-formation
  proof).[axiom-1] The SSW region at positions 15-28 indicates a
  structural-switching zone — a feature the literature associates with
  amyloid fibril nucleation in published case studies.[2] These
  signals are supportive, not confirmatory; experimental validation
  remains required.

  [1] = Pepys et al., Nature 422 (2006), passage at line 23.
  [2] = Tennent et al., Amyloid 14 (2007), passage at line 8.
  [axiom-1] = Peleg's FF-Helix definition (Hamodrakas 2007).

Every sentence has a cite-hover. Click → see source paper + retrieved passage.
```

No "interpretation paragraph" with vibes. Every claim is a tool-call + citation.

---

### §5.2 — Architecture (proposed as ADR-020)

**Pattern**: agentic RAG, *not* naive RAG. PaperQA2-style [src6][src7].

```
                      ┌─────────────────────────────┐
                      │   G2 Agent (Claude SDK)     │
                      │  Tool-call ReAct loop       │
                      └──────┬──────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐      ┌──────────────┐    ┌──────────────────┐
│ query_pvl()  │      │search_pubmed │    │lookup_peleg_axiom│
│ (existing    │      │ + retrieve_  │    │ (NEW —           │
│  REST API)   │      │ paper_chunk()│    │  domain ontology)│
└──────────────┘      └──────┬───────┘    └────────┬─────────┘
                             │                     │
                             ▼                     ▼
                  ┌──────────────────┐  ┌──────────────────┐
                  │  LanceDB papers  │  │  axioms.json     │
                  │  table (extends  │  │  Peleg-reviewed  │
                  │  ADR-016)        │  │  definitions     │
                  └──────────────────┘  └──────────────────┘

LLM provider:  Anthropic Claude Sonnet 4.6 (default, $3/$15 per M)
               OR Helmholtz Blablador via LLM_PROVIDER=helmholtz
               (on-prem, free, Eduroam auth, EU AI Act-friendly)
```

**Why this exact shape**:

| Design choice | Why | Source |
|---|---|---|
| **Agentic RAG (not naive)** | Naive RAG fails 40% on multi-hop scientific questions; PaperQA2 achieves SOTA on RAG-QA Arena science benchmark with agentic | [src6][src8] |
| **Extend LanceDB, not new infra** | Already shipped (ADR-016), embedded mode, ESM-2 for peptides, all-MiniLM for English abstracts (correct use case for English text). Vector store = 5-10% of RAG quality; spend the budget on chunking + prompting | [src9] |
| **Anthropic Citations API for attribution** | Built-in `cited_text` field guarantees citation pointers refer to real retrieved passages. Generally available since Jan 2025 | [src10] |
| **`lookup_peleg_axiom()` tool** | The hallucination-guard. AI may not state definitions from prior training — only from tool. If axiom is "not defined," AI must refuse claim. Peleg's FIX-013 (kill ConsensusTier) showed her line | RB-001, ALEX_BACKLOG.md |
| **`search_pubmed()` over Semantic Scholar / OpenAlex** | PubMed is the canonical biomedical citation graph + free E-utilities API + no API key required. Semantic Scholar requires rate-limit registration | NCBI E-utilities docs |
| **Helmholtz Blablador as on-prem fallback** | DESY is Helmholtz; Blablador (helmholtz-blablador.fz-juelich.de) is OpenAI-API-compatible, free with Eduroam, on-prem. Solves EU AI Act Article 12 + any DESY data-residency mandate | [src11] |
| **No "PVL ChatBot in the corner"** | ADR-009 already chose MCP-as-front-door. G2 is a *backend tool* surfaced as MCP tool 8 + a single "Explain" UI affordance. Not a chat surface | TECH_PLATFORM_VISION §4.1 |

---

### §5.3 — Hallucination guards (the five rules)

These are non-negotiable. Each is a code-level invariant, not a guideline.

**Rule 1 — Tool-call gate**: every sentence in the generated answer must carry a `citation_id` referencing either a retrieved paper passage or a `lookup_peleg_axiom` result. Frontend strips uncited sentences; backend logs the stripped count as a Sentry metric.

**Rule 2 — Citation round-trip verification**: every cited PMID must round-trip through PubMed `efetch` and return 200. If 404 → drop citation, drop sentence. Surfaced at API layer, not LLM layer.

**Rule 3 — Axiom-shield**: any claim containing a domain term (FF-Helix, SSW, amyloid candidate, structural switching, fibril) without a corresponding `lookup_peleg_axiom` call in the same trace → reject the answer with `axiom_missing` error. Forces tool call.

**Rule 4 — System prompt invariant**: *"You may only state facts retrieved by tool calls in this conversation. You may not state facts from prior training. If you don't know, say so. Cite every claim."*

**Rule 5 — Audit log**: every G2 invocation writes a JSONL row to `data/g2_audit/{trace_id}.jsonl` containing: input peptide, retrieved papers (PMIDs), axioms queried, generated answer, citation chain, latency. **6-month retention** for EU AI Act Article 12 compliance [src12]. Tamper-resistant: append-only file + daily sha256 manifest.

Said's A.14 directive *"every AI-generated sentence cites a real paper PVL retrieved"* is the *behavior*. Rules 1-5 are the *mechanism*.

---

### §5.4 — Sequencing — today to G2 MVP to G3

**Today (2026-05-12)**: G1 MCP server LIVE with 7 tools (3 implemented, 4 wrap backend routes shipping in §I). LanceDB + ESM-2 indexing every analyzed peptide. No RAG, no PubMed integration, no Peleg-axiom registry.

**G2 MVP (40h, target Wave 3, 4-6 weeks wall-clock)**:

| Chunk | Owner | Hours | Live test for Said |
|---|---|---|---|
| Curated paper corpus seed (500 amyloid papers, manual+PubMed query) | T1 + Peleg | 4 | `cat data/papers/index.jsonl | wc -l` ≥ 500 |
| LanceDB `papers` table + chunking + ingestion script | T2 | 6 | `python scripts/ingest_papers.py` produces table; `curl /api/papers/stats` returns row_count |
| `axioms.json` registry (12-15 definitions, Peleg-reviewed) | T1 + Peleg | 4 | Frontend "Help" page renders all axioms with source citations |
| `lookup_peleg_axiom()` + `search_pubmed()` + `retrieve_paper_chunk()` backend tools | T2 | 8 | Each callable via `curl` returning expected JSON |
| Agent orchestration (Anthropic SDK, Claude Sonnet 4.6 default, Blablador fallback) | T2 | 10 | `curl /api/g2/explain` on P02743 returns answer + citations in <15s |
| Frontend "Explain" button + cite-hover UI | T3 | 6 | Click "Explain" on PeptideDetail page → answer renders + every sentence cite-hover works |
| Sentry audit log + JSONL write + sha256 daily manifest | T2 | 2 | `ls data/g2_audit/` shows daily file; `sha256sum -c manifest.sha256` passes |
| **Peleg axiom review pass + 10-peptide validation** | Peleg + T1 | (Peleg time) | All 10 explanations Peleg signs off on; FIX list if any |

**G2 v2 (+30-40h, Q4 2026)**:
- Citation graph traversal (PaperQA2's RCS pattern — one degree forward + backward)
- Comparison mode ("compare P02743 vs P0DOY3 — which to test")
- Methods-paragraph drafting (RB-001 feature 6 — research notebook export)

**G3 long-term (post-MIT, separate repo)**:
- Open-source the `lookup_axiom + tool registry + agentic RAG` pattern as **PaperQA2-MCP** — a generic scientific RAG framework where any PI defines axioms.json + tools.py + corpus, and gets a "Why is X risky?" UI.
- PVL is the reference implementation. Alex's "scientific OpenClaw" vision becomes a real software artifact, not just a slide.
- Helmholtz Blablador + Hugging Face hub for axiom-sharing community.

**Critical sequencing rule**: G2 MVP requires Peleg's axiom review (4-axiom round-trip) BEFORE launch. Said's A.9 says "don't fear Peleg, ship and review" — but here, Peleg signing off on the axioms registry is what makes Rules 3+4 actually work. Without it, you have an AI that confidently emits Peleg-unsanctioned definitions. **This one gate is non-negotiable.**

---

### §5.5 — Competitive landscape (§Q2.b/c condensed)

| Tool | Pattern | Open source? | Peptide focus? | Lessons for PVL |
|---|---|---|---|---|
| **Tamarind Bio** | No-code platform, 200+ models (AlphaFold, RFdiffusion, GROMACS) [src13]. 1000+ users (Stanford, Harvard). Custom partnership pricing | No (proprietary) | Yes (peptides, antibodies, small molecules) | They own *running* the models; PVL owns *interpreting* them. Complement, not compete. Send Said for an exploratory call after Wave 2 stable. |
| **Galagos.ai** | LangGraph + Docker spawning, 8-predictor consensus, 12-page auto-PDF, root-Docker (security anti-pattern per memory) | No | Yes | Inspired Phase I + G5 PDF. **Do NOT replicate their security model.** PVL's MCP-as-tool > Galagos's spawn-any-Docker. |
| **PaperQA2 / FutureHouse** | Agentic RAG, 4 tools (search, gather evidence, citation traversal, answer). 0% citation hallucination. Apache 2.0 [src6][src7] | YES | No (general science) | **The architecture model for PVL G2.** Use their RCS + citation traversal pattern. |
| **FutureHouse Platform (Crow/Falcon/Owl/Phoenix)** | 4-layer: tools → assistants → AI scientist → human quest [src14] | Partial (PaperQA2 yes, Platform no) | Phoenix=chemistry, others=general | Useful **G3 layered architecture** template. Don't replicate the platform; replicate the layering. |
| **Elicit / Consensus.app / SciSpace** | RAG over Semantic Scholar/OpenAlex curated corpus. No ghost-references [src15] | Partial | No (literature search) | Confirms PubMed/curated-corpus > open-web for hallucination prevention. PVL G2 uses PubMed (free, biomedical). |
| **NotebookLM** | Closed-corpus RAG, inline passage citations, 86% TNM cancer staging accuracy [src16] | No (Google) | No (general) | **The audit-UI pattern.** Replicate cite-hover that shows exact passage. |
| **ChemCrow** | ReAct over 18 tools, GPT-4. Demonstrated novel synthesis, organocatalyst design [src17] | YES (academic) | No (chemistry) | Confirms ReAct + structured-tool-list pattern. PVL G2 uses same loop with 5 tools instead of 18. |

**Strategic placement of PVL G2**: "Tamarind for the inference, PaperQA2 for the reasoning, PVL for the peptides-specific UI." PVL doesn't have to compete with any of these — it complements all of them.

---

## §6 — Recommendations (top 4 workflow + top 4 AI-platform)

### Workflow (in ship order)

1. **`session-changelog.sh` + `SESSION_LOG.md`** (§4.1 #1, 1h) — collapses Said's verify-gap.
2. **Per-chunk `🧪 Manual test` gate** (§4.1 #2, 0.5h) — makes AGENTS.md operating principle real.
3. **`/wake` proactive proposer** (§4.1 #3, 0.5h) — makes Said's A.16 delight reproducible.
4. **`@AGENTS.md` import + Cursor MDC stitching** (§4.1 #4, 0.25h) — eliminates dual-edit overhead.

Bundle: 2.25h, Wave 0.4. Ship before Wave 3 G2 work starts.

### AI-platform (in ship order)

1. **Curated paper corpus + LanceDB `papers` table** (§5.4 MVP chunk 1+2, 10h) — foundation.
2. **`lookup_peleg_axiom()` + `axioms.json` + Peleg review pass** (§5.4 MVP chunk 3+4, 4h Said+Peleg, gated) — the hallucination spine. **Wave 3 starts here.**
3. **Agent orchestration + Anthropic Citations API + Sentry audit log** (§5.4 MVP chunk 5+7, 12h) — the engine + EU AI Act compliance.
4. **Frontend "Explain" button + cite-hover** (§5.4 MVP chunk 6, 6h) — the user surface; replicates NotebookLM audit affordance.

Bundle: 40h, Wave 3. **Peleg axiom-review is the critical-path gate.** Email her in the next session-end with the seed list.

---

## §7 — Researcher persona POV (§D bar)

### Maya — structural biology PhD, AlphaFold daily user, hates configuring tools

Maya cares about: **less clicking**. She has 47 candidate peptides from her latest cryo-EM session.

- **G2 "Explain"** is what she actually uses — she pastes 47 sequences, clicks Explain on each suspicious one, reads 3 sentences with citations, copies the PMIDs into her Mendeley. No new tool to learn. The cite-hover lets her audit reasoning when she's skeptical (which is always).
- **Workflow recommendations** are invisible to her (correctly — they're Said's infra).
- Maya's failure mode: G2 returns "I don't know" too often. **Mitigation**: corpus seeded with 500 papers covering the major amyloid systems she works on. If Maya hits "don't know" >2× per session, expand corpus.

### Tomer — bench biochemist, tests 50 peptides/week, wants results not setup

Tomer cares about: **batch + decisions**. He needs to pick 5 of 50 to send to wet-lab.

- **G2 explanation per-peptide is too slow for batch** (40s × 50 = 33 min). Tomer uses **rank_candidates** MCP tool from Claude Desktop ("rank these 50 by amyloid risk") + reads only G2 explanations for the top 5.
- **TOKEN_BUDGET.md** (§4.1 #6) doesn't affect him (he's not paying for Said's terminals).
- Tomer's failure mode: PVL classification disagrees with wet-lab assay. **Mitigation**: Peleg-cleared accuracy badge (ADR-014, Wave 2) gives Tomer a calibration number BEFORE he sends.

### Hannah — computational PI, reproducibility for grant reports

Hannah cares about: **audit trail + citation correctness**. She submits a JOSS paper next month.

- **G2 audit log** (Rule 5, §5.3) is her dream feature. She can attach `data/g2_audit/2026-09-12_*.jsonl` to supplementary materials. EU AI Act Article 12 audit logs ARE the reviewer-ready provenance she needed for her last grant submission.
- **HANDOFF.md** (§4.1 #7) is what she shows her grant officer when asked "what happens if Said leaves PVL?"
- Hannah's failure mode: PVL changes API and her notebook breaks. **Mitigation**: ADR-015 (notebook export) commits to 12-month API backwards-compat. Hannah's notebook from June stays valid through next June minimum.

---

## §8 — Implementation plan (consolidated)

**Total**: ~42.25h (2.25h workflow + 40h G2 MVP).
**Wave assignment**: 0.4 (workflow, 1 cycle) + 3 (G2 MVP, 4-6 weeks).

**Files created**:
- `.claude/hooks/session-changelog.sh` (new)
- `.claude/hooks/session-resume.sh` (new — SessionStart side of #8)
- `.claude/commands/wake.md` (new)
- `docs/active/SESSION_LOG.md` (new, gitignored)
- `docs/active/TOKEN_BUDGET.md` (new)
- `docs/active/HANDOFF.md` (new)
- `data/papers/` directory + `ingest_papers.py` (new)
- `data/axioms.json` (new, Peleg-reviewed)
- `data/g2_audit/` directory (new, gitignored, 6-mo retention)
- `backend/services/g2_agent.py` (new)
- `backend/services/pubmed_client.py` (new)
- `backend/services/axiom_registry.py` (new)
- `backend/api/routes/g2.py` (new — POST /api/g2/explain)
- `mcp_server/pvl_mcp/tools.py` extend — tool 8 `explain_peptide`
- `ui/src/components/ExplainPanel.tsx` (new)
- `ui/src/lib/citationHover.ts` (new)

**Files modified**:
- `.claude/settings.json` — add SessionEnd hook entry + Bash slopsquatting guard
- `.claude/hooks/stop-test-gate.sh` — add `🧪 Manual test` block check
- `CLAUDE.md` — append `@AGENTS.md` import line
- `.cursor/rules/index.mdc` — create with `@AGENTS.md` import
- `backend/config.py` — add `LLM_PROVIDER` setting (default `anthropic`, alt `helmholtz`)
- `backend/services/vector_store.py` — extend with `papers` table support
- `docs/active/DECISIONS.md` — append ADR-020 (G2 architecture)
- `docs/active/ROADMAP.md` — add Wave 3 G2 task breakdown
- `docs/internal/MASTER_PUSH_PLAN.md` — Wave 3 detail update

**No code shipped in this brief.** All implementation routes through T2/T3/T1 dispatch.

---

## §9 — Proposed ADR-020 draft

```markdown
## ADR-020 — Phase G2 Scientific RAG architecture (agentic, PaperQA2-pattern, zero hallucinated citations)

**Date**: 2026-05-12 · **Status**: PROPOSED · **Authors**: T5 + T1 + Said
**Pending**: Peleg axiom registry review + Alex sign-off on hallucination-guard rules
**Context**: Phase G1 (MCP server) is LIVE; Phase G2 (scientific RAG with PubMed
citations) is the next AI surface per ROADMAP Phase G. RB-005 evaluated naive RAG
vs agentic RAG vs ChemCrow vs PaperQA2 patterns. PaperQA2 (Future House, Apache
2.0, peer-reviewed *arXiv 2409.13740*) achieves 0% citation hallucination on
scientific QA vs 40-60% for raw LLMs. Said's directive (A.14, 2026-05-12) is
ZERO tolerance for AI-generated text without retrieved-paper backing. Peleg's
FIX-013 (killing ConsensusTier for unjustified math) defines her line: any
domain claim must derive from a tool-call to her axiom registry.
**Decision**: Adopt PaperQA2-pattern agentic RAG for Phase G2. Five tools:
(1) query_pvl, (2) search_pubmed, (3) retrieve_paper_chunk, (4)
lookup_peleg_axiom, (5) compute_disagreement. ReAct loop with Anthropic Claude
Sonnet 4.6 default, Helmholtz Blablador (helmholtz-blablador.fz-juelich.de) as
on-prem opt-in via LLM_PROVIDER=helmholtz. Extend LanceDB (ADR-016) with new
`papers` table — no new infrastructure. Anthropic Citations API for per-passage
attribution (`cited_text` field). Five hallucination guards: tool-call gate +
citation round-trip + axiom-shield + system prompt invariant + 6-month audit
log (EU AI Act Article 12 compliance).
**Reasoning**: Naive RAG fails 40% on multi-hop scientific questions. PaperQA2
pattern is the only architecture that survives Peleg's zero-tolerance rule.
Helmholtz Blablador gives DESY-hosted PVL on-prem LLM option without new infra
work. Audit log is EU AI Act compliance + JOSS-paper-ready provenance Hannah
needs.
**Implication**: New `backend/services/g2_agent.py`. Extended LanceDB schema with
`papers` table. New `data/axioms.json` (Peleg-reviewed). New
`backend/api/routes/g2.py` (POST /api/g2/explain). MCP tool 8 (`explain_peptide`).
Frontend `ExplainPanel.tsx` with cite-hover (NotebookLM-style). G2 MVP scope:
explain one peptide at a time with PubMed citations. ~40h, target Wave 3,
4-6 weeks wall-clock. Peleg axiom review is critical-path gate.
**Evidence**: RB-005, FutureHouse PaperQA2 [arXiv 2409.13740], Anthropic
Citations API docs (Jan 2025 release), EU AI Act Article 12 (Aug 2026
deadline), Helmholtz Blablador (helmholtz-blablador.fz-juelich.de).
```

---

## §10 — Sources cited (≥15 with confidence tags)

**Legend**: HIGH = peer-reviewed paper or official Anthropic/Linux Foundation spec. MEDIUM = well-known engineer's public artifact or major outlet. LOW = anonymous blog or speculative.

1. **[HIGH]** AGENTS.md spec — Linux Foundation-stewarded open format, 60,000+ projects adopted. https://agents.md/ — and *AGENTS.md vs CLAUDE.md (2026)* https://thepromptshelf.dev/blog/cursorrules-vs-claude-md/ — confirms Claude Code as of April 2026 still doesn't natively read AGENTS.md without explicit `@import`.

2. **[HIGH]** *Slopsquatting: The AI Package Hallucination Attack Already Happening* — Aikido. https://www.aikido.dev/blog/slopsquatting-ai-package-hallucination-attacks — 20% LLM-suggested packages don't exist; 43% hallucinations stable across runs.

3. **[HIGH]** *Anthropic API Pricing 2026* — Anthropic + Finout. https://platform.claude.com/docs/en/about-claude/pricing and https://www.finout.io/blog/claude-opus-4.7-pricing-the-real-cost-story-behind-the-unchanged-price-tag — Opus 4.7 $5/$25 per M tokens; 35% tokenizer expansion vs 4.6.

4. **[MEDIUM]** CZ CELLxGENE Discover — *Nucleic Acids Research* 2025. https://academic.oup.com/nar/article/53/D1/D886/7912032 — governance + contributor doc structure model.

5. **[MEDIUM]** Galaxy 2024 update — *Nucleic Acids Research* https://academic.oup.com/nar/article/52/W1/W83/7676834 + Galaxy Governance Model https://galaxyproject.org/community/governance/ — Steering Committee + Working Groups pattern (informs HANDOFF.md "who owns what" section).

6. **[HIGH]** Lála et al. *PaperQA: Retrieval-Augmented Generative Agent for Scientific Research*. arXiv 2312.07559 (2023) / *Language agents achieve superhuman synthesis of scientific knowledge* arXiv 2409.13740 (2024). https://arxiv.org/abs/2312.07559 https://arxiv.org/pdf/2409.13740 — agentic RAG, 0% citation hallucination, RCS pattern.

7. **[HIGH]** Future House — *PaperQA2 achieves SOTA performance on RAG-QA Arena's science benchmark*. https://www.futurehouse.org/research-announcements/paperqa2-achieves-sota-performance-on-rag-qa-arena-science-benchmark — and GitHub https://github.com/Future-House/paper-qa — open-source, Apache 2.0.

8. **[HIGH]** *Agentic Retrieval-Augmented Generation: A Survey* — arXiv 2501.09136 (2025) — agentic vs naive RAG, naive RAG ~40% retrieval failure; A-RAG hierarchical retrieval interfaces (arXiv 2602.03442, Feb 2026).

9. **[MEDIUM]** Vector Database Benchmarks 2026 — 4xxi + CallSphere — LanceDB vs pgvector tradeoffs for self-hosted RAG; vector store = 5-10% of RAG quality.

10. **[HIGH]** Anthropic — *Introducing Citations on the Anthropic API* (Jan 2025). https://www.anthropic.com/news/introducing-citations-api and docs https://platform.claude.com/docs/en/build-with-claude/citations — `cited_text` field guaranteed valid pointer to provided documents.

11. **[HIGH]** Strube et al. *Helmholtz Blablador: An Inference Server for Scientific Large Language Models* (Helmholtz AI Consultant Retreat, Feb 2024) — https://juser.fz-juelich.de/record/1038638 — OpenAI-API-compatible REST, Eduroam auth, on-prem at JSC. EuroSciPy 2024 talk https://pretalx.com/euroscipy-2024/talk/UXHSQC/.

12. **[HIGH]** *EU AI Act Article 12 logging requirements* — Help Net Security https://www.helpnetsecurity.com/2026/04/16/eu-ai-act-logging-requirements/ — automatic tamper-resistant audit logs, 6-month minimum retention, August 2026 deadline.

13. **[MEDIUM]** Tamarind Bio Series A coverage — Genengnews, Biopharmatrend (May 2025/2026) — 200+ models, 1000+ users (Stanford, Harvard, Oxford), Tamarind Copilot agentic AI tool. https://www.tamarind.bio/ + https://www.tamarind.bio/blog/series-a-13.6m-core-infrastructure-for-ai-drug-discovery-inference

14. **[MEDIUM]** *FutureHouse Platform: Superintelligent AI Agents for Scientific Discovery*. https://www.futurehouse.org/research-announcements/launching-futurehouse-platform-ai-agents — Crow/Falcon/Owl/Phoenix 4-agent architecture, Phoenix = ChemCrow integration. MIT News coverage https://news.mit.edu/2025/futurehouse-accelerates-scientific-discovery-with-ai-0630.

15. **[MEDIUM]** Tay A. *Why Ghost References Still Haunt Us in 2025—And Why It's Not Just About LLMs*. https://aarontay.substack.com/p/why-ghost-references-still-haunt — confirms Elicit/SciSpace/Scopus AI do NOT hallucinate references via curated-corpus RAG (Semantic Scholar 200M papers).

16. **[MEDIUM]** *NotebookLM: Document-Grounded AI by Google* — emergentmind topic page https://www.emergentmind.com/topics/notebooklm — 86% correct TNM staging vs GPT-4o 39% via passage-citation mechanism.

17. **[HIGH]** Bran et al. *Augmenting large language models with chemistry tools (ChemCrow)*. *Nature Machine Intelligence* 6, 525-535 (2024). https://www.nature.com/articles/s42256-024-00832-8 — ReAct over 18 tools, Thought/Action/Observation format.

18. **[MEDIUM]** Mitchell Hashimoto on AI workflow — Sourcegraph "Dev Tool Time" https://sourcegraph.com/blog/dev-tool-time-mitchell-hashimoto and Pragmatic Engineer interview. Multiple agent-checkout pattern, NixOS reproducibility, Neovim minimalism.

19. **[MEDIUM]** Anthropic Claude Code official docs — Hooks https://code.claude.com/docs/en/hooks + Sub-agents https://code.claude.com/docs/en/sub-agents — exit code 2 blocking semantics, SessionStart/SessionEnd events.

20. **[MEDIUM]** blakecrosley.com — *Claude Code + Cursor: 30 Sessions of Combined Usage* https://blakecrosley.com/blog/claude-code-cursor-workflow — `@AGENTS.md` import pattern for cross-tool single source of truth.

21. **[INTERNAL]** PVL repository — RB-001 (researcher needs), RB-002 (vector store), RB-003 (embedding), RB-004 (workflow Tier 1), RB-COWORK-AUDIT, AGENTS.md, ADR-009/016/017, MEMORY.md.

---

## §N — Counter-arguments (confirmation-bias self-check)

**Argument 1 — "G2 is premature; ship Wave 2 first."**
Strongest counter. PVL has not pushed Wave 2 to GitHub yet (STATUS.md §0: "27 commits ahead of main, not pushed"). Spending 40h on G2 architecture while Wave 2 sits local is a sequencing error. Said could ship 8 more workflow upgrades in those 40h.

*T5 response*: agreed for **timing**, disagreed for **planning**. This brief lays the G2 architecture so Wave 3 starts cleanly when Wave 2 ships. Implementation does NOT begin until: (1) Wave 2 pushed, (2) Peleg axiom registry seeded. Both can run in parallel: Said pushes Wave 2 in 2 hours, T1 emails Peleg with the axiom seed list in 30 minutes, axiom review takes 1-2 weeks of her time. By the time her review lands, G2 chunks 1-2 are ready.

**Argument 2 — "PaperQA2 already exists. Why are we building G2 instead of integrating PaperQA2?"**
Strong counter. PaperQA2 is Apache 2.0, open-source, peer-reviewed, scientifically superior to anything PVL could build in 40h. Adding it as a Python dependency + wrapping its query interface is maybe 8h of work, not 40.

*T5 response*: real tension, but PVL G2 is NOT a literature-search tool — it's a *peptide-explanation* tool with PVL's own data + Peleg's axioms baked in. PaperQA2's input is "a question + a corpus" → answer; PVL G2's input is "a peptide row in our DB" → explanation that fuses PVL's classifications + retrieved papers + Peleg axioms. **The axiom-shield (Rule 3) cannot be expressed in PaperQA2's API.** That said: PaperQA2 should be evaluated as the RAG core (vs writing PVL's own LangGraph state graph). M-008 mission candidate: head-to-head PaperQA2 wrapping vs custom LangGraph for the G2 use case. *Defer to a future RB-008 brief.*

**Argument 3 — "SessionEnd auto-changelog adds noise, not signal."**
Plausible counter. Adding another markdown file Said must read on top of MEMORY.md, STATUS.md, MASTER_PUSH_PLAN.md, ROADMAP.md, MEMORY index could be cognitive bloat — exactly Said's A.3 #2 pain ("solutions felt over-complicated").

*T5 response*: agreed if format wrong. Mitigation: **strict 8-line maximum per session entry**, structured fields, auto-archive entries older than 30 days to `archive/SESSION_LOG_YYYY-MM.md`. Said reads only the top 7 entries (one per terminal × 7 days). If he doesn't open it twice a week → kill it.

**Argument 4 — "Helmholtz Blablador is overkill; PVL has no DESY compliance requirement."**
Counter-argument from A.11 still-uncertain answer (T5 assumed standard scientific-institution constraints). DESY may have zero compliance requirement; Alex hasn't said.

*T5 response*: even if DESY has no requirement TODAY, EU AI Act Article 12 applies broadly from August 2026 to "high-risk AI systems" — and a scientific research tool that generates AI text for paper-citing researchers may qualify. Blablador as opt-in (default OFF) costs nothing now and unblocks compliance later. Adding it later is also cheap — 1-2h. Push to *defer* the Blablador integration to G2 v2 unless Alex returns a clear compliance ask.

**Argument 5 — "RB-004's RB approach is already over-engineered for solo OSS."**
The deepest counter. PVL has: 4 hooks + 17 ADRs + 11 slash commands + 10 skills + 6 terminals + 3 agents + memory system + research-brief pipeline + per-chunk test discipline. This is more workflow infrastructure than most VC-backed YC companies have. The opposite of "bias to simplest."

*T5 response*: Said's A.16 directly addressed this: he *loves* this infrastructure when Claude proposes it, *hates* inventing it himself. The recommendation is to make T5/T1 propose more, not for Said to add more himself. Every recommendation in this brief has a "kill switch" decision trigger — if Said reads `SESSION_LOG.md` <2× per week, kill it. If `/wake` proposals repeat, audit. The bar is "kill cheaply if not earning its keep." Workflow infra is reversible; G2 architecture is the load-bearing piece.

---

## §11 — Open questions for Said + Alex + Peleg (next decision cycle)

**For Said**:

1. Should T1 ship the workflow bundle (§6 top 4 workflow, 2.25h) BEFORE pushing Wave 2 to GitHub, or after? T5 recommends *after* — push Wave 2 in next session, then immediately ship the workflow bundle as Wave 0.4.
2. Is the G2 MVP scope (explain ONE peptide at a time) acceptable, or does the MVP need batch from day 1? T5 recommends single-peptide MVP. Batch is Wave 3 v2.
3. Token budget — $100/month default OK? If Said wants tighter or looser, adjust SessionStart hook threshold.
4. Are you OK with `SESSION_LOG.md` being gitignored (private) or should it be committed (so Peleg/Alex can see PVL development cadence)?

**For Peleg** (T1 to draft email):

5. Axiom registry seed: T5 + T1 will draft a 12-15 definition starter (FF-Helix, SSW, amyloid candidate, structural switching, fibril, helix, helicity, hydrophobicity, μH, charge, classification flags, threshold semantics) — review pass in 1-2 weeks?
6. Hallucination guard Rule 3 (axiom-shield): any FF-Helix/SSW/amyloid claim without an axiom lookup → rejection. Approval to ship?
7. G2 launch criterion: 10 peptides validated by Peleg's expert review BEFORE launch. Specifically: pick 10 peptides spanning each class flag combo, T1 runs G2, Peleg reads each explanation, gives ACCEPT/REJECT/FIX per. 100% ACCEPT bar.

**For Alex** (T1 to draft email):

8. Phase G priority post-G1: confirm G2 next (not G3 jump). If thinking has evolved, surface now.
9. DESY AI/cloud LLM compliance — is there an internal mandate that affects PVL? Helmholtz Blablador as on-prem fallback — does it need formal review or just "Said configures `LLM_PROVIDER=helmholtz`"?
10. Funding angle: is there a DESY-internal Open Science fund call that would fund the G2 build specifically (~40h)? If a single grant ask of ~$1K-5K could pay for a Peleg consulting block, that's high leverage.

---

## §12 — Cross-references

- **Deepens**: RB-004 (Tier 1 baseline). §4.2 explicitly defers RB-004 #4 (TS typecheck hook) — kept available but not top-8.
- **Supersedes**: RB-004 §5 Top-5 ranking — RB-004 ranked by impact × 1/cost; this brief re-ranks by time-to-Said-seeing-it-work and explicitly assumes RB-004 Top-5 #1-3 are already shipped via `60c5a96`.
- **Proposes**: ADR-020 (Phase G2 architecture).
- **Affects**: ROADMAP.md Wave 3 (G2 sequenced), MASTER_PUSH_PLAN.md Wave 3 (detail update), TECH_PLATFORM_VISION.md §4.1 (G2 architecture link), TECH_PLATFORM_VISION.md §6 (vector-store-Q resolved, agent-framework-Q resolved → LangGraph deferred in favor of Anthropic SDK direct + ReAct loop, simpler).
- **Relates to**: RB-002 (vector store — extends `papers` table), RB-003 (embedding — uses ESM-2 for peptides, all-MiniLM for English abstracts), ADR-009 (MCP-as-front-door — G2 surfaces as MCP tool 8).
- **Triggers**: M-008 future mission (PaperQA2 wrap vs custom LangGraph for G2 — §N argument 2).

---

## §13 — Decision triggers (when to re-validate each recommendation)

| Recommendation | Re-validate when |
|---|---|
| SessionEnd auto-changelog | Said opens `SESSION_LOG.md` <2× per week for 2 weeks |
| `🧪 Manual test` gate | Said fills placeholder blocks to bypass — soften gate |
| `/wake` proposer | Repeats same proposals across 3 invocations — fix memory file |
| `@AGENTS.md` import | Cursor MDC syntax breaks OR Claude Code ships native AGENTS.md |
| Slopsquatting guard | Anthropic ships verified-package badge OR npm trust score |
| TOKEN_BUDGET.md | Projection error >50% for 2 consecutive weeks |
| HANDOFF.md | `git log -1 HANDOFF.md` older than 90 days |
| Session transcripts | Files exceed 50 lines each — auto-summarize before write |
| G2 architecture (ADR-020) | (1) PaperQA2 ships native MCP support → revisit wrap, (2) Peleg axiom registry needs schema change, (3) DESY mandate emerges → flip Blablador default |
| G2 MVP scope (single peptide) | Tomer persona feedback says batch is critical → upgrade to v2 |

---

## §14 — Summary for T1

**Brief location**: `docs/active/RESEARCH_BRIEFS/RB-005_workflow-and-ai-platform-deep.md` (this file).

**Top-3 workflow recommendations** (one line each):
1. `session-changelog.sh` SessionEnd hook + `docs/active/SESSION_LOG.md` — Said's A.3 pain solved in 1h.
2. Per-chunk `🧪 Manual test` block gate inside Stop hook — makes AGENTS.md operating principle real, 0.5h.
3. `/wake` slash command — makes Said's A.16 delight reproducible, T1 proposes proactively on demand.

**Top-3 AI-platform recommendations** (one line each):
1. Adopt PaperQA2-pattern agentic RAG for Phase G2 (ADR-020) — 0% hallucination architecture, 40h MVP.
2. Five-rule hallucination guard (tool-call gate + citation round-trip + axiom-shield + system-prompt-invariant + EU AI Act audit log).
3. Helmholtz Blablador as opt-in on-prem LLM provider — unblocks future DESY compliance, costs nothing today.

**Top-3 cited sources**:
1. [HIGH] Lála et al. *PaperQA: Retrieval-Augmented Generative Agent for Scientific Research* — arXiv 2312.07559 + arXiv 2409.13740 (the architecture model).
2. [HIGH] Anthropic *Introducing Citations on the Anthropic API* (Jan 2025) — built-in per-passage attribution mechanism.
3. [HIGH] Strube et al. *Helmholtz Blablador* (Helmholtz AI Consultant Retreat 2024) — on-prem LLM unblocker for DESY-hosted PVL.

**Next mission proposed**: M-008 — head-to-head PaperQA2 (wrap as Python dep) vs custom LangGraph state graph for PVL G2. Defer until after G2 axiom seed list is Peleg-reviewed (~2 weeks).

**T5 stop**: T5-DEEP-001 complete. Per `feedback_t5_deep_terminal_not_agent.md`, T5 does NOT auto-chain to a second mission this session. Said picks next dispatch.
