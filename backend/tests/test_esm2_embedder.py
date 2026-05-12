"""Real-model smoke tests for the ESM-2 8M embedder (ADR-017, D-fix).

These are the "is the embedder biologically valid?" tests — they download
``facebook/esm2_t6_8M_UR50D`` (~30 MB) on first run and load it into RAM
(~150-250 MB). They are skipped automatically when ``transformers`` / ``torch``
are not importable so CI environments without ML deps still go green.

Deterministic LanceDB seam tests live in ``test_vector_store.py`` and use a
4-dim fake embedder via ``vector_store.set_embedder(...)`` — that file does
NOT exercise the real model.
"""

from __future__ import annotations

import os
import time

import pytest

# Disable PVL providers so importing the FastAPI app stays fast.
os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")

# Skip the entire module if either transformers or torch are unavailable —
# saves CI cycles and keeps the existing 484-test baseline green on minimal
# Python environments.
transformers = pytest.importorskip("transformers")
torch = pytest.importorskip("torch")  # noqa: F401 — imported for skip side effect

from config import settings  # noqa: E402
from services import vector_store  # noqa: E402


@pytest.fixture(scope="module")
def real_esm2_embedder():
    """Build the real ESM-2 embedder once for the whole module.

    Scope ``module`` so we pay the ~1-2 s model-load cost once. The fixture
    also pins ``VECTOR_DIM`` to the real ESM-2 output dimension (320) so
    ``index_peptide`` doesn't reject embeddings as dim-mismatched.
    """
    # Reset cached state so any prior fake embedder from another test file
    # is cleared and ``_ensure_embedder`` builds the real one from scratch.
    vector_store.reset_for_tests()
    embedder = vector_store._build_local_esm2_embedder()
    yield embedder
    vector_store.reset_for_tests()


def test_default_settings_match_adr_017():
    """The shipped defaults must encode ADR-017 — anyone running PVL out of
    the box gets ESM-2 8M @ 320-dim, not the rejected MiniLM @ 384-dim."""
    assert settings.EMBEDDING_PROVIDER in ("local-esm2-8m", "local-esm2")
    assert settings.EMBEDDING_MODEL_NAME == "facebook/esm2_t6_8M_UR50D"
    assert settings.VECTOR_DIM == 320


def test_embedding_dimension_is_320(real_esm2_embedder):
    """Smoke: ESM-2 t6 last_hidden_state width is 320 → that's our sequence dim."""
    vec = real_esm2_embedder("GIGAVLKVLTTGLPALISWIKRKRQQ")
    assert isinstance(vec, list)
    assert len(vec) == 320
    assert all(isinstance(x, float) for x in vec)


def test_embedding_is_l2_normalized(real_esm2_embedder):
    """``_build_local_esm2_embedder`` normalizes so Lance's L2 index ≡ cosine."""
    import math

    vec = real_esm2_embedder("AAKKAA")
    norm_sq = sum(x * x for x in vec)
    assert math.isclose(norm_sq, 1.0, rel_tol=1e-3, abs_tol=1e-3)


def _cosine_distance(a: list[float], b: list[float]) -> float:
    """Cosine distance on L2-normalized vectors == 1 - dot product."""
    dot = sum(x * y for x, y in zip(a, b))
    return 1.0 - dot


def test_charge_difference_separates_embeddings(real_esm2_embedder):
    """Lysine-rich (positive) vs glutamate-rich (negative) peptides must end
    up further apart than two identical sequences. This is the canary that
    the model captures real biochemistry, not letter-frequency noise (the
    MiniLM correctness failure RB-003 identified)."""
    k_vec = real_esm2_embedder("KKKKK")
    e_vec = real_esm2_embedder("EEEEE")
    k_vec_again = real_esm2_embedder("KKKKK")

    d_identical = _cosine_distance(k_vec, k_vec_again)
    d_charge = _cosine_distance(k_vec, e_vec)

    # Identical sequences are essentially distance 0.
    assert d_identical < 1e-4
    # KKKKK vs EEEEE should be meaningfully further apart than KKKKK vs itself.
    assert d_charge > d_identical + 0.01


def test_homologous_peptides_cluster_closer_than_unrelated(real_esm2_embedder):
    """Two short homologs (IKRKR / IKRKRQ — same charge motif, length differs
    by one residue) should be closer than either is to GGGGG. This is the
    "does the embedding capture sequence similarity" check."""
    a = real_esm2_embedder("IKRKR")
    b = real_esm2_embedder("IKRKRQ")
    far = real_esm2_embedder("GGGGG")

    d_homologs = _cosine_distance(a, b)
    d_a_far = _cosine_distance(a, far)
    d_b_far = _cosine_distance(b, far)

    assert d_homologs < d_a_far, (
        f"homologs (IKRKR↔IKRKRQ, d={d_homologs:.4f}) should be closer than "
        f"IKRKR↔GGGGG (d={d_a_far:.4f})"
    )
    assert d_homologs < d_b_far


def test_embed_latency_under_500ms_for_50aa(real_esm2_embedder):
    """Sanity check that ESM-2 8M on CPU stays under the <500 ms target for
    a 50-AA peptide. Not strict — first call may include lazy-load already
    paid for in the fixture; we measure a fresh embed."""
    seq = "AILMVAILMVAILMVAILMVAILMVAILMVAILMVAILMVAILMVAILMV"  # 50 AA
    assert len(seq) == 50
    started = time.perf_counter()
    vec = real_esm2_embedder(seq)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert len(vec) == 320
    # Allow generous headroom — on a busy CI box the model can run slower.
    # The point is to catch a 5-second regression, not a 100ms drift.
    assert elapsed_ms < 5_000, f"embed took {elapsed_ms:.0f} ms (target <500 ms)"


def test_provider_lookup_disables_on_unknown_provider(monkeypatch):
    """If ``EMBEDDING_PROVIDER`` is set to something we don't recognize, the
    vector store should mark itself disabled with a clear reason — and the
    rest of PVL must keep working (best-effort indexing contract)."""
    monkeypatch.setattr(settings, "EMBEDDING_PROVIDER", "unknown-provider")
    vector_store.reset_for_tests()

    embedder = vector_store._ensure_embedder()
    assert embedder is None
    reason = vector_store.disabled_reason()
    assert reason is not None
    assert "Unsupported EMBEDDING_PROVIDER" in reason

    # And index_peptide must short-circuit cleanly.
    assert vector_store.index_peptide({"id": "X", "sequence": "AAAA"}) is False
    vector_store.reset_for_tests()
