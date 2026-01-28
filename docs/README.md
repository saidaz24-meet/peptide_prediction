# Peptide Prediction Service — Documentation

Complete technical documentation for the Peptide Prediction Service.

> **📖 Start here**: See **[KNOWLEDGE_INDEX.md](./KNOWLEDGE_INDEX.md)** for the single entry point to all documentation.

## 📋 Core Documentation (New)

### System Overview

1. **[SYSTEM_MAP.md](./SYSTEM_MAP.md)** — High-level architecture diagram and module overview
   - Architecture diagram (ASCII)
   - Main modules/services (backend API, Tango runners, UniProt client, analysis pipeline, UI)
   - Data stores, caches, temp dirs, and their paths
   - All binaries/externals (Tango binary, Docker images)

2. **[EXECUTION_PATHS.md](./EXECUTION_PATHS.md)** — End-to-end flows for the 3 most important user actions
   - "UniProt search → analysis → Tango → display"
   - "Manual peptide upload → analysis → Tango → display"
   - "Re-run/refresh using cached inputs"
   - For each flow: entrypoints, key functions, called files, environment flags, inputs/outputs, on-disk paths

3. **[WORKFLOWS.md](./WORKFLOWS.md)** — Operator cookbook
   - How to run locally (macOS/Apple Silicon & Intel), with/without Docker
   - Required env vars, examples (.env.example)
   - Preflight checks (permissions, quarantine removal, presence of tango binary)
   - "From zero to results on the web UI" step-by-step (10 steps)

4. **[CONFIG_MATRIX.md](./CONFIG_MATRIX.md)** — All toggles/flags with defaults
   - Feature flags (USE_TANGO, USE_PSIPRED)
   - TANGO configuration (TANGO_MODE, TANGO_BIN, TANGO_RUNTIME_DIR)
   - PSIPRED configuration (PSIPRED_IMAGE, PSIPRED_DB)
   - SSW threshold configuration
   - FF-Helix configuration
   - Where each flag is read in code, and which path it changes

5. **[FAILURE_MODES.md](./FAILURE_MODES.md)** — Silent failure modes (MUST READ)
   - Every place a silent failure can happen
   - Path resolution, tmp dirs, file permissions, macOS quarantine, Docker volume mounts, timeouts, parsing when outputs are empty
   - For each: exact symptom, log signature, and the decisive fix
   - **Includes the specific regression pattern where a generated script computes the wrong tango binary path relative to a run folder**

6. **[OBSERVABILITY.md](./OBSERVABILITY.md)** — Logging and monitoring
   - List of log events (names, levels)
   - Structured logging guards around: runner selection, resolved paths, counts of produced *.txt, and non-zero exit codes
   - Hard guard: if Tango produces 0 outputs for N inputs, return an error to the UI with the run directory and suspected cause

7. **[TODO_TRIAGE.md](./TODO_TRIAGE.md)** — Code smells and quick wins
   - Ordered list with file/line pointers
   - Highlights places that generate .bat on macOS (recommends renaming to .sh)
   - Investigation scope and quick wins

## 📚 Legacy Documentation (Still Useful)

### Detailed Implementation

8. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Detailed frontend architecture
   - Route map (URLs → pages → components)
   - Data flow diagrams (Upload/QuickAnalyze → API → store → UI)
   - State contracts (TypeScript types, API payloads)
   - Component and sequence diagrams
   - **Note**: More detailed than SYSTEM_MAP.md on frontend specifics

9. **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** — What's implemented vs missing
   - Feature matrix by page/component/service
   - Dead code paths and unused components
   - Partial implementations and stubs
   - **Note**: May be outdated; verify against current codebase

10. **[ACCURACY_FALLBACKS.md](./ACCURACY_FALLBACKS.md)** — Provider accuracy and fallback rules
    - PSIPRED/TANGO/FF-Helix mapping to UI fields
    - Fallback math when providers are unavailable
    - Source-of-truth table: field → provider → fallback → display rule

11. **[FILE_REFERENCE.md](./FILE_REFERENCE.md)** — File-by-file commentary
    - Purpose, inputs/outputs, dependencies
    - Assumptions, thresholds, TODOs
    - Cross-references

### Development Guides

12. **[DEV_ERGONOMICS.md](./DEV_ERGONOMICS.md)** — Developer setup and tooling
    - Environment variables (.env.example)
    - One-command dev run
    - Testing knobs and fixtures
    - **Note**: Overlaps with WORKFLOWS.md; WORKFLOWS.md is more comprehensive

13. **[CONTINUATION_PLAN.md](./CONTINUATION_PLAN.md)** — Concrete PR plan
    - Short-term PRs (1–2 days): types, store, mappers, provider status, temp dirs, logs, dead code
    - Medium-term PRs: Postgres schema, Docker toggle, background queue
    - Risk log and mitigations
    - **Note**: May be outdated; see TODO_TRIAGE.md for current priorities

### Specialized Topics

14. **[uniprot-flow.md](./uniprot-flow.md)** — UniProt query flow details
    - Query parsing and execution
    - **Note**: Overlaps with EXECUTION_PATHS.md; EXECUTION_PATHS.md is more comprehensive

15. **[providers.md](./providers.md)** — Provider status details
    - Provider status values and meanings
    - **Note**: May be outdated; see CONFIG_MATRIX.md and FAILURE_MODES.md for current status

16. **[provider-fixes-summary.md](./provider-fixes-summary.md)** — Provider fixes summary
    - Historical fixes for provider issues
    - **Note**: May be outdated; see FAILURE_MODES.md for current failure modes

## 🎯 Quick Start for New Engineers

1. **Read**: [WORKFLOWS.md](./WORKFLOWS.md) — Follow "From Zero to Results" (10 steps)
2. **Read**: [SYSTEM_MAP.md](./SYSTEM_MAP.md) — Understand high-level architecture
3. **Read**: [EXECUTION_PATHS.md](./EXECUTION_PATHS.md) — Understand execution flows
4. **Read**: [FAILURE_MODES.md](./FAILURE_MODES.md) — Understand silent failure modes
5. **Reference**: [CONFIG_MATRIX.md](./CONFIG_MATRIX.md) — All configuration options
6. **Reference**: [OBSERVABILITY.md](./OBSERVABILITY.md) — Logging and monitoring

## 🔧 Preflight Checks

Before starting the server, run:

```bash
./checks/preflight.sh
```

This checks:
- ✅ TANGO binary exists and is executable
- ✅ macOS quarantine removed
- ✅ Runtime directories exist and are writable
- ✅ Docker available (if using PSIPRED)
- ✅ Required Python packages installed

## 🧪 Smoke Tests

After setup, run:

```bash
./checks/smoke_uniprot.sh
```

This runs a tiny UniProt query (2 sequences), validates at least 2 TANGO outputs exist, exits non-zero if not.

## 📝 Documentation Status

| Document | Status | Last Updated | Notes |
|----------|--------|--------------|-------|
| SYSTEM_MAP.md | ✅ Current | 2024-01-13 | New comprehensive overview |
| EXECUTION_PATHS.md | ✅ Current | 2024-01-13 | New detailed flows |
| WORKFLOWS.md | ✅ Current | 2024-01-13 | New operator cookbook |
| CONFIG_MATRIX.md | ✅ Current | 2024-01-13 | New complete config reference |
| FAILURE_MODES.md | ✅ Current | 2024-01-13 | New critical failure documentation |
| OBSERVABILITY.md | ✅ Current | 2024-01-13 | New logging reference |
| TODO_TRIAGE.md | ✅ Current | 2024-01-13 | New code smells list |
| ARCHITECTURE.md | ⚠️ Review | Unknown | Detailed frontend; may need updates |
| IMPLEMENTATION_STATUS.md | ⚠️ Review | Unknown | May be outdated |
| ACCURACY_FALLBACKS.md | ✅ Useful | Unknown | Provider mapping still relevant |
| CONTINUATION_PLAN.md | ⚠️ Review | Unknown | May be outdated; see TODO_TRIAGE.md |
| DEV_ERGONOMICS.md | ⚠️ Review | Unknown | Overlaps with WORKFLOWS.md |
| FILE_REFERENCE.md | ✅ Useful | Unknown | File-by-file reference still useful |
| uniprot-flow.md | ⚠️ Review | Unknown | Overlaps with EXECUTION_PATHS.md |
| providers.md | ⚠️ Review | Unknown | May be outdated |
| provider-fixes-summary.md | ⚠️ Review | Unknown | Historical; see FAILURE_MODES.md |

## 🔗 Related Files

- **checks/preflight.sh** — Preflight checks script
- **checks/verify_tango_path.py** — Verify TANGO binary path resolution
- **checks/smoke_uniprot.sh** — UniProt smoke test
