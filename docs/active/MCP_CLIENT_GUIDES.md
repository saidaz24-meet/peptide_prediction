# MCP client guides — paste-ready install snippets per assistant

PVL exposes a Model Context Protocol (MCP) server so any MCP-aware LLM client can call its prediction pipeline natively. This page is one-stop install + first-query reference for the five clients we test against.

**Companion docs**: `MCP_RUNBOOK.md` (server-side ops, tool reference, troubleshooting). `ECOSYSTEM_GUIDE.md` (five-surface reference).

**Server status check** (works for all clients): once configured, ask your LLM `"Use PVL to look up its version."` and you should get back a tagged version string like `PVL v0.3.0 (sha 7a1b2c3, deployed 2026-06-08)`.

---

## Prerequisites (all clients)

1. **A PVL backend reachable from your machine.** Either:
   - **Hosted instance** at `http://94.130.178.182:8000` (or whatever URL the maintainers publish — check [README.md](../../README.md))
   - **Self-hosted**: `make docker-up` from a clone — backend listens on `http://localhost:8000`
2. **`pvl-mcp` installed.** Until PyPI release ships, install from source:

   ```bash
   git clone https://github.com/saidaz24-meet/peptide_prediction
   cd peptide_prediction/mcp_server
   pip install -e .
   ```

   Post-PyPI release: `pip install pvl-mcp`.

3. **Python 3.11+ on PATH.** Check with `python --version`.

---

## Claude Desktop

**Config location**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Snippet** — add to the `mcpServers` object:

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

**Restart Claude Desktop.** A new "pvl" capability should appear in the tools menu. Verify with `"Use PVL to look up its version."`

**First useful query**:

> "Use PVL to analyze the sequence GIGAVLKVLTTGLPALISWIKRKRQQ. Tell me whether it's FF-Helix or FF-SSW, and explain the classification using PVL's definitions."

The MCP server returns Peleg's exact category definitions, so the LLM cannot hallucinate a Chou-Fasman propensity or confuse aggregation with fibril formation.

---

## Cursor

Cursor uses the same MCP protocol as Claude Desktop but reads from a different config file.

**Config location**:
- macOS / Linux: `~/.cursor/mcp.json`
- Windows: `%USERPROFILE%\.cursor\mcp.json`

**Snippet** — same as Claude Desktop:

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

**Restart Cursor.** Open the command palette → "Show MCP servers" → "pvl" should be listed as ready.

**First useful query** (Cursor chat panel):

> "@pvl analyze the UniProt entry P01501 (cecropin A) and rank by FF-Helix score."

---

## Continue (VS Code extension)

Continue is configured via a YAML file rather than JSON.

**Config location**: `~/.continue/config.yaml`

**Snippet** — add under the `mcpServers` key (create if missing):

```yaml
mcpServers:
  - name: pvl
    command: python
    args: ["-m", "pvl_mcp"]
    env:
      PVL_API_URL: "http://localhost:8000"
```

**Reload Continue** (Cmd+Shift+P → "Continue: Reload"). The "pvl" server should appear in the model dropdown alongside your default model.

**First useful query**:

> "@pvl find FF-Helix candidates in S. aureus reference proteome length 10–50, top 5."

This triggers a UniProt query under the hood and ranks by Peleg's gap-smoothed FF-Helix gate.

---

## Cline (formerly Claude Dev)

Cline has its own MCP config UI accessible via the gear icon in the chat panel → "MCP Servers" tab.

**Web UI flow**:
1. Click "Add MCP Server"
2. Server name: `pvl`
3. Command: `python`
4. Arguments: `-m pvl_mcp`
5. Environment: add key `PVL_API_URL` with value `http://localhost:8000`
6. Click "Save"

**Or edit the config file directly**:
- macOS / Linux: `~/.cline/mcp_settings.json`
- Windows: `%USERPROFILE%\.cline\mcp_settings.json`

```json
{
  "mcpServers": {
    "pvl": {
      "command": "python",
      "args": ["-m", "pvl_mcp"],
      "env": {
        "PVL_API_URL": "http://localhost:8000"
      },
      "disabled": false,
      "autoApprove": ["pvl_version", "pvl_predict"]
    }
  }
}
```

The `autoApprove` list lets Cline call read-only PVL tools without per-call confirmation. Recommend approving `pvl_version` and `pvl_predict` only; require manual approval for the UniProt batch tools so they can't accidentally start a long-running job.

**First useful query**:

> "Use the PVL pvl_predict tool to analyze GIGAVLKVLTTGLPALISWIKRKRQQ and summarize the four-category classification."

---

## Windsurf (formerly Codeium)

Windsurf reads MCP config from a workspace-level or user-level JSON.

**User-level config**:
- macOS: `~/.codeium/windsurf/mcp_config.json`
- Linux: `~/.config/codeium/windsurf/mcp_config.json`
- Windows: `%USERPROFILE%\.codeium\windsurf\mcp_config.json`

**Workspace-level** (overrides user-level): `.windsurf/mcp_config.json` at the workspace root.

**Snippet**:

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

**Restart Windsurf.** PVL tools appear in the Cascade panel under "External tools".

**First useful query**:

> "@pvl analyze this sequence: KLVFFAE. Is it FF-Helix?"

(That's the canary sequence — Aβ16-22, the most-studied amyloid fragment. The expected answer is FF-Helix=No, FF-SSW=Yes, μH ~ 0.13, hydrophobicity ~ 0.74.)

---

## Common troubleshooting

**`pvl-mcp` not found.** Make sure `pip install -e .` ran from `mcp_server/` and that the Python on your PATH is the same one your client invokes. On macOS, Claude Desktop sometimes uses a system Python that doesn't see your virtualenv — set `command` to the absolute path of your venv's `python`:

```json
"command": "/Users/you/.venvs/pvl/bin/python"
```

**Connection refused on `PVL_API_URL`.** The backend isn't running. Start it with `make docker-up` from the repo root, or point `PVL_API_URL` at the hosted instance (`http://94.130.178.182:8000`).

**The LLM keeps saying "I don't have access to PVL".** The client didn't pick up the config. Verify the JSON parses (use `jq` or a JSON linter). Restart the client process — most MCP clients only read the config on launch.

**Tool calls succeed but return classifications I disagree with.** PVL returns Peleg's definitions verbatim — Helix means the gap-smoothed segment finder found at least one helix segment; FF-Helix means Helix AND μH ≥ dataset-derived μH-positive mean; etc. The full algorithm is in [`CHANGELOG_PELEG.md`](CHANGELOG_PELEG.md) and the Ragonis-Bachar et al. 2022 paper (DOI 10.1021/acs.biomac.2c00582). If you think PVL has a real bug (not a definitional disagreement), file an issue with the exact sequence, version, and threshold preset.

**My LLM hallucinates FF-Helix percentages.** PVL exposes `s4predHelixScore` (raw probability), `ffHelixScore` (sliding-window propensity), and `ffHelixFlag` (the binary class flag — what you typically want). If your LLM is making up percentages, tell it explicitly: *"Use PVL's ffHelixFlag for class membership, not a Chou-Fasman propensity."*

---

## Tool reference (summary; full spec in `MCP_RUNBOOK.md`)

| Tool | What it does | Typical use |
|---|---|---|
| `pvl_version` | Returns PVL version + SHA + deploy timestamp | Sanity check after install |
| `pvl_predict` | Single-sequence analysis | "Analyze GIGAV…" |
| `pvl_uniprot` | UniProt query → analysis pipeline | "Find FF-Helix in S. aureus 10-50aa" |
| `pvl_compare` | Side-by-side cohort comparison | "Compare WT to mutant set" |
| `pvl_permalink` | Reproducible URL for an analysis | "Give me a citable URL for that last analysis" |

All tools return Pydantic v2 schemas matching the web API contract; the LLM gets typed structured data, not free-form prose.
