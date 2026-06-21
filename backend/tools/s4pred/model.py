# -*- coding: utf-8 -*-
"""
S4PRED Model Loader and Predictor
Refactored from run_model.py for PVL integration.

Original Author: Lewis Moffat (Github: limitloss)
"""

import os

# PERF-2026-06-18: PyTorch / OpenMP / MKL / OpenBLAS all default their thread
# counts to os.cpu_count(). With 5 BiLSTM ensemble × default intra-op (= 4 on
# CX33) × N thread-pool slots × M uvicorn workers, we end up with 100+ threads
# fighting 4 cores — context-switch + cache-thrash makes prod 22× slower than
# a Mac terminal run. Pin to 1 BEFORE torch is imported so the OMP runtime
# sees the env var at first call.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")

from typing import Dict, List, Optional, Tuple

import torch
import numpy as np

# Belt-and-braces: even if the env var was set late, force torch's view too.
try:
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
except RuntimeError:
    # set_num_interop_threads must be called before any parallel work;
    # if it has already started, the env vars above + set_num_threads still help.
    pass

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

        self.device = torch.device("cpu:0" if device == "cpu" else "cuda:0")
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
            "weights_1.pt",
            "weights_2.pt",
            "weights_3.pt",
            "weights_4.pt",
            "weights_5.pt",
        ]

        for i, wf in enumerate(weight_files, start=1):
            weight_path = os.path.join(self.weights_path, wf)
            if not os.path.exists(weight_path):
                raise FileNotFoundError(f"S4PRED weight file not found: {weight_path}")

            state_dict = torch.load(weight_path, map_location=lambda storage, loc: storage)
            getattr(self.model, f"model_{i}").load_state_dict(state_dict)

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
            "entry_id": entry_id,
            "sequence": data[2],  # Cleaned sequence
            "ss_prediction": [IND2CHAR[s] for s in ss],
            "P_C": ss_conf[:, 0].tolist(),
            "P_H": ss_conf[:, 1].tolist(),
            "P_E": ss_conf[:, 2].tolist(),
        }

    # ----------------------------------------------------------------------
    # PVL-perf-03 (2026-06-21): batched forward
    # ----------------------------------------------------------------------
    # Per-peptide dispatch was the dominant cost for batch runs — 5 ensemble
    # × N peptides = 5N forward calls, each paying full PyTorch dispatch
    # overhead on a tiny (1, L) tensor. Batched forward stacks all peptides
    # in the batch into one padded (N, L_max) tensor and dispatches the
    # ensemble once on the whole batch. The actual numeric work is the same
    # (BiLSTM has no cross-sequence interaction); we save the dispatch cost.
    #
    # Expected impact: 5–10× speedup on the batch path. No effect on Quick
    # Analyze (N=1) — that path's bottleneck is elsewhere (see PERF_TRACE).
    #
    # Padding value: the embedding's padding_idx=21. Padded positions
    # contribute zero gradient (we're in no_grad mode anyway) and we slice
    # the output back to the unpadded length per sequence.

    PAD_IDX = 21  # matches ResidueEmbedding(padding_idx=21) in network.py

    def predict_sequences_batched(
        self,
        items: List[Tuple[str, str]],
        max_batch_size: int = 32,
    ) -> List[Dict]:
        """Predict secondary structure for many sequences in a single forward pass.

        Args:
            items: list of (entry_id, sequence) tuples. Each sequence is the
                already-sanitized amino-acid string (e.g. after
                ``auxiliary.get_corrected_sequence``).
            max_batch_size: upper bound on sequences per micro-batch to keep
                peak memory bounded. 32 × max_len=40 × 2048 hidden × 5 models
                ≈ 250 MB peak; well within an 8 GB container.

        Returns:
            List of prediction dicts in the same order as ``items``. Each dict
            has the same shape as :meth:`predict_from_sequence` returns so
            downstream code can be agnostic to which path produced it.
        """
        if not items:
            return []

        # Convert all sequences to int arrays once, group into micro-batches.
        per_seq_inputs = [sequence_to_input(eid, seq) for eid, seq in items]

        results: List[Dict] = []
        for start in range(0, len(per_seq_inputs), max_batch_size):
            chunk = per_seq_inputs[start : start + max_batch_size]
            results.extend(self._predict_batch_chunk(chunk))
        return results

    def _predict_batch_chunk(self, chunk: List[List]) -> List[Dict]:
        """One forward pass over a padded chunk. ``chunk`` is a list of
        ``[entry_id, int_sequence, str_sequence]`` items.

        IMPORTANT: the BiLSTM is bidirectional, so simply padding a batch
        contaminates the prediction near sequence boundaries — the backward
        pass reads OVER padding tokens and leaks into the legitimate
        positions. We use ``pack_padded_sequence`` to feed each sub-model
        only the real positions per sequence; padding is invisible to the
        GRU. This restores bit-equivalence with the legacy per-peptide path
        (verified to <1e-5 absolute float diff in tests).
        """
        from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence

        if not chunk:
            return []

        # Single-sequence fast path: keep the original (unpadded) shape so the
        # network's `x.squeeze()` behaves exactly as in the legacy code. This
        # makes the batched method bit-equivalent for N=1, which simplifies
        # the Quick Analyze path without touching it.
        if len(chunk) == 1:
            ss, ss_conf = self.predict_sequence(chunk[0])
            return [self._format_result(chunk[0], ss, ss_conf)]

        lengths = [len(item[1]) for item in chunk]
        max_len = max(lengths)
        lengths_tensor = torch.tensor(lengths, dtype=torch.long)

        # Build padded (N, L_max) tensor on CPU/GPU.
        padded = torch.full((len(chunk), max_len), self.PAD_IDX, dtype=torch.long)
        for i, item in enumerate(chunk):
            seq_len = lengths[i]
            padded[i, :seq_len] = torch.tensor(item[1], dtype=torch.long)
        padded = padded.to(self.device)

        # Per-sub-model forward with packed-sequence handling.
        def _grunet_forward_packed(gru_model) -> torch.Tensor:
            # padded → (N, L_max, embed_dim) — embed handles padding_idx
            embedded = gru_model.embed(padded)
            # Pack so the GRU only sees real positions per sequence.
            packed = pack_padded_sequence(
                embedded, lengths_tensor.cpu(), batch_first=True, enforce_sorted=False
            )
            packed_out, _ = gru_model.lstm(packed)
            # Pad back to (N, L_max, 2*lstm_hdim). Padding positions are zeros
            # — they'll be sliced off per-sequence at the end.
            out, _ = pad_packed_sequence(
                packed_out, batch_first=True, total_length=max_len
            )
            out = gru_model.outlayer(out)  # (N, L_max, 3)
            return torch.nn.functional.log_softmax(out, dim=-1)

        with torch.no_grad():
            ensemble_logp = (
                _grunet_forward_packed(self.model.model_1) * 0.2
                + _grunet_forward_packed(self.model.model_2) * 0.2
                + _grunet_forward_packed(self.model.model_3) * 0.2
                + _grunet_forward_packed(self.model.model_4) * 0.2
                + _grunet_forward_packed(self.model.model_5) * 0.2
            )  # (N, L_max, 3)

            # Mirror predict_sequence's renormalization: exp out of log space,
            # then per-position normalize so the three class probabilities sum
            # to 1 exactly.
            probs = ensemble_logp.exp()
            tsum = probs.sum(-1, keepdim=True)  # (N, L_max, 1)
            probs = probs / tsum

            ss = probs.argmax(-1)  # (N, L_max)
            ss_np = ss.cpu().numpy()
            probs_np = probs.cpu().numpy()

        # Slice each sequence's output back to its original length.
        out: List[Dict] = []
        for i, item in enumerate(chunk):
            seq_len = lengths[i]
            out.append(self._format_result(item, ss_np[i, :seq_len], probs_np[i, :seq_len]))
        return out

    def _format_result(self, item: List, ss: np.ndarray, ss_conf: np.ndarray) -> Dict:
        """Shape a single per-sequence result to match predict_from_sequence."""
        return {
            "entry_id": item[0],
            "sequence": item[2],
            "ss_prediction": [IND2CHAR[int(s)] for s in ss],
            "P_C": ss_conf[:, 0].tolist(),
            "P_H": ss_conf[:, 1].tolist(),
            "P_E": ss_conf[:, 2].tolist(),
        }

    def format_ss2(self, data: List, ss: np.ndarray, ss_conf: np.ndarray) -> List[str]:
        """
        Format output in .ss2 style (PSIPRED-compatible format).

        Args:
            data: [name, int_sequence, str_sequence]
            ss: Prediction indices
            ss_conf: Confidence scores (seq_len, 3)

        Returns:
            List of lines for .ss2 file
        """
        lines = ["# S4PRED V1.2.4 (.ss2 format)\n"]
        for i in range(len(ss)):
            lines.append(
                "%4d %c %c  %6.3f %6.3f %6.3f"
                % (i + 1, data[2][i], IND2CHAR[ss[i]], ss_conf[i, 0], ss_conf[i, 1], ss_conf[i, 2])
            )
        return lines


# Global instance (lazy initialization)
_predictor: Optional[S4PREDPredictor] = None


def get_predictor(
    weights_path: str, device: str = "cpu", threads: Optional[int] = None
) -> S4PREDPredictor:
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
