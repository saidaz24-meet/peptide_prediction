"""Shared pytest fixtures for the PVL MCP server tests."""

from __future__ import annotations

from typing import Any

import pytest

from pvl_mcp import _client, server, tools


class _RecordingClient:
    """Stand-in for ``pvl_mcp._client.request`` that records calls.

    A test sets ``response`` to whatever the fake backend should return; the
    test then inspects ``calls`` to assert the tool used the right method,
    path, and payload shape.
    """

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.response: Any = {}
        self.exc: Exception | None = None

    async def __call__(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        data: dict[str, Any] | None = None,
        files: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> Any:
        self.calls.append(
            {
                "method": method,
                "path": path,
                "params": params,
                "json": json,
                "data": data,
                "files": files,
                "headers": headers,
                "timeout": timeout,
            }
        )
        if self.exc is not None:
            raise self.exc
        return self.response


class _FakeFastMCP:
    """Minimal FastMCP look-alike for tool-registration tests.

    We don't need the real server lifecycle — we just want to know which
    decorated functions ``register_tools`` produced and to be able to invoke
    them directly. Capturing the wrapped coroutine lets us call it with
    keyword args exactly as FastMCP would after the LLM picks the tool.
    """

    def __init__(self) -> None:
        self.registered: dict[str, Any] = {}
        self.instructions: str | None = None

    def tool(self, *_args: Any, **_kwargs: Any):
        def decorator(fn):
            self.registered[fn.__name__] = fn
            return fn

        return decorator


@pytest.fixture
def fake_client(monkeypatch: pytest.MonkeyPatch) -> _RecordingClient:
    """Replace ``_client.request`` with a recording stand-in."""
    rc = _RecordingClient()
    monkeypatch.setattr(_client, "request", rc)
    monkeypatch.setattr(tools._client, "request", rc)
    return rc


@pytest.fixture
def registered_tools() -> dict[str, Any]:
    """Build a fresh fake MCP and register all PVL tools on it."""
    fake = _FakeFastMCP()
    tools.register_tools(fake)
    return fake.registered


@pytest.fixture
def fake_mcp_class() -> type[_FakeFastMCP]:
    """Expose the fake class for tests that want to drive ``build_server``."""
    return _FakeFastMCP


@pytest.fixture
def patch_fastmcp(monkeypatch: pytest.MonkeyPatch, fake_mcp_class: type[_FakeFastMCP]):
    """Patch ``mcp.server.fastmcp.FastMCP`` so ``build_server`` runs without
    the real SDK being installed (or in case its API differs across versions).
    """
    instances: list[_FakeFastMCP] = []

    def _factory(*_args: Any, **kwargs: Any) -> _FakeFastMCP:
        inst = fake_mcp_class()
        inst.instructions = kwargs.get("instructions")
        instances.append(inst)
        return inst

    fake_module_name = "mcp.server.fastmcp"

    class _FakeFastMCPModule:
        FastMCP = staticmethod(_factory)

    import sys

    monkeypatch.setitem(sys.modules, fake_module_name, _FakeFastMCPModule())
    monkeypatch.setitem(
        sys.modules,
        "mcp.server",
        type("mcp_server_pkg", (), {"fastmcp": _FakeFastMCPModule()}),
    )
    monkeypatch.setitem(sys.modules, "mcp", type("mcp_pkg", (), {}))

    # Re-import server with the patched module visible.
    import importlib

    importlib.reload(server)

    yield instances

    importlib.reload(server)
