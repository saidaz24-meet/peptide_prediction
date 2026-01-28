"""
Sequence-based caching for peptide predictions.

Principle C: Add caching early by sequence hash.
Cache key = hash(sequence) to enable future precompute without heavy infra.
"""
import hashlib
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
import pickle

# Cache directory (in backend/cache/)
CACHE_DIR = Path(__file__).parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def sequence_hash(sequence: str) -> str:
    """
    Generate deterministic hash for a sequence.
    Uses SHA256 for collision resistance.
    """
    seq_normalized = sequence.strip().upper()
    return hashlib.sha256(seq_normalized.encode('utf-8')).hexdigest()[:16]  # 16 chars = 64 bits


def cache_key(sequence: str, provider: Optional[str] = None) -> str:
    """
    Generate cache key for a sequence (and optional provider).
    
    Args:
        sequence: Amino acid sequence
        provider: Optional provider name (e.g., "tango", "psipred") for provider-specific caching
    
    Returns:
        Cache key string (filename-safe)
    """
    seq_hash = sequence_hash(sequence)
    if provider:
        return f"{provider}_{seq_hash}.pkl"
    return f"peptide_{seq_hash}.pkl"


def get_cache_path(key: str) -> Path:
    """Get full path to cache file for a key"""
    return CACHE_DIR / key


def cache_get(key: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve cached result for a key.
    
    Returns:
        Cached data dict or None if not found/invalid
    """
    cache_file = get_cache_path(key)
    if not cache_file.exists():
        return None
    
    try:
        with open(cache_file, 'rb') as f:
            return pickle.load(f)
    except Exception as e:
        # Cache corruption - remove bad file
        print(f"[CACHE][WARN] Failed to load cache {key}: {e}")
        try:
            cache_file.unlink()
        except Exception:
            pass
        return None


def cache_set(key: str, data: Dict[str, Any], ttl_seconds: Optional[int] = None) -> None:
    """
    Store data in cache.
    
    Args:
        key: Cache key (from cache_key())
        data: Data to cache (must be serializable)
        ttl_seconds: Optional TTL (not implemented yet - cache persists until manually cleared)
    """
    cache_file = get_cache_path(key)
    try:
        # Store with metadata
        cache_data = {
            "data": data,
            "cached_at": None,  # Could add timestamp for TTL
        }
        with open(cache_file, 'wb') as f:
            pickle.dump(cache_data, f)
    except Exception as e:
        print(f"[CACHE][WARN] Failed to write cache {key}: {e}")


def cache_clear(sequence: Optional[str] = None) -> int:
    """
    Clear cache entries.
    
    Args:
        sequence: If provided, clear only cache for this sequence. Otherwise clear all.
    
    Returns:
        Number of files deleted
    """
    if sequence:
        key = cache_key(sequence)
        cache_file = get_cache_path(key)
        if cache_file.exists():
            cache_file.unlink()
            return 1
        return 0
    else:
        # Clear all
        count = 0
        for cache_file in CACHE_DIR.glob("*.pkl"):
            try:
                cache_file.unlink()
                count += 1
            except Exception:
                pass
        return count

