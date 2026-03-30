# Alex & Peleg Raw Feedback — Structured Backlog

**Source**: Said's notes from meetings + Alex's Slack messages (2026-03-25 to 2026-03-28)
**Purpose**: Nothing gets lost. Each item tagged with phase and priority.
**Last Updated**: 2026-03-28

---

## Threshold Controls (Phase D — UI Redesign)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| T1 | Delete "Dangerous Max" threshold — misleading name | D | DONE |
| T2 | If advanced thresholds are from TANGO, reconsider — goal is to not rely on TANGO | D | DONE (removed Rule 1) |
| T3 | Add "Minimal Score of Helicity" threshold | D | DONE |
| T4 | Group thresholds with titles: SSW section, FF section, General section | D | DONE |
| T5 | General threshold: "Minimal prediction percentage of amino acids" (if <50% predicted, flag it) | D | DONE |
| T6 | Min S4PRED helix threshold | D | DONE |
| T7 | Max TANGO difference threshold (keep but deprioritize) | D | DONE |
| T8 | SSW max difference threshold | D | DONE |
| T9 | FF threshold section: hydrophobicity and muH cutoffs | D | DONE (grouped) |
| T10 | Add eye/info icons next to each threshold showing description + effect | D | DONE |
| T11 | Reference: look up Peleg and Bader papers for threshold values | D | TODO |

## Table & Columns (Phase D)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| C1 | Put S4PRED secondary structure (helicity) in a table column | D | DONE |
| C2 | Remove TANGO/S4PRED labels everywhere — researchers already know | D | DONE |
| C3 | S4PRED helix as yes/no (auto-show) | D | DONE |
| C4 | Important columns on left side, bio calcs on right side | D | DONE |
| C5 | Remove T1 warning ("S4PRED and TANGO disagree") — not serious, expected | D | DONE |

## PeptideDetail Page (Phase D)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| P1 | Two tracks: one for helix, one for SSW, both with sequence letters | D | TODO |
| P2 | Have sequence shown again under SSW track with SSW-specific calcs | D | TODO |
| P3 | Clickable/expandable titles for faster scrolling | D | TODO |
| P4 | Show three aggregation graphs for S4PRED helix results (same as SSW graphs) | D | TODO |
| P5 | Remove "concerns and flagging risks" — aggregation is not a risk to biologists | D | DONE |
| P6 | Aggregation graph: calmer colors proportional to score | D | DONE |
| P7 | "High confidence switch zone" warning — research Hamodrakas 2007 for amyloid-forming hallmark | D | TODO |
| P8 | Another helix diagram (same layout as SSW up/down diagram) | D | TODO |

## Charts & Diagrams (Phase D)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| CH1 | Pipeline overview: different colors per region, summary table of colors + percentages underneath | D | TODO |
| CH2 | Dynamic Venn diagram: if no FF-Helix+SSW overlap exists, don't show crossing circles | D | TODO |
| CH3 | Clickable diagram sections: click "helix & SSW but not FF-Helix" to filter table | D | TODO |
| CH4 | Top 2 charts: more rows, more colors, more distribution, user-customizable (show what they want in one diagram instead of 10 separate ones) | D | TODO |
| CH5 | Peptide markers in table below charts for quick visual relationships | D | TODO |
| CH6 | Rename "Doolittle" to "Fauchere-Pliska" in sliding window charts | D | DONE (labels + scale values) |
| CH7 | Rename to "Helic West" (verify exact name from Peleg) | D | TODO |

## AlphaFold (Phase B/D)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| AF1 | Research: why does AlphaFold DB have longer sequence than what we send from UniProt? | B | TODO |
| AF2 | Add warning: "AlphaFold structure includes signal peptide — PVL sequence may be shorter" | B | DONE |

## Cohort Comparison (B13 — already in roadmap)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| CO1 | Upload both A and B fresh (not just B against already-loaded A) | B13 | TODO |
| CO2 | Save previous analysis results for later comparison without recalculation | B13 | TODO |

## Quick Analyze (B — already in roadmap as ISSUE-022)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| QA1 | Add example peptide buttons (like Upload page has Venom, Antimicrobial, etc.) | ISSUE-022 | DONE |

## Tools Tab (B14 — already in roadmap)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| TL1 | PDB structure renderer: drag-drop PDB file -> PNG publication image | B14 | TODO |
| TL2 | Research other tools to add (format converters, batch lookup, etc.) | B14 | TODO |

## Large Datasets (B15 — already in roadmap)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| LD1 | Fix nginx 413 error for >1MB files | ISSUE-021 | FIXED |
| LD2 | Handle 3K+ entry datasets (timeout, progress, auto-disable TANGO) | B15 | TODO |
| LD3 | Show entry count warning during upload with time estimate | B15 | DONE |

## Load Testing (B16 — already in roadmap)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| LT1 | Simulate 50, 100, 1000 concurrent analyses on Hetzner VPS | B16 | TODO |

## UI/UX General (Phase D)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| UX1 | Better sidebar: icons only, hover labels, no text | D | TODO |
| UX2 | More app-like scrolling experience | D | TODO |
| UX3 | Professional research-tool look, modern design | D | TODO |
| UX4 | Final theme decision (dark/light/auto) | D | TODO |
| UX5 | Minimizable bars wherever possible | D | TODO |

## Infrastructure (Phase E — already in roadmap)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| INF1 | Docker compose consolidation | E2 | TODO |
| INF2 | GHCR pull-and-run workflow | E1 | TODO |
| INF3 | Multi-arch build (Apple Silicon + Linux) | E6 | TODO |
| INF4 | Git workflow: branches, PRs, not just push to main | — | TODO |

## AI/LLM Integration (Phase G — already in roadmap)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| AI1 | PVL MCP Server — natural language queries | G1 | TODO |
| AI2 | Scientific RAG with PubMed citations | G2 | TODO |
| AI3 | Research Tamarind Bio for inspiration/connection | G1 | TODO |

## Concurrency & Background Processing (CRITICAL — 2026-03-30)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| CQ1 | Large analysis (6000 entries) blocks ALL other requests — Quick Analyze, Upload, everything | B15 | DONE |
| CQ2 | Wrap `subprocess.run()` in `asyncio.to_thread()` to unblock event loop | B15 | DONE |
| CQ3 | Bump `--workers 1` to `--workers 2` in Dockerfile.backend + CPU limit to 3 | B15 | DONE |
| CQ4 | Ghost processes: navigating away leaves TANGO running in background, no way to reconnect | B15 | PARTIAL (abort on nav, but no reconnect yet) |
| CQ5 | Add navigation guard: "Do you really want to leave? Analysis in progress." | B15 | DONE |
| CQ6 | Job persistence: sidebar tab showing running/completed jobs (Alex's idea) | B15 | TODO |
| CQ7 | Server at 150% CPU (1.5/4 cores) but other requests still blocked — queue architecture issue | B15 | TODO |
| CQ8 | 6000 entries estimated 360 min — communicate timing better and/or optimize batch processing | B15 | TODO |
| CQ9 | Future: Celery + Redis for proper job queue (defer until 10+ concurrent users) | B15 | TODO |

## Upload UX Confusion (2026-03-30)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| UU1 | Alex keeps clicking violet "Upload Data" button instead of dropzone — rename/tone down or make dropzone more prominent | D | TODO |
| UU2 | Alex also clicks "Upload File" near progress bar — confusing with actual upload area | D | TODO |
| UU3 | Make real upload dropzone the main focus: more contrast, color, "click here" indicator | D | TODO |

## Quick Analyze UX (2026-03-30)

| ID | Item | Phase | Status |
|----|------|-------|--------|
| QU1 | Rename "Label (optional)" to "Name (optional)" or "Peptide Name" — Alex didn't understand it was a name field | D | DONE |

## Operational

| ID | Item | Owner | Status |
|----|------|-------|--------|
| OP1 | Activate DESY email | Said | TODO |
| OP2 | Set up DESY email for managing DESY IT + VM requests | Said | TODO |
| OP3 | Sentry setup on Hetzner VPS | Said | TODO |
| OP4 | Free domain for Hetzner VPS | Said | TODO |
