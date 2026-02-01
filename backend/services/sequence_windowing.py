"""
UniProt sequence windowing service.

Windows protein sequences into overlapping peptides for analysis.
"""
from typing import List, Dict, Any
import re


def window_sequence(
    sequence: str,
    sequence_id: str,
    window_size: int = 20,
    step_size: int = 5
) -> List[Dict[str, Any]]:
    """
    Window a protein sequence into overlapping peptides.
    
    Args:
        sequence: Protein sequence (uppercase, no spaces)
        sequence_id: UniProt ID (e.g., "P53_HUMAN")
        window_size: Peptide length (default: 20)
        step_size: Step size for sliding window (default: 5)
    
    Returns:
        List of peptides: [{id, name, sequence, start, end, protein_id}]
    """
    peptides = []
    seq_clean = re.sub(r'[^A-Z]', '', sequence.upper())
    
    for i in range(0, len(seq_clean) - window_size + 1, step_size):
        peptide_seq = seq_clean[i:i + window_size]
        start = i + 1  # 1-indexed
        end = i + window_size
        
        peptides.append({
            "id": f"{sequence_id}_pep_{start}_{end}",
            "name": f"{sequence_id} ({start}-{end})",
            "sequence": peptide_seq,
            "start": start,
            "end": end,
            "protein_id": sequence_id,
        })
    
    return peptides


def window_sequences(
    sequences: List[Dict[str, str]],
    window_size: int = 20,
    step_size: int = 5
) -> List[Dict[str, Any]]:
    """
    Window multiple protein sequences into peptides.
    
    Args:
        sequences: [{id, sequence}]
        window_size: Peptide length
        step_size: Step size
    
    Returns:
        List of all peptides from all sequences
    """
    all_peptides = []
    for seq_data in sequences:
        peptides = window_sequence(
            seq_data["sequence"],
            seq_data["id"],
            window_size,
            step_size
        )
        all_peptides.extend(peptides)
    return all_peptides

