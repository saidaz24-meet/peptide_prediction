# Knowledge Index

Quick reference table for all documentation. Agents should read Tier 1 by default; Tier 2 when needed; Tier 3 is blocked.

| Document | Tier | Purpose | Last Updated |
|----------|------|---------|--------------|
| **DEV_CONTEXT.md** | 1 | Primary context: project overview, folder map, invariants, tests | 2025-01-31 |
| **SYSTEM_MAP.md** | 1 | Architecture diagram and module overview | 2024-01-14 |
| **EXECUTION_PATHS.md** | 1 | End-to-end execution flows | 2024-01-14 |
| **FAILURE_MODES.md** | 1 | Silent failure modes with fixes | 2024-01-14 |
| **CONFIG_MATRIX.md** | 1 | All environment variables/flags | 2024-01-14 |
| **REF_IMPL_FULL_WALKTHROUGH.md** | 1 | Reference implementation end-to-end flow | 2026-02-02 |
| **CORRECTNESS_DELTA_REPORT.md** | 1 | Reference vs PVL comparison with evidence | 2026-02-02 |
| **REPLACEMENT_ROADMAP.md** | 2 | Implementation plan for reference alignment | 2026-02-02 |
| reference/WORKFLOWS.md | 2 | Operator cookbook (setup, running, troubleshooting) | 2024-01-14 |
| reference/ARCHITECTURE.md | 2 | Detailed frontend architecture | 2024-01-13 |
| reference/OBSERVABILITY.md | 2 | Logging and monitoring | 2024-01-14 |
| reference/FILE_REFERENCE.md | 2 | File-by-file commentary | Unknown |
| user/TODO_TRIAGE.md | 2 | Code smells and quick wins | 2024-01-13 |
| user/ACCURACY_FALLBACKS.md | 2 | Provider mapping rules | Unknown |
| user/SENTRY_TESTING.md | 3 | User-specific testing procedures | Unknown |
| user/SENTRY_TROUBLESHOOTING.md | 3 | User-specific debugging | Unknown |
| user/learn/OBSERVABILITY_ELI5.md | 3 | Teaching materials | Unknown |
| _archive/** | 3 | Historical snapshots, legacy docs, audit reports, refactor notes | Various |

## Tier Definitions

- **Tier 1 (MUST_READ)**: Essential for understanding the codebase. Read by default.
- **Tier 2 (OPTIONAL)**: Useful reference material. Read when relevant to task.
- **Tier 3 (IGNORE)**: Historical, user-specific, or bulky. Blocked by `.claudeignore`.

## Quick Access

**For agents starting work:**
1. Read `DEV_CONTEXT.md` (always)
2. Read relevant Tier 1 docs based on task
3. Consult Tier 2 docs if needed
4. Never read Tier 3 (blocked)

**For developers:**
- Setup: `reference/WORKFLOWS.md`
- Architecture: `SYSTEM_MAP.md` + `reference/ARCHITECTURE.md`
- Debugging: `FAILURE_MODES.md` + `reference/OBSERVABILITY.md`
- Configuration: `CONFIG_MATRIX.md`

---

## Reference Implementation Alignment

PVL has been validated against the reference implementation (`260120_Alpha_and_SSW_FF_Predictor`).

**Documentation:**
| Document | Purpose |
|----------|---------|
| `REF_IMPL_FULL_WALKTHROUGH.md` | End-to-end execution flow of reference |
| `CORRECTNESS_DELTA_REPORT.md` | Detailed comparison with evidence |
| `REPLACEMENT_ROADMAP.md` | Implementation plan and decisions |

**Golden Tests:**
| Test File | Coverage |
|-----------|----------|
| `test_ssw_golden.py` | SSW algorithm validation |
| `test_biochem_golden.py` | Biochemical calculations |
| `test_sentinel_values.py` | Null semantics |
| `test_preprocessing_golden.py` | Sequence preprocessing |

### Intentional Differences from Reference

PVL differs from reference in these areas **by design**:

#### 1. Null Semantics (IMPROVEMENT)
- **Reference:** Uses `-1` as sentinel for missing data
- **PVL:** Uses `null` (JSON null) for missing data
- **Rationale:** `null` is semantically correct for "no data available"
- **Impact:** API responses use `null` instead of `-1` for missing values

#### 2. μH Averaging (IMPROVEMENT)
- **Reference:** Simple mean of segment μH values: `mean([μH1, μH2, ...])`
- **PVL:** Weighted average by segment length: `Σ(μH_i × len_i) / Σ len_i`
- **Rationale:** Longer segments contribute more residues; weighted is more accurate
- **Impact:** μH values may differ when segments have unequal lengths

#### 3. Histidine Charge (IMPROVEMENT)
- **Reference:** Omits histidine from charge calculation (H = 0)
- **PVL:** Includes H = +0.1 (10% protonated at pH 7.4)
- **Rationale:** Chemically accurate for physiological pH
- **Impact:** Charge differs for histidine-containing sequences

### Matching Reference Exactly

These areas match reference implementation exactly:

- SSW threshold comparison: `diff < avg → 1` (IS SSW), `diff >= avg → -1` (NOT SSW)
- Segment detection: MIN_SEGMENT_LENGTH=5, MAX_GAP=3
- B/Z preprocessing: B→D (aspartate), Z→E (glutamate)
- TANGO parameters: nt="N", ct="N", ph="7", te="298", io="0.1", tf="0"
- Hydrophobicity scale: Fauchere-Pliska
- μH formula: Eisenberg 1982 (normalized by length)
