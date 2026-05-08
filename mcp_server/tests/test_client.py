"""Tests for ``pvl_mcp._client`` — the thin httpx wrapper."""

from __future__ import annotations

import httpx
import pytest

from pvl_mcp import _client


def test_get_base_url_default(monkeypatch):
    monkeypatch.delenv("PVL_API_URL", raising=False)
    assert _client.get_base_url() == _client.DEFAULT_BASE_URL


def test_get_base_url_strips_trailing_slash(monkeypatch):
    monkeypatch.setenv("PVL_API_URL", "https://pvl.example.com/")
    assert _client.get_base_url() == "https://pvl.example.com"


def test_get_timeout_default(monkeypatch):
    monkeypatch.delenv("PVL_API_TIMEOUT", raising=False)
    assert _client.get_timeout() == _client.DEFAULT_TIMEOUT_SECONDS


def test_get_timeout_falls_back_on_invalid(monkeypatch):
    monkeypatch.setenv("PVL_API_TIMEOUT", "not-a-number")
    assert _client.get_timeout() == _client.DEFAULT_TIMEOUT_SECONDS


def test_get_timeout_parses_float(monkeypatch):
    monkeypatch.setenv("PVL_API_TIMEOUT", "5.5")
    assert _client.get_timeout() == 5.5


@pytest.mark.asyncio
async def test_request_returns_parsed_json(monkeypatch):
    """``request`` should return parsed JSON for 2xx responses."""

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        return httpx.Response(200, json={"ok": True, "version": "0.1.0"})

    transport = httpx.MockTransport(handler)

    class _MockClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
    out = await _client.request("GET", "/api/version")
    assert out == {"ok": True, "version": "0.1.0"}


@pytest.mark.asyncio
async def test_request_raises_pvlapi_error_on_4xx(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422, json={"detail": "bad request"})

    transport = httpx.MockTransport(handler)

    class _MockClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _MockClient)

    with pytest.raises(_client.PVLAPIError) as exc_info:
        await _client.request("POST", "/api/predict", json={})
    assert exc_info.value.status_code == 422
    assert "422" in str(exc_info.value)


@pytest.mark.asyncio
async def test_request_raises_pvlapi_error_on_connect_failure(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    transport = httpx.MockTransport(handler)

    class _MockClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _MockClient)

    with pytest.raises(_client.PVLAPIError) as exc_info:
        await _client.request("GET", "/api/version")
    msg = str(exc_info.value)
    assert "Could not reach PVL backend" in msg
    assert "PVL_API_URL" in msg
