# Zoom prep — Peleg, 2026-06-04

**Purpose**: read-now, take-into-the-call. Every section below is answer-ready: what to say, what to ask, what to demo.

**Live URL during call**: `http://94.130.178.182:3000` — Wave 2.6 batch should be deployed by call time (T6 in flight).
**Diagnostic peptide for live demo**: `P0C005` (Anoplin). Best single peptide for showing the SSW/FF-SSW story honestly.

**Agenda I'd propose at the top of the call** (≈60 min):
1. (5 min) State of the world since the PowerPoint round — what landed, what's blocked
2. (15 min) The three scientific shifts you re-framed for us (AMPs / Q5 symmetry / Helix-only-terminology), so we're aligned
3. (20 min) D1-D5 co-design (Interpretation Notes / 4-class labels / Tier-1 derivation / Ranking presets / SSW Score scope)
4. (10 min) Rename brainstorm
5. (10 min) Forward plan + the items I need from you (DOI, ORCID, Maxwell access via Alex)

---

## §1 — Things I did since last contact (the 5-surface ecosystem)

PVL stopped being a website and became an ecosystem. One scientific core, five interfaces — the same algorithms, same outputs, same reproducibility guarantees, just different ways in. This matters because the audience splits naturally: bench researchers want the web, devops want the CLI, data scientists want a library, AI engineers want MCP, IT-conscious labs want a self-host. Forcing them all into one UI lost everyone.

### 1.1 — Web app
- **State**: live at `http://94.130.178.182:3000`, the "main" PVL.
- **For**: general researchers, non-technical stakeholders, anyone who wants an instant visual interface.
- **What's new since the PowerPoint**: D1 redesign shipped (Stripe-level visual quality, light-first, no jumpy animations), peptide-detail page restructured around classification-first reading order, 4-class chart polish, cohort comparison brought back as two parallel charts (SSW grouping + Helix grouping), per-peptide TANGO-raw verdict preservation so we never silently overwrite what your subprocess produced.
- **For the demo on the call**: open `/peptides/P0C005` and walk through the EvidencePanel — that's where the FF-SSW honesty story is clearest, because the TANGO-raw verdict and the unified SSW verdict are shown separately. That's the structural fix your Slack comment on FF-SSW led to.

### 1.2 — Command-line interface (`pvl-cli`)
- **State**: scaffolded, basic flow works for batch processing.
- **For**: devops, system administrators, anyone who scripts pipelines and prefers keyboard-driven automation. A researcher who wants to point PVL at a 5,000-row CSV from their terminal without uploading.
- **Status honest**: usable for batch jobs, not documented as a public surface yet — Wave 2.7 will produce the user-facing CLI quickstart.
- **Why it matters**: lab automation people don't open browsers. They want `pvl analyze input.fasta --predictors tango,s4pred --out results.csv`.

### 1.3 — Python package (`pvl-py`)
- **State**: scaffolded with a quickstart notebook.
- **For**: data scientists, bioinformaticians, researchers integrating PVL into a larger pipeline. Notebook users.
- **What it gives them**: programmatic access to TANGO, S4PRED, FF-Helix detection, the same threshold defaults as the website. Same results as Quick Analyze, but reproducible from a Jupyter cell.
- **Status honest**: client + I/O scaffolding committed (commit `062123d`), notebook walkthrough exists. The pip-installable polish + PyPI release queued for Wave 2.7.

### 1.4 — MCP server (live)
- **State**: shipped 2026-05-12 as part of Wave 2 §I (Phase G1). Repo: `mcp_server/pvl_mcp/`.
- **For**: AI engineers, anyone building LLM applications who wants to give an AI model direct access to PVL.
- **What it does**: exposes PVL's analysis primitives — `get_peptide_detail`, `rank_candidates`, `compare_cohorts`, `find_similar`, `analyse_sequence` — over the MCP protocol. Any MCP-speaking AI assistant (Claude Desktop, Cursor, Continue, Cline, Windsurf) can drive PVL from natural language.
- **In practice**: a researcher with PVL configured in their assistant says "screen these 50 sequences for amyloid candidates and rank them by FF-Helix score" — the assistant orchestrates the tool calls, returns ranked results with citations to the underlying PVL run.
- **Demo plan**: I can show this live on the call if there's time. Otherwise a 30-second screen recording afterwards.

### 1.5 — Self-hostable Docker
- **State**: working `docker-compose.yml` in the repo; teams can spin up PVL on their own infrastructure with one command.
- **For**: enterprise teams, privacy-conscious labs, IT departments where compliance requires data not leaving the institute. DESY is exactly this audience.
- **Why it matters for your work**: if a sequence is sensitive (unpublished, NDA, patient-derived), the public webapp is not an option. Self-host removes the data-egress objection entirely.
- **Status honest**: compose stack works, multi-arch build is queued (Phase E6, blocked on knowing the DESY VM architecture).

### 1.6 — What ties the five together
- **One scientific contract**: `backend/schemas/api_models.py` is the canonical schema. Web, CLI, pvl-py, MCP all return the same shape. Single sequence and batch always produce identical results. JSON `null` only — no sentinel values.
- **One reproducibility surface**: every run's URL encodes the dataset hash + predictor versions + threshold values + selection state. Paste the URL → exact same figure. Web inherits this directly; pvl-py / MCP encode it as a returned `permalink` field.
- **One source of truth for thresholds**: changing `config.py` defaults updates all five surfaces in one place. There is no "the web has different defaults than the CLI" possibility.

---

## §2 — My own coding tasks (what's in flight, what's queued)

Not everything on this list ships before the Zoom — some are Wave 2.7+ — but I want you to see the full forward plan so you can flag priority shifts.

### 2.1 — Upgrade component design (Phase D6, round-3 redesign)
- **What**: every page brought to the home-page visual quality. The home page is Stripe-level; the inner pages still vary. Pages targeted: Results, PeptideDetail, Compare, Upload, About, Help.
- **Owner**: Cowork (visual design lane), me (integration).
- **Status**: queued, in ROADMAP at Phase D6. Won't ship this week.
- **Tell Peleg**: visual polish is intentional next-quarter work, not a sprint. The science is already locked.

### 2.2 — Background designs
- **What**: cohesive background visuals across the site — subtle gradients, scientific-domain imagery (peptide silhouettes, sequence motifs, ribbon traces) that signals "this is a serious tool" without being decorative noise.
- **Status**: design-only at the moment, not blocked, queued for D6.

### 2.3 — Landing page quality push
- **What**: the home page is currently good; I want it best-in-class. The job-to-be-done is "MSc student lands here from Google, decides in 8 seconds whether to upload their CSV."
- **What's queued**: hero section refresh, one-paragraph "why PVL" copy that uses your shared-biophysics framing, a 40-second silent demo loop above the fold, social-proof bar showing the 5-surface ecosystem.
- **Tell Peleg**: the discoverability conversation she raised in the PPT ("young researchers searching for amyloid / fibril / peptide") routes through the landing page first. We can demo at the call if she wants.

### 2.4 — Host on VM fully (DESY migration)
- **What**: move from Hetzner (current VPS at 94.130.178.182) to the DESY VM `landau-webapp-dev` once Maxwell SSH access is restored.
- **Status**: BLOCKED. Maxwell SSH login still rejected (PAM acct_mgmt rejection 2026-05-26, same pattern as 2026-05-18). Alex hasn't yet added `azaizahs` to the Maxwell login-allowed group.
- **Tell Peleg**: this needs Alex's action. Ask her to nudge him if she's in contact with him before us.

### 2.5 — Automate maintenance
- **What**: cron-driven nightly health checks, automated dependency updates with Dependabot (currently 4 risky PRs open and audited), automated weekly redeploy of a fresh image so the running container never drifts from `main`.
- **Status**: partially in place — GitHub Actions deploys on every merge to `main`, Sentry captures errors with replay sampling. Missing: scheduled health probes, automated certificate renewal verification, monthly dependency-roll-up.
- **Tell Peleg**: this is plumbing work, not science work. She doesn't need to weigh in.

### 2.6 — Wave 2.7 (post-Zoom code queue)
The list of code work waiting on her sign-off or co-design:
- Hard-reject route enforcement for >40-aa sequences (currently default-skipped; she asked for hard reject).
- Help.tsx rewritten with her exact 4-section text (Helix / FF-Helix / SSW / FF-SSW).
- "FF-Helix %" → "Helix %" rename audit across ~12 components.
- Black-G residue colouring derived from her fragment columns (Helix-S4PRED, SSW-TANGO, SSW-S4PRED) with gap-≤-3 smoothing.
- TANGO aggregation stretch method (needs her code reference — see §5 Q4).
- Signed-charge handling on Cohort Comparison (`PELEG-Q-FIX-022`).
- UniProt keyword chips on every peptide row (in motion).

---

## §3 — Future plans (with concrete asks from her)

Each item is paired with the specific thing I need from her to unblock.

### 3.1 — Ragonis-Bachar and Rayan paper citation
- **Why I need it**: the threshold defaults in PVL must cite your paper, not Eisenberg 1984. That goes in the Help text, the threshold tooltip, and the paper methods.
- **Ask her for**: the DOI (or full citation) of the paper. If there are multiple relevant papers, ask which is the most appropriate to cite for the threshold values.
- **State at the call**: "The moment I have it, the Eisenberg citation goes out everywhere. Today, if possible."

### 3.2 — ORCID for the team
- **Why**: every contributor on the Zenodo deposit and the paper needs an ORCID. The Zenodo record fails CrossRef ingestion if any author lacks one.
- **Ask her for**: her ORCID. Ask her to forward Alex's. (Mine is set up.)
- **State**: "Send me both. I'll pre-populate the Zenodo metadata so we just review and submit."

### 3.3 — Zenodo account / DOI
- **Why**: archived GitHub release → Zenodo DOI is what makes PVL citable in the paper and on bio.tools.
- **Ask her**: does she already have a Zenodo account from her PhD work? If so, she can join the community. Otherwise she creates one when we're ready to publish.
- **Action**: I'll create the PVL Zenodo community myself; she joins as a contributor.

### 3.4 — bio.tools registration
- **Why**: ELIXIR's bio.tools registry is THE discovery point for new bioinformatics tools. Every literature-search workflow points there.
- **Ask her**: does she have a bio.tools account from any of her prior tools (PASTA-related, the Ragonis-Bachar work)? If yes, she can co-own the PVL entry. If not, I'll register it.
- **State**: this is blocked on having the final name (see 3.7).

### 3.5 — Publishing venue
- **Why**: tool papers have a few good targets — JOSS (open, fast, free), Bioinformatics (impact, slower), NAR Web Server issue (annual, prestigious, deadline-based), Nature Methods (long-shot for a tool paper but possible if the FF-SSW concept is the lead story).
- **My current lean**: JOSS for the software publication (fast, gets us the DOI) + NAR Web Server issue for the scientific story (timed for the 2027 issue with the Staphylococcus and Uperin case studies as the data sections).
- **Ask her**: thoughts. Her PI taste matters more than mine here.

### 3.6 — Commercialization stance
- **My take**: PVL stays open-source MIT. No SaaS pricing, no auth wall, no email gating. The journal requirement we discussed (JOSS / NAR both want open-source unrestricted access) cements this. There's no commercial play here — the value is being the default reference tool, not extracting fees.
- **What this means concretely**: the website stays free. No premium tier. Self-host is the only "advanced" option, and that's also free.
- **Ask her**: confirm she agrees, or flag a concern. If she has a "but what about future" consideration, hear it now.

### 3.7 — Find a name
- **Why "PVL" needs to change**: she flagged this in the Drive comments (Comment 25) — too generic for SEO, three letters with no scientific anchor, hard to find via search.
- **My starting shortlist** (to brainstorm from, not commit to):
  - **FibrilLens** — what we do (lens on fibril formation), easy to search.
  - **AmyloPath** — pathway language, but maybe too disease-coded.
  - **ChameleonPep** — references the α-helix → β-sheet switch (chameleon proteins literature).
  - **Helix2Sheet** — descriptive of the prediction; literal.
  - **SwitchScope** — focuses on the SSW concept, broader than amyloid.
  - **PepMorph** — peptide morphology shift.
- **Ask her**: which of these she'd actually use in a paper title, and what she'd add. Decision can be made on the call or in the week after.
- **Constraint**: the name should still let us register `name.app` or `name.science` as the domain.

---

## §4 — Questions I still need from you (concise)

Five asks. Everything else either has an answer or can wait.

1. **The Ragonis-Bachar / Rayan paper DOI** (3.1).
2. **Your function name in the TANGO-aggregation-by-stretches code** so I can pass the TANGO score array through your SSW-fragment finder with `avg_limit=0` (§5 Q4 below).
3. **Two confirmations on the Help-page 4-section text** you pasted (whether SSW definition should reference both gap threshold AND minimum % SS content, and whether FF-SSW gate is hydrophobicity (not μH)) — §5 Q2 below.
4. **Symmetric Help-page section text for SSW and FF-SSW** in the same paste-style as you wrote for Helix / FF-Helix — so I can ship verbatim (§5 Q5).
5. **Your ORCID + Alex's ORCID** for Zenodo deposit (3.2).

---

## §5 — Her questions / comments — my prepared answers

Read this section as the most call-relevant. If she revisits any of these, I have an answer.

### Q-AMP — "AMPs as false positives"
**Her correction**: "This is incorrect. The features that drive amyloid or fibril formation are the same features that allow membrane interactions." Plus: "the fact that we report or call name for fibril formation potential only, it is fine if other biological functionalities might also happen."
**My answer to give back**:
> "You're right. I've stripped 'false positive' from the validation brief, from the Help text, from Packet 1 §11.7 and Packet 2 §5. The new framing is 'membrane-active overlap class with shared fibril-forming features' — which is your framing, and it's actually a *better* differentiator for the paper because it lets us position PVL's positive class as deliberately broader than 'confirmed amyloid'. PSM-α2 showing up as FF-SSW positive is now a feature, not a bug. The paper intro will lead with this framing: AMPs and toxic peptides were your initial experimental targets *because* of the shared feature space."

### Q-Q5 — "Everything that is SSW needs to be also of helix"
**Her clarification**: this was about **symmetry of treatment**, not subset axiom.
**My answer**:
> "I had read this as 'redraw the Venn so SSW ⊆ Helix' — that's wrong, that's not what you said. You meant: any analysis or treatment we apply to SSW / FF-SSW should symmetrically apply to Helix / FF-Helix. The Venn stays as 4 sibling circles. The symmetry sweep is in progress — the Quick Analyze badge symmetry you flagged (No SSW badge appeared without Helix / FF-Helix / FF-SSW counterparts) is already fixed in the build."

### Q-NegCtrl — "Which negative controls?"
**Her correction**: "In the field of fibril or amyloid formation it is very hard to define a negative control, since fibril or amyloid formation is very dependent on environmental conditions… when we wrote the papers describing the methods we said that the peptides did not form fibrils in the tested conditions."
**My answer**:
> "Agreed and we've stopped calling them negative controls. They're regression canaries — sequences whose downstream values must not drift across releases, not assertions of non-fibrillation. The Aβ16-22 / KLVFFAE entry I added recently is the actual amyloid-forming canonical short peptide, not a 'negative' anything. The paper limitations section will use your exact language: 'did not form fibrils in the tested conditions' as the framing for any non-finding. I want your sign-off that 'regression canaries' is the right term — if you'd phrase it differently, tell me."

### Q-Percent — "What does the % mean? FF-Helix and Helix only, two terms"
**Her direction**: "There should be only two terms: Helix and FF-Helix. The % should just be another feature indicating what percentage of the sequence was predicted to be helical and should be treated as a separate variable/parameter."
**My answer**:
> "Got it. The classes stay FF-Helix and FF-SSW. The percent value — what fraction of the sequence S4PRED predicts helical — is a feature we display alongside the class flag, not a third name. I'm renaming the column 'FF-Helix %' to 'Helix %' (or 'S4PRED helix content') and removing it as a class-style badge anywhere it appears that way. The Smart Ranking weight slider that was labelled 'FF-Helix %' becomes 'Helix %' too. Round 2 of Wave 2.6 — touches about 12 components, one focused PR."

### Q-Length — "40 hard cutoff, user override 10-40"
**Her direction**: "It should definitely be a hard cutoff (NOT only a warning), and the cutoff should be 40… 40 it is! The user can define length limitation of his own, only if it between 10-40."
**My answer**:
> "Encoded as the default in this build — `PEPTIDE_LENGTH_HARD_MAX = 40`, override clamped to [10, 40], S4PRED's per-sequence cap default dropped from 100 to 40, upload and Quick Analyze warning copy rewritten in your language ('surface-vs-structure problem', not 'reduced accuracy'). One honest flag: the *hard reject at the API route* (so a 41-aa sequence cannot enter the pipeline at all, not just get S4PRED-skipped) is queued as the next backend PR. I want to land it focused. If you need it as a hard reject before something specific — a demo, a teaching moment — tell me and I'll bump it forward."

### Q-TANGO — "Use the SSW-fragment finder with avg_limit=0"
**Her direction**: "If we are referring to the aggregation of Tango, we should apply the same method we used to obtain the secondary structure prediction, only now passing the array of Tango aggregation scores to the functions… find a long-enough stretch of residues that have a Tango aggregation score that is above 0 and average only their scores… It is fairly easy to implement this using the part of my code that finds secondary structure by sending the tango aggregation score list with average score limitation = 0."
**My answer**:
> "I need help finding it in your code. If you can paste the function name (or the relevant snippet), I'll thread the TANGO per-residue score array through your SSW-fragment finder with `avg_limit=0` and replace both the 'average all' and 'max only' paths with one stretch-aggregated value per peptide. The 'max' stays as a secondary display so the histogram doesn't lose information, but the primary aggregation score moves to the stretch method."

### Q-BlackG — "Black G must come from fragment columns"
**Her direction**: "It should be derived from the calculations… taken from the column named Helix fragments (S4PRED), SSW fragments (Tango), SSW fragments (S4PRED). My algorithm takes into account and smooths these small gaps (under 3, hence this threshold)."
**My answer**:
> "Two confirmations before I touch the renderer:
> 1. The gap-smoothing rule (gap < 3 → merge fragments → colour the gap too) applies to all three fragment families (Helix-S4PRED, SSW-TANGO, SSW-S4PRED) in the same way — yes?
> 2. When the three fragments disagree on a residue (S4PRED says 'helix fragment', TANGO says 'SSW fragment'), the renderer picks the more-specific class? I'll default to 'show both with one priority colour' unless you'd prefer one wins outright.
> Once those two answers are clear, I implement and ship."

### Q-Cohort — "Cohort comparison annotations" (the slide you marked up)
**Her annotations**: more spaces between features ✅, y-axis title ✅, colours flipped (No SSW = brown-orange, SSW = green) ✅, add FF-SSW third group ✅, same chart for Helix ✅, charge calculation different than absolute numbers ⏳.
**My answer**:
> "Five of the six are landing in the build by call time. The colour swap is done, the spacing's widened, the chart is now rendered as two parallel comparisons (SSW + Helix) so the symmetry principle is visible. The remaining one is the signed-charge handling — currently the metric uses |charge|, which loses the positive-vs-negative biological signal you flagged. That's queued as `PELEG-Q-FIX-022` for Wave 2.7 because it touches the ranking math too. We can co-design it on the call if you want — should the cohort chart use signed charge, or split into positive-charge and negative-charge metrics?"

### Q-ChartGone — "She wrote a lot about the cohort comparison and now it's gone"
**My answer**:
> "It's not gone — it was renamed and split. You'd asked in the PowerPoint (FIX-022 / FIX-029) for BOTH SSW and Helix groupings in the chart. So instead of one 'Cohort Comparison' I have two parallel charts on /results — 'SSW classification — biochemical comparison' and 'Helix classification — biochemical comparison'. Same chart logic, two groupings, side-by-side. The title 'Cohort Comparison' didn't survive because you'd also asked to drop 'cohort' for 'database'. If you want the literal title 'Cohort Comparison' back, that's a one-line change."

### Q-Default — "Default thresholds = Ragonis-Bachar and Rayan, not Eisenberg"
**Her direction**: confirmed.
**My answer**:
> "Acknowledged. As soon as you send the DOI (see §4 ask 1), the Eisenberg reference is replaced everywhere it appears. The calibration story for the paper methods will state explicitly: thresholds were calibrated by your computational work combined with Bader's experiments. Eisenberg's 1984 hydrophobic-moment formula is a separate, prior thing — we'll keep the *μH formula* citation to Eisenberg, but the *threshold values* cite you."

### Q-Scatter — "FF-Helix vs Aggregation Max needs legend and axis names"
**My answer**:
> "Done. The scatter on /peptides/:id now has explicit axis labels ('FF-Helix %' on x, 'Peak TANGO aggregation score' on y) and a legend strip below the chart (Current peptide in red, Database in grey)."

### Q-Help — "Help page needs 4 sections (Helix, FF-Helix, SSW, FF-SSW)"
**Her pasted text**: she wrote out the Helix / FF-Helix / SSW / FF-SSW definitions verbatim.
**My answer**:
> "Pasting verbatim. Two minor questions before I ship (§4 ask 3): (a) should the SSW definition reference both the maximum-gap threshold and the minimum %-SS-content threshold, or only the gap threshold? (b) the FF-SSW gate is hydrophobicity (not μH), correct? Once those two are clear, the Help page rewrite ships in the same PR as the column-rename audit."

### Q-MCP — "So… you already implemented this?"
**My answer**:
> "Yes. The MCP server shipped 2026-05-12. It exposes PVL's analysis primitives — get_peptide_detail, rank_candidates, compare_cohorts, find_similar, analyse_sequence — over the MCP protocol. Any MCP-speaking assistant (Claude Desktop, Cursor, Continue, Cline, Windsurf) can drive PVL from natural language. A researcher says 'screen these 50 sequences for amyloid candidates and rank them by FF-Helix score' — the assistant orchestrates the tool calls, returns ranked results. I can demo it on the call if there's time."

### Q-RAG — "Not sure I fully understood this point"
**My answer (the explanation I owe her)**:
> "RAG = Retrieval-Augmented Generation. Think of it this way: when an AI model answers a question about a peptide, plain LLM gives you 'this peptide is amyloidogenic' with no source. RAG means we first *retrieve* relevant papers from PubMed/PMC (using the peptide sequence, the predicted class, the FF-Helix score as the query) and then the LLM generates its answer *grounded in those retrieved papers* — so it says 'this peptide is amyloidogenic per Smith et al. 2024 (PMID 12345), consistent with the KLVFFAE fragment work in Balbach et al. 2000'.
>
> The hard problems are:
> 1. Building the literature vector database (which papers, which embedding model, how often re-indexed).
> 2. Preventing hallucinated citations — an LLM with no retrieval will confidently invent a paper that doesn't exist. RAG with weak retrieval will cite the wrong paper. Both are worse than no citation at all in a scientific tool.
>
> So: this is Alex's longer-term vision and we have it queued (Phase G2), but it needs scientific co-design with you on what 'good cite-grounded answers' look like before I commit engineering to it. MCP base proves itself first; RAG follows once we know what shape it should take.
>
> Concrete use cases the researcher might ask (and that RAG would ground):
> - 'What do we know about this sequence from the literature?'
> - 'Has anyone tested aggregation in this peptide family?'
> - 'What conditions did they use?'
> - 'Are there structural studies on this peptide?'
>
> MCP today: answers come from PVL's own analysis. MCP + RAG tomorrow: answers come from PVL's analysis *plus* cited literature."

### Q-Reach — "How will you reach young researchers?"
**My answer (the discoverability plan I want to discuss)**:
> "Beyond LinkedIn posts, the four levers I want to pull, in order of effort:
> 1. **bio.tools registration**. ELIXIR's directory is the canonical discovery point for new bioinformatics tools. Anyone literature-searching 'amyloid prediction tool' or 'fibril prediction peptide' should land on PVL within the first page. Blocked on having the final name.
> 2. **Zenodo DOI + GitHub release**. Citable in the paper, indexed by Google Scholar, makes PVL appear in citation chains.
> 3. **JOSS paper for the software**. JOSS is open, fast, no APC, and gets us into the JOSS RSS feed which a lot of bioinformatics people watch.
> 4. **Targeted MSc/PhD outreach**. Your former students, Alex's group, the Technion structural bio mailing list, the DESY biostructure interest groups. One demo session with 10 PhD students moves the needle more than 100 LinkedIn posts.
>
> Algorithmic SEO is real but downstream of the name decision and the bio.tools entry. Once the name is set, I'll register the domain + set up the structured metadata so search engines understand the site.
>
> Concrete question for you: would you co-host an intro session with your old lab and 2-3 Technion postdocs in early August? 30 minutes, hands-on with their actual sequences. That's the single biggest adoption lever I can think of."

### Q-Permalink — "Different paper?"
**My answer**:
> "Same paper, dedicated section in the methods. Not a separate publication."

### Q-AlphaFold framing
**Her direction**: "Just in title, AlphaFold3 predicted 3d structure. In the paper we will emphasize this."
**My answer**:
> "Two places already done: the card title in the UI is now 'AlphaFold-predicted structure' (was 'Sequence & Structure'). The paper methods will say it prominently — restricting structural-overlay interpretation to high-confidence regions when relevant."

### Q-Disclosure — Omitting AGGRESCAN / PASTA / AmyloDeep
**Her framing**: "they will miss these sequences since they are basing their prediction on the propensity to form β-sheets, which is the opposite of what we are doing."
**My answer**:
> "Going in as the lead differentiator in the paper intro. The story is: competing tools predict β-sheet propensity directly; PVL predicts the α-helix → β-sheet *switch*. That reframes why omitting them is not a comparison-gap — it's a category distinction. Thank you for that phrasing, it's the strongest single sentence I have for the intro."

### Q-Cohort wording
**Her clarification**: "Still not convinced we need to change the terminology. what is the problem with FF-a-helix and FF-SSW?"
**My answer**:
> "Total my-side miscommunication on that one. I was NOT proposing to rename FF-α-helix or FF-SSW. The 'database' word was the cohort → database rename you asked for in the original PowerPoint feedback (the comparison-text rewording, not the class flags). FF-α-helix and FF-SSW stay. Sorry for the confusion."

---

## §6 — Cheat sheet (during the call)

**If she asks "what's live right now?"**
> "The Wave 2.6 batch landed earlier today on `http://94.130.178.182:3000`. Hard refresh — you should see the AlphaFold-predicted structure title on any peptide detail page, the new cohort comparison colours on /results, the legend on the FF-Helix vs Aggregation Max scatter."

**If she asks "did you do X from the comments?"**
> Check the §3 list in this doc — odds are Round 1 covered it. If it's not there, it's queued for Round 2 (Wave 2.7).

**If she presses on length cap not being a *hard* reject yet**
> "Right — the default is set, the warnings are rewritten, but the API-level hard-reject is the next backend PR. I can land it within 24 hours if you need it before any specific demo."

**If she asks about Maxwell SSH**
> "Still blocked. Alex needs to add `azaizahs` to the Maxwell login group. Can you nudge him?"

**If she pushes on the name**
> Have the §3.7 shortlist ready. Don't commit to a name on the call. Promise a domain-feasibility check within 48 hours of the call deciding the shortlist.

**If MCP / RAG comes up**
> The §5 Q-RAG explanation is the one to give. Don't overload with technical detail — focus on the *use cases* (literature-grounded peptide answers) not the *tech*.

**If she asks about commercialization**
> §3.6 — open-source MIT, no SaaS, journal requirements cement this. Get her sign-off on the call so it's settled.

**Worst-case fallback for any unanswered question**
> "I want to give you a real answer rather than guess. Can I follow up tonight in writing?" Then actually follow up tonight in writing.

---

## §7 — Forward state (the one-paragraph closer for the call)

> "After this call: I'll land Wave 2.7 (the hard-reject route, the Help.tsx 4-section rewrite, the column-rename audit, the black-G fragment derivation, the TANGO stretch method) within two weeks. The DESY VM migration is on Alex. The Zenodo + bio.tools + paper-venue conversation happens once we have the name and the DOI. I'll send you a written version of this call's decisions within 48 hours, and we set a recurring 30-minute check-in monthly so this stays tight."
