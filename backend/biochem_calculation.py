import math
import statistics

import numpy as np

Fauchere_Pliska = {
    "A": 0.31,
    "R": -1.01,
    "N": -0.60,
    "D": -0.77,
    "C": 1.54,
    "Q": -0.22,
    "E": -0.64,
    "G": 0.00,
    "H": 0.13,
    "I": 1.80,
    "L": 1.70,
    "K": -0.99,
    "M": 1.23,
    "F": 1.79,
    "P": 0.72,
    "S": -0.04,
    "T": 0.26,
    "W": 2.25,
    "Y": 0.96,
    "V": 1.22,
}

# Pre-computed lookup array indexed by ASCII code for vectorized access.
# Maps uppercase amino acid letters to Fauchere-Pliska values; unknown = 0.0.
_FP_LUT = np.zeros(128, dtype=np.float64)
for _aa, _val in Fauchere_Pliska.items():
    _FP_LUT[ord(_aa)] = _val

# Same for charge at pH 7.4
_CHARGE_LUT = np.zeros(128, dtype=np.float64)
for _aa, _val in {"E": -1, "D": -1, "K": 1, "R": 1, "H": 0.1}.items():
    _CHARGE_LUT[ord(_aa)] = _val


def __get_hydrophobic_moment_vec(seq) -> list:
    """
    calculates a vector of hydrophobic moments
    :param seq: sequens of aa
    :return: list representing hydrophobic vector
    """
    hydro = []
    for aa in seq:
        hydro.append(Fauchere_Pliska.get(aa, 0.0))
    return hydro


def hydrophobic_moment(peptide_sequence, angle=100) -> float:
    """
    Calculates the hydrophobic dipole moment from an array of hydrophobicity
    values. Formula defined by Eisenberg, 1982 (Nature). Returns the average
    moment (normalized by sequence length)

    uH = sqrt(sum(Hi cos(i*d))**2 + sum(Hi sin(i*d))**2),
    where i is the amino acid index and d (delta) is an angular value in
    degrees (100 for alpha-helix, 180 for beta-sheet).

    :param peptide_sequence: Sequence by one-letter code
    :param angle: angle to calculate the moment by
    :return: the hydrophobic moment
    """
    assert len(peptide_sequence) > 0, "Sequence for calculating hydrophobic moment is empty"
    codes = np.frombuffer(peptide_sequence.encode("ascii"), dtype=np.uint8)
    hydro = _FP_LUT[codes]
    n = len(hydro)
    rad_inc = np.arange(n, dtype=np.float64) * (angle * np.pi / 180.0)
    sum_cos = float(np.dot(hydro, np.cos(rad_inc)))
    sum_sin = float(np.dot(hydro, np.sin(rad_inc)))

    result = math.sqrt(sum_cos**2 + sum_sin**2) / n
    if math.isnan(result) or not math.isfinite(result):
        return 0.0
    return result


def total_charge(sequence) -> float:
    """
    Calculate total peptide charge at pH=7.4.

    Charge contributions:
    - K (Lysine): +1
    - R (Arginine): +1
    - D (Aspartate): -1
    - E (Glutamate): -1
    - H (Histidine): +0.1 (partially protonated at pH 7.4, pKa ~6.0)

    :param sequence: peptide sequence
    :return: total charge (float to account for partial H charge)
    """
    codes = np.frombuffer(sequence.encode("ascii"), dtype=np.uint8)
    return float(np.sum(_CHARGE_LUT[codes]))


def hydrophobicity(sequence: str) -> float:
    """This function gets a sequence and calculates and return its hydrophobicity by Fauchere_Pliska scale

    :param sequence: peptide sequence
    :return: hydrophobicity of the sequence
    """
    codes = np.frombuffer(sequence.encode("ascii"), dtype=np.uint8)
    return float(np.mean(_FP_LUT[codes]))
