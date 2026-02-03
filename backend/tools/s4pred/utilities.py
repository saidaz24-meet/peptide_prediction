# -*- coding: utf-8 -*-
"""
S4PRED Utilities
Original Author: Lewis Moffat (Github: limitloss)
Adapted for PVL integration.
"""

from typing import List, Tuple


def aas2int(seq: str) -> List[int]:
    """Convert amino acid sequence to integer encoding."""
    aanumdict = {
        'A': 0, 'R': 1, 'N': 2, 'D': 3, 'C': 4, 'Q': 5, 'E': 6, 'G': 7, 'H': 8,
        'I': 9, 'L': 10, 'K': 11, 'M': 12, 'F': 13, 'P': 14, 'S': 15, 'T': 16,
        'W': 17, 'Y': 18, 'V': 19
    }
    return [aanumdict.get(res, 20) for res in seq]


def loadfasta(fasta_file: str) -> List[List]:
    """
    Load FASTA file containing multiple sequences.

    Returns a list of [name, int_sequence, str_sequence] for each record.
    """
    try:
        from Bio import SeqIO

        sequences = []
        records = list(SeqIO.parse(fasta_file, "fasta"))
        for record in records:
            name = record.name
            seq = str(record.seq).upper().replace('-', '')
            iseq = aas2int(seq)
            sequences.append([name, iseq, seq])
        return sequences
    except ImportError:
        # Fallback parser if Biopython not available
        return _legacy_loadfasta(fasta_file)


def _legacy_loadfasta(fasta_file: str) -> List[List]:
    """
    Fallback FASTA parser without Biopython dependency.
    """
    sequences = []
    current_name = None
    current_seqs = []

    with open(fasta_file, "r") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith(">"):
                if current_name is not None:
                    seq = ''.join(current_seqs).upper().replace('-', '')
                    iseq = aas2int(seq)
                    sequences.append([current_name, iseq, seq])
                current_name = line[1:].split()[0]  # Get ID part only
                current_seqs = []
            else:
                current_seqs.append(line)

        # Don't forget the last sequence
        if current_name is not None:
            seq = ''.join(current_seqs).upper().replace('-', '')
            iseq = aas2int(seq)
            sequences.append([current_name, iseq, seq])

    return sequences


def sequence_to_input(entry_id: str, sequence: str) -> List:
    """
    Convert a single sequence to S4PRED input format.

    Args:
        entry_id: Sequence identifier
        sequence: Amino acid sequence string

    Returns:
        [name, int_sequence, str_sequence]
    """
    seq = sequence.upper().replace('-', '')
    iseq = aas2int(seq)
    return [entry_id, iseq, seq]
