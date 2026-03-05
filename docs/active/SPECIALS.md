# PVL Calculations Reference ("The Specials")

Each calculation with source file, formula, assumptions, and interpretation.

---

## 1. Mean Average Hydrophobicity

**Source**: `backend/biochem_calculation.py:hydrophobicity()`

**Scale**: Fauchere-Pliska (1983) — verified against Peleg reference implementation.

**Formula**: Per-residue mean of Fauchere-Pliska hydrophobicity values.

```
H = (1/N) * Σ FP(aa_i)  for i = 1..N
```

**Range**: Approximately -1.0 to +2.5.

**Interpretation**: Higher values indicate more hydrophobic peptides. Combined with charge, screens for membrane-active or aggregation-prone candidates.

---

## 2. Aggregation Hotspots (TANGO)

**Source**: `backend/tango.py:process_tango_output()`

**Method**: TANGO (Fernandez-Escamilla et al., 2004) — statistical mechanics algorithm predicting beta-aggregation propensity per residue.

**Threshold**: Residues with TANGO aggregation score >5% are considered aggregation-prone regions (APRs). The 5% threshold follows the original TANGO publication default.

**Key field**: `tangoAggMax` — peak per-residue aggregation score (0-100%).

**Interpretation**:
- `tangoAggMax > 20%`: Strong aggregation-prone region
- `tangoAggMax > 5%`: Aggregation hotspot present
- `tangoAggMax ≤ 5%`: No significant aggregation concern

**Limitations**: TANGO accuracy degrades for sequences >100 aa. Absolute minimum: 5 aa.

---

## 3. Net Charge vs Length

**Source**: `backend/biochem_calculation.py:charge_at_pH()`

**Method**: Henderson-Hasselbalch equation at pH 7.4.

**pKa values**: From Lehninger Principles of Biochemistry (standard set):
- N-terminus: 9.69, C-terminus: 2.34
- Asp: 3.65, Glu: 4.25, His: 6.00, Cys: 8.18
- Tyr: 10.07, Lys: 10.53, Arg: 12.48

**Formula**:
```
charge = Σ(positive residues at pH) - Σ(negative residues at pH)
```

**Interpretation**: Highly positive peptides tend toward membrane-active antimicrobial activity. Charge near zero combined with high hydrophobicity suggests aggregation risk.

---

## 4. FF-Helix % vs Aggregation Max

**Source**: `backend/auxiliary.py:ff_helix_percent()`

**Method**: Chou-Fasman (1978) helix propensity calculation.
- Window size: 6 residues
- Threshold: mean propensity ≥ 1.0 in window → helix nucleation
- FF-Helix % = fraction of residues in predicted helical windows

**Cross-plot**: FF-Helix % (y-axis) vs `tangoAggMax` (x-axis) reveals:
- **Top-right quadrant**: High helix propensity + high aggregation → conformational switch candidates
- **Bottom-right**: High aggregation, low helix → likely beta-aggregation
- **Top-left**: High helix, low aggregation → stable helical peptides
- **Bottom-left**: Neither — low-risk candidates

**Note**: FF-Helix measures intrinsic amino acid propensity (context-free, 1978 method). S4PRED uses a modern neural network for context-dependent prediction. For short peptides, high FF-Helix + 0% S4PRED Helix is correct — the residues favor helix individually but don't form a stable segment in context.

---

## 5. TANGO Aggregation Heatmap

**Source**: `ui/src/components/AggregationHeatmap.tsx`

**Data**: TANGO per-residue `tangoAggCurve` (from `tango.py`).

**Visualization**: Bar chart with per-residue aggregation scores:
- Color scale: 0% (green) → 50% (amber) → 100% (red)
- Overlays: Beta curve, helix curve, S4PRED beta probability

**Interpretation**: Contiguous regions of high aggregation (>5%) are amyloid-forming regions (APRs). Co-localization with S4PRED helix predictions indicates conformational switch zones.

---

## 6. Consensus Secondary Structure Analysis

**Source**: `backend/consensus.py:get_consensus_ss()` / `ui/src/lib/consensus.ts`

**Method**: Tiered reconciliation of TANGO aggregation + S4PRED secondary structure predictions. Based on AMYLPRED2 consensus approach (Hamodrakas 2007).

**Tier Logic (the "Meytal" Rules):**

| Tier | Condition | Label | Base Certainty |
|------|-----------|-------|----------------|
| 1 | TANGO APR >threshold + S4PRED=Helix at hotspot | High-Confidence Switch Zone | 0.9 |
| 2 | TANGO APR >threshold + S4PRED=Coil at hotspot | Disordered Aggregation-Prone | 0.7 |
| 3 | TANGO APR >threshold + S4PRED=Beta at hotspot | Native Beta / Low Switch Risk | 0.5 |
| 4 | TANGO APR ≤threshold + any S4PRED | No Aggregation Concern | 0.8 |
| 5 | No TANGO data | Insufficient Data | 0.0 |

**Certainty modifiers**:
- SSW predictors agree (both positive or both negative): +0.1
- SSW predictors disagree: -0.1
- Sequence <20 aa: cap certainty at 0.5 (S4PRED out-of-distribution)

**Scientific basis**:
- **Tier 1** (Switch Zone): The hallmark of amyloid-forming peptides — native helical structure in a region with high beta-aggregation propensity. These residues can undergo a helix-to-beta conformational switch under aggregation-promoting conditions.
- **Tier 2** (Disordered): Aggregation-prone but disordered — no stable secondary structure. May aggregate through disorder-to-order transition.
- **Tier 3** (Native Beta): Already in beta conformation at the aggregation hotspot — less likely to undergo conformational switching, but may still participate in amyloid formation.
- **Tier 4** (No Concern): Below aggregation threshold — low risk regardless of secondary structure.
- **Tier 5** (Insufficient): Cannot assess without TANGO data.

**Literature**:
- Hamodrakas, S.J. (2007). "Protein aggregation and amyloid fibril formation prediction software from primary sequence." *BMC Structural Biology*, 7(1), 1-11.
- Fernandez-Escamilla, A.M. et al. (2004). "Prediction of sequence-dependent and mutational effects on the aggregation of peptides and proteins." *Nature Biotechnology*, 22(10), 1302-1306.
- Lewis, T.E. et al. (2019). "S4PRED: Single Sequence Secondary Structure PREDiction using a deep neural network." *Bioinformatics*, 35(22), 4699-4706.

---

## Sequence Length Guidelines

| Range | TANGO | S4PRED | Recommendation |
|-------|-------|--------|----------------|
| <5 aa | Cannot run | Unreliable | Not suitable for analysis |
| 5-14 aa | Runs but limited | Unreliable | Biochemical properties only |
| 15-100 aa | Optimal | Reliable | Full analysis recommended |
| >100 aa | Accuracy degrades | Reliable | S4PRED-focused analysis |

**Optimal length**: ~40 aa (S4PRED supervised training minimum, well within TANGO's 7-50 aa sweet spot).
