# Troubleshooting — When Something Is Broken

> Symptom-first. Find the line that matches what you see, read the one-sentence cause, apply the fix. Each entry links to the authoritative issue record and to [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md) for the deeper agent-level diagnosis when the quick fix doesn't hold.

**The one rule that explains half of these:** PVL degrades gracefully. If TANGO or S4PRED can't run, FF-Helix%, charge, hydrophobicity, and μH still compute — so a half-empty result is usually a missing *predictor*, not a broken pipeline. A blank field means **no data** (`null`), never a fake `0`. And `-1` is a real value (e.g. charge `-1.0`), not a sentinel.

## Contents

- [1. Quick Analyze sat on "Analyzing…" for 30+ seconds](#1-quick-analyze-sat-on-analyzing-for-30-seconds)
- [2. The aggregation heatmap is empty for the bundled example](#2-the-aggregation-heatmap-is-empty-for-the-bundled-example)
- [3. I uploaded a CSV but the table shows 0 rows](#3-i-uploaded-a-csv-but-the-table-shows-0-rows)
- [4. Mol* shows "No structure available" for my peptide](#4-mol-shows-no-structure-available-for-my-peptide)
- [5. I see "Something went wrong" / Minified React error #XXX](#5-i-see-something-went-wrong--minified-react-error-xxx)
- [6. The DOI badge in the README is grey / says "mints on release"](#6-the-doi-badge-in-the-readme-is-grey--says-mints-on-release)
- [7. I get a 429 rate limit error](#7-i-get-a-429-rate-limit-error)
- [8. TANGO output is all zeros for all peptides](#8-tango-output-is-all-zeros-for-all-peptides)
- [9. S4PRED probabilities sum to >1 or <1 by a lot](#9-s4pred-probabilities-sum-to-1-or-1-by-a-lot)
- [Still stuck?](#still-stuck)

---

## 1. Quick Analyze sat on "Analyzing…" for 30+ seconds

**Cause:** The first request after a server start pays a one-time [S4PRED](02_the_science.md#3-s4pred) cost — it loads 5 PyTorch BiLSTM model weights into memory before it can predict.

**Fix:** Wait it out once; subsequent requests are fast because the process stays warm. If every request is slow, you're probably running the live pipeline on a large batch instead of the precomputed artifact — confirm the backend logged `boot` and that `--reload` isn't restarting the worker mid-request.

- See [`../../active/KNOWN_ISSUES.md`](../../active/KNOWN_ISSUES.md) → ISSUE-033 (the inline ESM-2 embedding that used to add 3–5 s/peptide is fixed; predict no longer waits on it).
- Can't fix → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## 2. The aggregation heatmap is empty for the bundled example

**Cause:** The heatmap is driven by [TANGO](02_the_science.md#2-tango) per-residue curves. It's blank when TANGO didn't run — either `USE_TANGO=0`, or TANGO failed under Apple-Silicon x86 emulation, or the precomputed example artifact was built without the TANGO subprocess.

**Fix:** Set `USE_TANGO=1` on a native-Linux/x86 host and re-run. On an Apple-Silicon Mac in Docker, TANGO can't execute under emulation — run the backend natively or regenerate the example artifact with `scripts/precompute_dataset.py`.

- See [`../../active/KNOWN_ISSUES.md`](../../active/KNOWN_ISSUES.md) → **ISSUE-034** (precompute silently skipped the TANGO subprocess — fixed with `force_recompute` + `bypass_tango_budget`) and **ISSUE-018** (TANGO fails under Apple-Silicon emulation).
- Can't fix → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## 3. I uploaded a CSV but the table shows 0 rows

**Cause:** The upload pipeline requires an `Entry` (or `Accession`/`ID`) column **and** a `Sequence` column. If neither maps, or the file parsed to zero data rows, you get an empty result — not a crash.

**Fix:** Open your file and confirm the header row literally contains `Entry`/`Accession`/`ID` and `Sequence`. Re-export from UniProt with those columns, or rename your headers. Empty files and header-only files are rejected with a 400 explaining exactly that.

- Grounded in [`backend/api/routes/upload.py`](../../../backend/api/routes/upload.py) (`require_cols(df, ["Entry", "Sequence"])`) and [`../../active/KNOWN_ISSUES.md`](../../active/KNOWN_ISSUES.md) → ISSUE-002 (the `missing required field "id" or "Entry"` mapping bug, fixed).
- Can't fix → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## 4. Mol* shows "No structure available" for my peptide

**Cause:** The 3D viewer fetches a predicted model from the AlphaFold DB by UniProt accession. If the accession has no AlphaFold entry (the API returns 404), or the row has no real accession (e.g. a Quick-Analyze peptide you typed by hand), there's nothing to render.

**Fix:** This is expected, not a bug — many short or synthetic peptides aren't in AlphaFold. Use a row that carries a valid UniProt accession. Note AlphaFold predictions for peptides under ~30 residues are unreliable anyway, which the viewer warns about.

- Grounded in [`ui/src/lib/alphafold.ts`](../../../ui/src/lib/alphafold.ts) (`returns null on 404`) and [`ui/src/components/Mol3DViewer.tsx`](../../../ui/src/components/Mol3DViewer.tsx) ("No AlphaFold structure available"). No KNOWN_ISSUES entry — this is designed behavior.
- Can't fix → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## 5. I see "Something went wrong" / Minified React error #XXX

**Cause:** A frontend render crash. The three historical culprits are a Radix `React.Children.only` violation, and `crypto.randomUUID` being undefined on plain HTTP or old Safari.

**Fix:** Hard-refresh to pull the latest build. If it persists, open the browser console, read the de-minified component name, and check it against the known crashes below. Serving over HTTPS (or localhost) resolves the `crypto.randomUUID` class of errors.

- See [`../../active/KNOWN_ISSUES.md`](../../active/KNOWN_ISSUES.md) → **ISSUE-023** (`React.Children.only` on `/results`, fixed), **ISSUE-027** (`crypto.randomUUID is not a function` on HTTP/Safari, fixed), **ISSUE-002** (the older "Something went wrong" mapping error, fixed).
- Can't fix → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## 6. The DOI badge in the README is grey / says "mints on release"

**Cause:** This is the intended pre-release state, not a failure. PVL is `v0.3.0` pre-release; the Zenodo DOI is only minted when a GitHub release tag is published.

**Fix:** Nothing to fix. The release script (`scripts/publish_v0_3_0.sh`) patches the badge line on tag, guided by the `DOI-BADGE-MARKER` comment in [`README.md`](../../../README.md). Until then, cite the underlying algorithm via Ragonis-Bachar et al. 2022.

- See [`../../active/DECISIONS.md`](../../active/DECISIONS.md) and the README "Citing PVL" section. No KNOWN_ISSUES entry — this is expected.
- Background → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## 7. I get a 429 rate limit error

**Cause:** PVL puts a per-IP token bucket (slowapi) in front of the heavy routes — Quick Analyze / predict is capped at **30 requests/minute**, and feedback submissions are throttled separately. A 429 can also bubble up from UniProt's own API when a batch query pages too fast.

**Fix:** Slow down and retry after a minute — the cap is per-IP, so a tight loop or a shared NAT can trip it. For UniProt-origin 429s, PVL already honors the upstream `Retry-After` header and retries once; if it still fails, your query is too large — narrow it.

- Grounded in [`backend/api/routes/predict.py`](../../../backend/api/routes/predict.py) (`@_LIMITER.limit("30/minute")`), [`backend/api/routes/feedback.py`](../../../backend/api/routes/feedback.py), and [`backend/services/uniprot_execute_service.py`](../../../backend/services/uniprot_execute_service.py) (Retry-After handling). No KNOWN_ISSUES entry — this is a guardrail working as designed.
- Can't fix → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## 8. TANGO output is all zeros for all peptides

**Cause:** TANGO didn't actually run. Most common: `USE_TANGO=0`, the binary failing under Apple-Silicon emulation, the dataset exceeding the per-run TANGO budget (`MAX_PEPTIDES_PER_RUN_WITH_TANGO`, default **500**) which auto-disables it, or a precompute artifact built without the subprocess.

**Fix:** Check the backend `boot` log for `USE_TANGO=True`, and check `meta.warnings` for `tango_auto_disabled` (batch > 500) or `tango_not_available`. For a large dataset, raise the budget env var on a host with headroom, or accept that TANGO is off and rely on S4PRED + FF-Helix. On Apple Silicon, run natively.

- Grounded in [`backend/config.py`](../../../backend/config.py) (`USE_TANGO`, `MAX_PEPTIDES_PER_RUN_WITH_TANGO`) and [`../../active/KNOWN_ISSUES.md`](../../active/KNOWN_ISSUES.md) → **ISSUE-018** (emulation) and **ISSUE-034** (precompute skip).
- Can't fix → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## 9. S4PRED probabilities sum to >1 or <1 by a lot

**Cause:** Almost always a units/field mix-up, not a math bug. S4PRED emits **per-residue** 3-state probabilities (helix + sheet + coil) that sum to ~1 *at each position* — they are not meant to sum to 1 across the whole sequence. The whole-sequence numbers PVL surfaces (e.g. helix **% content**) are 0–100 aggregates, a different quantity. A truly empty/`null` S4PRED block usually means the sequence exceeded `S4PRED_MAX_LENGTH` (default **40 aa**) and was skipped with an `s4pred_skipped_long_seq` warning.

**Fix:** Confirm you're reading per-residue probabilities (sum ≈ 1 per column) vs aggregate helix% (0–100). If the fields are `null`, check the sequence length and `meta.warnings`; trim to ≤ 40 aa.

- Grounded in [`backend/config.py`](../../../backend/config.py) (`S4PRED_MAX_LENGTH = 40`). **Not tied to a KNOWN_ISSUES entry** — there is no recorded bug where the per-residue probabilities themselves fail to sum to 1; this entry is expectation-setting, so escalate if you see genuine per-residue drift.
- Can't fix → [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).

---

## Still stuck?

- For dev-environment basics (ports, venv, TANGO binary not found), see [`01_first_run.md`](01_first_run.md) → Troubleshooting.
- For the full backend debugging workflow and the agent's diagnostic decision tree, see [`../agents/06_failure_modes.md`](../agents/06_failure_modes.md).
- If you've confirmed a genuinely new failure, file it against the template at the bottom of [`../../active/KNOWN_ISSUES.md`](../../active/KNOWN_ISSUES.md).
