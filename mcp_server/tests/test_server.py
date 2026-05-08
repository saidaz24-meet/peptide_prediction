"""Tests for the server entry point: argparse, transport selection, and that
``build_server`` plumbs the system prompt through to FastMCP."""

from __future__ import annotations

from pvl_mcp.tools import TOOL_NAMES


def test_build_server_passes_system_prompt_and_registers_all_tools(patch_fastmcp):
    """``build_server`` must construct FastMCP with the Peleg domain prompt
    AND register every documented tool — otherwise the MCP surface drifts
    silently from the spec."""
    from pvl_mcp.prompts import SYSTEM_PROMPT
    from pvl_mcp.server import build_server

    mcp = build_server(host="0.0.0.0", port=9999)

    assert mcp.instructions == SYSTEM_PROMPT
    assert set(mcp.registered.keys()) == set(TOOL_NAMES)


def test_main_defaults_to_stdio_transport(patch_fastmcp, monkeypatch):
    """No ``--transport`` flag → stdio. This is what Claude Desktop uses."""
    from pvl_mcp.server import main

    captured: dict[str, str] = {}

    def fake_run(self, transport: str = "stdio") -> None:
        captured["transport"] = transport

    from pvl_mcp.server import build_server
    from tests.conftest import _FakeFastMCP

    monkeypatch.setattr(_FakeFastMCP, "run", fake_run, raising=False)

    rc = main([])
    assert rc == 0
    assert captured["transport"] == "stdio"
    # Quiet the unused-import lint check on build_server.
    assert callable(build_server)


def test_main_sse_transport_routed(patch_fastmcp, monkeypatch):
    """``--transport sse`` is forwarded to FastMCP.run()."""
    from pvl_mcp.server import main

    captured: dict[str, object] = {}

    def fake_run(self, transport: str = "stdio") -> None:
        captured["transport"] = transport
        captured["self"] = self

    from tests.conftest import _FakeFastMCP

    monkeypatch.setattr(_FakeFastMCP, "run", fake_run, raising=False)

    rc = main(["--transport", "sse", "--port", "9999", "--host", "0.0.0.0"])
    assert rc == 0
    assert captured["transport"] == "sse"
