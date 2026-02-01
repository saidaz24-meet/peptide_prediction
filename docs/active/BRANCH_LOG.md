# Branch Log: chore/docs-hygiene

## Summary
Major cleanup and infrastructure refactor for Peptide Visual Lab (PVL).

## Commits (newest first)

| Commit | Type | Description |
|--------|------|-------------|
| `a17e149` | fix | Update frontend types for null semantics |
| `376b4fc` | feat | Add infrastructure (config, api, tests, tooling) |
| `194f7f3` | refactor | Use settings.USE_* dynamically instead of cached vars |
| `70c7713` | fix | Replace -1 sentinels with null for missing data (ISSUE-000) |
| `31ede4f` | chore | Consolidate docs to active/ structure |
| `ab5ebe8` | chore | Remove JPred dead code |
| `e9f1796` | feat | ISSUE-018 full response model validation |
| `b805e03` | refactor | Phase 0B/1 cleanup + UX improvements |
| `a1e39b0` | chore | Phase 5 cleanup sweep |
| `da2396a` | refactor | Rename files to follow Python naming conventions |
| `9f5da21` | refactor | Extract UniProt helper functions |
| `a2be055` | refactor | Extract predict logic to predict_service.py |
| `f358bf7` | refactor | Extract upload processing logic |
| `6746628` | refactor | Consolidate DataFrame utilities |
| `2c9bab1` | fix | Resolve 7 failing tests in test_golden_pipeline.py |
| `2b6cc5a` | refactor | Major updates to schema and logic |

## Issues Resolved
- ISSUE-000: -1 sentinel values replaced with null
- ISSUE-014: Duplicate FeedbackRequest class removed
- ISSUE-015: .dict() replaced with model_dump()
- ISSUE-017: Row validation through PeptideRow
- ISSUE-018: Full response model validation
- ISSUE-019: Provider status case mismatch fixed
- ISSUE-021: CSV column mapping UX simplified

## Tests
All 54 backend tests passing.

## Ready for Review
- [ ] PR to main pending
