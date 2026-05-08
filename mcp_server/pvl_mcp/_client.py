"""Thin httpx wrapper around the PVL REST API.

Tools call ``request(method, path, ...)`` rather than touching httpx directly,
which keeps tool implementations focused on shaping inputs/outputs and gives
tests a single seam to mock.

Configuration is environment-driven so an MCP client (e.g. Claude Desktop)
can point the same server at staging/production by setting ``PVL_API_URL`` in
its config file.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_TIMEOUT_SECONDS = 60.0


def get_base_url() -> str:
    """Return the configured PVL backend base URL (no trailing slash)."""
    return os.environ.get("PVL_API_URL", DEFAULT_BASE_URL).rstrip("/")


def get_timeout() -> float:
    """Return the configured HTTP timeout in seconds."""
    raw = os.environ.get("PVL_API_TIMEOUT")
    if raw is None:
        return DEFAULT_TIMEOUT_SECONDS
    try:
        return float(raw)
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS


class PVLAPIError(RuntimeError):
    """Raised when the PVL backend returns an error status or is unreachable.

    The string form is intended for the LLM — it should explain what went
    wrong in plain language so the model can decide whether to retry, ask
    the user to start the backend, or surface the error verbatim.
    """

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


async def request(
    method: str,
    path: str,
    *,
    params: Optional[dict[str, Any]] = None,
    json: Optional[Any] = None,
    data: Optional[dict[str, Any]] = None,
    files: Optional[dict[str, Any]] = None,
    headers: Optional[dict[str, str]] = None,
    timeout: Optional[float] = None,
) -> Any:
    """Send a request to the PVL backend and return parsed JSON.

    Tests monkeypatch this function to avoid real network calls — see
    ``tests/test_tools.py``.
    """
    url = f"{get_base_url()}{path}"
    effective_timeout = timeout if timeout is not None else get_timeout()
    async with httpx.AsyncClient(timeout=effective_timeout) as client:
        try:
            response = await client.request(
                method=method,
                url=url,
                params=params,
                json=json,
                data=data,
                files=files,
                headers=headers,
            )
        except httpx.ConnectError as exc:
            raise PVLAPIError(
                f"Could not reach PVL backend at {get_base_url()} ({exc}). "
                "Is the FastAPI server running? Set PVL_API_URL if it lives elsewhere."
            ) from exc
        except httpx.TimeoutException as exc:
            raise PVLAPIError(
                f"PVL backend timed out after {effective_timeout}s ({exc}). "
                "Long analyses may need PVL_API_TIMEOUT raised."
            ) from exc

        if response.status_code >= 400:
            detail: Any
            try:
                detail = response.json()
            except ValueError:
                detail = response.text
            raise PVLAPIError(
                f"PVL backend returned {response.status_code} for {method} {path}: {detail}",
                status_code=response.status_code,
            )

        if not response.content:
            return None
        try:
            return response.json()
        except ValueError as exc:
            raise PVLAPIError(
                f"PVL backend returned non-JSON response for {method} {path}: {exc}"
            ) from exc


__all__ = [
    "DEFAULT_BASE_URL",
    "DEFAULT_TIMEOUT_SECONDS",
    "PVLAPIError",
    "get_base_url",
    "get_timeout",
    "request",
]
