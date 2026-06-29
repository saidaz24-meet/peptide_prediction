# Contracts & Invariants — The Surfaces That Never Move

> Audience: an AI agent about to change PVL. These seven invariants are load-bearing. They are not style preferences — each one was paid for in a real bug (cited below) or in a scientific-credibility commitment to Peleg. If your change touches one, **stop and ask the user first** (see [04_when_to_ask_humans.md](./04_when_to_ask_humans.md)). For the heat map of every file mentioned here, see [01_repo_map.md](./01_repo_map.md); for the safe-change procedure, see [03_doing_a_safe_change.md](./03_doing_a_safe_change.md); for the science behind the 4 classes, see [../humans/02_the_science.md](../humans/02_the_science.md).

---

## 1. Protected files — the contract surface

**Invariant.** `backend/schemas/api_models.py` is **THE** API contract: every request/response Pydantic model lives there. Response schemas (key names, camelCase, shapes, Entry alignment) never change without explicit user approval.

**Why it exists.** The frontend types in `ui/src/types/peptide.ts` and `ui/src/types/api.ts` mirror these models by hand. A silent rename in `api_models.py` desyncs the UI without a compile error and ships wrong data to researchers. ADR-002 records the sibling lesson: silent contract drift in *request* schemas (`max_results` coerced to `size=500`) made users think they queried 5 peptides when the server processed 500. In a scientific tool, silent contract drift is catastrophic — users trust the number on screen.

**How it's enforced.** A `PreToolUse` hook, **`.claude/hooks/protect-api-contract.sh`**, blocks any Edit whose `file_path` contains `schemas/api_models.py` (`exit 2` = hard block). You will see `BLOCKED: schemas/api_models.py is the protected API contract.` There is no way around it except the user lifting it.

**The full protected list** (the 🛡️ rows in [01_repo_map.md](./01_repo_map.md)):

| Path | Why protected |
|---|---|
| `backend/schemas/api_models.py` | THE response contract — hook-blocked |
| `backend/api/main.py` | App instantiation — additive router include only |
| `backend/tango.py`, `backend/s4pred.py` | Vendored predictor wrappers — outputs are pinned by golden tests |
| `backend/biochem_calculation.py` | Deterministic charge/hydrophobicity/µH — reused by tests *and* the paper |
| `backend/_perf_init.py` | Pins thread counts before torch loads; import order matters |
| `backend/Tango/bin/tango`, `tools/s4pred/` | Vendored predictor binary + weights wrapper |
| `ui/src/lib/peptideMapper.ts` | API→frontend mapping (see §6) |
| `ui/src/types/peptide.ts`, `ui/src/types/api.ts` | Hand-mirrors of `api_models.py` |
| `ui/src/lib/sswColor.ts` | Single source of the SSW magenta token |
| `ui/src/components/ui/` | shadcn-generated — regenerate, don't hand-edit |
| `CITATION.cff` | Authors + version + Zenodo DOI metadata |
| `_external/` | Vendored copy of Peleg's repo + the source paper PDFs — **DO NOT REDISTRIBUTE** |
| `CLAUDE.md` | Project-level agent instructions |

**Before touching any of these:** propose the change, name the downstream mirror you'll update in the same PR, and get a yes.

---

## 2. The 4-class axioms — FF ⊆ parent

**Invariant.** Two subset axioms anchor the 4-category classification (ADR-001, ADR-003, Peleg P27 canonical):

```
ffSswFlag   == 1  ⇒  sswPrediction          == 1
ffHelixFlag == 1  ⇒  s4predHelixPrediction  == 1
```

A peptide can never be "candidate FF-SSW" while "not SSW", nor "candidate FF-Helix" while "not Helix". FF is always a *subset* of its parent class.

**Why it exists.** ISSUE-032 (P0) broke this in production: `sswPrediction` shipped the TANGO-only column while `ffSswFlag` used the `TANGO ∪ S4PRED` mask. Peptides P85089 and P0C005 displayed `FF-SSW=true, SSW=false`. Peleg caught it on Slack: *"How is it possible that the peptide is predicted to be FF-SSW, but not predicted to be SSW?"* The root cause was a dual-source desync — two fields deriving the same fact from different masks.

**How it's enforced.** Two layers:
1. **Source of truth** — `apply_ff_flags` in `backend/services/dataframe_utils.py` derives both fields from one unified `TANGO ∪ S4PRED` mask, so they cannot disagree.
2. **Defense-in-depth** — `_enforce_ff_axioms` in `backend/services/normalize.py` runs at the JSON-serialization boundary (called from `normalize_rows_for_ui` per row). If an upstream regression ever emits a violating row, it logs `ff_ssw_axiom_violation` and clamps the offending FF flag to `-1`. The contract holds even when upstream code is broken.

Pinned by **`backend/tests/test_axiom_invariants.py`** — `TestFfSswAxiom` exercises the P85089/P0C005 scenario end-to-end; `TestEnforceFfAxiomsDefenseLayer` tests the clamp directly; `TestPerPredictorVerdictPreserved` pins that the unified summary does *not* overwrite each predictor's honest raw verdict (`tangoSswPrediction`, `s4predSswPrediction`).

**Before touching it:** never let `apply_ff_flags` and `_enforce_ff_axioms` derive FF from different inputs. Any new classification (e.g. Phase-I multi-predictor consensus) must follow the same data-layer pattern and add its own axiom test.

---

## 3. The deterministic-output guarantee

**Invariant.** Same input + same code version + same thresholds → **byte-identical** output. Every calculation is deterministic and reproducible (CLAUDE.md principle 4).

**Why it exists.** This is the scientific-reproducibility floor. A peer reviewer who reruns a peptide must get the same Helix/Beta/Coil call, the same FF-Helix %, the same charge. Non-determinism in a prediction tool is indistinguishable from a bug, and it sinks the JOSS/Zenodo credibility story.

**How it's enforced.** The deterministic math (Length, Charge, Hydrophobicity, Full length uH, Beta full length uH, FF-Helix %) is pinned against literature-derived ground truth in **`backend/tests/test_canary_peptides.py`** (the scientific-integrity canary suite — relaxing a canary requires a written justification + ideally a Peleg sign-off) and against frozen fixtures in **`backend/tests/test_golden_pipeline.py`** and the `tests/golden_inputs/` golden suite. Run-provenance (predictor versions, thresholds) is serialized deterministically and pinned by **`backend/tests/test_run_metadata.py`** (ADR-013), so the output carries the exact config that produced it.

**Before touching it:** if you change any numeric path, expect golden/canary diffs. A diff is the test working — do **not** silently re-baseline it. Surface it, explain the scientific reason, and get sign-off.

---

## 4. The single-vs-batch invariant

**Invariant.** The same sequence submitted via single predict (Quick Analyze) and via batch (CSV/FASTA upload) returns **identical** numbers (CLAUDE.md principle 1).

**Why it exists.** ADR-001: classification flags are computed once at the data layer in `apply_ff_flags`; the frontend never re-derives them. Single-source-of-truth is the *only* way single and batch can agree. A researcher who analyzes one peptide alone must see the same result as that peptide inside a 500-row batch — otherwise the tool contradicts itself.

**How it's enforced.** Three real tests:
- **`backend/tests/test_4category_classification.py`** — `TestSingleBatchConsistency` asserts a peptide's FF flags are identical alone vs. inside a mixed batch.
- **`backend/tests/test_s4pred_batched_equivalence.py`** — `test_batched_forward_single_sequence_is_identical_to_legacy` compares the batched S4PRED forward pass against the per-peptide legacy path character-for-character (skipped when weights are absent).
- **`backend/tests/test_batch_fasta_route.py`** — same sequence via FASTA vs CSV → identical output rows (parity holds across *input formats* too).

**Before touching it:** never add a per-row computation that depends on batch context (e.g. a mean over the batch) to anything that also runs single-row, unless the single-row path uses the identical fallback. See `test_ff_thresholds_single_sequence_fallback.py` for the threshold case.

---

## 5. The null-only invariant (with the flag-column exception)

**Invariant.** JSON `null` is the only "no value" sentinel. Never `-1`, `"N/A"`, or `""`. **Exception:** prediction/flag columns use `-1` to mean "not a candidate" — `-1` (no), `1` (yes), `None` (no data).

**Why it exists.** ISSUE-013 (P1): a blanket `-1.0 → None` conversion in `normalize.py` destroyed a legitimate `charge = -1.0`, because the sanitizer couldn't tell a real measurement from a fake default. The fix made the sentinel *field-specific* instead of value-global.

**How it's enforced.** `_sanitize_for_json` in `backend/services/normalize.py` carries an explicit `prediction_fields` allow-set:

```python
prediction_fields = {
    "sswPrediction", "tangoSswPrediction", "s4predSswPrediction",
    "s4predHelixPrediction", "ffHelixFlag", "ffSswFlag",
}
if obj == -1 and field_name not in prediction_fields:
    return None   # fake default → null
return obj         # -1 is a valid verdict for a flag field
```

So `-1` survives only for those six flag fields; everywhere else `-1`/`""`/`"-"` collapse to `None`.

**Before touching it:** if you add a new flag field that uses `-1` semantics, add it to `prediction_fields` *and* document the meaning. If you add a numeric measurement that can legitimately be `-1`, it must **not** go in that set — let the value pass through as itself.

---

## 6. The frontend `??` (not `||`) rule

**Invariant.** Numeric fallbacks in the frontend use `??` (nullish coalescing), never `||`.

**Why it exists.** ISSUE-014 (P1): `peptideMapper.ts` used `ffHelixPercent || fallback`. JavaScript treats `0` as falsy, so a real `ffHelixPercent: 0` was discarded and the UI rendered "–". For a peptide with genuinely zero FF-Helix content, the tool hid a true result.

**How it's enforced.** Convention, plus the mirror types. `ui/src/lib/peptideMapper.ts` uses `??` throughout (mapping `api_models.py` fields into the canonical `Peptide` type in `ui/src/types/peptide.ts`). Both files are 🛡️ in the repo map.

**Before touching it:** any `||` next to a number, percentage, charge, score, or count in the mapper is a bug. Use `??`. Only use `||` for genuine booleans/strings where empty-string-means-absent is intended.

---

## 7. The commit-identity rule

**Invariant.** All git activity — author, committer, commit messages, doc bylines, code comments, UI copy, metadata — shows **Said Azaizah** only. Never "Claude", "AI", "assistant", "Anthropic", "generated by", or any equivalent trace, anywhere.

**Why it exists.** PVL is a research instrument heading to Zenodo/JOSS/bio.tools under a human author of record. AI attribution in the history or the artifacts undermines authorship and is a hard rule from the project owner.

**How it's enforced.** Git identity is `Said Azaizah <said.azaizah@cssb-hamburg.de>` (team-facing; never the personal `az.said2007@gmail.com` in any shipped surface). `.claude/hooks/warn-git-push.sh` injects a branch reminder before every push so pushes are intentional. The rest is on you: scan diffs, commit messages, and new doc text for any AI trace before committing.

**Before touching it:** there is nothing to touch — this rule has no exceptions and no approval path. Just never write the trace in the first place.

---

### Quick self-check before any change
1. Does it edit a 🛡️ file (§1)? → ask first.
2. Could it let FF disagree with its parent class (§2)? → keep one mask + the enforcer.
3. Will golden/canary tests diff (§3)? → surface it, don't re-baseline silently.
4. Does single-row now depend on batch context (§4)? → unify the fallback.
5. New `-1`/`null` field (§5)? → decide flag-set membership explicitly.
6. `||` next to a number (§6)? → make it `??`.
7. Any AI trace in the commit/docs (§7)? → remove it.
