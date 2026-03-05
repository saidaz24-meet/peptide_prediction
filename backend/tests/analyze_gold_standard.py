"""
Analyze the gold-standard Excel file to understand column distributions
and extract representative test fixtures for pipeline comparison tests.

Usage:
    cd backend && .venv/bin/python tests/analyze_gold_standard.py

Outputs:
    - Console report of all column distributions
    - tests/fixtures/gold_standard_sample.json  (20 representative peptides)
"""

import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
EXCEL_PATH = PROJECT_ROOT / "Final_Staphylococcus_2023_new.xlsx"
FIXTURES_DIR = SCRIPT_DIR / "fixtures"
OUTPUT_JSON = FIXTURES_DIR / "gold_standard_sample.json"

# ---------------------------------------------------------------------------
# Column classification
# ---------------------------------------------------------------------------

# Columns that come directly from UniProt (input / metadata)
INPUT_COLS = {
    "Entry",
    "Reviewed",
    "Entry Name",
    "Protein names",
    "Gene Names",
    "Organism",
    "Length",
    "Sequence",
    "Organism (ID)",
    "PubMed ID",
    "Sequence caution",
    "Sequence conflict",
    "Sequence uncertainty",
}

# Columns added by the PVL pipeline (computed)
COMPUTED_COLS = {
    "SSW fragments",
    "SSW score",
    "SSW diff",
    "SSW helix percentage",
    "SSW beta percentage",
    "SSW prediction",
    "Helix fragments (Jpred)",
    "Helix score (Jpred)",
    "Helix percentage (Jpred)",
    "Charge",
    "Hydrophobicity",
    "Full length uH",
    "Helix (Jpred) uH",
    "Beta full length uH",
    "FF-Secondary structure switch",
    "FF-Secondary structure switch score",
    "FF-Helix (Jpred)",
    "FF-helix score",
}

# Experimental / annotation columns (from Peleg's lab)
ANNOTATION_COLS = {
    "Keyword",
    "LandauID",
    "TEM Fibrils",
    "Fiber diffraction",
    "ThT",
}

# Columns known to use -1 as a sentinel for "no data" (not a real value)
SENTINEL_MINUS_ONE_COLS = {
    "SSW diff",            # -1 when SSW prediction is -1 (no SSW segments)
    "Helix score (Jpred)", # -1 when no Jpred helix segments detected
    "Helix (Jpred) uH",   # -1 when no Jpred helix segments detected
    "FF-helix score",      # -1 when FF-Helix flag is -1
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_json(val: Any) -> Any:
    """Convert numpy/pandas types to JSON-serializable Python types."""
    if val is None:
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    if isinstance(val, (np.bool_,)):
        return bool(val)
    if isinstance(val, (np.ndarray,)):
        return val.tolist()
    if isinstance(val, pd.Timestamp):
        return val.isoformat()
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    return val


def _describe_numeric(series: pd.Series) -> Dict[str, Any]:
    """Describe a numeric column, noting sentinel -1 values if applicable."""
    numeric = pd.to_numeric(series, errors="coerce")
    stats = {
        "count": int(numeric.notna().sum()),
        "null_count": int(numeric.isna().sum()),
        "min": _safe_json(numeric.min()),
        "max": _safe_json(numeric.max()),
        "mean": _safe_json(numeric.mean()),
        "median": _safe_json(numeric.median()),
        "std": _safe_json(numeric.std()),
    }

    # Check for -1 sentinel usage
    minus_one_count = int((numeric == -1).sum())
    if minus_one_count > 0:
        stats["sentinel_minus_one_count"] = minus_one_count
        # Stats excluding -1 sentinels
        real_values = numeric[numeric != -1]
        if real_values.notna().any():
            stats["real_min"] = _safe_json(real_values.min())
            stats["real_max"] = _safe_json(real_values.max())
            stats["real_mean"] = _safe_json(real_values.mean())

    return stats


def _describe_categorical(series: pd.Series) -> Dict[str, Any]:
    """Describe a categorical/object column."""
    stats = {
        "count": int(series.notna().sum()),
        "null_count": int(series.isna().sum()),
        "unique_count": int(series.nunique()),
    }
    vc = series.value_counts(dropna=False).head(10)
    stats["top_values"] = {str(k): int(v) for k, v in vc.items()}
    return stats


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def print_section(title: str) -> None:
    """Print a section header."""
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def analyze_columns(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """Analyze all columns and return a dict of column -> stats."""
    column_stats = {}
    for col in df.columns:
        dtype = str(df[col].dtype)
        if df[col].dtype in ("int64", "float64"):
            stats = _describe_numeric(df[col])
            stats["dtype"] = dtype
        else:
            stats = _describe_categorical(df[col])
            stats["dtype"] = dtype
        column_stats[col] = stats
    return column_stats


def print_column_report(df: pd.DataFrame, column_stats: Dict) -> None:
    """Print a human-readable column report."""

    # --- Input columns ---
    print_section("INPUT COLUMNS (from UniProt)")
    for col in df.columns:
        if col in INPUT_COLS:
            s = column_stats[col]
            print(f"\n  {col} [{s['dtype']}]")
            if "mean" in s:
                mean_str = f"{s['mean']:.4f}" if s['mean'] is not None else "N/A"
                print(f"    count={s['count']}  nulls={s['null_count']}  "
                      f"min={s['min']}  max={s['max']}  mean={mean_str}")
            else:
                print(f"    count={s['count']}  nulls={s['null_count']}  "
                      f"unique={s['unique_count']}")
                top = list(s["top_values"].items())[:5]
                if top:
                    print(f"    top: {top}")

    # --- Computed columns ---
    print_section("COMPUTED COLUMNS (PVL pipeline)")
    for col in df.columns:
        if col in COMPUTED_COLS:
            s = column_stats[col]
            print(f"\n  {col} [{s['dtype']}]")
            if "mean" in s:
                mean_str = f"{s['mean']:.4f}" if s['mean'] is not None else "N/A"
                print(f"    count={s['count']}  nulls={s['null_count']}  "
                      f"min={s['min']}  max={s['max']}  mean={mean_str}")
                if "sentinel_minus_one_count" in s:
                    print(f"    sentinel -1 count = {s['sentinel_minus_one_count']}")
                    if "real_min" in s:
                        print(f"    excluding -1: min={s['real_min']}  "
                              f"max={s['real_max']}  mean={s['real_mean']:.4f}")
            else:
                print(f"    count={s['count']}  nulls={s['null_count']}  "
                      f"unique={s['unique_count']}")
                top = list(s["top_values"].items())[:5]
                if top:
                    print(f"    top: {top}")

    # --- Annotation columns ---
    print_section("ANNOTATION COLUMNS (Peleg lab)")
    for col in df.columns:
        if col in ANNOTATION_COLS:
            s = column_stats[col]
            print(f"\n  {col} [{s['dtype']}]")
            if "mean" in s:
                print(f"    count={s['count']}  nulls={s['null_count']}  "
                      f"min={s['min']}  max={s['max']}")
            else:
                print(f"    count={s['count']}  nulls={s['null_count']}  "
                      f"unique={s['unique_count']}")
                top = list(s["top_values"].items())[:5]
                if top:
                    print(f"    top: {top}")

    # --- Unknown columns ---
    known = INPUT_COLS | COMPUTED_COLS | ANNOTATION_COLS
    unknown = [c for c in df.columns if c not in known]
    if unknown:
        print_section("UNKNOWN COLUMNS (not classified)")
        for col in unknown:
            print(f"  {col}")


# ---------------------------------------------------------------------------
# Specific distribution analyses
# ---------------------------------------------------------------------------

def analyze_ssw_prediction(df: pd.DataFrame) -> None:
    """Detailed SSW prediction analysis."""
    print_section("SSW PREDICTION DISTRIBUTION")
    vc = df["SSW prediction"].value_counts()
    total = len(df)
    for val, count in sorted(vc.items()):
        pct = 100.0 * count / total
        label = {1: "SSW+ (has SSW segments)", -1: "SSW- (no SSW segments)"}.get(val, f"unknown({val})")
        print(f"  {val:3d} -> {count:5d} ({pct:5.1f}%)  {label}")
    print("\n  NOTE: This file has no null SSW predictions (all rows have TANGO data)")


def analyze_ssw_diff(df: pd.DataFrame) -> None:
    """Detailed SSW diff analysis (including -1 sentinel)."""
    print_section("SSW DIFF DISTRIBUTION")
    col = df["SSW diff"]
    sentinel_count = int((col == -1).sum())
    real = col[col != -1]
    print(f"  Total rows:        {len(col)}")
    print(f"  Sentinel -1 count: {sentinel_count}  "
          f"(these are SSW- rows where diff is meaningless)")
    print(f"  Real values:       {len(real)}")
    if len(real) > 0:
        print(f"  Real min:   {real.min():.6f}")
        print(f"  Real max:   {real.max():.6f}")
        print(f"  Real mean:  {real.mean():.6f}")
        print(f"  Real median:{real.median():.6f}")
        # Percentiles
        for p in [5, 25, 50, 75, 95]:
            print(f"  P{p:02d}:        {real.quantile(p / 100):.6f}")


def analyze_biochem(df: pd.DataFrame) -> None:
    """Detailed biochemical property distributions."""
    print_section("BIOCHEMICAL PROPERTIES")

    for col_name, description in [
        ("Charge", "Total charge at pH 7.4 (K,R=+1; D,E=-1; H=+0.1)"),
        ("Hydrophobicity", "Mean Fauchere-Pliska hydrophobicity"),
        ("Full length uH", "Hydrophobic moment (alpha-helix angle=100)"),
        ("Beta full length uH", "Hydrophobic moment (beta-sheet angle=160)"),
        ("Helix (Jpred) uH", "Average uH of Jpred helix segments (-1 = no segments)"),
    ]:
        col = df[col_name]
        numeric = pd.to_numeric(col, errors="coerce")
        sentinel_n = int((numeric == -1).sum()) if col_name in SENTINEL_MINUS_ONE_COLS else 0

        print(f"\n  {col_name}: {description}")
        print(f"    min={numeric.min():.4f}  max={numeric.max():.4f}  "
              f"mean={numeric.mean():.4f}  std={numeric.std():.4f}")
        if sentinel_n > 0:
            real = numeric[numeric != -1]
            print(f"    sentinel -1 count: {sentinel_n}")
            if real.notna().any():
                print(f"    excluding -1: min={real.min():.4f}  max={real.max():.4f}  "
                      f"mean={real.mean():.4f}")

        # Percentiles (on raw values)
        for p in [5, 25, 50, 75, 95]:
            print(f"    P{p:02d}: {numeric.quantile(p / 100):.4f}")


def analyze_ff_helix(df: pd.DataFrame) -> None:
    """FF-Helix flag and score distribution."""
    print_section("FF-HELIX ANALYSIS")

    # FF-Helix flag
    vc = df["FF-Helix (Jpred)"].value_counts()
    total = len(df)
    print("  FF-Helix (Jpred) flag distribution:")
    for val, count in sorted(vc.items()):
        pct = 100.0 * count / total
        label = {1: "candidate", -1: "not candidate"}.get(val, f"unknown({val})")
        print(f"    {val:3d} -> {count:5d} ({pct:5.1f}%)  {label}")

    # FF-SSW flag
    print()
    vc2 = df["FF-Secondary structure switch"].value_counts()
    print("  FF-SSW flag distribution:")
    for val, count in sorted(vc2.items()):
        pct = 100.0 * count / total
        label = {1: "candidate", -1: "not candidate"}.get(val, f"unknown({val})")
        print(f"    {val:3d} -> {count:5d} ({pct:5.1f}%)  {label}")

    # Cross-tabulation: FF-Helix vs FF-SSW
    print("\n  Cross-tab FF-Helix x FF-SSW:")
    ct = pd.crosstab(df["FF-Helix (Jpred)"], df["FF-Secondary structure switch"],
                     margins=True, margins_name="Total")
    print(ct.to_string().replace("\n", "\n    "))

    # FF-helix score
    print("\n  FF-helix score (sentinel -1 = not candidate):")
    score_col = df["FF-helix score"]
    sentinel_n = int((score_col == -1).sum())
    real = score_col[score_col != -1]
    print(f"    total={len(score_col)}  sentinel -1={sentinel_n}  "
          f"real values={len(real)}")
    if len(real) > 0:
        print(f"    real min={real.min():.4f}  max={real.max():.4f}  "
              f"mean={real.mean():.4f}")


def analyze_length(df: pd.DataFrame) -> None:
    """Sequence length distribution."""
    print_section("LENGTH DISTRIBUTION")
    lengths = df["Length"]
    print(f"  min={lengths.min()}  max={lengths.max()}  "
          f"mean={lengths.mean():.1f}  median={lengths.median()}")

    # Histogram buckets
    bins = [0, 10, 15, 20, 25, 30, 35, 40, 50]
    hist, edges = np.histogram(lengths, bins=bins)
    print("\n  Length histogram:")
    for i in range(len(hist)):
        bar = "#" * max(1, int(hist[i] / 20))
        print(f"    {edges[i]:3.0f}-{edges[i+1]:3.0f}: {hist[i]:5d}  {bar}")


def analyze_helix_percentage(df: pd.DataFrame) -> None:
    """Helix and beta percentage distributions (from TANGO SSW segments)."""
    print_section("SSW HELIX / BETA PERCENTAGE")

    for col_name in ["SSW helix percentage", "SSW beta percentage"]:
        col = df[col_name]
        print(f"\n  {col_name}:")
        print(f"    min={col.min():.2f}  max={col.max():.2f}  "
              f"mean={col.mean():.2f}  std={col.std():.2f}")
        print(f"    zeros: {int((col == 0).sum())}  "
              f"100%: {int((col == 100).sum())}")


# ---------------------------------------------------------------------------
# Sample extraction
# ---------------------------------------------------------------------------

def extract_representative_sample(df: pd.DataFrame, n: int = 20) -> pd.DataFrame:
    """
    Extract a representative sample of peptides covering key edge cases.

    Selection strategy (aim for ~20 rows):
      1. Shortest peptide (min length)
      2. Longest peptide (max length)
      3. Highest positive charge
      4. Most negative charge
      5. Highest hydrophobicity
      6. Lowest hydrophobicity
      7. Highest Full length uH
      8. Lowest Full length uH (>0)
      9. SSW prediction = 1, FF-SSW = 1, FF-Helix = 1  (triple positive)
     10. SSW prediction = 1, FF-SSW = -1 (SSW+ but not FF-SSW candidate)
     11. SSW prediction = -1, FF-Helix = 1 (no SSW but helix candidate)
     12. SSW prediction = -1, FF-Helix = -1 (double negative)
     13. Highest SSW score
     14. Highest SSW diff (excluding -1)
     15. Lowest real SSW diff (>0, excluding -1 sentinel)
     16. Helix (Jpred) uH = -1 (no helix segments detected)
     17. Highest Helix (Jpred) uH (real value)
     18. Length exactly 8 (minimum in dataset)
     19. Length exactly 40 (maximum in dataset)
     20. A "median" peptide (closest to median on all numeric columns)
    """
    selected_entries: List[str] = []

    def _pick(mask_or_idx, label: str) -> Optional[str]:
        """Pick one Entry from mask or index, avoiding duplicates."""
        if isinstance(mask_or_idx, pd.Series):
            candidates = df.loc[mask_or_idx]
        elif isinstance(mask_or_idx, (int, np.integer)):
            candidates = df.iloc[[mask_or_idx]]
        else:
            candidates = mask_or_idx

        if len(candidates) == 0:
            print(f"  [SKIP] {label}: no candidates")
            return None

        for _, row in candidates.iterrows():
            entry = row["Entry"]
            if entry not in selected_entries:
                selected_entries.append(entry)
                print(f"  [{len(selected_entries):2d}] {label}: {entry}  "
                      f"(len={row['Length']}, SSW={row['SSW prediction']}, "
                      f"FF-SSW={row['FF-Secondary structure switch']}, "
                      f"FF-Helix={row['FF-Helix (Jpred)']})")
                return entry
        # All candidates already selected; pick the first anyway for logging
        print(f"  [DUP] {label}: all candidates already selected")
        return None

    print_section("REPRESENTATIVE SAMPLE EXTRACTION")

    # 1. Shortest
    _pick(df["Length"].idxmin(), "Shortest peptide")

    # 2. Longest
    _pick(df["Length"].idxmax(), "Longest peptide")

    # 3. Highest positive charge
    _pick(df["Charge"].idxmax(), "Highest positive charge")

    # 4. Most negative charge
    _pick(df["Charge"].idxmin(), "Most negative charge")

    # 5. Highest hydrophobicity
    _pick(df["Hydrophobicity"].idxmax(), "Highest hydrophobicity")

    # 6. Lowest hydrophobicity
    _pick(df["Hydrophobicity"].idxmin(), "Lowest hydrophobicity")

    # 7. Highest Full length uH
    _pick(df["Full length uH"].idxmax(), "Highest full-length uH")

    # 8. Lowest Full length uH (>0)
    pos_uh = df[df["Full length uH"] > 0]
    if len(pos_uh) > 0:
        _pick(pos_uh["Full length uH"].idxmin(), "Lowest full-length uH (>0)")

    # 9. Triple positive: SSW=1, FF-SSW=1, FF-Helix=1
    triple_pos = df[
        (df["SSW prediction"] == 1)
        & (df["FF-Secondary structure switch"] == 1)
        & (df["FF-Helix (Jpred)"] == 1)
    ]
    _pick(triple_pos.head(1) if len(triple_pos) > 0 else pd.DataFrame(), "Triple positive")

    # 10. SSW+ but FF-SSW-
    ssw_pos_ff_neg = df[
        (df["SSW prediction"] == 1)
        & (df["FF-Secondary structure switch"] == -1)
    ]
    _pick(ssw_pos_ff_neg.head(1) if len(ssw_pos_ff_neg) > 0 else pd.DataFrame(),
          "SSW+ but FF-SSW-")

    # 11. SSW- but FF-Helix+
    ssw_neg_helix_pos = df[
        (df["SSW prediction"] == -1)
        & (df["FF-Helix (Jpred)"] == 1)
    ]
    _pick(ssw_neg_helix_pos.head(1) if len(ssw_neg_helix_pos) > 0 else pd.DataFrame(),
          "SSW- but FF-Helix+")

    # 12. Double negative: SSW-1, FF-Helix-1
    double_neg = df[
        (df["SSW prediction"] == -1)
        & (df["FF-Helix (Jpred)"] == -1)
    ]
    _pick(double_neg.head(1) if len(double_neg) > 0 else pd.DataFrame(), "Double negative")

    # 13. Highest SSW score
    _pick(df["SSW score"].idxmax(), "Highest SSW score")

    # 14. Highest SSW diff (excluding -1 sentinel)
    real_diff = df[df["SSW diff"] != -1]
    if len(real_diff) > 0:
        _pick(real_diff["SSW diff"].idxmax(), "Highest real SSW diff")

    # 15. Lowest real SSW diff (>0, excluding -1)
    pos_diff = df[(df["SSW diff"] > 0) & (df["SSW diff"] != -1)]
    if len(pos_diff) > 0:
        _pick(pos_diff["SSW diff"].idxmin(), "Lowest real SSW diff (>0)")

    # 16. Helix (Jpred) uH = -1 (no helix)
    no_helix = df[df["Helix (Jpred) uH"] == -1]
    if len(no_helix) > 0:
        _pick(no_helix.head(1), "No Jpred helix (uH=-1)")

    # 17. Highest real Helix (Jpred) uH
    real_helix_uh = df[df["Helix (Jpred) uH"] != -1]
    if len(real_helix_uh) > 0:
        _pick(real_helix_uh["Helix (Jpred) uH"].idxmax(), "Highest real Helix uH")

    # 18. Length exactly 8
    len8 = df[df["Length"] == 8]
    _pick(len8.head(1) if len(len8) > 0 else pd.DataFrame(), "Length = 8 (minimum)")

    # 19. Length exactly 40
    len40 = df[df["Length"] == 40]
    _pick(len40.head(1) if len(len40) > 0 else pd.DataFrame(), "Length = 40 (maximum)")

    # 20. "Median" peptide: closest to median on key numeric columns
    median_cols = ["Length", "Charge", "Hydrophobicity", "Full length uH"]
    medians = df[median_cols].median()
    # Normalize distances
    stds = df[median_cols].std().replace(0, 1)
    distances = ((df[median_cols] - medians) / stds).pow(2).sum(axis=1)
    # Exclude already-selected
    for entry in selected_entries:
        mask = df["Entry"] == entry
        distances[mask] = float("inf")
    closest_idx = distances.idxmin()
    _pick(closest_idx, "Median peptide (closest to median)")

    # --- Build the sample DataFrame ---
    sample_df = df[df["Entry"].isin(selected_entries)].copy()

    # Reorder to match selection order
    sample_df = sample_df.set_index("Entry").loc[selected_entries].reset_index()

    print(f"\n  Total selected: {len(sample_df)} peptides")
    return sample_df


def dataframe_to_json_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Convert DataFrame to a list of JSON-serializable dicts.

    Handles:
    - NaN/None -> null
    - numpy types -> Python native types
    - String-encoded lists (SSW fragments, Helix fragments) -> parsed lists
    """
    records = []
    for _, row in df.iterrows():
        record = {}
        for col in df.columns:
            val = row[col]

            # Handle NaN
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                record[col] = None
                continue

            # Handle numpy types
            val = _safe_json(val)

            # Parse string-encoded lists like "[(10, 19), (28, 35)]"
            if col in ("SSW fragments", "Helix fragments (Jpred)") and isinstance(val, str):
                try:
                    parsed = eval(val)  # noqa: S307 — trusted data from gold standard
                    if isinstance(parsed, list):
                        # Convert tuples to lists for JSON
                        val = [list(t) if isinstance(t, tuple) else t for t in parsed]
                    else:
                        val = parsed
                except Exception:
                    pass  # Keep as string if parsing fails

            record[col] = val
        records.append(record)
    return records


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Run the full gold-standard analysis."""
    print(f"Reading gold-standard file: {EXCEL_PATH}")
    if not EXCEL_PATH.exists():
        print(f"ERROR: File not found: {EXCEL_PATH}")
        sys.exit(1)

    df = pd.read_excel(EXCEL_PATH, engine="openpyxl")
    print(f"Shape: {df.shape[0]} rows x {df.shape[1]} columns")

    # --- Column classification ---
    print_section("COLUMN CLASSIFICATION")
    for col in df.columns:
        if col in INPUT_COLS:
            category = "INPUT"
        elif col in COMPUTED_COLS:
            category = "COMPUTED"
        elif col in ANNOTATION_COLS:
            category = "ANNOTATION"
        else:
            category = "UNKNOWN"
        print(f"  {category:12s}  {col} [{df[col].dtype}]")

    # --- Full column analysis ---
    column_stats = analyze_columns(df)
    print_column_report(df, column_stats)

    # --- Specific analyses ---
    analyze_ssw_prediction(df)
    analyze_ssw_diff(df)
    analyze_biochem(df)
    analyze_ff_helix(df)
    analyze_length(df)
    analyze_helix_percentage(df)

    # --- Thresholds used in gold standard ---
    print_section("THRESHOLD ANALYSIS (reverse-engineered from data)")

    # SSW hydro threshold = mean hydrophobicity of SSW+ rows
    ssw_pos = df[df["SSW prediction"] == 1]
    ssw_hydro_threshold = ssw_pos["Hydrophobicity"].mean()
    print(f"  SSW hydro threshold (mean of SSW+ rows): {ssw_hydro_threshold:.6f}")
    print(f"    (FF-SSW flag = 1 when SSW=1 AND Hydrophobicity >= {ssw_hydro_threshold:.6f})")

    # Helix uH threshold = mean Helix (Jpred) uH of rows with real helix data
    real_helix_mask = (df["Helix (Jpred) uH"] != -1) & df["Helix (Jpred) uH"].notna()
    if real_helix_mask.any():
        helix_uh_threshold = df.loc[real_helix_mask, "Helix (Jpred) uH"].mean()
        print(f"  Helix uH threshold (mean of rows with helix data): {helix_uh_threshold:.6f}")
        print(f"    (FF-Helix flag = 1 when Helix uH >= {helix_uh_threshold:.6f})")

    # Verify: count how many FF-SSW=1 match the threshold logic
    ff_ssw_should_be_1 = (
        (df["SSW prediction"] == 1)
        & (df["Hydrophobicity"] >= ssw_hydro_threshold)
    )
    actual_ff_ssw_1 = df["FF-Secondary structure switch"] == 1
    match_count = int((ff_ssw_should_be_1 == actual_ff_ssw_1).sum())
    print(f"\n  FF-SSW threshold verification: {match_count}/{len(df)} rows match "
          f"({100.0 * match_count / len(df):.1f}%)")

    if real_helix_mask.any():
        # Note: FF-Helix uses Helix score (Jpred) and Helix (Jpred) uH
        # The flag logic in the reference code checks:
        #   helix_pred != -1 AND helix_uH >= threshold
        has_helix = df["Helix score (Jpred)"] != -1
        ff_helix_should_be_1 = has_helix & (df["Helix (Jpred) uH"] >= helix_uh_threshold)
        actual_ff_helix_1 = df["FF-Helix (Jpred)"] == 1
        match_count_h = int((ff_helix_should_be_1 == actual_ff_helix_1).sum())
        print(f"  FF-Helix threshold verification: {match_count_h}/{len(df)} rows match "
              f"({100.0 * match_count_h / len(df):.1f}%)")

    # --- Extract representative sample ---
    sample_df = extract_representative_sample(df)

    # --- Save sample as JSON ---
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    records = dataframe_to_json_records(sample_df)

    output = {
        "description": (
            "Representative sample of 20 peptides from the gold-standard "
            "Staphylococcus dataset (Final_Staphylococcus_2023_new.xlsx). "
            "Covers edge cases: short/long peptides, extreme charges, "
            "high/low hydrophobicity, all FF-flag combinations, "
            "sentinel -1 values, and a median peptide."
        ),
        "source_file": "Final_Staphylococcus_2023_new.xlsx",
        "source_shape": {"rows": df.shape[0], "columns": df.shape[1]},
        "column_classification": {
            "input": sorted(INPUT_COLS & set(df.columns)),
            "computed": sorted(COMPUTED_COLS & set(df.columns)),
            "annotation": sorted(ANNOTATION_COLS & set(df.columns)),
        },
        "sentinel_conventions": {
            "-1_in_SSW_prediction": "No SSW segments detected (valid flag value)",
            "-1_in_SSW_diff": "Sentinel: no SSW segments, diff is meaningless",
            "-1_in_Helix_score_Jpred": "Sentinel: no Jpred helix segments detected",
            "-1_in_Helix_Jpred_uH": "Sentinel: no Jpred helix segments detected",
            "-1_in_FF_flags": "-1 means 'not a candidate' (valid flag value)",
            "-1_in_FF_helix_score": "Sentinel: FF-Helix flag is -1, score is meaningless",
        },
        "thresholds_reverse_engineered": {
            "ssw_hydro_threshold": round(ssw_hydro_threshold, 6),
            "helix_uH_threshold": round(helix_uh_threshold, 6) if real_helix_mask.any() else None,
            "note": (
                "These thresholds are the dataset-mean values used by the reference "
                "pipeline (apply_ff_flags with default threshold_mode). They will vary "
                "per dataset."
            ),
        },
        "default_config_thresholds": {
            "FF_HELIX_THRESHOLD": 1.0,
            "FF_HELIX_CORE_LEN": 6,
            "SSW_DIFF_THRESHOLD_STRATEGY": "mean",
            "SSW_DIFF_THRESHOLD_FALLBACK": 0.0,
            "MIN_S4PRED_SCORE": 0.5,
            "MIN_SEGMENT_LENGTH": 5,
            "MAX_GAP": 3,
            "DEFAULT_MU_H_CUTOFF": 0.0,
            "DEFAULT_HYDRO_CUTOFF": 0.0,
            "DEFAULT_FF_HELIX_PERCENT_THRESHOLD": 50.0,
            "DEFAULT_AGG_THRESHOLD": 5.0,
        },
        "peptides": records,
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=_safe_json)

    print(f"\n  Saved {len(records)} peptides to: {OUTPUT_JSON}")
    print(f"  File size: {OUTPUT_JSON.stat().st_size:,} bytes")

    # --- Summary ---
    print_section("SUMMARY")
    print(f"  Dataset: {df.shape[0]} peptides, {df.shape[1]} columns")
    print(f"  Input columns: {len(INPUT_COLS & set(df.columns))}")
    print(f"  Computed columns: {len(COMPUTED_COLS & set(df.columns))}")
    print(f"  Annotation columns: {len(ANNOTATION_COLS & set(df.columns))}")
    print(f"  SSW+ rate: {100.0 * (df['SSW prediction'] == 1).sum() / len(df):.1f}%")
    print(f"  FF-SSW+ rate: {100.0 * (df['FF-Secondary structure switch'] == 1).sum() / len(df):.1f}%")
    print(f"  FF-Helix+ rate: {100.0 * (df['FF-Helix (Jpred)'] == 1).sum() / len(df):.1f}%")
    print(f"  Length range: {df['Length'].min()}-{df['Length'].max()}")
    print(f"  Charge range: {df['Charge'].min()} to {df['Charge'].max()}")
    print(f"\n  Sample saved to: {OUTPUT_JSON}")
    print("  Run pipeline comparison tests against these fixtures.")


if __name__ == "__main__":
    main()
