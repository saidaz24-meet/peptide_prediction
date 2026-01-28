# Knowledge Index

Single entry point for all documentation. Navigate from here to find what you need.

## 🚀 Quick Start (New Engineers)

**Start here if you're new to the codebase:**

1. **[WORKFLOWS.md](./WORKFLOWS.md)** — "From Zero to Results" (10 steps)
   - Setup, installation, running locally
   - Preflight checks, smoke tests
   - Troubleshooting guide

2. **[SYSTEM_MAP.md](./SYSTEM_MAP.md)** — High-level architecture
   - Architecture diagram (ASCII)
   - Main modules/services overview
   - Data stores and binaries

3. **[EXECUTION_PATHS.md](./EXECUTION_PATHS.md)** — How things work end-to-end
   - UniProt search → analysis → Tango → display
   - Manual upload → analysis → Tango → display
   - Re-run/refresh using cached inputs

4. **[FAILURE_MODES.md](./FAILURE_MODES.md)** — Silent failures (MUST READ)
   - Path mis-resolution regression
   - macOS quarantine, permissions, timeouts
   - Exact symptoms, log signatures, fixes

## 📚 Core Documentation

### System & Architecture

- **[SYSTEM_MAP.md](./SYSTEM_MAP.md)** — Architecture diagram, modules, data stores, binaries
- **[EXECUTION_PATHS.md](./EXECUTION_PATHS.md)** — End-to-end execution flows
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Detailed frontend architecture (routes, components, state)

### Operations & Setup

- **[WORKFLOWS.md](./WORKFLOWS.md)** — Operator cookbook (setup, running, troubleshooting)
- **[CONFIG_MATRIX.md](./CONFIG_MATRIX.md)** — All environment variables/flags with defaults
- **[DEPLOYMENT.md](../DEPLOYMENT.md)** — Deployment guide (lab server, public access)

### Reliability & Debugging

- **[FAILURE_MODES.md](./FAILURE_MODES.md)** — Silent failure modes with fixes
- **[OBSERVABILITY.md](./OBSERVABILITY.md)** — Logging events and structured logging guards
- **[TODO_TRIAGE.md](./TODO_TRIAGE.md)** — Code smells and quick wins

### Implementation Details

- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** — Feature matrix, what's implemented vs missing
- **[ACCURACY_FALLBACKS.md](./ACCURACY_FALLBACKS.md)** — Provider accuracy and fallback rules
- **[FILE_REFERENCE.md](./FILE_REFERENCE.md)** — File-by-file commentary

## 🛠️ Tools & Scripts

### Preflight & Verification

- **`checks/preflight.sh`** — Idempotent preflight checks (binary, perms, quarantine, volumes)
- **`checks/verify_tango_path.py`** — Resolves and prints TANGO binary paths for all runners
- **`checks/smoke_uniprot.sh`** — Tiny UniProt query validation (2 sequences, validates TANGO outputs)

### Cleanup

- **`scripts/clean_repo.sh`** — Repository cleanup (dry-run by default, use `--apply`)
  - Archives historical MD files to `docs/legacy/`
  - Cleans cache/temp directories
  - See **[CLEANUP_PLAN.md](./CLEANUP_PLAN.md)** for details

## 📖 Documentation Structure

```
docs/
├── KNOWLEDGE_INDEX.md          ← YOU ARE HERE (single entry point)
├── README.md                   ← Documentation index with status
├── CLEANUP_PLAN.md             ← Cleanup inventory and actions
│
├── Core Docs (Protected)       ← Never delete these
│   ├── SYSTEM_MAP.md
│   ├── EXECUTION_PATHS.md
│   ├── WORKFLOWS.md
│   ├── CONFIG_MATRIX.md
│   ├── FAILURE_MODES.md
│   ├── OBSERVABILITY.md
│   └── TODO_TRIAGE.md
│
├── Detailed Docs (Keep)        ← Still useful
│   ├── ARCHITECTURE.md
│   ├── IMPLEMENTATION_STATUS.md
│   ├── ACCURACY_FALLBACKS.md
│   └── FILE_REFERENCE.md
│
└── legacy/                     ← Archived docs (historical)
    ├── CHANGES_*.md
    ├── CODEBASE_ANALYSIS.md
    ├── DEV_ERGONOMICS.md
    └── ...
```

## 🎯 Common Tasks

### "I want to understand how the system works"
→ Start with **[SYSTEM_MAP.md](./SYSTEM_MAP.md)**, then **[EXECUTION_PATHS.md](./EXECUTION_PATHS.md)**

### "I want to set up and run locally"
→ Follow **[WORKFLOWS.md](./WORKFLOWS.md)** "From Zero to Results" (10 steps)

### "I want to configure the system"
→ See **[CONFIG_MATRIX.md](./CONFIG_MATRIX.md)** for all environment variables

### "Something is broken / not working"
→ Check **[FAILURE_MODES.md](./FAILURE_MODES.md)** for known issues and fixes

### "I want to add logging / monitor the system"
→ See **[OBSERVABILITY.md](./OBSERVABILITY.md)** for log events and guards

### "I want to understand the frontend"
→ See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed frontend docs

### "I want to clean up the repo"
→ Run `scripts/clean_repo.sh` (dry-run) or see **[CLEANUP_PLAN.md](./CLEANUP_PLAN.md)**

## 🔗 External References

- **Main README**: [../README.md](../README.md) — Project overview and quick start
- **Deployment**: [../DEPLOYMENT.md](../DEPLOYMENT.md) — Deployment guide
- **License**: [../LICENSE-DESY-RESEARCH.md](../LICENSE-DESY-RESEARCH.md) — License file

## 📝 Documentation Status

| Document | Status | Last Updated | Notes |
|----------|--------|--------------|-------|
| KNOWLEDGE_INDEX.md | ✅ Current | 2024-01-14 | Single entry point (this file) |
| SYSTEM_MAP.md | ✅ Current | 2024-01-13 | Protected, core doc |
| EXECUTION_PATHS.md | ✅ Current | 2024-01-13 | Protected, core doc |
| WORKFLOWS.md | ✅ Current | 2024-01-13 | Protected, core doc |
| CONFIG_MATRIX.md | ✅ Current | 2024-01-13 | Protected, core doc |
| FAILURE_MODES.md | ✅ Current | 2024-01-13 | Protected, core doc |
| OBSERVABILITY.md | ✅ Current | 2024-01-13 | Protected, core doc |
| TODO_TRIAGE.md | ✅ Current | 2024-01-13 | Protected, core doc |
| ARCHITECTURE.md | ⚠️ Review | Unknown | Detailed frontend; may need updates |
| IMPLEMENTATION_STATUS.md | ⚠️ Review | Unknown | May be outdated |
| ACCURACY_FALLBACKS.md | ✅ Useful | Unknown | Provider mapping still relevant |
| FILE_REFERENCE.md | ✅ Useful | Unknown | File-by-file reference still useful |

## 🧹 Cleanup & Maintenance

- **Cleanup Plan**: [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) — Inventory and actions
- **Cleanup Script**: `scripts/clean_repo.sh` — Idempotent cleanup (dry-run by default)
- **Legacy Docs**: `docs/legacy/` — Archived historical documentation

---

**Last Updated**: 2024-01-14  
**Maintainer**: See [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) for documentation maintenance rules.

