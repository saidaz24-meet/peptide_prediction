"""PVL MCP server entry point.

Default transport is stdio (what Claude Desktop / Cursor / Continue connect
to via local subprocess). SSE is available for web-based MCP clients and for
debugging — start with ``pvl-mcp --transport sse --port 8765`` and connect
with an SSE-capable client.

Configuration:
- ``PVL_API_URL`` — backend base URL (default ``http://localhost:8000``)
- ``PVL_API_TIMEOUT`` — backend HTTP timeout in seconds (default 60.0)
- ``PVL_MCP_HOST`` — SSE bind host (default ``127.0.0.1``)
- ``PVL_MCP_PORT`` — SSE bind port (default 8765)
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

from .prompts import SYSTEM_PROMPT
from .tools import register_tools

DEFAULT_SSE_HOST = "127.0.0.1"
DEFAULT_SSE_PORT = 8765


def build_server(host: str = DEFAULT_SSE_HOST, port: int = DEFAULT_SSE_PORT) -> Any:
    """Construct a FastMCP instance with all PVL tools + the domain prompt.

    ``host`` and ``port`` are only used by the SSE transport; stdio ignores
    them. Imported lazily so that importing ``pvl_mcp.server`` for tests does
    not require the mcp SDK to be installed.
    """
    from mcp.server.fastmcp import FastMCP

    mcp = FastMCP(
        name="pvl-mcp",
        instructions=SYSTEM_PROMPT,
        host=host,
        port=port,
    )
    register_tools(mcp)
    return mcp


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="pvl-mcp",
        description=(
            "Peptide Visual Lab MCP server — exposes PVL as tools for any "
            "MCP-aware LLM client (Claude Desktop, Cursor, Continue, ...)."
        ),
    )
    parser.add_argument(
        "--transport",
        choices=("stdio", "sse"),
        default="stdio",
        help="Transport. stdio = local subprocess (default; what Claude Desktop uses). "
        "sse = HTTP Server-Sent Events for remote / web clients.",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("PVL_MCP_HOST", DEFAULT_SSE_HOST),
        help=f"SSE bind host (default: {DEFAULT_SSE_HOST}). Ignored for stdio.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PVL_MCP_PORT", DEFAULT_SSE_PORT)),
        help=f"SSE bind port (default: {DEFAULT_SSE_PORT}). Ignored for stdio.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Returns process exit code."""
    args = _parse_args(argv)
    mcp = build_server(host=args.host, port=args.port)

    # FastMCP.run() handles both transports; we forward the choice. Stdio is
    # synchronous from the caller's POV (it parks until the parent process
    # closes the pipes); SSE blocks on the uvicorn server it starts internally.
    mcp.run(transport=args.transport)
    return 0


if __name__ == "__main__":  # pragma: no cover — invoked via `python -m pvl_mcp`
    sys.exit(main())
