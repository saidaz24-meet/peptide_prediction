# Embedding Model Evaluation for PVL Peptide Similarity Search — Research Brief

**Brief ID**: RB-003
**Date**: 2026-05-12
**Author**: T-RES (research terminal)
**Mission**: Determine which embedding model gives best results for peptide sequence similarity in PVL's `POST /api/peptides/similar` endpoint, and lock the choice before reindexing pain accumulates.
**Reading time**: ~10 minutes

---

## §1 — TL;DR (5 bullets)

- **all-MiniLM-L6-v2 is scientifically invalid for peptide similarity** and must be replaced. It was trained on 1 billion English sentence pairs; it has no biological token vocabulary and produces embeddings that capture character-frequency patterns rather than evolutionary, structural, or functional relationships between amino acids. Any nearest-neighbor result from it is biologically meaningless.
- **ESM-2 (8M variant) is the correct replacement.** Trained on 250 million protein sequences from UniRef50, produces biologically grounded embeddings, runs CPU-only, fits comfortably within Hetzner CX33's 8 GB RAM. ~30–35 MB on disk, ~150–250 MB RAM loaded, MIT license.
- **The short-peptide gap is real but manageable with ESM-2.** Only 2.8% of UniRef sequences are <50 residues (PepBERT paper, 2025), so ESM-2 wasn't trained primarily on short peptides. However, residue-level tokenization plus mean pooling still produces coherent embeddings for ≥5 AA peptides — unlike MiniLM which treats single-letter amino acid codes as arbitrary English letters.
- **PepBERT (4.9M, peptide-specific, April 2025 preprint) is scientifically ideal** and outperforms ESM-2 8M on 8 of 9 peptide-specific tasks, but has no stable pip package, no ecosystem support — too immature for solo-maintained production tool.
- **Paid API embeddings (Anthropic, OpenAI, Cohere) violate ADR-011** offline-first requirement and create per-query online dependency. Rejected as primary options.

---

## §2 — Context

T2 shipped Section D (commit `8e907fc`) using `sentence-transformers/all-MiniLM-L6-v2` (384-dim) as provisional embedding. ADR-016 locked LanceDB but left embedding open. Switching now requires reindex of LanceDB — one-time cost. Switching later compounds with every ingest. M-004 from `_INDEX.md`.

---

## §3 — Options evaluated

### Option A — all-MiniLM-L6-v2 (current — generic English LM) — REJECT

- **What it is**: 6-layer MiniLM distilled from BERT, fine-tuned on 1 billion English sentence pairs. 384-dim. ~80 MB.
- **License + cost**: Apache 2.0. $0.
- **Fit for PVL**: None. Model has no amino acid vocabulary, no evolutionary/structural priors. Two peptides with similar letter frequencies (both lysine-rich, e.g. `KKKK...`) cluster with English words containing many "K"s. **Correctness failure, not a tradeoff.**

### Option B — ESM-2 8M (`facebook/esm2_t6_8M_UR50D`) — RECOMMENDED

- **What it is**: Smallest ESM-2 checkpoint (Lin et al., Science 2023). 6 layers, 320-dim residue embeddings. Trained on 250M UniRef50 sequences via masked LM. 7.84M parameters.
- **License + cost**: MIT. $0.
- **Maturity**: Science 2023 paper (doi:10.1126/science.ade2574). 19k+ GitHub stars. HuggingFace transformers integration stable.
- **Fit for PVL**: Strong. ~30–35 MB disk, ~150–250 MB RAM loaded. CPU inference ~10–50 ms per 5–100 AA peptide. Fits CX33 with ~3 GB headroom.
- **Short peptide quality**: Residue-level tokenization makes embeddings coherent even on short sequences. Less training data on <50 AA but still biologically grounded.
- **Migration cost**: ~3–5h. Replace embed call, reindex LanceDB, change schema dim 384 → 320.

### Option C — ESM-2 35M — Acceptable alternative

- ~140 MB disk, ~600–700 MB RAM, ~100–300 ms inference. Fits CX33 but with less headroom. Marginally better quality on 50+ AA peptides. Use if 8M proves insufficient.

### Option D — ESM-2 150M / 650M — REJECT (too large)

150M is ~2 GB RAM, 650M is ~3 GB. Pushes CX33 budget past safe limits when running alongside FastAPI + workers.

### Option E — ESM-1b — REJECT

Strictly dominated by ESM-2 on all benchmarks. ~2.5 GB RAM.

### Option F — ProtBert — REJECT

420M params, ~1.7 GB RAM. ESM-2 outperforms ProtBert by 52% on binding-site MCC (Zhang 2024). Heavier and worse.

### Option G — ProtGPT2 — REJECT

Decoder-only architecture; not designed for sequence embeddings. Wrong tool for the task.

### Option H — Paid APIs (Anthropic, OpenAI, Cohere) — REJECT

Violate ADR-011 (offline-first). General-purpose text embeddings, no biological advantage over ESM-2. Per-query cost grows with scale.

### Option I — PepBERT — DEFER

Scientifically best for short peptides (8/9 tasks vs ESM-2). But April 2025 bioRxiv preprint, no stable pip release, no ecosystem. Revisit at v1.x if it stabilizes.

---

## §4 — Comparison matrix

| Criterion | MiniLM (current) | **ESM-2 8M** | ESM-2 35M | ProtBert | Paid APIs | PepBERT |
|---|---|---|---|---|---|---|
| Biological validity | None | High | High | High | None | Very High |
| RAM loaded | ~200 MB | ~150–250 MB | ~600–700 MB | ~1.7 GB | 0 (API) | TBD |
| CPU latency/peptide | ~2–5 ms | ~10–50 ms | ~100–300 ms | ~500 ms+ | ~100–300 ms | TBD |
| License/ADR-011 OK | Yes | Yes | Yes | Yes | NO | Yes |
| Solo-maintainer burden | Very Low | Very Low | Low | Low | Medium | High |
| Fits CX33 budget | Yes | Yes | Yes | Marginal | Yes | Yes |
| Peer-reviewed | No | **Yes (Science 2023)** | Yes | Yes | No | No (preprint) |
| Embedding dim | 384 | 320 | 480 | 1024 | 1024–3072 | TBD |
| Overall score (1-5) | **1 (invalid)** | **4** | 3 | 2 | 2 | 3 (immature) |

---

## §5 — Recommendation

**Adopt**: ESM-2 8M (`facebook/esm2_t6_8M_UR50D`).

**Reason**: Smallest peer-reviewed, MIT-licensed protein language model producing biologically valid embeddings grounded in 250M protein sequences. Fits CX33 budget, runs CPU-only within latency target, pip-installable via `transformers`, no separate service. Replacing all-MiniLM is a **correctness fix** — current model produces biologically meaningless results.

**When to revisit**: Track `dzjxzyd/PepBERT` on GitHub. If stable HuggingFace release lands, head-to-head test on Staphylococcus 2023 dataset. If PVL exceeds 500k peptides and latency degrades, swap to 35M variant in-place.

**Rejected** (and why): MiniLM (English-only — correctness failure); ESM-2 35M (no quality gain at PVL scale, 3–4× RAM); ESM-2 150M/650M (too large); ESM-1b (strictly dominated); ProtBert (52% worse MCC, heavier); ProtGPT2 (wrong architecture); paid APIs (ADR-011 violation); PepBERT (preprint, no pip).

---

## §6 — Implementation plan

- **Effort**: 3–5h, T2 terminal, Wave 2 §D continuation
- **Files affected**:
  - `backend/services/vector_store.py` — swap `sentence-transformers` SentenceTransformer for `transformers.AutoModel` + tokenizer, mean-pool residue embeddings → 320-dim sequence vector
  - `backend/services/vector_store.py` schema — embedding dim 384 → 320, drop+recreate `peptides` table
  - `backend/requirements.txt` — `transformers` (already transitive via sentence-transformers); can remove `sentence-transformers` after migration if unused elsewhere
  - `backend/tests/test_vector_store.py` — update assertions for 320-dim
  - One-time `python -m backend.scripts.reindex_lance` to regenerate vectors over existing peptides
- **New ADR**: ADR-017 (drafted §7)
- **MASTER_DEV_DOC**: add note "ESM-2 8M is production embedding model per ADR-017"
- **Tech radar**: ESM-2 8M → "adopt-now"; PepBERT → "watch"

---

## §7 — Proposed ADR draft

```markdown
## ADR-017 — Embedding model: ESM-2 8M (supersedes provisional all-MiniLM-L6-v2)
**Date**: 2026-05-12 · **Status**: PROPOSED · **Author**: T-RES + Said
**Context**: LanceDB adopted (ADR-016). Provisional model all-MiniLM-L6-v2 trained on English text — produces biologically meaningless embeddings on amino acid sequences. Correctness failure, not tradeoff.
**Decision**: Use ESM-2 8M (facebook/esm2_t6_8M_UR50D, MIT) as production embedding. 320-dim. CPU-only. Lazy-load at first embed call. Mean-pool residue embeddings → sequence vector.
**Reasoning**: Smallest peer-reviewed protein LM with biological grounding (250M UniRef50 sequences). Fits CX33 budget. No GPU. No API. No separate service. PepBERT marginally better scientifically but immature (April 2025 preprint).
**Implication**: Reindex entire LanceDB. Schema dim 384 → 320 (drop+recreate). Future upgrade: PepBERT if it stabilizes; ESM-2 35M if latency degrades at >500k peptides.
**Evidence**: RB-003.
```

---

## §8 — Sources cited

1. Lin, Z. et al. "Evolutionary-scale prediction of atomic-level protein structure with a language model." *Science* 379, 1123–1130 (2023). https://www.science.org/doi/10.1126/science.ade2574
2. Shen, D. et al. "PepBERT: Lightweight language models for bioactive peptide representation." bioRxiv (2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC12236832/
3. Sanderson, T. et al. "Medium-sized protein language models perform well at transfer learning on realistic datasets." *Scientific Reports* (2025). https://www.nature.com/articles/s41598-025-05674-x
4. Zhang, Y. et al. "FusPB-ESM2: Fusion of ProtBERT and ESM-2 for cell-penetrating peptide prediction." *Computational Biology and Chemistry* (2024). https://www.sciencedirect.com/science/article/abs/pii/S1476927124000860
5. BioLM ESM-2 35M deployment specs. https://biolm.ai/models/esm2-35m/
6. HuggingFace model card: facebook/esm2_t6_8M_UR50D. https://huggingface.co/facebook/esm2_t6_8M_UR50D
7. Hacker News practitioner consensus on all-MiniLM-L6-v2 obsolescence. https://news.ycombinator.com/item?id=46081800
8. Comparative Assessment of Protein Large Language Models. *PMC* (2025). https://pmc.ncbi.nlm.nih.gov/articles/PMC11866580/

---

## §9 — Open questions / things to revisit

- **PepBERT stability** (Q4 2026): head-to-head against ESM-2 8M on Staph 2023 dataset if HuggingFace release stabilizes.
- **ESM-2 fine-tuning on aggregation peptides** (long-term): ~20h effort; out of scope for solo MIT-semester.
- **Reindex script ergonomics** (T2 action): document the reindex command in DEPLOYMENT.md; possibly auto-run on startup if dim mismatch detected.
- **Cold-start latency**: ESM-2 weights load at first embed call (lazy). Verify FastAPI health check tolerates ~2s first-call delay; otherwise warmup at startup.

---

## §10 — Cross-references

- Affects: ADR-016 (LanceDB embedding dim update 384 → 320)
- Affects: ADR-011 (MIT OSS compliance — confirmed)
- Supersedes: provisional all-MiniLM-L6-v2 in T2-INSTRUCTIONS §D
- Proposes: ADR-017
- Related: RB-002 (vector store)
- Affects: MASTER_PUSH_PLAN Wave 2 §D (embedding swap + one-time reindex)
