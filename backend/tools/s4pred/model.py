# -*- coding: utf-8 -*-
"""
S4PRED Model Loader and Predictor
Refactored from run_model.py for PVL integration.

Original Author: Lewis Moffat (Github: limitloss)
"""

import os
from typing import Dict, List, Optional, Tuple

import torch
import numpy as np

from .network import S4PRED
from .utilities import sequence_to_input


# Character mapping for SS prediction
IND2CHAR = {0: "C", 1: "H", 2: "E"}


class S4PREDPredictor:
    """
    S4PRED secondary structure predictor.

    Loads the ensemble model and provides prediction methods.
    """

    def __init__(self, weights_path: str, device: str = "cpu", threads: Optional[int] = None):
        """
        Initialize the S4PRED predictor.

        Args:
            weights_path: Path to directory containing weights_1.pt through weights_5.pt
            device: Either 'cpu' or 'gpu'
            threads: Number of CPU threads (None = use default)
        """
        if threads:
            torch.set_num_threads(threads)

        self.device = torch.device('cpu:0' if device == 'cpu' else 'cuda:0')
        self.weights_path = weights_path

        # Initialize model
        self.model = S4PRED().to(self.device)
        self.model.eval()
        self.model.requires_grad = False

        # Load weights
        self._load_weights()

    def _load_weights(self):
        """Load all 5 model weights."""
        weight_files = [
            'weights_1.pt',
            'weights_2.pt',
            'weights_3.pt',
            'weights_4.pt',
            'weights_5.pt',
        ]

        for i, wf in enumerate(weight_files, start=1):
            weight_path = os.path.join(self.weights_path, wf)
            if not os.path.exists(weight_path):
                raise FileNotFoundError(f"S4PRED weight file not found: {weight_path}")

            state_dict = torch.load(weight_path, map_location=lambda storage, loc: storage)
            getattr(self.model, f'model_{i}').load_state_dict(state_dict)

    def predict_sequence(self, data: List) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict secondary structure for a single sequence.

        Args:
            data: [name, int_sequence, str_sequence] format

        Returns:
            (ss_prediction, ss_confidence) where:
              - ss_prediction: numpy array of class indices (0=C, 1=H, 2=E)
              - ss_confidence: numpy array of shape (seq_len, 3) with probabilities
        """
        with torch.no_grad():
            ss_conf = self.model(torch.tensor([data[1]]).to(self.device))
            ss = ss_conf.argmax(-1)

            # Move confidence scores out of log space
            ss_conf = ss_conf.exp()

            # Renormalize to handle precision issues
            tsum = ss_conf.sum(-1)
            tsum = torch.cat((tsum.unsqueeze(1), tsum.unsqueeze(1), tsum.unsqueeze(1)), 1)
            ss_conf /= tsum

            ss = ss.cpu().numpy()
            ss_conf = ss_conf.cpu().numpy()

        return ss, ss_conf

    def predict_from_sequence(self, entry_id: str, sequence: str) -> Dict:
        """
        Predict secondary structure from a sequence string.

        Args:
            entry_id: Sequence identifier
            sequence: Amino acid sequence

        Returns:
            Dictionary with prediction results:
            {
                'entry_id': str,
                'sequence': str,
                'ss_prediction': list of 'C'/'H'/'E',
                'P_C': list of coil probabilities,
                'P_H': list of helix probabilities,
                'P_E': list of beta probabilities,
            }
        """
        data = sequence_to_input(entry_id, sequence)
        ss, ss_conf = self.predict_sequence(data)

        return {
            'entry_id': entry_id,
            'sequence': data[2],  # Cleaned sequence
            'ss_prediction': [IND2CHAR[s] for s in ss],
            'P_C': ss_conf[:, 0].tolist(),
            'P_H': ss_conf[:, 1].tolist(),
            'P_E': ss_conf[:, 2].tolist(),
        }

    def format_ss2(self, data: List, ss: np.ndarray, ss_conf: np.ndarray) -> List[str]:
        """
        Format output in PSIPRED VFORMAT .ss2 style.

        Args:
            data: [name, int_sequence, str_sequence]
            ss: Prediction indices
            ss_conf: Confidence scores (seq_len, 3)

        Returns:
            List of lines for .ss2 file
        """
        lines = ['# PSIPRED VFORMAT (S4PRED V1.2.4)\n']
        for i in range(len(ss)):
            lines.append(
                "%4d %c %c  %6.3f %6.3f %6.3f" % (
                    i + 1,
                    data[2][i],
                    IND2CHAR[ss[i]],
                    ss_conf[i, 0],
                    ss_conf[i, 1],
                    ss_conf[i, 2]
                )
            )
        return lines


# Global instance (lazy initialization)
_predictor: Optional[S4PREDPredictor] = None


def get_predictor(weights_path: str, device: str = "cpu", threads: Optional[int] = None) -> S4PREDPredictor:
    """
    Get or create the global S4PRED predictor instance.

    This allows model reuse across predictions.
    """
    global _predictor
    if _predictor is None:
        _predictor = S4PREDPredictor(weights_path, device, threads)
    return _predictor


def clear_predictor():
    """Clear the global predictor instance (useful for testing)."""
    global _predictor
    _predictor = None
