# -*- coding: utf-8 -*-
"""
S4PRED Neural Network Architecture
Original Author: Lewis Moffat (Github: limitloss)
Adapted for PVL integration.

Inference Only Version of S4PRED - Single Sequence Secondary Structure Prediction
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ResidueEmbedding(nn.Embedding):
    def __init__(self, vocab_size=21, embed_size=128, padding_idx=None):
        super().__init__(vocab_size, embed_size, padding_idx=padding_idx)


class GRUnet(nn.Module):
    def __init__(self, lstm_hdim=1024, embed_size=128, num_layers=3, bidirectional=True, lstm=False, outsize=3):
        super().__init__()
        """
        Inference-only model with training artifacts (dropconnect, etc.) removed.
        """
        self.lstm_hdim = lstm_hdim
        self.embed = ResidueEmbedding(vocab_size=22, embed_size=embed_size, padding_idx=21)
        self.lstm = nn.GRU(128, 1024, num_layers=3, bidirectional=True, batch_first=True, dropout=0.0)
        self.outlayer = nn.Linear(lstm_hdim * 2, outsize)
        self.finalact = F.log_softmax

    def forward(self, x):
        """Assumes a batch size of one currently."""
        x = self.embed(x)
        x, _ = self.lstm(x)
        x = self.outlayer(x)
        x = self.finalact(x, dim=-1)
        return x.squeeze()


class S4PRED(nn.Module):
    def __init__(self):
        super().__init__()
        """
        Ensemble of 5 GRU models for secondary structure prediction.
        """
        # Manually listing for clarity and hot swapping in future
        self.model_1 = GRUnet()
        self.model_2 = GRUnet()
        self.model_3 = GRUnet()
        self.model_4 = GRUnet()
        self.model_5 = GRUnet()

    def forward(self, x):
        y_1 = self.model_1(x)
        y_2 = self.model_2(x)
        y_3 = self.model_3(x)
        y_4 = self.model_4(x)
        y_5 = self.model_5(x)
        y_out = y_1 * 0.2 + y_2 * 0.2 + y_3 * 0.2 + y_4 * 0.2 + y_5 * 0.2
        return y_out
