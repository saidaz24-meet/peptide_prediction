import math
import statistics

Fauchere_Pliska = {'A':  0.31, 'R': -1.01, 'N': -0.60,
                              'D': -0.77, 'C':  1.54, 'Q': -0.22,
                              'E': -0.64, 'G':  0.00, 'H':  0.13,
                              'I':  1.80, 'L':  1.70, 'K': -0.99,
                              'M':  1.23, 'F':  1.79, 'P':  0.72,
                              'S': -0.04, 'T':  0.26, 'W':  2.25,
                              'Y':  0.96, 'V':  1.22}

def __get_hydrophobic_moment_vec(seq) -> list:
    """
    calculates a vector of hydrophobic moments
    :param seq: sequens of aa
    :return: list representing hydrophobic vector
    """
    hydro = []
    for aa in seq:
        hydro.append(Fauchere_Pliska.get(aa))
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
    # assert((end_i - start_i + 1) >= min_H_length), "start idx and end idx does not create a sequence"
    assert len(peptide_sequence) > 0, "Sequence for calculating hydrophobic moment is empty"
    hydro = __get_hydrophobic_moment_vec(peptide_sequence)
    sum_cos, sum_sin = 0.0, 0.0
    for i, hv in enumerate(hydro):
        rad_inc = ((i * angle) * math.pi) / 180.0
        sum_cos += hv * math.cos(rad_inc)
        sum_sin += hv * math.sin(rad_inc)

    return math.sqrt(sum_cos ** 2 + sum_sin ** 2) / len(hydro)


def total_charge(sequence) -> int:
    """
    calculates total peptid charge at pH=7.4

    :param sequence: peptide sequence
    :return: total charge
    """
    aa_charge = {'E': -1, 'D': -1, 'K': 1, 'R': 1}  # at PH = 7.4   

    sc_charges = [aa_charge.get(aa, 0) for aa in sequence]
    return sum(sc_charges)


def hydrophobicity(sequence: str) -> tuple:
    """ This function gets a sequence and calculates and return its hydrophobicity by Fauchere_Pliska scale

    :param sequence: peptide sequence
    :return: hydrophobicity of the sequence
    """

    hydrophobicity_list = []
    for aa in sequence:
        hydrophobicity_list.append(Fauchere_Pliska[aa])
    return statistics.mean(hydrophobicity_list)
