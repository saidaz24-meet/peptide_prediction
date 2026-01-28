"""
Biochemical calculation functions for peptide analysis.
Extracted from server.py and batch_process.py to remove duplication.
"""
import pandas as pd
import biochemCalculation
import auxiliary

def sanitize_seq(s: str) -> str:
    """Sanitize sequence to canonical 20 amino acids."""
    AA20 = set(list("ACDEFGHIKLMNPQRSTVWY"))
    s = (s or "").upper()
    s = "".join([ch for ch in s if ch in AA20])
    return s

def _to_segments(val):
    """Parse segment data from various formats."""
    import json
    import re
    
    if val is None or (isinstance(val, (int, float)) and val == -1):
        return []
    if isinstance(val, (list, tuple)):
        return list(val)
    s = str(val).strip()
    if not s or s in ("-1", "[]", ""):
        return []
    # try JSON first (e.g., "[[5,12],[20,28]]")
    try:
        seg = json.loads(s)
        if isinstance(seg, (list, tuple)):
            return list(seg)
    except Exception:
        pass
    # fallback: "5-12;20-28" or "5:12,20:28"
    seg = []
    for part in re.split(r"[;,]", s):
        m = re.match(r"\s*(\d+)\s*[-:]\s*(\d+)\s*", part)
        if m:
            seg.append([int(m.group(1)), int(m.group(2))])
    return seg

def calculate_biochemical_features(df: pd.DataFrame, use_strict_validation: bool = True) -> None:
    """
    Calculate biochemical features for peptide sequences.
    
    Adds columns: Charge, Hydrophobicity, Full length uH, Helix (Jpred) uH, Beta full length uH
    
    Args:
        df: DataFrame with 'Sequence' column and optionally 'Helix fragments (Jpred)'
        use_strict_validation: If True, mark invalid sequences as NaN instead of computing
    """
    charges, hydros, uh_full, uh_helix, uh_beta = [], [], [], [], []
    
    for _, r in df.iterrows():
        seq_raw = str(r["Sequence"])
        
        if use_strict_validation:
            # Server.py style: sanitize first, fallback to corrected, mark invalid as NaN
            seq = sanitize_seq(seq_raw) or auxiliary.get_corrected_sequence(seq_raw)
            if not seq:
                # mark invalids so the UI can show 'Not available' instead of 0.00
                charges.append(float("nan"))
                hydros.append(float("nan"))
                uh_full.append(float("nan"))
                uh_helix.append(float("nan"))
                uh_beta.append(float("nan"))
                continue
            
            # robustly parse helix fragments
            helix_frags = _to_segments(r.get("Helix fragments (Jpred)", []))
        else:
            # batch_process.py style: use corrected sequence directly
            seq = auxiliary.get_corrected_sequence(seq_raw)
            helix_frags = r.get("Helix fragments (Jpred)", [])
        
        charges.append(biochemCalculation.total_charge(seq))
        hydros.append(biochemCalculation.hydrophobicity(seq))
        uh_full.append(biochemCalculation.hydrophobic_moment(seq))
        uh_helix.append(auxiliary.get_avg_uH_by_segments(seq, helix_frags))
        uh_beta.append(biochemCalculation.hydrophobic_moment(seq, angle=160))
    
    df["Charge"] = charges
    df["Hydrophobicity"] = hydros
    df["Full length uH"] = uh_full
    df["Helix (Jpred) uH"] = uh_helix
    df["Beta full length uH"] = uh_beta

