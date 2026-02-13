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

**Active Context Pack** (docs/active/):
- **ACTIVE_CONTEXT.md** — Architecture overview, entrypoints, data flow, key modules
- **TESTING_GUIDE.md** — Test commands, local setup, known failures
- **CONTRACTS.md** — API endpoints, request/response shapes, UI requirements
- **KNOWN_ISSUES.md** — Known bugs, limitations, workarounds
- **FILES_TO_TOUCH.md** — Hot files most likely to be edited

**DO NOT READ**:
- `docs/_archive/**` — Historical/archived docs (ignored)
- `docs/legacy/**` — Legacy docs (ignored)
- `docs/reference/**` — Reference docs (use active context instead)
- `docs/user/**` — User-specific docs (ignored)
- Any markdown files outside `docs/active/` (unless explicitly requested)

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
| `backend/server.py` | Main orchestrator (~1500 LOC) |
| `backend/tango.py` | TANGO runner/parser (~1300 LOC) |
| `backend/s4pred.py` | S4PRED runner/analyzer (~670 LOC) |
| `backend/auxiliary.py` | FF-Helix + SSW helpers (~370 LOC) |
| `backend/biochem_calculation.py` | Charge, hydrophobicity, μH (~200 LOC) |
| `backend/config.py` | Centralized settings (~210 LOC) |
| `backend/services/normalize.py` | Response normalization (~740 LOC) |
| `backend/schemas/api_models.py` | **CANONICAL** API contract (protected) |

### Frontend Core
| File | Purpose |
|------|---------|
| `ui/src/pages/Results.tsx` | Main dashboard |
| `ui/src/pages/PeptideDetail.tsx` | Peptide deep-dive |
| `ui/src/stores/datasetStore.ts` | Zustand state management |

## Quick Reference
```bash
# Development
make test       # All tests (deterministic, no network)
make test-unit  # Fast unit tests
make lint       # Code quality
make typecheck  # Type checking
make fmt        # Format code
make ci         # Full pipeline

# Predictor flags
USE_TANGO=1     # Enable TANGO
USE_S4PRED=1    # Enable S4PRED (primary)
```

