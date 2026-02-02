# -*- coding: utf-8 -*-
"""
S4PRED - Single Sequence Secondary Structure Prediction

Neural network-based secondary structure predictor using an ensemble
of 5 GRU models.

Original implementation by Lewis Moffat (Github: limitloss)
Adapted for PVL integration.
"""

from .model import S4PREDPredictor, get_predictor, clear_predictor
from .utilities import aas2int, sequence_to_input

__all__ = [
    'S4PREDPredictor',
    'get_predictor',
    'clear_predictor',
    'aas2int',
    'sequence_to_input',
]
