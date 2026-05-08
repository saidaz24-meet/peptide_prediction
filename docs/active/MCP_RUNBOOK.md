# MCP Runbook — PVL as a tool for any MCP-aware LLM client

> **Status**: Wave 2 §A landed (2026-05-08). Backend MCP server scaffolded; three tools (`search_uniprot`, `analyze_sequences`, `get_pvl_version`) wrap live backend endpoints. The other four (`get_peptide_detail`, `rank_candidates`, `compare_cohorts`, `find_similar_peptides`) are wired to documented paths and ship as the matching backend routes land in subsequent waves.

This document is the operator's guide for `pvl-mcp`. If you want the high-level "why MCP", see [ADR-009 in `DECISIONS.md`](DECISIONS.md). If you want the dev-facing API surface, see [`mcp_server/README.md`](../../mcp_server/README.md).

---

## 1. Architecture

```
┌────────────────────────┐    MCP (stdio or SSE)    ┌──────────────────────────┐    HTTPS    ┌────────────────────────┐
│  LLM client            │ ───────────────────────► │  pvl-mcp (this package)  │ ──────────► │  PVL FastAPI backend   │
│  Claude Desktop /      │                          │  - 7 tools               │             │  - /api/predict        │
│  Cursor / Continue /   │                          │  - Peleg domain prompt   │             │  - /api/upload-csv     │
│  custom agent          │ ◄─────────────────────── │  - httpx client          │ ◄────────── │  - /api/uniprot/...    │
└────────────────────────┘                          └──────────────────────────┘             └────────────────────────┘
                                                              ▲
                                                              │ env: PVL_API_URL
```

**Key design choices** (from ADR-009):

- **MCP, not a custom chat UI.** Researchers already use Claude Desktop / Cursor / their own agents. Don't build another chatbot — give the one they already use the ability to talk to PVL.
- **Stateless wrapper.** `pvl-mcp` contains zero analysis logic; it forwards requests to the PVL REST API. All scientific computation, normalization, and threshold logic stays in the FastAPI backend, which is the single source of truth (`schemas/api_models.py`).
- **Domain prompt baked in.** Peleg's exact category definitions ship as the FastMCP `instructions` string so an LLM that hasn't read PVL's docs still gets the science right (no Chou-Fasman, no CD spec, no conflating aggregation with fibril formation).

---

## 2. Quick start

### 2.1 Install

```bash
# Backend (must be running for tools to actually work)
cd backend && uvicorn api.main:app --reload --port 8000

# In a separate terminal, install the MCP server in dev mode
cd mcp_server && pip install -e .
```

### 2.2 Smoke test from CLI (no LLM required)

```bash
# Should print FastMCP startup banner and then park on stdio waiting for an MCP client.
PVL_API_URL=http://localhost:8000 python -m pvl_mcp
# Ctrl-C to exit; this is what Claude Desktop will spawn under the hood.
```

### 2.3 Wire up Claude Desktop

Add this block to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

If `pvl_mcp` isn't on the system Python path, use the venv's interpreter explicitly:

```json
{
  "mcpServers": {
    "pvl": {
      "command": "/Users/you/projects/peptide_prediction/.venv/bin/python",
      "args": ["-m", "pvl_mcp"],
      "env": {
        "PVL_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

Fully restart Claude Desktop (Quit, not just close). You should see PVL appear under the connected-tools indicator.

### 2.4 Wire up Cursor

`Cursor → Settings → MCP → Add Server → stdio`:

```yaml
name: pvl
command: python -m pvl_mcp
env:
  PVL_API_URL: http://localhost:8000
```

### 2.5 Wire up Continue

In `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": { "type": "stdio", "command": "python", "args": ["-m", "pvl_mcp"] }
      }
    ]
  }
}
```

---

## 3. Verification prompts

After connecting, ask your LLM these in order. The expected tool calls are listed beside each prompt — most clients show a "tool call" indicator that lets you confirm.

| Prompt | Expected tool call | Backend route |
| --- | --- | --- |
| *"Use PVL to look up its version."* | `get_pvl_version()` | `GET /api/version` |
| *"Use PVL to analyze the sequence GIGAVLKVLTTGLPALISWIKRKRQQ."* | `analyze_sequences(sequences=[{"id": "...", "sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ"}])` | `POST /api/predict` |
| *"Use PVL to search UniProt for amyloid peptides from S. aureus, length 10 to 50."* | `search_uniprot(query="amyloid", organism_id="1280", length_min=10, length_max=50)` | `POST /api/uniprot/execute` |

A correctly answering LLM cites the version (`get_pvl_version`) when reporting paper-citable results, and uses Peleg's category names (Helix / FF-Helix / SSW / FF-SSW) — never "amyloid-prone" or "Chou-Fasman propensity".

---

## 4. Tool reference

All tools are async; payloads are JSON. The "client-side" types match what the LLM sees in the MCP catalog.

### 4.1 `search_uniprot`

Search UniProt and return PVL-normalized peptide rows.

| Parameter      | Type          | Default | Description |
| -------------- | ------------- | ------- | ----------- |
| `query`        | str           | —       | Accession (`P0C1Q4`), keyword (`amyloid`), or organism+keyword. |
| `organism_id`  | str?          | None    | NCBI taxonomy ID (`1280` = S. aureus). |
| `length_min`   | int?          | None    | Min sequence length filter. |
| `length_max`   | int?          | None    | Max sequence length filter. |
| `reviewed`     | bool          | True    | Swiss-Prot only when True; TrEMBL when False. |
| `max_results`  | int           | 500     | 1–10000; pagination handled server-side. |
| `run_tango`    | bool          | False   | Run TANGO on returned sequences. |
| `run_s4pred`   | bool          | False   | Run S4PRED on returned sequences. |

**Returns**: `{ rows: [...], stats: {...}, ... }` (PVL `RowsResponse` shape).

### 4.2 `analyze_sequences`

Run the full PVL pipeline on one or more sequences. Single-element batches go through `/api/predict`; multi-element batches go through `/api/upload-csv`. Single/batch parity is a PVL invariant — same sequence, same result, regardless of path.

| Parameter           | Type                      | Description |
| ------------------- | ------------------------- | ----------- |
| `sequences`         | `list[{id, sequence}]`    | One row per peptide. |
| `threshold_config`  | `dict?`                   | Optional override of the 9 PVL thresholds. Omit for defaults. |

**Returns**: PVL response with biochem metrics + classification flags (`helixFlag`, `ffHelixFlag`, `sswPrediction`, `ffSswFlag`).

### 4.3 `get_peptide_detail`

Returns all PVL data for one peptide — biochem metrics, all four classifications, provider raw outputs (TANGO peaks, S4PRED helix segments), structure metadata (PDB / AlphaFold link).

| Parameter   | Type | Description |
| ----------- | ---- | ----------- |
| `accession` | str  | Peptide accession or PVL row ID. |

**Backend status**: `GET /api/peptide/{accession}` is on the Wave 2 / 3 backend punch list. Until it ships the tool returns a clean PVL backend error.

### 4.4 `rank_candidates`

Multi-signal ranking — never relies on TANGO alone (PVL ranking-design rule).

| Parameter     | Type       | Default | Description |
| ------------- | ---------- | ------- | ----------- |
| `sequences`   | `list?`    | None    | Pre-analyzed rows to rank. |
| `dataset_id`  | str?       | None    | Server-side dataset ID. Pass exactly one of this OR `sequences`. |
| `preset`      | str        | `equal` | `equal` / `helix-focus` / `fibril-formation-focus` / `switch-focus`. |
| `weights`     | `dict?`    | None    | Custom signal-weight overrides; overrides the preset. |
| `top_n`       | int        | 10      | Number of top peptides to return. |

**Backend status**: `POST /api/rank` is on the Wave 2 / 3 backend punch list.

### 4.5 `compare_cohorts`

Class-fraction deltas + biochem distribution shifts between two cohorts.

| Parameter   | Type   | Description |
| ----------- | ------ | ----------- |
| `cohort_a`  | list   | Analyzed rows. |
| `cohort_b`  | list   | Analyzed rows. |
| `label_a`   | str    | Display label. |
| `label_b`   | str    | Display label. |

**Backend status**: `POST /api/compare` is on the Wave 2 / 3 backend punch list.

### 4.6 `find_similar_peptides`

Cosine-similarity search over PVL's vector embedding store.

| Parameter             | Type | Description |
| --------------------- | ---- | ----------- |
| `reference_sequence`  | str  | Reference peptide (single-letter AAs). 2–500 chars. |
| `k`                   | int  | Number of neighbors to return (1–100). |

**Backend status**: depends on Wave 2 §D (Chroma vector store + `POST /api/peptides/similar`).

### 4.7 `get_pvl_version`

Returns `{ version, build_sha, build_timestamp }`. Cite the version when reporting paper-citable results.

---

## 5. Domain axiom system prompt

`pvl-mcp` sets FastMCP's `instructions` to the prompt in [`pvl_mcp/prompts.py`](../../mcp_server/pvl_mcp/prompts.py). Keep these definitions verbatim — `tests/test_prompts.py` regex-checks for them and the full prompt round-trips into every connected client.

The four canonical categories (Peleg's axioms):

1. **Helix** = S4PRED helix segments AND length ≥ min-continuous-residues AND score ≥ min-helix-score.
2. **FF-Helix** = Helix AND **uH** > uH_threshold.   ← uses **hydrophobic moment**, not raw hydrophobicity.
3. **SSW** = TANGO **OR** S4PRED is indecisive (helix/beta within max-gap).   ← logic is **OR**, not AND.
4. **FF-SSW** = SSW AND **hydrophobicity** > hydrophobicity_threshold.   ← uses **hydrophobicity**, not uH.

The three CRITICAL CORRECTIONS (must never be violated by an LLM answer):

- "Aggregation" (TANGO output) is NOT the same as "fibril formation".
- Chou-Fasman propensity is OUTDATED and not used in PVL classification.
- CD spectroscopy is NEVER mentioned in PVL outputs.

If you change the prompt, run `pytest mcp_server/tests/test_prompts.py` to confirm every assertion still passes.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Claude Desktop shows "PVL" but no tools listed | Server crashed on startup or wrong Python | Check Claude Desktop logs (`~/Library/Logs/Claude/mcp-server-pvl.log`). Use full venv Python path in config. |
| Every tool call returns "Could not reach PVL backend" | Backend not running or `PVL_API_URL` wrong | Start `uvicorn api.main:app --port 8000`; verify `curl http://localhost:8000/api/health`. |
| Tool call returns "PVL backend returned 422" | Pydantic schema rejected the LLM's payload | The error body lists exact field validation errors. Update tool docstring/types if the LLM consistently sends a wrong shape. |
| Tool call returns "PVL backend timed out after 60s" | Long S4PRED on a long sequence | Set `PVL_API_TIMEOUT=180` in the MCP server env, or set `S4PRED_MAX_LENGTH` lower. |
| `analyze_sequences` returns the wrong rows for cached input | Stale cache hit | Caches are scoped per (sequence, threshold_config); change a threshold or restart the backend. See `services/predict_service.py`. |
| SSE transport refuses connection | Bind host or port mismatch | `pvl-mcp --transport sse --host 0.0.0.0 --port 8765`; confirm `curl http://localhost:8765/sse` responds. |

---

## 7. Operational notes

- **No analysis state in `pvl-mcp`.** Restarts are safe at any time — there's nothing to migrate.
- **One-process-per-client.** Claude Desktop / Cursor / Continue each spawn their own subprocess; multiple concurrent clients are fine.
- **Sentry / tracing.** This package emits no telemetry of its own; the backend handles tracing (each request has a `traceId` propagated via `X-Trace-Id`).
- **Auth.** None. The MCP server inherits whatever the underlying PVL backend exposes — keep PVL behind your usual VPN / SSH tunnel for non-public deployments.

---

## 8. Roadmap

| Item | Wave | Notes |
| --- | --- | --- |
| Wire `get_peptide_detail` to a real `/api/peptide/{accession}` route | Wave 2 / 3 | Backend currently lacks a single peptide-detail endpoint at the API surface. |
| Wire `rank_candidates` to a real `/api/rank` endpoint | Wave 2 / 3 | Today ranking is computed client-side; lifting to backend matches the MCP shape. |
| Wire `compare_cohorts` to `/api/compare` | Wave 2 / 3 | Same story — currently client-side. |
| Implement `find_similar_peptides` end-to-end | Wave 2 §D | Depends on the Chroma vector-store work. |
| Add `analyze_pdb` tool | Wave 3+ | When the structure-aware predictors land. |
| Auth-header passthrough | Wave 4 | If/when PVL gets a hosted multi-tenant deployment. |

---

## 9. Reference

- [`mcp_server/README.md`](../../mcp_server/README.md) — package usage / install
- [`pvl_mcp/tools.py`](../../mcp_server/pvl_mcp/tools.py) — canonical tool definitions
- [`pvl_mcp/prompts.py`](../../mcp_server/pvl_mcp/prompts.py) — system prompt
- [ADR-009 in `DECISIONS.md`](DECISIONS.md) — why MCP is the AI-platform front door
- [`MASTER_PUSH_PLAN.md` §3](MASTER_PUSH_PLAN.md) — Wave 2 plan
- [Anthropic MCP spec](https://modelcontextprotocol.io)
