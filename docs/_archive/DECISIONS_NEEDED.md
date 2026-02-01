# Decisions Needed

**Created**: 2026-02-01
**Purpose**: Questions requiring your input before refactoring begins.

---

## Decision 1: Critical Docs Location

**Context**: You mentioned reading these critical docs first:
- `docs/_critical/Setup (1).docx`
- `docs/_critical/Complete Development & Deployment Roadmap (K8s) (2).docx`
- `docs/_critical/Meta Navigator.docx`

**Finding**: These files do not exist in the repo. The `docs/_critical/` directory doesn't exist.

**Question**:
- [ ] **A)** These files are elsewhere (provide correct paths)
- [ ] **B)** These files need to be added (you'll upload them)
- [ ] **C)** Proceed without them (use existing docs/active/* as source of truth)

---

## Decision 2: JPred Code Deletion

**Context**: `jpred.py` is 380+ lines of dead code. `USE_JPRED = False` is hardcoded.

**Question**: Can I delete `backend/jpred.py` and `backend/Jpred/` directory entirely?

- [ ] **A)** Yes, delete everything JPred-related
- [ ] **B)** Archive to `backend/_archive/Jpred/` (keep for historical reference)
- [ ] **C)** Keep — we may re-enable JPred in future

---

## Decision 3: batch_process.py Status

**Context**: `batch_process.py` is a 300+ line standalone script for offline/batch processing. It imports the disabled `jpred` module.

**Question**: Is offline batch processing still needed?

- [ ] **A)** No, delete it
- [ ] **B)** Yes, keep it but fix the jpred import
- [ ] **C)** Unknown — need to check with original author

---

## Decision 4: Archived Docs Cleanup

**Context**: `docs/_archive/` contains 50 markdown files. `docs/active/` has only 5 files (the real documentation).

**Question**: What should happen to archived docs?

- [ ] **A)** Delete `docs/_archive/` entirely
- [ ] **B)** Compress into single `docs/ARCHIVE.md` summary
- [ ] **C)** Leave as-is (ignore in CLAUDE.md is sufficient)

---

## Decision 5: Deprecated Field Removal

**Context**: `chameleonPrediction` was marked for removal after 2025-04-01. It's now 2026-02-01 (10 months past deadline).

**Question**: Can I remove all `chameleonPrediction` references?

- [ ] **A)** Yes, remove it — no external consumers
- [ ] **B)** No, keep it — there are external consumers (please list them)
- [ ] **C)** Add deprecation warning but keep for another 6 months

---

## Decision 6: Stub Services Strategy

**Context**: Three "service" files are just wrappers that redirect to `server.py`:
- `upload_service.py`
- `predict_service.py`
- `uniprot_service.py`

**Question**: What should happen to stub services?

- [ ] **A)** Delete stubs, call server.py directly (honest about current state)
- [ ] **B)** Keep stubs, complete extraction as priority (ISSUE-001)
- [ ] **C)** Keep stubs as-is (they're fine as placeholders)

---

## Decision 7: Service Extraction Priority

**Context**: `server.py` is 2534 lines. Extraction will take 8-12 hours spread over multiple sessions.

**Question**: Which extraction order do you prefer?

- [ ] **A)** Start with file parsing (lowest risk)
- [ ] **B)** Start with upload logic (highest value)
- [ ] **C)** Start with UniProt logic (most self-contained)
- [ ] **D)** Don't extract yet — focus on deletions first

---

## Decision 8: UniProt File Naming

**Context**: Three confusingly-named files:
- `services/uniprot.py` (sequence windowing)
- `services/uniprot_query.py` (query parsing)
- `services/uniprot_service.py` (stub)

**Question**: Preferred naming convention?

- [ ] **A)** Rename: `sequence_windowing.py`, `uniprot_parser.py`, delete stub
- [ ] **B)** Create package: `services/uniprot/__init__.py`, `windowing.py`, `parser.py`
- [ ] **C)** Keep current names (they're fine)

---

## Decision 9: Run-Cache Policy

**Context**: PSIPRED has 59 run directories (empty). TANGO run dirs are also accumulating.

**Question**: How should run caches be managed?

- [ ] **A)** Add to .gitignore only (directories persist locally)
- [ ] **B)** Add cleanup script to Makefile (`make clean-cache`)
- [ ] **C)** Auto-prune: Keep only last N runs
- [ ] **D)** All of the above

---

## Decision 10: Deployment Artifacts

**Context**: Only TANGO has a Dockerfile. No main app Dockerfile, docker-compose, or K8s manifests found.

**Question**: Is deployment setup needed as part of this refactor?

- [ ] **A)** Yes, create Dockerfile for main app
- [ ] **B)** Yes, create docker-compose for local dev
- [ ] **C)** Not now — focus on code cleanup first
- [ ] **D)** Deployment artifacts exist elsewhere (provide location)

---

## Quick Response Template

Copy and fill in:

```
Decision 1: [ ]
Decision 2: [ ]
Decision 3: [ ]
Decision 4: [ ]
Decision 5: [ ]
Decision 6: [ ]
Decision 7: [ ]
Decision 8: [ ]
Decision 9: [ ]
Decision 10: [ ]

First issue to fix: ISSUE-___
```

---

## Ready When You Are

Once you provide these decisions, I will:

1. Start with the approved first issue
2. Make minimal changes
3. Run tests
4. Show you the diff before committing
5. Wait for approval before moving to next issue
