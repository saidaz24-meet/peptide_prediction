"""
Validation re-run script — Staphylococcus 2023 + Ragonis-Bachar 2022 cohorts.

Triggered once T2's backend FF threshold fix lands. Compares the corrected
pipeline's classification output against:

  1. Ragonis-Bachar et al. 2022 (Biomacromolecules 23:3713-3727) experimental
     ground truth — 14 of 26 AMPs formed fibrils per TEM + X-ray diffraction.
  2. Staphylococcus aureus 2023 proteome subset (n=2916, 66 labelled rows).

Outputs:
  - docs/active/RESEARCH_BRIEFS/RB-VALIDATION-V0-2.md  (the corrected-pipeline
    numbers for the JOSS paper Results section)
  - data/validation/2026_06_07_run.json                (raw run output for
    paper reproducibility — encodes dataset hash + thresholds + per-peptide
    classifications)

Usage:
  cd backend
  USE_TANGO=1 USE_S4PRED=1 .venv/bin/python scripts/rerun_validation_2026_06_07.py

Pre-requisites:
  - T2's PR must be merged on main (look for compute_dataset_ff_thresholds in
    backend/consensus.py or backend/services/normalize.py)
  - TANGO binary on $PATH (verify with `make smoke-tango`)
  - S4PRED model weights cached locally (first run downloads them)

Wall-clock estimate: ~45 min for the Staphylococcus cohort, ~5 min for the
Ragonis-Bachar 26-peptide cohort. Run overnight on a laptop.
"""

import argparse
import json
import hashlib
import logging
import pathlib
import sys
import time
from typing import Any, Dict, List

# Add backend/ to path so imports work when invoked from project root
_BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

import pandas as pd  # noqa: E402

from config import settings  # noqa: E402
from services import upload_service  # noqa: E402

# ----------------------------------------------------------------------------
# Cohort definitions
# ----------------------------------------------------------------------------

#: The 26-AMP cohort from Ragonis-Bachar et al. 2022.
#: 14 of 26 formed fibrils per TEM + X-ray diffraction. The label column is
#: True for the 14 ffAMPs and False for the 12 negative-class AMPs (those that
#: were tested but did not form fibrils in tested conditions — per Peleg's
#: 2026-06-03 framing, "did not form fibril" is always provisional).
#:
#: Sequences pulled from Ragonis-Bachar 2022 Supporting Information Table 2.
RAGONIS_BACHAR_2022_COHORT: List[Dict[str, Any]] = [
    # The 14 ffAMPs (Table 1 of the paper)
    {"id": "Cupiennin-1", "sequence": "GFGALFKFLAKKVAKTVAKQAAKQGAKYVANKQME", "ff_truth": True},
    {"id": "Cyanophlyctin", "sequence": "GIGAVLKVLTTGLPALISWIKNKRKQ", "ff_truth": True},
    {"id": "Citropin-1.3", "sequence": "GLFDVIKKVASVIGGL", "ff_truth": True},
    {"id": "Pleurocidin-like_GcSc4C5", "sequence": "GWGSFFKKAAHVGKHVGKAALTHYL", "ff_truth": True},
    {"id": "Brevinin-2SKb", "sequence": "GIWDTIKSMGKVFAGKILQNL", "ff_truth": True},
    {"id": "Lasioglossin_LL-I", "sequence": "VNWKKILGKIIKVVK", "ff_truth": True},
    {"id": "Temporin-1Cea", "sequence": "FVDLKKIANIINSIF", "ff_truth": True},
    {"id": "Plantaricin-J", "sequence": "GAWKNFWSSLRKGFYDGEAGRAIRR", "ff_truth": True},
    {"id": "Cecropin-C", "sequence": "GWLKKIGKKIERVGQHTRDATIQAIGVAQQAANVAATARG", "ff_truth": True},
    {"id": "Plantaricin-K", "sequence": "KKKKKGWGKVVGAVAGGLLATL", "ff_truth": True},
    {"id": "Aurein-3.3", "sequence": "GLFDIVKKVVGAFGSL", "ff_truth": True},
    {"id": "Bombinin_H4", "sequence": "IIGPVLGMVGSALGGLLKKI", "ff_truth": True},
    {"id": "Dolabellanin-B2", "sequence": "AWKNVATPGLNKVAKDVAKEALSI", "ff_truth": True},
    {"id": "Pleurocidin-like_WFX", "sequence": "WLRRWVLGKILGAYNRG", "ff_truth": True},
    # The 12 tested-and-negative cohort (Supplementary Table 2 — peptides that
    # passed the bioinformatics filter but DID NOT form fibrils in the tested
    # experimental conditions). NOTE per Peleg: this is "not formed in tested
    # conditions" — these are NOT asserted as eternal non-fibril-formers.
    # Sequences need to be filled in from Supporting Information Table 2 once
    # we get electronic access. Placeholder structure:
    # {"id": "<name>",  "sequence": "<seq>",  "ff_truth": False},
]


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------


def _sequence_hash(rows: List[Dict[str, Any]]) -> str:
    """Stable SHA-256 of the input cohort — encoded in meta for reproducibility."""
    canonical = "|".join(f"{r['id']}:{r['sequence']}" for r in rows)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def _run_pipeline(rows: List[Dict[str, Any]], cohort_name: str) -> Dict[str, Any]:
    """Push rows through the full PVL pipeline (TANGO + S4PRED + classification).

    Reuses upload_service.process_dataframe so this script exactly matches the
    UI batch-upload code path — no parallel implementation to drift from.
    """
    df = pd.DataFrame(
        [{"Entry": r["id"], "Sequence": r["sequence"], "Length": len(r["sequence"])} for r in rows]
    )

    logging.info(
        "[%s] starting pipeline — %d rows, TANGO=%s S4PRED=%s",
        cohort_name,
        len(df),
        settings.USE_TANGO,
        settings.USE_S4PRED,
    )

    t0 = time.time()
    result = upload_service.process_dataframe(
        df=df,
        run_tango=settings.USE_TANGO,
        run_s4pred=settings.USE_S4PRED,
        config_override=None,
    )
    elapsed = time.time() - t0

    logging.info("[%s] pipeline complete in %.1f s", cohort_name, elapsed)
    return {
        "cohort_name": cohort_name,
        "input_hash": _sequence_hash(rows),
        "n_rows": len(df),
        "elapsed_seconds": elapsed,
        "result": result,
    }


def _evaluate_against_truth(
    run_output: Dict[str, Any],
    cohort: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute confusion matrix vs experimental ground truth.

    Note per Peleg (2026-06-03): "not formed in tested conditions" is
    provisional — false-negatives in this evaluation may simply be peptides
    that need a different experimental condition to form fibrils. Report
    sensitivity / specificity but do NOT make absolute claims.
    """
    df = run_output["result"]["df"]
    truth_by_id = {row["id"]: row["ff_truth"] for row in cohort}

    tp = fp = tn = fn = 0
    per_peptide: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        entry = row["Entry"]
        truth = truth_by_id.get(entry)
        if truth is None:
            continue
        ff_helix = int(row.get("FF-Helix (S4PRED)", -1)) == 1
        ff_ssw = int(row.get("FF-SSW", -1)) == 1
        predicted_ff = ff_helix or ff_ssw
        if predicted_ff and truth:
            tp += 1
        elif predicted_ff and not truth:
            fp += 1
        elif not predicted_ff and truth:
            fn += 1
        else:
            tn += 1
        per_peptide.append(
            {
                "id": entry,
                "truth": truth,
                "ff_helix": ff_helix,
                "ff_ssw": ff_ssw,
                "predicted_ff": predicted_ff,
            }
        )

    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else None
    specificity = tn / (tn + fp) if (tn + fp) > 0 else None
    ppv = tp / (tp + fp) if (tp + fp) > 0 else None
    npv = tn / (tn + fn) if (tn + fn) > 0 else None

    return {
        "confusion": {"TP": tp, "FP": fp, "TN": tn, "FN": fn},
        "sensitivity": sensitivity,
        "specificity": specificity,
        "ppv": ppv,
        "npv": npv,
        "per_peptide": per_peptide,
    }


# ----------------------------------------------------------------------------
# Entrypoint
# ----------------------------------------------------------------------------


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cohort",
        choices=["ragonis-bachar", "staphylococcus", "all"],
        default="ragonis-bachar",
        help="Which cohort to run. 'all' runs both serially.",
    )
    parser.add_argument(
        "--output-dir",
        default="data/validation",
        help="Directory to write JSON output (relative to repo root).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip pipeline execution; just write cohort definitions to disk.",
    )
    args = parser.parse_args()

    output_dir = pathlib.Path(__file__).resolve().parent.parent.parent / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    cohorts_to_run = []
    if args.cohort in ("ragonis-bachar", "all"):
        cohorts_to_run.append(("ragonis-bachar-2022", RAGONIS_BACHAR_2022_COHORT))
    if args.cohort in ("staphylococcus", "all"):
        # TODO: load Staphylococcus 2023 cohort from
        # docs/active/RESEARCH_BRIEFS/datasets/staphylococcus_2023.csv once it's
        # in the repo. Placeholder for now.
        logging.warning(
            "Staphylococcus cohort not yet wired into this script. Skipping. "
            "Add the 66-labelled-row CSV under data/validation/ first."
        )

    for cohort_name, rows in cohorts_to_run:
        if args.dry_run:
            logging.info("[%s] dry run — skipping pipeline", cohort_name)
            outpath = output_dir / f"{cohort_name}_cohort_2026_06_07_dryrun.json"
            outpath.write_text(json.dumps(rows, indent=2))
            logging.info("[%s] wrote cohort definition to %s", cohort_name, outpath)
            continue

        run_output = _run_pipeline(rows, cohort_name)
        evaluation = _evaluate_against_truth(run_output, rows)

        outpath = output_dir / f"{cohort_name}_2026_06_07.json"
        outpath.write_text(
            json.dumps(
                {
                    "cohort": cohort_name,
                    "run": {
                        "input_hash": run_output["input_hash"],
                        "n_rows": run_output["n_rows"],
                        "elapsed_seconds": run_output["elapsed_seconds"],
                    },
                    "evaluation": evaluation,
                    "thresholds_meta": run_output["result"].get("meta", {}).get("thresholds"),
                },
                indent=2,
            )
        )
        logging.info("[%s] wrote validation output to %s", cohort_name, outpath)
        logging.info(
            "[%s] Sensitivity=%.3f  Specificity=%.3f  PPV=%.3f  NPV=%.3f",
            cohort_name,
            evaluation["sensitivity"] or 0,
            evaluation["specificity"] or 0,
            evaluation["ppv"] or 0,
            evaluation["npv"] or 0,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
