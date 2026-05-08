# pvl-mcp — Peptide Visual Lab MCP Server

`pvl-mcp` exposes the [Peptide Visual Lab](https://github.com/saidaz24-meet/peptide_prediction) REST API as a set of tools that any MCP-aware LLM client can call directly: Claude Desktop, Cursor, Continue, Cline, Windsurf, or your own agent.

When a researcher asks their assistant *"find me the top 5 amyloid candidates from S. aureus, length 10–50, ranked by FF-Helix score"*, the LLM calls PVL tools, receives structured data, and synthesizes the answer — with PVL's exact category definitions baked into the system prompt so the science stays correct.

## Install (local dev)

```bash
cd mcp_server
pip install -e .
# optional: dev tooling
pip install -e ".[dev]"
```

## Run

```bash
# stdio (default; what Claude Desktop / Cursor / Continue connect to)
python -m pvl_mcp
# OR equivalently:
pvl-mcp

# SSE (for web / remote clients)
pvl-mcp --transport sse --host 0.0.0.0 --port 8765
```

## Configuration

| Env var            | Default                  | Purpose                                       |
| ------------------ | ------------------------ | --------------------------------------------- |
| `PVL_API_URL`      | `http://localhost:8000`  | Base URL of the PVL FastAPI backend           |
| `PVL_API_TIMEOUT`  | `60`                     | HTTP timeout (seconds) for backend calls      |
| `PVL_MCP_HOST`     | `127.0.0.1`              | SSE bind host (ignored for stdio)             |
| `PVL_MCP_PORT`     | `8765`                   | SSE bind port (ignored for stdio)             |

## Tools

| Tool                     | Backend route                              | Status |
| ------------------------ | ------------------------------------------ | ------ |
| `search_uniprot`         | `POST /api/uniprot/execute`                | LIVE   |
| `analyze_sequences`      | `POST /api/predict` + `POST /api/upload-csv` | LIVE   |
| `get_pvl_version`        | `GET /api/version`                         | LIVE   |
| `get_peptide_detail`     | `GET /api/peptide/{accession}`             | wraps a backend route that ships in a follow-up wave |
| `rank_candidates`        | `POST /api/rank`                           | wraps a backend route that ships in a follow-up wave |
| `compare_cohorts`        | `POST /api/compare`                        | wraps a backend route that ships in a follow-up wave |
| `find_similar_peptides`  | `POST /api/peptides/similar`               | depends on Wave 2 §D vector store          |

The MCP surface is fixed at seven tools so prompts and client configurations don't drift between releases. Tools whose backend route is still in flight return a clear backend error when called — the LLM surfaces it verbatim instead of inventing an answer.

## Use from Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pvl": {
      "command": "python",
      "args": ["-m", "pvl_mcp"],
      "env": {
        "PVL_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

Restart Claude Desktop. You should now see PVL listed under the connected tools indicator. Sample prompts to verify:

1. *"Use PVL to look up version info."* — should call `get_pvl_version`.
2. *"Use PVL to search UniProt for amyloid peptides from S. aureus, length 10–50."* — should call `search_uniprot` with `organism_id="1280"` and `length_min=10`, `length_max=50`.
3. *"Use PVL to analyze the sequence GIGAVLKVLTTGLPALISWIKRKRQQ."* — should call `analyze_sequences` and report Helix / FF-Helix / SSW / FF-SSW classifications.

## Use from Cursor / Continue / other clients

The same stdio command (`python -m pvl_mcp`) works as the MCP server invocation in any client that supports stdio MCP servers. SSE-capable clients can connect to `http://<host>:8765/sse` after starting `pvl-mcp --transport sse`.

## Development

```bash
# from mcp_server/
pytest -v                       # all tests
pytest tests/test_tools.py -v   # tool-level
ruff check .                    # lint
ruff format .                   # format
```

The full integration walkthrough — including troubleshooting and tool reference with example payloads — lives in [`docs/active/MCP_RUNBOOK.md`](../docs/active/MCP_RUNBOOK.md).

## License

MIT — same as PVL.
