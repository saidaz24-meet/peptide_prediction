"""Tests for the DuckDB-backed provider result cache."""

import json
import os

import pandas as pd
import pytest

os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _reset_read_conn():
    """Close and clear the thread-local read connection so the next call
    opens a fresh connection against whatever DB_PATH currently points to."""
    from services import provider_cache

    conn = getattr(provider_cache._read_local, "conn", None)
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass
    provider_cache._read_local.conn = None
    provider_cache._read_local.path = None


def _make_minimal_df(sequences: list) -> pd.DataFrame:
    """Return a DataFrame with a 'Sequence' column and RangeIndex."""
    return pd.DataFrame({"Sequence": sequences})


def _make_tango_entry(sequence: str) -> dict:
    """Minimal provider cache entry with only tango data populated."""
    tango_data = {
        "SSW fragments": 2,
        "SSW score": 0.75,
        "SSW diff": 0.1,
        "SSW helix percentage": 0.5,
        "SSW beta percentage": 0.3,
        "Tango Beta curve": [0.1, 0.2],
        "Tango Helix curve": [0.3, 0.4],
        "Tango Turn curve": [0.05, 0.05],
        "Tango Aggregation curve": [0.6, 0.7],
        "Tango has data": True,
        "Tango Beta max": 0.2,
        "Tango Helix max": 0.4,
        "Tango Aggregation max": 0.7,
        "Tango attempted": True,
    }
    biochem_data = {
        "Charge": 1.0,
        "Hydrophobicity": 0.4,
        "Full length uH": 0.3,
        "Helix (Jpred) uH": None,
        "Beta full length uH": 0.2,
    }
    return {
        "sequence": sequence,
        "tango_json": json.dumps(tango_data),
        "s4pred_json": None,
        "biochem_json": json.dumps(biochem_data),
        "ff_helix_json": None,
    }


def _make_full_entry(sequence: str) -> dict:
    """Provider cache entry with all four provider blocks populated."""
    tango_data = {
        "SSW fragments": 1,
        "SSW score": 0.8,
        "SSW diff": 0.05,
        "SSW helix percentage": 0.6,
        "SSW beta percentage": 0.2,
        "Tango Beta curve": [0.1],
        "Tango Helix curve": [0.5],
        "Tango Turn curve": [0.1],
        "Tango Aggregation curve": [0.8],
        "Tango has data": True,
        "Tango Beta max": 0.1,
        "Tango Helix max": 0.5,
        "Tango Aggregation max": 0.8,
        "Tango attempted": True,
    }
    s4pred_data = {
        "Helix prediction (S4PRED)": "HHH",
        "Helix fragments (S4PRED)": 1,
        "Helix score (S4PRED)": 0.9,
        "Helix percentage (S4PRED)": 60.0,
        "SSW fragments (S4PRED)": 1,
        "SSW score (S4PRED)": 0.7,
        "SSW diff (S4PRED)": 0.1,
        "SSW helix percentage (S4PRED)": 0.6,
        "SSW beta percentage (S4PRED)": 0.2,
        "SSW percentage (S4PRED)": 50.0,
        "S4PRED P_H curve": [0.9, 0.8],
        "S4PRED P_E curve": [0.05, 0.1],
        "S4PRED P_C curve": [0.05, 0.1],
        "S4PRED SS prediction": "HH",
    }
    biochem_data = {
        "Charge": 2.0,
        "Hydrophobicity": 0.55,
        "Full length uH": 0.4,
        "Helix (Jpred) uH": None,
        "Beta full length uH": 0.3,
    }
    ff_data = {
        "FF-Helix %": 33.3,
        "FF Helix fragments": 1,
    }
    return {
        "sequence": sequence,
        "tango_json": json.dumps(tango_data),
        "s4pred_json": json.dumps(s4pred_data),
        "biochem_json": json.dumps(biochem_data),
        "ff_helix_json": json.dumps(ff_data),
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path, monkeypatch):
    """Each test gets its own temp DB.  The thread-local read connection is
    cleared before and after so tests never share a stale handle."""
    from services import provider_cache

    _reset_read_conn()

    monkeypatch.setattr(provider_cache, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(provider_cache, "DB_PATH", tmp_path / "provider_cache.duckdb")
    monkeypatch.setattr(provider_cache, "LOCK_PATH", tmp_path / "provider_cache.lock")

    yield

    _reset_read_conn()


# ---------------------------------------------------------------------------
# 1. seq_hash — consistency across case and whitespace variants
# ---------------------------------------------------------------------------


class TestSeqHash:
    def test_same_sequence_same_hash(self):
        from services.provider_cache import seq_hash

        assert seq_hash("MRWQEMGYIFYPRKLR") == seq_hash("MRWQEMGYIFYPRKLR")

    def test_lowercase_same_as_uppercase(self):
        from services.provider_cache import seq_hash

        assert seq_hash("mrwqemgyifyprklr") == seq_hash("MRWQEMGYIFYPRKLR")

    def test_leading_trailing_whitespace_stripped(self):
        from services.provider_cache import seq_hash

        assert seq_hash("  MRWQEMGYIFYPRKLR  ") == seq_hash("MRWQEMGYIFYPRKLR")

    def test_mixed_case_and_whitespace(self):
        from services.provider_cache import seq_hash

        assert seq_hash("  mrwQEMGYIfyPRKLR  ") == seq_hash("MRWQEMGYIFYPRKLR")

    def test_different_sequences_differ(self):
        from services.provider_cache import seq_hash

        assert seq_hash("AAAA") != seq_hash("MRWQEMGYIFYPRKLR")

    def test_hash_is_32_chars(self):
        from services.provider_cache import seq_hash

        h = seq_hash("AAAA")
        assert len(h) == 32


# ---------------------------------------------------------------------------
# 2. bulk_get_provider_cache — empty result for unknown sequences
# ---------------------------------------------------------------------------


class TestBulkGetEmpty:
    def test_unknown_sequence_returns_empty_dict(self):
        from services.provider_cache import bulk_get_provider_cache

        result = bulk_get_provider_cache(["UNKNOWNSEQ"])
        assert result == {}

    def test_empty_list_returns_empty_dict(self):
        from services.provider_cache import bulk_get_provider_cache

        result = bulk_get_provider_cache([])
        assert result == {}

    def test_list_of_empty_strings_returns_empty_dict(self):
        from services.provider_cache import bulk_get_provider_cache

        result = bulk_get_provider_cache(["", "   "])
        assert result == {}


# ---------------------------------------------------------------------------
# 3. bulk_set + bulk_get roundtrip — 3 entries, verify JSON
# ---------------------------------------------------------------------------


class TestBulkRoundtrip:
    def test_three_entry_roundtrip(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            bulk_set_provider_cache,
            seq_hash,
        )

        sequences = ["AAAA", "CCCC", "GGGG"]
        entries = [_make_full_entry(s) for s in sequences]

        written = bulk_set_provider_cache(entries)
        assert written == 3

        result = bulk_get_provider_cache(sequences)
        assert len(result) == 3

        for seq in sequences:
            h = seq_hash(seq)
            assert h in result
            entry = result[h]
            assert entry["tango"] is not None
            assert entry["s4pred"] is not None
            assert entry["biochem"] is not None

    def test_tango_values_preserved(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            bulk_set_provider_cache,
            seq_hash,
        )

        seq = "TESTSEQ"
        entry = _make_full_entry(seq)
        bulk_set_provider_cache([entry])

        result = bulk_get_provider_cache([seq])
        h = seq_hash(seq)
        tango = result[h]["tango"]

        assert tango["Tango has data"] is True
        assert tango["Tango Aggregation max"] == pytest.approx(0.8)
        assert isinstance(tango["Tango Aggregation curve"], list)

    def test_case_normalisation_in_roundtrip(self):
        """Sequence stored as uppercase must be retrievable via lowercase."""
        from services.provider_cache import (
            bulk_get_provider_cache,
            bulk_set_provider_cache,
            seq_hash,
        )

        bulk_set_provider_cache([_make_full_entry("AACC")])
        result = bulk_get_provider_cache(["aacc"])
        assert seq_hash("AACC") in result

    def test_overwrite_replaces_entry(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            bulk_set_provider_cache,
            seq_hash,
        )

        seq = "OVERWRITE"
        original = _make_full_entry(seq)
        updated = dict(original)
        new_tango = json.loads(original["tango_json"])
        new_tango["Tango Aggregation max"] = 0.99
        updated["tango_json"] = json.dumps(new_tango)

        bulk_set_provider_cache([original])
        bulk_set_provider_cache([updated])

        result = bulk_get_provider_cache([seq])
        h = seq_hash(seq)
        assert result[h]["tango"]["Tango Aggregation max"] == pytest.approx(0.99)


# ---------------------------------------------------------------------------
# 4. Partial provider caching — write tango only, s4pred must be None,
#    then update s4pred and verify it appears
# ---------------------------------------------------------------------------


class TestPartialProviderCaching:
    def test_missing_s4pred_is_none(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            bulk_set_provider_cache,
            seq_hash,
        )

        seq = "PARTIAL"
        bulk_set_provider_cache([_make_tango_entry(seq)])

        result = bulk_get_provider_cache([seq])
        h = seq_hash(seq)
        assert result[h]["s4pred"] is None

    def test_tango_present_when_s4pred_absent(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            bulk_set_provider_cache,
            seq_hash,
        )

        seq = "PARTIAL"
        bulk_set_provider_cache([_make_tango_entry(seq)])

        result = bulk_get_provider_cache([seq])
        h = seq_hash(seq)
        assert result[h]["tango"] is not None

    def test_update_adds_s4pred(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            bulk_set_provider_cache,
            seq_hash,
        )

        seq = "PARTIAL"
        # First write: only tango
        bulk_set_provider_cache([_make_tango_entry(seq)])

        # Second write: full entry (overwrites)
        bulk_set_provider_cache([_make_full_entry(seq)])

        result = bulk_get_provider_cache([seq])
        h = seq_hash(seq)
        assert result[h]["s4pred"] is not None
        assert result[h]["s4pred"]["Helix percentage (S4PRED)"] == pytest.approx(60.0)


# ---------------------------------------------------------------------------
# 5. split_cached_uncached — 5-row DataFrame, 2 hits + 3 misses
# ---------------------------------------------------------------------------


class TestSplitCachedUncached:
    def _populate_two_sequences(self, seqs_to_cache):
        from services.provider_cache import bulk_set_provider_cache

        entries = [_make_full_entry(s) for s in seqs_to_cache]
        bulk_set_provider_cache(entries)

    def test_hit_and_miss_counts(self):
        from services.provider_cache import split_cached_uncached

        all_seqs = ["AAAA", "CCCC", "GGGG", "TTTT", "KKKK"]
        cached_seqs = ["AAAA", "CCCC"]
        self._populate_two_sequences(cached_seqs)

        df = _make_minimal_df(all_seqs)
        df_hits, df_misses = split_cached_uncached(df, need_tango=True, need_s4pred=True)

        assert len(df_hits) == 2
        assert len(df_misses) == 3

    def test_hits_contain_correct_sequences(self):
        from services.provider_cache import split_cached_uncached

        all_seqs = ["AAAA", "CCCC", "GGGG", "TTTT", "KKKK"]
        self._populate_two_sequences(["AAAA", "CCCC"])

        df = _make_minimal_df(all_seqs)
        df_hits, _ = split_cached_uncached(df, need_tango=True, need_s4pred=True)

        hit_seqs = set(df_hits["Sequence"].str.upper().tolist())
        assert hit_seqs == {"AAAA", "CCCC"}

    def test_misses_contain_correct_sequences(self):
        from services.provider_cache import split_cached_uncached

        all_seqs = ["AAAA", "CCCC", "GGGG", "TTTT", "KKKK"]
        self._populate_two_sequences(["AAAA", "CCCC"])

        df = _make_minimal_df(all_seqs)
        _, df_misses = split_cached_uncached(df, need_tango=True, need_s4pred=True)

        miss_seqs = set(df_misses["Sequence"].str.upper().tolist())
        assert miss_seqs == {"GGGG", "TTTT", "KKKK"}

    def test_original_index_preserved_in_hits(self):
        from services.provider_cache import split_cached_uncached

        all_seqs = ["AAAA", "CCCC", "GGGG"]
        self._populate_two_sequences(["AAAA", "CCCC"])

        df = _make_minimal_df(all_seqs)
        df_hits, _ = split_cached_uncached(df, need_tango=True, need_s4pred=True)

        # Original RangeIndex positions 0 and 1 should be in hits
        assert set(df_hits.index).issubset({0, 1, 2})
        assert 2 not in df_hits.index  # GGGG is index 2, must be a miss

    def test_empty_df_returns_two_empty_frames(self):
        from services.provider_cache import split_cached_uncached

        df = pd.DataFrame({"Sequence": []})
        df_hits, df_misses = split_cached_uncached(df, need_tango=False, need_s4pred=False)

        assert df_hits.empty
        assert df_misses.empty

    def test_all_miss_when_cache_empty(self):
        from services.provider_cache import split_cached_uncached

        df = _make_minimal_df(["AAAA", "CCCC"])
        df_hits, df_misses = split_cached_uncached(df, need_tango=True, need_s4pred=True)

        assert df_hits.empty
        assert len(df_misses) == 2


# ---------------------------------------------------------------------------
# 6. Merge preserves row order via sort_index
# ---------------------------------------------------------------------------


class TestMergeRowOrder:
    def test_concat_sort_index_restores_original_order(self):
        from services.provider_cache import bulk_set_provider_cache, split_cached_uncached

        # Cache rows 0, 2, 4 out of 5
        seqs = ["AAAA", "BBBB", "CCCC", "DDDD", "EEEE"]
        cached = ["AAAA", "CCCC", "EEEE"]
        bulk_set_provider_cache([_make_full_entry(s) for s in cached])

        df = _make_minimal_df(seqs)
        df_hits, df_misses = split_cached_uncached(df, need_tango=True, need_s4pred=True)

        merged = pd.concat([df_hits, df_misses]).sort_index()

        # After sort_index, the Sequence column must match the original order
        assert list(merged["Sequence"]) == seqs

    def test_no_rows_lost_after_merge(self):
        from services.provider_cache import bulk_set_provider_cache, split_cached_uncached

        seqs = ["AAAA", "BBBB", "CCCC"]
        bulk_set_provider_cache([_make_full_entry("AAAA")])

        df = _make_minimal_df(seqs)
        df_hits, df_misses = split_cached_uncached(df, need_tango=True, need_s4pred=True)

        assert len(df_hits) + len(df_misses) == len(df)


# ---------------------------------------------------------------------------
# 7. Graceful degradation — read error returns {}
# ---------------------------------------------------------------------------


class TestGracefulDegradation:
    def test_read_error_returns_empty_dict(self, monkeypatch):
        from services import provider_cache

        def _bad_conn():
            raise RuntimeError("simulated read failure")

        monkeypatch.setattr(provider_cache, "_get_read_conn", _bad_conn)

        result = provider_cache.bulk_get_provider_cache(["AAAA"])
        assert result == {}

    def test_read_error_does_not_raise(self, monkeypatch):
        from services import provider_cache

        def _bad_conn():
            raise OSError("disk gone")

        monkeypatch.setattr(provider_cache, "_get_read_conn", _bad_conn)

        # Must not propagate — cache failures are non-fatal
        try:
            provider_cache.bulk_get_provider_cache(["AAAA"])
        except Exception as exc:
            pytest.fail(f"bulk_get_provider_cache raised unexpectedly: {exc}")

    def test_split_degrades_to_all_misses_on_read_error(self, monkeypatch):
        from services import provider_cache

        def _bad_conn():
            raise RuntimeError("disk error")

        monkeypatch.setattr(provider_cache, "_get_read_conn", _bad_conn)

        df = _make_minimal_df(["AAAA", "CCCC"])
        df_hits, df_misses = provider_cache.split_cached_uncached(
            df, need_tango=True, need_s4pred=True
        )

        assert df_hits.empty
        assert len(df_misses) == 2


# ---------------------------------------------------------------------------
# 8. Provider flag mismatch — cache without TANGO, need_tango=True → miss
# ---------------------------------------------------------------------------


class TestProviderFlagMismatch:
    def test_missing_tango_causes_miss_when_need_tango(self):
        from services.provider_cache import bulk_set_provider_cache, split_cached_uncached

        # Entry has s4pred + biochem but no tango
        seq = "NOTANGO"
        entry_no_tango = {
            "sequence": seq,
            "tango_json": None,
            "s4pred_json": _make_full_entry(seq)["s4pred_json"],
            "biochem_json": _make_full_entry(seq)["biochem_json"],
            "ff_helix_json": None,
        }
        bulk_set_provider_cache([entry_no_tango])

        df = _make_minimal_df([seq])
        df_hits, df_misses = split_cached_uncached(df, need_tango=True, need_s4pred=False)

        assert df_hits.empty
        assert len(df_misses) == 1

    def test_missing_tango_is_hit_when_tango_not_needed(self):
        from services.provider_cache import bulk_set_provider_cache, split_cached_uncached

        seq = "NOTANGO"
        entry_no_tango = {
            "sequence": seq,
            "tango_json": None,
            "s4pred_json": _make_full_entry(seq)["s4pred_json"],
            "biochem_json": _make_full_entry(seq)["biochem_json"],
            "ff_helix_json": None,
        }
        bulk_set_provider_cache([entry_no_tango])

        df = _make_minimal_df([seq])
        df_hits, df_misses = split_cached_uncached(df, need_tango=False, need_s4pred=True)

        assert len(df_hits) == 1
        assert df_misses.empty

    def test_missing_s4pred_causes_miss_when_need_s4pred(self):
        from services.provider_cache import bulk_set_provider_cache, split_cached_uncached

        seq = "NOS4PRED"
        bulk_set_provider_cache([_make_tango_entry(seq)])  # no s4pred_json

        df = _make_minimal_df([seq])
        df_hits, df_misses = split_cached_uncached(df, need_tango=True, need_s4pred=True)

        assert df_hits.empty
        assert len(df_misses) == 1

    def test_missing_biochem_always_causes_miss(self):
        from services.provider_cache import bulk_set_provider_cache, split_cached_uncached

        seq = "NOBIOCHEM"
        entry = _make_full_entry(seq)
        entry["biochem_json"] = None  # biochem always required for a hit

        bulk_set_provider_cache([entry])

        df = _make_minimal_df([seq])
        df_hits, df_misses = split_cached_uncached(df, need_tango=False, need_s4pred=False)

        assert df_hits.empty
        assert len(df_misses) == 1


# ---------------------------------------------------------------------------
# 9. write_computed_to_cache — DataFrame with provider columns, verify roundtrip
# ---------------------------------------------------------------------------


class TestWriteComputedToCache:
    def _make_computed_df(self) -> pd.DataFrame:
        """Minimal DataFrame that covers all four provider column groups."""
        return pd.DataFrame(
            [
                {
                    "Sequence": "MRWQEMGYIFYPRKLR",
                    # TANGO cols
                    "SSW fragments": 2,
                    "SSW score": 0.75,
                    "SSW diff": 0.1,
                    "SSW helix percentage": 0.5,
                    "SSW beta percentage": 0.3,
                    "Tango Beta curve": [0.1, 0.2],
                    "Tango Helix curve": [0.3, 0.4],
                    "Tango Turn curve": [0.05, 0.05],
                    "Tango Aggregation curve": [0.6, 0.7],
                    "Tango has data": True,
                    "Tango Beta max": 0.2,
                    "Tango Helix max": 0.4,
                    "Tango Aggregation max": 0.7,
                    "Tango attempted": True,
                    # S4PRED cols
                    "Helix prediction (S4PRED)": "HHH",
                    "Helix fragments (S4PRED)": 1,
                    "Helix score (S4PRED)": 0.9,
                    "Helix percentage (S4PRED)": 60.0,
                    "SSW fragments (S4PRED)": 1,
                    "SSW score (S4PRED)": 0.7,
                    "SSW diff (S4PRED)": 0.1,
                    "SSW helix percentage (S4PRED)": 0.6,
                    "SSW beta percentage (S4PRED)": 0.2,
                    "SSW percentage (S4PRED)": 50.0,
                    "S4PRED P_H curve": [0.9, 0.8],
                    "S4PRED P_E curve": [0.05, 0.1],
                    "S4PRED P_C curve": [0.05, 0.1],
                    "S4PRED SS prediction": "HH",
                    # Biochem cols
                    "Charge": 2.0,
                    "Hydrophobicity": 0.55,
                    "Full length uH": 0.4,
                    "Helix (Jpred) uH": None,
                    "Beta full length uH": 0.3,
                    # FF-Helix cols
                    "FF-Helix %": 33.3,
                    "FF Helix fragments": 1,
                }
            ]
        )

    def test_write_then_retrieve_via_bulk_get(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            seq_hash,
            write_computed_to_cache,
        )

        df = self._make_computed_df()
        write_computed_to_cache(df)

        result = bulk_get_provider_cache(["MRWQEMGYIFYPRKLR"])
        h = seq_hash("MRWQEMGYIFYPRKLR")
        assert h in result

    def test_tango_cols_roundtrip_via_write_computed(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            seq_hash,
            write_computed_to_cache,
        )

        df = self._make_computed_df()
        write_computed_to_cache(df)

        result = bulk_get_provider_cache(["MRWQEMGYIFYPRKLR"])
        h = seq_hash("MRWQEMGYIFYPRKLR")
        tango = result[h]["tango"]

        assert tango["Tango has data"] is True
        assert tango["Tango Aggregation max"] == pytest.approx(0.7)
        assert tango["SSW score"] == pytest.approx(0.75)

    def test_s4pred_cols_roundtrip_via_write_computed(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            seq_hash,
            write_computed_to_cache,
        )

        df = self._make_computed_df()
        write_computed_to_cache(df)

        result = bulk_get_provider_cache(["MRWQEMGYIFYPRKLR"])
        h = seq_hash("MRWQEMGYIFYPRKLR")
        s4pred = result[h]["s4pred"]

        assert s4pred["Helix prediction (S4PRED)"] == "HHH"
        assert s4pred["Helix percentage (S4PRED)"] == pytest.approx(60.0)

    def test_biochem_cols_roundtrip_via_write_computed(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            seq_hash,
            write_computed_to_cache,
        )

        df = self._make_computed_df()
        write_computed_to_cache(df)

        result = bulk_get_provider_cache(["MRWQEMGYIFYPRKLR"])
        h = seq_hash("MRWQEMGYIFYPRKLR")
        biochem = result[h]["biochem"]

        assert biochem["Charge"] == pytest.approx(2.0)
        assert biochem["Hydrophobicity"] == pytest.approx(0.55)
        assert biochem["Helix (Jpred) uH"] is None

    def test_ff_helix_cols_roundtrip_via_write_computed(self):
        from services.provider_cache import (
            bulk_get_provider_cache,
            seq_hash,
            write_computed_to_cache,
        )

        df = self._make_computed_df()
        write_computed_to_cache(df)

        result = bulk_get_provider_cache(["MRWQEMGYIFYPRKLR"])
        h = seq_hash("MRWQEMGYIFYPRKLR")
        ff = result[h]["ff_helix"]

        assert ff is not None
        assert ff["FF-Helix %"] == pytest.approx(33.3)

    def test_empty_df_does_not_raise(self):
        from services.provider_cache import write_computed_to_cache

        df = pd.DataFrame(columns=["Sequence", "Charge"])
        try:
            write_computed_to_cache(df)
        except Exception as exc:
            pytest.fail(f"write_computed_to_cache raised on empty df: {exc}")

    def test_nan_float_serialised_as_null(self):
        """NaN in a numeric column must round-trip as None, not as a string."""
        import math

        from services.provider_cache import (
            bulk_get_provider_cache,
            seq_hash,
            write_computed_to_cache,
        )

        df = self._make_computed_df().copy()
        df.at[0, "Hydrophobicity"] = float("nan")
        write_computed_to_cache(df)

        result = bulk_get_provider_cache(["MRWQEMGYIFYPRKLR"])
        h = seq_hash("MRWQEMGYIFYPRKLR")
        biochem = result[h]["biochem"]
        assert biochem["Hydrophobicity"] is None


# ---------------------------------------------------------------------------
# 10. provider_cache_stats — insert rows, verify counts
# ---------------------------------------------------------------------------


class TestProviderCacheStats:
    def test_stats_empty_db(self):
        from services.provider_cache import provider_cache_stats

        stats = provider_cache_stats()
        assert stats["total_entries"] == 0
        assert stats.get("error") is None or "error" not in stats

    def test_total_entries_after_inserts(self):
        from services.provider_cache import bulk_set_provider_cache, provider_cache_stats

        entries = [_make_full_entry("AAAA"), _make_full_entry("CCCC"), _make_full_entry("GGGG")]
        bulk_set_provider_cache(entries)

        stats = provider_cache_stats()
        assert stats["total_entries"] == 3

    def test_entries_with_tango_count(self):
        from services.provider_cache import bulk_set_provider_cache, provider_cache_stats

        # 2 with tango, 1 without
        entries = [
            _make_full_entry("AAAA"),
            _make_full_entry("CCCC"),
            _make_tango_entry("GGGG"),  # this one has tango
        ]
        # Overwrite GGGG with no-tango
        entries[2]["tango_json"] = None
        bulk_set_provider_cache(entries)

        stats = provider_cache_stats()
        assert stats["entries_with_tango"] == 2

    def test_entries_with_s4pred_count(self):
        from services.provider_cache import bulk_set_provider_cache, provider_cache_stats

        entry_no_s4 = _make_full_entry("KKKK")
        entry_no_s4["s4pred_json"] = None

        bulk_set_provider_cache([_make_full_entry("AAAA"), entry_no_s4])

        stats = provider_cache_stats()
        assert stats["entries_with_s4pred"] == 1

    def test_entries_with_biochem_count(self):
        from services.provider_cache import bulk_set_provider_cache, provider_cache_stats

        entry_no_bio = _make_full_entry("FFFF")
        entry_no_bio["biochem_json"] = None

        bulk_set_provider_cache([_make_full_entry("AAAA"), entry_no_bio])

        stats = provider_cache_stats()
        assert stats["entries_with_biochem"] == 1

    def test_db_size_bytes_nonzero_after_inserts(self):
        from services.provider_cache import bulk_set_provider_cache, provider_cache_stats

        bulk_set_provider_cache([_make_full_entry("AAAA")])
        stats = provider_cache_stats()
        assert stats["db_size_bytes"] > 0

    def test_duplicate_insert_does_not_inflate_count(self):
        from services.provider_cache import bulk_set_provider_cache, provider_cache_stats

        entry = _make_full_entry("AAAA")
        bulk_set_provider_cache([entry])
        bulk_set_provider_cache([entry])  # same key → replace, not insert

        stats = provider_cache_stats()
        assert stats["total_entries"] == 1
