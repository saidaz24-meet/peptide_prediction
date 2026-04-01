"""Tests for the DuckDB-backed prediction result cache."""

import os

import pytest

os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")


@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path, monkeypatch):
    """Each test gets its own temp DB so tests don't interfere."""
    monkeypatch.setattr("services.result_cache.CACHE_DIR", tmp_path)
    monkeypatch.setattr("services.result_cache.DB_PATH", tmp_path / "predictions.duckdb")


class TestCacheKey:
    def test_consistent_hash(self):
        from services.result_cache import cache_key

        k1 = cache_key("ACDEFG")
        k2 = cache_key("ACDEFG")
        assert k1 == k2

    def test_case_insensitive(self):
        from services.result_cache import cache_key

        assert cache_key("acdefg") == cache_key("ACDEFG")

    def test_strips_whitespace(self):
        from services.result_cache import cache_key

        assert cache_key("  ACDEFG  ") == cache_key("ACDEFG")

    def test_different_sequences_differ(self):
        from services.result_cache import cache_key

        assert cache_key("ACDEFG") != cache_key("GHIJKL")

    def test_different_thresholds_produce_different_keys(self):
        from services.result_cache import cache_key

        k1 = cache_key("ACDEFG", {"mode": "default"})
        k2 = cache_key("ACDEFG", {"mode": "strict"})
        assert k1 != k2

    def test_none_threshold_same_as_no_threshold(self):
        from services.result_cache import cache_key

        assert cache_key("ACDEFG", None) == cache_key("ACDEFG")


class TestCacheRoundtrip:
    def test_miss_returns_none(self):
        from services.result_cache import get_cached

        assert get_cached("nonexistent_key") is None

    def test_set_then_get(self):
        from services.result_cache import cache_key, get_cached, set_cached

        key = cache_key("TESTSEQ")
        payload = {"row": {"sequence": "TESTSEQ", "score": 0.5}, "meta": {"ok": True}}
        set_cached(key, "TESTSEQ", payload)
        result = get_cached(key)
        assert result == payload

    def test_overwrite_existing(self):
        from services.result_cache import cache_key, get_cached, set_cached

        key = cache_key("OVERWRITE")
        set_cached(key, "OVERWRITE", {"v": 1})
        set_cached(key, "OVERWRITE", {"v": 2})
        assert get_cached(key) == {"v": 2}

    def test_multiple_entries(self):
        from services.result_cache import cache_key, get_cached, set_cached

        k1 = cache_key("SEQ_A")
        k2 = cache_key("SEQ_B")
        set_cached(k1, "SEQ_A", {"a": True})
        set_cached(k2, "SEQ_B", {"b": True})
        assert get_cached(k1) == {"a": True}
        assert get_cached(k2) == {"b": True}


class TestCacheStats:
    def test_cache_stats_empty(self):
        from services.result_cache import cache_stats

        stats = cache_stats()
        assert stats["total_entries"] == 0

    def test_cache_stats_after_insert(self):
        from services.result_cache import cache_key, cache_stats, set_cached

        set_cached(cache_key("A"), "A", {"x": 1})
        set_cached(cache_key("B"), "B", {"x": 2})
        stats = cache_stats()
        assert stats["total_entries"] == 2
