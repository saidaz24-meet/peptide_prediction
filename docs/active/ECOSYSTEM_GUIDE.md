# PVL ecosystem — five surfaces, one scientific core

PVL is not a website with optional extras. It is a single scientific pipeline (TANGO + S4PRED + FF-Helix + SSW classification) exposed through five interfaces. Same algorithms, same outputs, same reproducibility guarantees on every surface. Pick the one that matches how you work.

---

## At-a-glance

| Surface | Audience | When to use | State |
|---|---|---|---|
| **Web app** | General researchers, non-technical users | Visual exploration, one-off uploads, sharing a result via URL | ✅ Live |
| **CLI (`pvl-cli`)** | Devops, sysadmins, automation builders | Scripted batch runs, CI/CD integration, headless servers | 🟡 Scaffolded |
| **Python package (`pvl-py`)** | Data scientists, bioinformaticians | Notebook workflows, embedding PVL in larger pipelines | 🟡 Scaffolded + notebook |
| **MCP server** | AI engineers, LLM application builders | Giving a model direct natural-language access to PVL | ✅ Live since 2026-05-12 |
| **Self-hostable Docker** | Enterprise IT, privacy-conscious labs | Running PVL on internal infrastructure (e.g. DESY VM) | ✅ Working compose |

---

## The one scientific contract (read this once)

Whichever surface you use, you get the same shape back. The canonical schema lives at `backend/schemas/api_models.py` — do NOT diverge from it on any surface.

**Always-present fields per peptide**:
- `id`, `sequence`, `length`
- `helixPrediction`, `ffHelixFlag`, `sswPrediction`, `ffSswFlag` — the four canonical class flags
- `tangoAggMax`, `s4predHelixPercent`, `ffHelixPercent`, `muH`, `hydrophobicity`, `charge`, `sswScore`
- Plus a `meta.permalink` field encoding the exact run (dataset hash + predictor versions + thresholds + selection) so any output can be regenerated.

**Null handling**: JSON `null` only. No `-1`, no `"N/A"`, no empty string as a sentinel. Flag columns use `-1` for "not a candidate", `1` for "candidate", `null` for "no data".

**Identical results promise**: a single sequence run via Quick Analyze on the web must produce the same numbers as the same sequence run via `pvl analyze`, via `from pvl import analyze`, via the MCP `analyse_sequence` tool, or via a self-hosted Docker stack. If they ever diverge, that is a bug — file it.

---

## §1 — Web app

**For**: people who want an instant visual interface without setup.

**URL**: `http://94.130.178.182:3000` (Hetzner VPS, production). Self-host instructions in §5.

**Quickstart**:
1. Click *Quick Analyze*, paste a single peptide sequence (up to 40 aa), hit Run.
2. Or click *Upload*, drop a CSV with a `Sequence` column.
3. Results land at `/results` with the cohort comparison charts, ranked candidate list, distributions per metric, and a permalink at the top-right.
4. Click any peptide row to land on `/peptides/:id` for the deep dive (AlphaFold-predicted structure, per-residue overlays, FF-Helix vs Aggregation Max scatter, biochem comparison vs. the database).

**Key constraint**: per-sequence length cap is 40 aa (Peleg-set 2026-06-03). Above 40, the secondary-structure prediction becomes a surface-vs-structure problem and the FF-Helix / SSW logic loses meaning. Sequences above 40 are skipped with a warning.

**Reproducibility**: copy the URL at any state. Paste it anywhere — same dataset, same thresholds, same selection, same result. The URL encodes the dataset hash + predictor versions + thresholds + selection.

**When NOT to use the web**: dataset >5,000 rows (use the CLI), batch automation (use the CLI), AI-driven workflows (use MCP), data that cannot leave the institute (self-host).

---

## §2 — CLI (`pvl-cli`)

**For**: people who script. The web app is a UI on top; the CLI is the same thing without one.

**Repo**: `pvl-cli/` in the PVL monorepo. Standalone install instructions:

```bash
# From the monorepo root
cd pvl-cli
pip install -e .
```

**Quickstart**:
```bash
# Single sequence against the public backend
pvl analyze --sequence ACDEFGHIKLMNPQRSTVWY --entry P12345

# Batch from a CSV with a Sequence column
pvl analyze peptides.csv

# FASTA input
pvl analyze peptides.fasta

# Custom backend (e.g. your self-hosted instance)
pvl analyze peptides.csv --base-url https://pvl.your-lab.science

# Raw JSON to pipe into jq for scripted workflows
pvl analyze peptides.csv --json | jq '.peptides[] | select(.ffHelixFlag == 1) | .id'
```

**What it's good at right now**:
- Single-sequence and CSV/FASTA batch.
- Hitting any PVL backend, including a self-hosted one.
- Pretty-printed table output for interactive use OR raw JSON for pipelines.

**What's still queued (Wave 2.7+)**:
- Threshold preset flag (`--preset helix-focus`).
- Progress bars on long batches.
- Output format options (CSV / Parquet / SQLite).
- Resume-from-checkpoint on big batches.

**When NOT to use the CLI**: when you want a visual interpretation (use the web), when you want to programmatically build derived analysis (use `pvl-py`), when you're an AI assistant (use MCP).

---

## §3 — Python package (`pvl-py`)

**For**: notebook-driven data science. Bioinformaticians who want PVL as a library, not a tool.

**Repo**: `pvl-py/` in the monorepo. Has a quickstart Jupyter notebook at `pvl-py/notebooks/`.

**Install** (pre-PyPI):
```bash
cd pvl-py
pip install -e .
```

**Quickstart**:
```python
from pvl import PvlClient

client = PvlClient(base_url="http://94.130.178.182:8000")

# Single sequence
result = client.analyze(sequence="ACDEFGHIKLMNPQRSTVWY", entry="P12345")
print(result.peptides[0].ff_helix_flag)
print(result.peptides[0].tango_agg_max)

# Batch from a pandas DataFrame
import pandas as pd
df = pd.DataFrame({"Sequence": ["ACDE...", "KLVF..."], "Entry": ["P1", "P2"]})
batch_result = client.analyze_batch(df)

# Threshold tweaks
result = client.analyze(
    sequence="KLVFFAE",
    entry="Abeta16_22",
    thresholds={"ffHelixUhMin": 0.45},
)
```

**What it's good at right now**:
- Programmatic single + batch.
- Custom threshold injection.
- Returns typed Pydantic-style models (you get autocomplete on `result.peptides[0].`).
- Reproducibility: every `result` carries a `result.meta.permalink` string. Stash it; you can replay the exact run via the web later.

**Notebooks**: see `pvl-py/notebooks/` for a walkthrough that ingests a UniProt subset, runs PVL, joins with a downstream pandas analysis.

**What's still queued (Wave 2.7+)**:
- PyPI release (`pip install pvl-py`).
- Async client for high-concurrency workflows.
- Built-in caching of repeat sequences.

**When NOT to use `pvl-py`**: AI agents (use MCP — it's the same primitives but exposed correctly to LLMs), CLI workflows (use `pvl-cli` — it's lighter weight for shell pipelines).

---

## §4 — MCP server

**For**: AI engineers. Give an LLM direct natural-language access to PVL.

**Repo**: `mcp_server/pvl_mcp/` in the monorepo. Detailed runbook: `docs/active/MCP_RUNBOOK.md`.

**State**: shipped 2026-05-12.

**What MCP is**: the Model Context Protocol — a standard way for an AI assistant (Claude Desktop, Cursor, Continue, Cline, Windsurf, etc.) to call tools running on your machine or a remote server. If your assistant speaks MCP, it can drive PVL.

**Tools exposed**:
- `analyse_sequence` — single peptide analysis.
- `get_peptide_detail` — deep dive on a single peptide (per-residue overlays, classification rationale).
- `rank_candidates` — Smart Ranking across a list of peptides with configurable weights.
- `compare_cohorts` — biochemical comparison between two peptide groups (e.g. "FF-Helix vs not").
- `find_similar` — sequence similarity search within the loaded dataset.

**Install** (Claude Desktop example — adapt for other clients):
```bash
cd mcp_server
pip install -e .
```

Then add to your Claude Desktop MCP config:
```json
{
  "mcpServers": {
    "pvl": {
      "command": "pvl-mcp",
      "args": ["--base-url", "http://94.130.178.182:8000"]
    }
  }
}
```

Restart Claude Desktop. In a new conversation you can now say *"Use the pvl tools to screen these 50 sequences for amyloid candidates and rank them by FF-Helix score"* and the assistant will orchestrate the calls.

**Use cases this opens**:
- *"Screen these candidates from my UniProt query and tell me which ones look amyloid-prone"* — assistant runs `analyse_sequence` + `rank_candidates`, returns a justified ranking.
- *"Compare the FF-SSW positives in this dataset against the negatives — what biochemical features differ most?"* — assistant runs `compare_cohorts`, returns a structured answer.
- *"Find peptides similar to KLVFFAE in my uploaded data"* — assistant runs `find_similar`.
- *"Open the detail view for the top candidate"* — assistant runs `get_peptide_detail` and the response can be rendered as a structured card.

**What's still queued (Phase G2)**:
- RAG / PubMed citation grounding. Currently MCP answers come from PVL's own analysis. With RAG, answers also cite published literature relevant to the peptide. The hard problems are building the literature vector database and preventing hallucinated citations (see `PELEG_ZOOM_PREP_2026_06_04.md` §5 Q-RAG for the full plan).

**When NOT to use MCP**: scripted automation that doesn't need an LLM in the loop (use the CLI), single-sequence one-off exploration (use the web).

---

## §5 — Self-hostable Docker

**For**: institutes that cannot use the public VPS for compliance / privacy reasons. DESY is exactly this audience.

**State**: `docker-compose.yml` in the repo works for a single-node deployment. Multi-arch builds queued (Phase E6, blocked on knowing the DESY VM architecture).

**One-command spin-up**:
```bash
git clone https://github.com/saidaz24-meet/peptide_prediction.git pvl
cd pvl
docker compose up -d
```

This starts:
- The FastAPI backend (uvicorn, 2 workers).
- The React UI (nginx serving the static build).
- A Celery worker for long-running batch jobs.
- A Redis instance for the worker queue and job tracking.

Open `http://localhost:3000` — same web app as the public VPS.

**Why a lab might pick this**:
- Sequence data is sensitive (unpublished, NDA, patient-derived) — running locally removes the data-egress objection entirely.
- The institute has GPU capacity and wants S4PRED to run on it instead of CPU.
- You want to fork PVL and add a custom predictor.
- You want a known-stable version pinned for a paper's reproducibility (cite the commit SHA in your methods).

**Pointing CLI / pvl-py / MCP at your self-host**:
- `pvl analyze peptides.csv --base-url http://localhost:8000` (CLI).
- `PvlClient(base_url="http://localhost:8000")` (`pvl-py`).
- Set `--base-url http://localhost:8000` in your MCP server config.

**What's still queued**:
- Multi-arch image (`linux/amd64` + `linux/arm64`) — blocked on DESY VM arch info.
- K8s deployment manifests for multi-node clusters (Phase C, blocked on DESY K8s namespace).
- Documented backup + restore procedure.

---

## §6 — When you're not sure which surface to use

| You want to… | Use |
|---|---|
| Try PVL once, no setup | Web (`http://94.130.178.182:3000`) |
| Run PVL inside a notebook | `pvl-py` |
| Run PVL from a bash script / CI job | `pvl-cli` |
| Let an LLM drive PVL with natural language | MCP server |
| Run PVL on data that can't leave your institute | Self-host (Docker) |
| Embed PVL into another web app | Use the REST API directly (see `docs/active/CONTRACTS.md`) |
| Cite PVL in a paper | Zenodo DOI (forthcoming) + the JOSS paper (forthcoming) |

---

## §7 — Reproducibility, across all surfaces

PVL bakes reproducibility into every output. Whichever surface you use, you get back a `meta.permalink` string that encodes:
- The dataset hash (so the input is fingerprinted).
- The predictor versions (so re-running on an updated PVL is still traceable).
- The threshold values active for the run.
- The selection / filter state at the moment the permalink was minted.

To replay any result:
- **Web**: paste the URL.
- **CLI**: `pvl replay <permalink>`.
- **pvl-py**: `client.replay(permalink)`.
- **MCP**: ask the assistant to "open the permalink `<...>`".
- **Self-host**: the same permalink works against your local instance as long as it's running the same PVL version (the predictor version is encoded in the permalink — if your local is older, you'll see a warning).

This means PVL is the *only* peptide-analysis tool in this category that supports a single-URL exact replay. That's deliberate, and it's the feature we lead with in the paper.

---

## §8 — Status as of 2026-06-03

| Surface | State | Live? | Public docs status |
|---|---|---|---|
| Web | ✅ Production | Yes (Hetzner VPS) | Complete |
| CLI | 🟡 Scaffolded | Local install only | Skeletal `pvl-cli/README.md`; full guide in Wave 2.7 |
| `pvl-py` | 🟡 Scaffolded + notebook | Local install only | Decent `pvl-py/README.md` + notebook; PyPI release Wave 2.7 |
| MCP | ✅ Production | Local-install assistants | Detailed `docs/active/MCP_RUNBOOK.md`; quickstart this guide |
| Self-host | ✅ Working compose | `docker compose up` works | This guide is the canonical short-form; long-form Wave 2.7 |

**Wave 2.7 docs queue** (post-Zoom):
- `pvl-cli/README.md` rewritten as a user guide (currently 24 lines, skeletal).
- `pvl-py` PyPI release with proper package metadata.
- `docs/active/SELF_HOST_GUIDE.md` for the institute IT audience (backup/restore, upgrade procedure, log rotation).
- `docs/active/MCP_CLIENT_GUIDES.md` — per-client install snippets for Claude Desktop, Cursor, Continue, Cline, Windsurf.
