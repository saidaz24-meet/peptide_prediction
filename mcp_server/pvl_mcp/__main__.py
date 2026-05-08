"""Allow ``python -m pvl_mcp`` to start the MCP server."""

import sys

from .server import main

if __name__ == "__main__":
    sys.exit(main())
