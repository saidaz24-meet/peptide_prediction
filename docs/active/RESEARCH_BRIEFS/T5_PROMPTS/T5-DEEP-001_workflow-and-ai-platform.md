# T5 Deep-Research Mission — Workflow Excellence + AI-Platform Power

**Mission ID**: T5-DEEP-001 (Tier 2, manual terminal)
**Estimated time**: 1.5–3 hours of deep research
**Output**: `docs/active/RESEARCH_BRIEFS/RB-005_workflow-and-ai-platform-deep.md` (or two briefs if you split: RB-005a workflow, RB-005b AI-platform)
**Author of this spec**: T1 (CEO terminal) for Said to paste into a fresh T5 terminal

---

## How to use this file

1. **Said reads §A "Questions T1 needs Said to answer first"** below and answers them inline in this file (or in a paste-back message). T5 cannot research these — they are human-taste / DESY-internal / partner-context.
2. Once §A is answered, Said opens a **fresh Claude Code terminal** (or Cursor agent session) and pastes this entire file as the first message.
3. T5 reads, runs deep research (50–200 web queries, primary sources, iterative refinement), writes the brief, returns recommendations.
4. T5 does NOT commit. T1 reviews + commits.

---

## §A — Said's answers (provided 2026-05-12, inferred from his message + the priors below)

These are Said's directives. T5 must respect them as constraints, not re-litigate.

- **A.1 Hours/day**: not a worry. 4 months until MIT is comfortable. Don't pad recommendations for "time-saving" — pad for "quality" and "Said-can-verify."
- **A.3 Top friction**: TWO concrete pains in last 2 weeks — (1) Said couldn't manually verify that shipped work actually functioned end-to-end; (2) solutions felt over-complicated, hard to audit. T5 must propose workflow upgrades that surface live testability and bias to simplest implementation.
- **A.5 Ambition**: keep shipping at current pace. "We should ship whatever is best." Don't slow down for handoff-only mode.
- **A.9 Peleg fear**: "Don't be afraid from her. She does what researchers want. We should do what we find best, and make her try everything later on." Ship first, review fast. Peleg's review cycles drive the majority of future work — that's expected, not avoided.
- **A.10 Alex's current Phase G priority**: "They would like a and b, but also whatever Alex said." Whatever Alex specified in ROADMAP Phase G — defer to his canonical write-up (G1 done, G2 RAG next, G3 long-term scientific OpenClaw).
- **A.12 First-AI-interaction pick**: (a) Natural-language search + (b) generative explanation with citations. Both — this is the G2 MVP target.
- **A.14 Citation-hallucination tolerance**: ZERO tolerance for AI-generated text without backing. "I don't want AI to be just a buzzword we add... we should really research and according to the things that Alex gave us how would ML help with our project, and try to solve the problem not integrate so we can say that we integrated, but rather actually add specific value." Every AI-generated sentence must cite a real paper PVL retrieved.
- **A.16 Frustration / delight**: Loves Claude making insightful decisions without being asked. Hates having to invent workflow infrastructure himself (T5, CEO terminal, skills, memory files — all Said-invented). Wants T1/T5 to PROPOSE proactively.
- **A.17 Perfect in 6 months**: AI integration that adds *specific value* matched to PVL's specific problem — not buzzword-driven. "What is the plan?" answered through Alex's vision + concrete G2 architecture.

### Still-uncertain Said inputs (T5 may ask once if blocking, otherwise infer):

- **A.7 Tamarind Bio personal read**: not given. T5 researches their public artifacts and proposes; Said reviews recommendation.
- **A.8 Galagos.ai specific takeaway**: memory `reference_galagos.md` says "inspires Phase I multi-predictor + G5 auto-PDF" — work from that.
- **A.11 DESY AI compliance**: not given. T5 assumes standard scientific-institution constraints (audit logging required, data residency preferred but not strict, cloud LLMs allowed for non-confidential metadata). T1 will email Alex if T5 surfaces a hard blocker.
- **A.13 Funding angle**: not given. Treat as "always relevant" — every recommendation notes funding/citation implications where applicable.
- **A.15 AI kill switches**: not given. T5 defaults to "every AI feature has runtime toggle" — this is the conservative bet, cheap to add.

### Original §A questions (preserved below for completeness, but answered above)

### A.1 — Workflow side (how Said works with Claude AI today)

1. **Real hours/day on PVL**: roughly how many focused hours/day on PVL right now, and how will that change in the 4 weeks before MIT (Sept 2026)? T-RES needs to calibrate the "5.5h of workflow improvements" recommendation to realistic time budget.
2. **Active terminals**: of the 6 specced (T1/T2/T3/T-RES/Cowork/T-PEL), which do you actually open daily? Which feel theoretical?
3. **Top 3 real friction points in the last 2 weeks** of Wave 2 dispatches: pick concrete moments. E.g., "I forgot to push branch X before opening a PR", "T3 produced 4 files when I wanted one PR", "I had to re-read MASTER_PUSH_PLAN twice to remember which wave we're in."
4. **Paid SaaS tolerance**: ADR-011 says no paid SaaS for the platform itself. Does that extend to YOUR workflow tools (Linear, Sunsama, Loom, Tana, ChatGPT Plus, etc.) or are personal-productivity SaaS subscriptions fine?
5. **Workflow ambition level**: are you trying to ship PVL MORE during MIT semesters (defend the project) or LESS but more robustly (handoff-ready)? RB-004 implicitly assumed the latter — confirm.
6. **Conferences / public talks** planned in next 6 months that drive a deadline?

### A.2 — AI-platform side (what PVL's AI integration becomes)

7. **Tamarind Bio**: have you tried it? What worked / didn't? Alex referenced it (`ALEX_BACKLOG.md` AI3) as "research for inspiration/connection." Without your read, T5 only has the website to go on.
8. **Galagos.ai**: you have memory `reference_galagos.md` — what specifically inspired you? "Multi-predictor flow" or "auto-PDF style" or "general feel"?
9. **Peleg's AI limits**: she killed `ConsensusCard`/`ConsensusTier` for unjustified tier math (FIX-013). Has she said what she'd refuse AI to do? E.g., would she let Claude generate a "scientific interpretation paragraph" for a peptide, or is that a line she won't cross? Critical for Phase G2 RAG scoping.
10. **Alex's current Phase G priority**: he proposed G1+G2+G3 in March 2026 (ROADMAP §G). G1 shipped. Does he now want G2 (RAG+PubMed) next, or has his thinking evolved post-G1?
11. **DESY constraints**: any internal mandate about AI/cloud LLM usage (no OpenAI? On-prem only? Specific compliance requirements for tools handling protein data)?
12. **First-AI-interaction users would find most valuable**: pick one or rank: (a) "Find me top 10 amyloid candidates from S.aureus length 10-50" — search query, (b) "Explain why P02743 is a strong amyloid candidate" — generative explanation with citations, (c) "Compare peptides A and B and tell me which to test in the lab" — recommendation, (d) "Generate a methods paragraph for my paper from my PVL session" — output drafting.
13. **Funding angle**: any grant call or partnership conversation where strong AI integration would unlock specific funding? (CZI EOSS, NIH OSS, DESY internal RA, Israeli IA, HHMI?)
14. **Citation-hallucination tolerance**: PVL outputs may end up in papers. Is the rule "zero AI-generated text in user-visible outputs without explicit user confirmation"? Or "labeled-as-AI outputs OK"?
15. **AI-feature kill switches**: should every AI feature have a runtime toggle so a paranoid user can disable it? Or are AI features always-on baseline?

### A.3 — Said-only context T5 won't get from anywhere else

16. **What is the ONE thing about working with Claude that frustrates you most this month**, and what is the ONE thing that delights you? T5 can use this to prioritize workflow recommendations toward what actually matters to YOU vs what's generically best-in-class.
17. **What would "perfect" look like in 6 months**? Describe in 3 sentences. T5 needs the target state to recommend the path.

---

## §B — Context T5 must read BEFORE researching

These docs (in `docs/active/`) ARE the project state. T5 reads them all, no exceptions:

**Workflow context:**
- `CLAUDE.md` (project root) — instructions to Claude agents
- `T-RES-INSTRUCTIONS.md` (gitignored) — T5's own role definition
- `feedback_t1_role_ceo.md`, `feedback_t5_deep_terminal_not_agent.md`, `feedback_workflow.md` (in `~/.claude/projects/.../memory/`)
- `RB-004_ai-workflow-infrastructure.md` — Tier 1 baseline workflow brief (this mission DEEPENS it)
- `RB-COWORK-AUDIT.md` — empirical PRE-FLIGHT validation
- `COWORK_PROMPTS_PELEG.md` (gitignored, in root) — current Cowork PROMPT 0
- `.claude/settings.json` — current 4 hooks
- `MASTER_PUSH_PLAN.md` §2 — "How we execute (terminals + agents + Cowork)"

**AI-platform context:**
- `docs/active/ROADMAP.md` Phase G (lines ~704-790) — Alex's G1/G2/G3 vision verbatim
- `docs/internal/ALEX_BACKLOG.md` "AI/LLM Integration" section — AI1/AI2/AI3
- `docs/internal/TECH_PLATFORM_VISION.md` §4 (AI for users / devs / science split)
- `docs/active/DECISIONS.md` ADR-009 (MCP front door, ACCEPTED), ADR-017 (ESM-2 embedding)
- `docs/active/RESEARCH_BRIEFS/RB-001_researcher-needs.md` — researcher feature priorities
- `docs/active/RESEARCH_BRIEFS/RB-002_vector-store-evaluation.md` — LanceDB rationale (RAG-relevant)
- `mcp_server/README.md` and `mcp_server/pvl_mcp/tools.py` — current MCP tools
- `docs/active/VECTOR_SEARCH_SPEC.md` — similarity search architecture
- `docs/internal/TOP_CEO_RECOMMENDATIONS.md` — sustainability + funding context

**Recent work:**
- `git log --oneline -30` — last ~30 commits on `wave-2-ai-platform` branch

---

## §C — The two deep questions

T5 produces ONE brief covering both, OR splits into RB-005a/RB-005b. T1 prefers one cohesive brief that shows how the two sides reinforce each other.

### Question 1 — Workflow excellence (deepen RB-004)

**The shallow version is in `RB-004_ai-workflow-infrastructure.md`.** It recommended 5 enhancements totaling 5.5h. That brief was a Tier 1 background-agent synthesis with 9 sources. **T5's Tier 2 job is to go 3-10x deeper:**

a. **Anthropic engineers' actual workflows** — not the marketing blog posts, but real public artifacts: GitHub configs from Claude Code contributors (look at `.claude/` directories in public repos owned by Anthropic engineers — e.g., Boris Cherny, Cat Hicks, Mike Krieger), public talks (Latent Space podcast, AI Engineer Summit). What hooks do they actually use? How many terminals? What's their `AGENTS.md` look like?

b. **Top-1% vs top-10% of solo OSS founders** — the difference. Specific named comparisons (Tom Preston-Werner, Sindre Sorhus, David Heinemeier Hansson, Mitchell Hashimoto solo era, Guillermo Rauch pre-Vercel) with concrete workflow patterns. What separates them from "good but not exceptional"?

c. **Multi-terminal Claude Code patterns at YC W24/W25 startups** — there are public posts about this (Latent Space transcripts, hackathon writeups). Real numbers: how many parallel sessions, what slash commands, what token-cost-per-feature?

d. **PVL-specific workflow audit** — read `git log --oneline -50` and identify the 3 workflow patterns Said REPEATS most. What automation would compound? Don't recommend generic "Stop+test hook" — recommend "Stop hook tuned to PVL's `make test-unit` taking 13s, with a per-suite breakdown that surfaces which test failed last so Said sees it on his next session start."

e. **Token-budget management for multi-terminal sessions** — at current burn rates, can Said run 4 parallel terminals during MIT semester within a reasonable monthly Claude API spend? Real math.

f. **The "perfect first hour" of a session** — what should the first 60 minutes of Said opening Claude Code look like at top-tier? SessionStart hook content, status injectors, daily standup pattern, anything.

g. **Slash command + MCP server recommendations** — beyond `.claude/commands/`, what's the canonical pattern for personal slash commands? Public examples?

h. **Cursor + Claude Code coexistence** — Said uses both. What's the current best pattern for splitting work between them without context drift?

i. **Pre-MIT handoff document structure** — `HANDOFF.md` was a RB-004 recommendation. What does a top-tier scientific OSS handoff doc look like (cellxgene? AlphaFold? Galaxy? Mol*)? Concrete section structure, not just "write things down."

**Output for Q1**: top 8 enhancements ordered by impact × (1/cost), with concrete file paths and example code/config. Include ADR drafts for any architectural changes.

### Question 2 — AI-platform power (the most powerful AI-integrated peptide tool)

Alex's vision (Phase G) is the spine. T5's job: research what "best in class" looks like in 2026 and define the path from PVL today to that state.

a. **G2 Scientific RAG with PubMed — the right architecture for 2026**:
   - RAG vs agentic retrieval vs multi-hop search — which fits PVL's "explain why this peptide is risky" use case?
   - Citation-hallucination prevention: state of the art (Google Scholar Constitutional AI patterns, Stanford verifiable-source-attribution research, Anthropic's CitationVerifier)
   - Domain-axiom architecture: how do you encode "FF-Helix uses uH threshold, FF-SSW uses hydrophobicity — NEVER mix" in an AI system so it cannot violate the rule? Constitutional AI? Tool-call gating? Fine-tuned safety classifier?
   - Storage: LanceDB (already adopted ADR-016) — is it the right substrate for paper abstracts + axioms, or do we need a separate doc-store?

b. **Tamarind Bio competitive analysis** — what makes them powerful, what's their UX, what's their pricing, what's the GTM? Deep read: their blog, their public docs, their changelog. (`reference_galagos.md` in Said's memory references a related tool — read it.)

c. **Scientific AI agent platforms landscape 2026** — beyond Tamarind: Galagos.ai, Owl (formerly OpenClaw?), Future House, ResearchRabbit, Elicit, Consensus.app, SciSpace. What architectural patterns are converging? What's the moat for each?

d. **Phase G3 "scientific OpenClaw" architecture** — Alex's long-term vision is a generalized scientific AI platform. What does a serious v1 of that look like? Is it a Galaxy-style workflow engine, or a chat-first agent, or a Notion-style domain-axiom-editor + plugin system? Worth picking a target architecture even if implementation is post-MIT.

e. **Hallucination guards specific to peptide / amyloid claims** — Peleg killed ConsensusTier for unjustified math. If PVL ships an AI explanation feature, what's the guard pattern? Mandatory tool-call before generative text? Confidence-scored output? "AI-generated, unverified" labels?

f. **Multi-step AI workflow examples in scientific tooling** — actual production examples: how does AlphaFold DB integrate generative AI (it doesn't, much — interesting datapoint)? How does ChemCrow chain tools? What does the canonical "user asks → AI plans → executes 4 tools → returns citations" pattern look like?

g. **DESY/scientific institution constraints on AI** — research what's becoming standard: on-prem LLM requirements, data residency, audit logging for AI calls in scientific tools. Wave 5 K8s deployment needs this answered.

h. **The killer Phase G2 feature** — pick the SINGLE AI feature that would make a researcher say "PVL is unlike any other peptide tool I've used." Argue for it with evidence.

i. **Roadmap sequencing for Phase G**: given G1 is done and G3 is 200h+, what's the minimum-viable G2 that demonstrates the AI-platform vision in <40h? "AI explains a peptide with PubMed citations" with rock-solid hallucination guards.

**Output for Q2**: a Phase G2 architecture spec (pick ONE specific design from research), ADR draft for the architecture, sequencing plan from "today" to "MVP G2" to "G3 long-term."

---

## §D — Quality bar (Tier 2 disciplines)

Every Tier 2 brief must include:

1. **≥15 cited primary sources** (papers, official docs, public configs from real engineers — not blog posts unless author is credible)
2. **Source-confidence tags** — HIGH (peer-reviewed paper or official spec), MEDIUM (well-known engineer's public artifact), LOW (anonymous blog or speculative). Apply per-claim.
3. **§N — Counter-arguments section** — T5 must argue against its own top recommendation. Forces confirmation-bias self-check.
4. **Quantitative tables** — never recommend without head-to-head numbers (cost, latency, accuracy, complexity).
5. **Researcher persona POV** — recommendations expressed from 2-3 named persona perspectives:
   - "Maya, structural biology PhD using AlphaFold daily, hates configuring tools"
   - "Tomer, bench biochemist who tests 50 peptides/week, wants results not setup"
   - "Hannah, computational PI, needs reproducibility for grant reports"
6. **Decision triggers** — every recommendation ends with "re-validate this when [SPECIFIC CONDITION]".
7. **Cross-brief linking** — explicitly references RB-001/002/003/004 where relevant. Notes if any prior brief's conclusion needs updating.

---

## §E — What T5 outputs

1. Brief at `docs/active/RESEARCH_BRIEFS/RB-005_workflow-and-ai-platform-deep.md` (or split RB-005a / RB-005b)
2. Updated row at top of `docs/active/RESEARCH_BRIEFS/_INDEX.md` briefs table
3. ADR drafts in brief §7 — at minimum ADR-018 (multi-terminal protocol, supersedes RB-004 draft), ADR-019 (hook quality gates, supersedes RB-004 draft), ADR-020 (Phase G2 architecture)
4. Section §N — Counter-arguments
5. Section §11 — Open questions for Said + Alex + Peleg (the next round of human-touch inputs)
6. Final summary message to T1: brief location, top-3 workflow + top-3 AI-platform recommendations in one-line each, top 3 cited sources

---

## §F — Boundaries

- T5 does NOT modify canonical docs (MASTER_PUSH_PLAN, ROADMAP, DECISIONS, TECH_PLATFORM_VISION)
- T5 does NOT commit
- T5 does NOT write code (config snippets in the brief are recommendations, not commits)
- T5 does NOT chain to a second mission in this session — stop after one brief, let Said + T1 absorb before next dispatch

---

## §G — After Said pastes this into a fresh terminal

Suggested first message from Said to T5: *"Read this entire file, then read all docs listed in §B, then research per §C using the quality bar in §D. Take 1.5–3 hours. Pause and ask me if you hit something genuinely blocking. Produce the brief per §E."*
