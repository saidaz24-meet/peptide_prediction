# Claude Agent Instructions

## Project Vision

**Peptide Visual Lab (PVL)** is an all-in-one prediction and visualization web server for peptide researchers.

**Problem**: Researchers studying peptide aggregation, structural switching, and fibril formation lack a single web tool that combines these analyses with interactive visualization. Existing tools (PASTA 2.0, Waltz, AGGRESCAN) are single-algorithm, non-visual, or offline-only.

**Solution**: PVL combines aggregation propensity (TANGO), secondary structure prediction (S4PRED), and fibril-forming helix detection (FF-Helix) in one web interface with publication-ready visualizations. It is a research instrument, not a feature collection.

**Long-term vision**: Open-source reference tool (MIT) → Zenodo DOI → JOSS paper → ELIXIR bio.tools registration. The tool must be scientifically correct first, user-friendly second, feature-rich last.

## Architectural Principles

1. **Single sequence and batch MUST produce identical results** for the same peptide. If the same sequence is submitted via Quick Analyze or CSV upload, every computed value must match exactly.
2. **`api_models.py` is the single source of truth** — never change response schemas without explicit approval.
3. **JSON `null` only** — never use `-1`, `"N/A"`, or empty string as sentinel values.
4. **Every calculation must be deterministic and reproducible** — same input, same config, same output.
5. **Foundation before features** — never ship new features on top of inconsistent pipelines. Fix correctness first.
6. **Always use plan mode** before multi-file changes so the user sees the bigger picture.

## Documentation Access Rule

**STRICT**: Default read only `CLAUDE.md` + `docs/active/*`. These are the ONLY authoritative documentation files.

**Three-bucket doc system** (clean-push policy, see `docs/internal/CLEAN_PUSH_POLICY_2026_06_07.md` for details):

**`docs/active/`** — publishable architecture + scientific reference. ALWAYS readable.
- **ACTIVE_CONTEXT.md** — Architecture overview, entrypoints, data flow, key modules
- **TESTING_GUIDE.md** — Test commands, local setup, known failures
- **CONTRACTS.md** — API endpoints, request/response shapes, UI requirements
- **KNOWN_ISSUES.md** — Known bugs, limitations, workarounds
- **MASTER_DEV_DOC.md** — Consolidated architecture + decisions reference
- **DEPLOYMENT.md** — VM specs, step-by-step deployment, K8s plan
- **ROADMAP.md** — Strategic position, Phase A/B/C tasks, completed history
- **DEVELOPER_REFERENCE.md** — Pipeline internals, null semantics, debugging
- **DECISIONS.md** — ADR log
- **SPECIALS.md** — Special handling rules
- **CHANGELOG_PELEG.md** — Scientific changelog reviewed by Peleg
- **MCP_RUNBOOK.md** — MCP server install + usage
- **MOL3D_OVERLAY_SPEC.md** — Mol* overlay technical spec
- **UNIPROT_ENRICHMENT_SPEC.md** — UniProt integration spec
- **VECTOR_SEARCH_SPEC.md** — LanceDB + ESM-2 architecture
- **SENTRY_RUNBOOK.md** — Sentry deployment runbook
- **DESIGN_SYSTEM.md** — Tailwind + shadcn conventions
- **ECOSYSTEM_GUIDE.md** — 5-surface reference
- **A4_BIO_TOOLS_SUBMISSION.md** — bio.tools submission packet
- **A5_ZENODO_RELEASE.md** — Zenodo release procedure
- **PELEG_FOLLOWUP_DOC_V2.md** — current draft going to Peleg
- **RESEARCH_BRIEFS/** — Scientific brief artifacts
- **RESPONSES/** — Peleg / Alex response log
- **cowork-dispatches/** — paste-ready Cowork prompts (V10-7, V10-8, V10-9)

**`docs/internal/`** — development process artifacts. ASK before reading.
Process docs (CLEAN_PUSH_POLICY, MASTER_PUSH_PLAN, TOP_CEO_RECOMMENDATIONS, COWORK_V10_DESIGN_QUEUE, ALEX_BACKLOG, PELEG_REVIEW_TASKS, STATUS, etc.) and dated one-shots (T2_T3_RESTART_2026_06_07, COMPACT_PUBLISH_LIST_2026_06_07, etc.). These are how-we-work docs, not what-we-ship.

**`docs/archive/<date>/`** — frozen historical artifacts. READ ONLY for the why-trail.
Sent packets (PELEG_FOLLOWUP_PACKET_*), completed audits (HELIX_PERCENTAGE_AUDIT, COVERAGE_AUDIT), pre-Zoom prep docs, superseded plans. Don't act on as current state.

**DO NOT READ** unless explicitly requested:
- `docs/internal/*` — process docs, ask first
- `docs/archive/*` — historical, treat as frozen
- Markdown files outside these three trees
- `_external/` — Peleg's repo + paper copy, DO NOT redistribute

**Before opening new files outside docs/active/**:
1. Propose top 3 files you want to read
2. Explain why each is needed for the task
3. Wait for user approval before reading

## TDD Workflow

1. **Write failing test first** — Test must fail for the right reason
2. **Minimal implementation** — Smallest change to make test pass
3. **Refactor** — Clean up while keeping tests green
4. **Edge tests** — Add boundary cases and error paths

**Test commands:**
- `make test` — All tests (deterministic, no network)
- `make test-unit` — Fast unit tests only
- `make ci` — Full pipeline (lint + typecheck + test)

## Output Policy

After every change, provide:

1. **Files changed** — List all modified/created files
2. **Verification commands** — Exact commands to verify:
   ```bash
   make test        # If tests changed
   make lint        # If code changed
   make typecheck   # If types changed
   make ci          # For significant changes
   ```

**Example:**
```
Files changed:
- backend/services/normalize.py
- backend/tests/test_normalize.py

Verify:
make test
```

## Context Management

- **Short file lists** — Read only necessary files, not entire directories
- **Summarize after milestones** — After completing a logical unit, summarize what was done
- **Recommend `/compact`** — Suggest using compact mode for large codebases when appropriate

## Safety Rules

1. **Public APIs are protected** — Do not change:
   - `backend/schemas/api_models.py` (response schemas)
   - API endpoint signatures in `backend/api/routes/`
   - Response formats (camelCase keys, Entry alignment)

2. **Smallest diffs** — Prefer minimal changes:
   - Fix only what's broken
   - Add features incrementally
   - Avoid refactoring unless requested

3. **Invariants**:
   - Entry IDs must align between input and output
   - Response keys must be camelCase
   - FF-Helix% always computed (no external dependency)
   - S4PRED is primary predictor (PSIPRED removed)

## Key Files Reference

### Backend Core
| File | Purpose |
|------|---------|
| `backend/server.py` | Compatibility shim (~15 LOC, deprecated) |
| `backend/tango.py` | TANGO runner/parser (~1400 LOC) |
| `backend/s4pred.py` | S4PRED runner/analyzer (~670 LOC) |
| `backend/auxiliary.py` | FF-Helix + SSW helpers (~370 LOC) |
| `backend/biochem_calculation.py` | Charge, hydrophobicity, μH (~85 LOC) |
| `backend/config.py` | Centralized settings (~245 LOC) |
| `backend/services/normalize.py` | Response normalization (~740 LOC) |
| `backend/schemas/api_models.py` | **CANONICAL** API contract (protected) |
| `backend/consensus.py` | Consensus pipeline logic |
| `backend/services/provider_state.py` | Provider state tracking |
| `backend/services/uniprot_execute_service.py` | UniProt query execution (~635 LOC) |

### Frontend Core
| File | Purpose |
|------|---------|
| `ui/src/pages/Results.tsx` | Main dashboard |
| `ui/src/pages/PeptideDetail.tsx` | Peptide deep-dive |
| `ui/src/stores/datasetStore.ts` | Zustand: peptide data + stats |
| `ui/src/stores/thresholdStore.ts` | Zustand: threshold presets + re-classification |
| `ui/src/stores/chartSelectionStore.ts` | Zustand: chart filter state |
| `ui/src/lib/peptideMapper.ts` | API → frontend type mapping |
| `ui/src/types/peptide.ts` | Canonical frontend type definitions |

## Quick Reference
```bash
# Development
make test           # All tests (deterministic, no network)
make test-unit      # Fast unit tests
make lint           # Code quality
make typecheck      # Type checking
make fmt            # Format code
make ci             # Full pipeline
make smoke-tango    # Verify TANGO binary works
make contract-check # Verify backend↔UI contract sync

# Predictor flags
USE_TANGO=1     # Enable TANGO
USE_S4PRED=1    # Enable S4PRED (primary)
```

