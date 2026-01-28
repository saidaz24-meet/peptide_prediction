"""
Threshold resolution service for peptide prediction.

Deterministically resolves threshold configurations based on mode:
- "default": Returns default threshold values
- "custom": Validates and merges custom thresholds with defaults
- "recommended": Computes thresholds from dataframe using stable statistical rules
"""
import pandas as pd
import numpy as np
from typing import Dict, Optional, Any
from services.logger import log_warning


# Default threshold values
DEFAULT_THRESHOLDS = {
    "muHCutoff": 0.0,  # Threshold for Full length uH (μH) flag
    "hydroCutoff": 0.0,  # Threshold for Hydrophobicity flag
    "ffHelixPercentThreshold": 50.0,  # Threshold for FF-Helix % (used in scoring)
}


def resolve_thresholds(
    threshold_config: Optional[Dict[str, Any]],
    df: pd.DataFrame,
    defaults: Optional[Dict[str, float]] = None
) -> Dict[str, float]:
    """
    Resolve threshold values based on configuration mode.
    
    Args:
        threshold_config: Threshold configuration dict with keys:
            - mode: "default" | "recommended" | "custom"
            - custom: Optional dict with custom threshold values (only used if mode="custom")
            - version: Version string (for future compatibility)
        df: DataFrame with peptide data (required for "recommended" mode)
        defaults: Optional dict of default thresholds (uses DEFAULT_THRESHOLDS if None)
    
    Returns:
        Dict with resolved threshold values:
            - muHCutoff: float
            - hydroCutoff: float
            - ffHelixPercentThreshold: float
    
    Rules:
        - mode "default": Returns defaults unchanged
        - mode "custom": Validates custom values and merges with defaults
        - mode "recommended": Computes thresholds from df using median (stable, deterministic)
    
    Recommended mode computation rules (documented for reproducibility):
        - muHCutoff: Median of "Full length uH" column (ignoring NaN/None)
        - hydroCutoff: Median of "Hydrophobicity" column (ignoring NaN/None)
        - ffHelixPercentThreshold: Median of "FF-Helix %" column (ignoring NaN/None)
        - If a column is missing or has no valid values, falls back to default for that threshold
    """
    if defaults is None:
        defaults = DEFAULT_THRESHOLDS.copy()
    else:
        defaults = defaults.copy()
    
    # If no config provided, return defaults
    if not threshold_config:
        return defaults
    
    mode = threshold_config.get("mode", "default")
    
    if mode == "default":
        return defaults
    
    elif mode == "custom":
        # Validate and merge custom thresholds
        custom = threshold_config.get("custom", {})
        if not isinstance(custom, dict):
            log_warning(
                "threshold_custom_invalid",
                "Custom thresholds must be a dict, using defaults",
                **{"custom_type": type(custom).__name__}
            )
            return defaults
        
        resolved = defaults.copy()
        
        # Validate and merge each custom threshold
        for key in defaults.keys():
            if key in custom:
                value = custom[key]
                # Validate value is numeric
                try:
                    num_value = float(value)
                    # Validate reasonable ranges (allow negative for cutoffs, but clamp extreme values)
                    if key == "ffHelixPercentThreshold":
                        # FF-Helix % is in [0, 100]
                        num_value = max(0.0, min(100.0, num_value))
                    # For muHCutoff and hydroCutoff, allow any float (no hard limits)
                    resolved[key] = num_value
                except (ValueError, TypeError):
                    log_warning(
                        "threshold_custom_invalid_value",
                        f"Invalid custom threshold value for {key}: {value}, using default",
                        **{"key": key, "value": str(value)}
                    )
                    # Keep default value
        
        return resolved
    
    elif mode == "recommended":
        # Compute thresholds from dataframe using median (stable, deterministic)
        resolved = defaults.copy()
        
        # muHCutoff: Median of "Full length uH" column
        # Rule: Use median of all valid (finite numeric) values, ignoring NaN/None
        if "Full length uH" in df.columns:
            muH_values = df["Full length uH"].dropna()
            # Filter to only finite numeric values
            muH_values = muH_values[muH_values.apply(lambda x: isinstance(x, (int, float)) and np.isfinite(x))]
            if len(muH_values) > 0:
                resolved["muHCutoff"] = float(np.median(muH_values))
            else:
                log_warning(
                    "threshold_recommended_no_data",
                    "No valid Full length uH values for recommended muHCutoff, using default",
                    **{"default": defaults["muHCutoff"]}
                )
        else:
            log_warning(
                "threshold_recommended_missing_column",
                "Full length uH column missing for recommended muHCutoff, using default",
                **{"default": defaults["muHCutoff"]}
            )
        
        # hydroCutoff: Median of "Hydrophobicity" column
        # Rule: Use median of all valid (finite numeric) values, ignoring NaN/None
        if "Hydrophobicity" in df.columns:
            hydro_values = df["Hydrophobicity"].dropna()
            # Filter to only finite numeric values
            hydro_values = hydro_values[hydro_values.apply(lambda x: isinstance(x, (int, float)) and np.isfinite(x))]
            if len(hydro_values) > 0:
                resolved["hydroCutoff"] = float(np.median(hydro_values))
            else:
                log_warning(
                    "threshold_recommended_no_data",
                    "No valid Hydrophobicity values for recommended hydroCutoff, using default",
                    **{"default": defaults["hydroCutoff"]}
                )
        else:
            log_warning(
                "threshold_recommended_missing_column",
                "Hydrophobicity column missing for recommended hydroCutoff, using default",
                **{"default": defaults["hydroCutoff"]}
            )
        
        # ffHelixPercentThreshold: Median of "FF-Helix %" column
        # Rule: Use median of all valid (finite numeric) values, clamped to [0, 100]
        if "FF-Helix %" in df.columns:
            ff_helix_values = df["FF-Helix %"].dropna()
            # Filter to only finite numeric values
            ff_helix_values = ff_helix_values[ff_helix_values.apply(lambda x: isinstance(x, (int, float)) and np.isfinite(x))]
            if len(ff_helix_values) > 0:
                median_value = float(np.median(ff_helix_values))
                # Clamp to [0, 100] for percentage
                resolved["ffHelixPercentThreshold"] = max(0.0, min(100.0, median_value))
            else:
                log_warning(
                    "threshold_recommended_no_data",
                    "No valid FF-Helix % values for recommended ffHelixPercentThreshold, using default",
                    **{"default": defaults["ffHelixPercentThreshold"]}
                )
        else:
            log_warning(
                "threshold_recommended_missing_column",
                "FF-Helix % column missing for recommended ffHelixPercentThreshold, using default",
                **{"default": defaults["ffHelixPercentThreshold"]}
            )
        
        return resolved
    
    else:
        # Unknown mode, log warning and return defaults
        log_warning(
            "threshold_mode_unknown",
            f"Unknown threshold mode: {mode}, using defaults",
            **{"mode": mode, "valid_modes": ["default", "recommended", "custom"]}
        )
        return defaults

