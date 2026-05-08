<div align="center">

# 🧬 Peptide Visual Lab

**The all-in-one peptide aggregation + structure prediction dashboard.**
Multi-tool consensus · Live 3D overlay · Reproducibility-as-permalink · AI-platform-ready.

[![CI](https://github.com/saidaz24-meet/peptide_prediction/actions/workflows/ci.yml/badge.svg)](https://github.com/saidaz24-meet/peptide_prediction/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tests: 887 passing](https://img.shields.io/badge/tests-887%20passing-brightgreen)](#running-tests)
[![Sentry monitored](https://img.shields.io/badge/Sentry-monitored-blueviolet)](https://sentry.io)
[![CodeRabbit reviewed](https://img.shields.io/badge/CodeRabbit-AI%20reviewed-orange)](.coderabbit.yaml)
[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-7C3AED)](https://www.anthropic.com/claude)

[**Live demo**](https://pvl.example) · [**Self-host**](#self-host-in-3-minutes) · [**API docs**](#api) · [**Contribute**](CONTRIBUTING.md) · [**Cite**](#citing-pvl)

</div>

---

## Why PVL is different

PVL is the only peptide-prediction tool that puts every analysis in one dashboard, overlays predictions on the AlphaFold structure, and turns each analysis into a citable URL. The competition is single-algorithm CLI tools that emit static PNGs.

| What you get | How others handle it |
|---|---|
| 🧬 **Multi-tool consensus** — TANGO + S4PRED + FF-Helix + biochem + AlphaFold + UniProt in one place | Switch tabs across 5 sites; merge CSVs in Excel |
| 🔬 **Live 3D structure overlay** — TANGO peaks + S4PRED helix segments + FF-Helix candidates + SSW zones rendered ON the AlphaFold structure via Mol\* | Read coords from a flat file; manually paint residues in PyMOL |
| 🔗 **Reproducibility-as-permalink** — every analysis becomes a URL with version + SHA + thresholds. Paste it in a paper; reviewers see the same view | Screenshot for the supplement; pray it stays accurate |
| 🤖 **AI-platform-ready** — designed for MCP, Python package, CLI, and embeddable widget | Web-only, no API, no integration story |
| 🆓 **Open source · MIT · runs on your laptop** — `docker compose up` and your data never leaves your machine | Closed-source, paid, or hosted-only |

---

## Screenshots

<table>
  <tr>
    <td width="50%">
      <strong>Quick Analyze</strong> — paste a single sequence, see results in seconds.
      <br/>
      <img src="docs/images/01-quick-analyze.png" alt="Quick Analyze single peptide flow" />
    </td>
    <td width="50%">
      <strong>Results Overview</strong> — classification landscape, click any region to filter.
      <br/>
      <img src="docs/images/02-results-overview.png" alt="Set diagram drill-down" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Smart Candidate Ranking</strong> — adjustable metric weights + presets.
      <br/>
      <img src="docs/images/03-smart-ranking.png" alt="Smart candidate ranking with weight bars" />
    </td>
    <td width="50%">
      <strong>2D Backbone</strong> — color-coded residues from AlphaFold PDB.
      <br/>
      <img src="docs/images/04-2d-backbone.png" alt="2D backbone visualization" />
    </td>
  </tr>
  <tr>
    <td colspan="2" width="100%">
      <strong>Correlation Matrix</strong> — pairwise Pearson correlations with rotated headers + diverging palette.
      <br/>
      <img src="docs/images/05-correlation-matrix.png" alt="Correlation matrix with rotated headers" />
    </td>
  </tr>
</table>

---

## Architecture

```mermaid
flowchart TB
    A["👤 Researcher<br/>(Browser · Claude Desktop · Cursor · Jupyter)"] --> B
    M["🤖 LLM Agent<br/>(MCP-aware client)"] -. "Phase G1<br/>(planned v0.2)" .-> Mcp
    Mcp["🛰️ MCP Server<br/>(Python SDK)"] --> B
    B["⚛️ React + Vite + Mol*<br/>(hover-everywhere drill-down)"] -- "REST<br/>(Pydantic v2 strict)" --> C
    C["🐍 FastAPI Backend"] --> D["📦 Predictor Pipeline"]
    D --> E1["TANGO<br/>(subprocess)"]
    D --> E2["S4PRED<br/>(BiLSTM)"]
    D --> E3["FF-Helix<br/>(pure Python)"]
    D --> E4["Biochem<br/>(vectorized)"]
    C --> F1["UniProt API"]
    C --> F2["AlphaFold DB"]
    C --> G["📊 Sentry<br/>(release-tagged + rich context)"]

    classDef planned stroke-dasharray: 5 5,opacity:0.7
    class M,Mcp planned
```

The whole architecture is documented in [`docs/active/TECH_PLATFORM_VISION.md`](docs/active/TECH_PLATFORM_VISION.md). Architectural decisions logged in [`docs/active/DECISIONS.md`](docs/active/DECISIONS.md) (12 ADRs).

---

## Self-host in 3 minutes

```bash
git clone https://github.com/saidaz24-meet/peptide_prediction.git
cd peptide_prediction
cp backend/.env.example backend/.env
make docker-up
```

Open <http://localhost:3000>. Done. Your data never leaves your machine.

### Optional prediction tools

| Tool | Purpose | Required? | Where |
|------|---------|-----------|-------|
| **S4PRED** | Secondary structure (helix / beta / coil) | Optional | `tools/s4pred/models/` (5 model files) |
| **TANGO** | Aggregation propensity | Optional | `tools/tango/bin/tango` |
| **FF-Helix** | Fibril-forming helix detection | Always available | Built-in (pure Python) |

Without S4PRED or TANGO, PVL still computes FF-Helix %, charge, hydrophobicity, μH, biochem properties, and the full classification pipeline.

---

## Use PVL from Claude Desktop

PVL exposes an MCP server so any MCP-aware LLM client (Claude Desktop, Cursor, Continue, Cline, Windsurf) can call PVL natively — paste a UniProt accession, ask for amyloid candidates, and get back a structured analysis with a permalink you can cite.

### Setup (Claude Desktop)

1. Install `pvl-mcp`. Until the PyPI release ships, install from source:

   ```bash
   # from a clone of this repo
   cd mcp_server && pip install -e .
   # (post-PyPI: pip install pvl-mcp)
   ```

2. Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

   ```json
   {
     "mcpServers": {
       "pvl": {
         "command": "python",
         "args": ["-m", "pvl_mcp"],
         "env": { "PVL_API_URL": "http://localhost:8000" }
       }
     }
   }
   ```

   Point `PVL_API_URL` at your own PVL backend (a hosted instance, your VPS, or a local `uvicorn api.main:app --port 8000`).

3. Restart Claude Desktop. Try these prompts:

   > "Use PVL to look up its version."
   >
   > "Use PVL to analyze the sequence GIGAVLKVLTTGLPALISWIKRKRQQ and tell me whether it is FF-Helix."
   >
   > "Use PVL to search UniProt for amyloid peptides from S. aureus, length 10–50, then rank the top 5 by FF-Helix score."

The MCP server exposes the same prediction pipeline used by the web UI — every result comes back with PVL's exact category definitions (Helix / FF-Helix / SSW / FF-SSW) so the LLM can't hallucinate a Chou-Fasman propensity or confuse aggregation with fibril formation.

See [`docs/active/MCP_RUNBOOK.md`](docs/active/MCP_RUNBOOK.md) for full configuration, the tool reference, Cursor / Continue setup, and troubleshooting.

---

## Tech stack

<table>
  <tr>
    <td><strong>Frontend</strong></td>
    <td>React 18 · TypeScript 5 · Vite · Tailwind · shadcn/ui · Zustand · Recharts · <a href="https://molstar.org/">Mol*</a></td>
  </tr>
  <tr>
    <td><strong>Backend</strong></td>
    <td>Python 3.11 · FastAPI · Pydantic v2 · pandas · PyTorch (CPU)</td>
  </tr>
  <tr>
    <td><strong>Predictors</strong></td>
    <td>TANGO (Linux 64-bit subprocess) · S4PRED (5-model BiLSTM ensemble) · FF-Helix (pure Python) · biochem (vectorized)</td>
  </tr>
  <tr>
    <td><strong>Observability</strong></td>
    <td>Sentry (release-tagged + rich context + source maps + Slack alerts + Seer AI triage)</td>
  </tr>
  <tr>
    <td><strong>CI/CD</strong></td>
    <td>GitHub Actions · CodeRabbit (AI PR review) · Dependabot (weekly batched)</td>
  </tr>
  <tr>
    <td><strong>Deployment</strong></td>
    <td>Docker Compose + Caddy (auto-TLS) · DESY Kubernetes (planned)</td>
  </tr>
  <tr>
    <td><strong>Reproducibility</strong></td>
    <td>Permalink-encoded analysis state · Zenodo DOI per release · CITATION.cff</td>
  </tr>
</table>

---

## How it works

```mermaid
flowchart LR
    A["📝 Paste a sequence<br/>or upload CSV/FASTA"] --> B["🔍 PVL runs<br/>TANGO · S4PRED · FF-Helix · biochem"]
    B --> C["📊 Interactive dashboard<br/>(classifications · distributions · drill-down)"]
    C --> D["🔗 Copy permalink<br/>or export figure pack"]
    D --> E["📄 Cite in your paper<br/>(Zenodo DOI · paste URL)"]
```

---

## Use cases

- **Identify amyloid candidates** in a UniProt query (e.g., S. aureus reference proteome length 10-50)
- **Compare wild-type vs mutant** peptide cohorts side-by-side with overlay distributions
- **Generate a paper figure pack** — multi-panel SVG ready for a Nature supplement
- **Automate analysis from Claude Desktop** (Phase G1, MCP server in v0.2)
- **Find peptides similar to a reference** via vector embedding search (Phase 2 v0.2)

---

## API

FastAPI auto-generates OpenAPI documentation at runtime. Once the backend is running:

- Interactive docs: <http://localhost:8000/api/docs>
- OpenAPI JSON: <http://localhost:8000/api/openapi.json>
- ReDoc view: <http://localhost:8000/api/redoc>

Selected endpoints (full list in [`docs/active/CONTRACTS.md`](docs/active/CONTRACTS.md)):

| Endpoint | Method | Description |
|---|---|---|
| `/api/predict` | POST | Single sequence prediction |
| `/api/upload` | POST | Batch CSV / FASTA / XLSX upload |
| `/api/uniprot/execute` | POST | UniProt query → analysis pipeline |
| `/api/jobs/{id}` | GET | Poll async job status |
| `/api/version` | GET | Build version + SHA + timestamp |
| `/api/health` | GET | Health check (Sentry cron monitor) |

All request schemas use Pydantic v2 with `extra="forbid"` — unknown fields fail loudly with 422 (per [ADR-002](docs/active/DECISIONS.md#adr-002--pydantic-v2-extraforbid-on-request-schemas)).

---

## Documentation

| Document | What it covers |
|---|---|
| [`docs/active/MASTER_PUSH_PLAN.md`](docs/active/MASTER_PUSH_PLAN.md) | The 7-wave path from current state to full-platform vision |
| [`docs/active/TECH_PLATFORM_VISION.md`](docs/active/TECH_PLATFORM_VISION.md) | Platform thesis · technology radar · AI-platform vision |
| [`docs/active/DECISIONS.md`](docs/active/DECISIONS.md) | 12 architectural decision records (ADR-001 through ADR-012) |
| [`docs/active/ROADMAP.md`](docs/active/ROADMAP.md) | Phases A–L plus O / S — every planned feature with effort estimates |
| [`docs/active/TOP_CEO_RECOMMENDATIONS.md`](docs/active/TOP_CEO_RECOMMENDATIONS.md) | Solo OSS sustainability · funding paths · burnout protocol |
| [`docs/active/COVERAGE_AUDIT.md`](docs/active/COVERAGE_AUDIT.md) | Every Peleg + Alex feedback item with status |
| [`docs/active/SENTRY_RUNBOOK.md`](docs/active/SENTRY_RUNBOOK.md) | Observability ops · alert rules · error fingerprints |
| [`docs/active/ACTIVE_CONTEXT.md`](docs/active/ACTIVE_CONTEXT.md) | Architecture overview · entry points · data flow |
| [`docs/active/CONTRACTS.md`](docs/active/CONTRACTS.md) | API endpoints · request/response shapes |
| [`docs/active/TESTING_GUIDE.md`](docs/active/TESTING_GUIDE.md) | Test patterns · golden fixtures · debugging |
| [`docs/active/DEPLOYMENT.md`](docs/active/DEPLOYMENT.md) | VM + Docker + Caddy step-by-step |
| [`README_EXPLAINER.md`](README_EXPLAINER.md) | Non-technical biologist-facing A-to-Z guide |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute · what to expect from a part-time-maintained project |

---

## Running tests

```bash
make test          # Backend (pytest) — 463 deterministic, no-network tests
cd ui && npx vitest run   # Frontend (vitest) — 424 component tests
make lint          # Linters (ruff + ESLint)
make typecheck     # Type checks (mypy + tsc)
make ci            # Full pipeline
```

**Total: 887 tests, all green.** Tests are deterministic and run without network access.

---

## Project structure

```
peptide_prediction/
├── backend/                  # FastAPI Python backend
│   ├── api/routes/           # Route definitions
│   ├── services/             # Business logic
│   ├── schemas/              # Pydantic v2 models (extra="forbid")
│   ├── auxiliary.py          # FF-Helix + 4-category classification
│   ├── tango.py · s4pred.py  # External predictor wrappers
│   └── tests/                # 463 pytest tests
├── ui/                       # React + TypeScript frontend
│   ├── src/components/       # ~120 components incl. Mol3DViewer, SetDiagram
│   ├── src/components/drilldown/  # Universal drill-down system
│   ├── src/components/hover/      # Universal hover system
│   ├── src/lib/              # metricRegistry, permalink, sentryContext
│   ├── src/stores/           # Zustand: dataset, threshold, hover, drilldown
│   └── src/pages/            # Index, Results, PeptideDetail, QuickAnalyze
├── pvl-cli/                  # `pvl analyze` CLI (scaffolded — Wave 2)
├── pvl-py/                   # `import pvl` Python package (scaffolded — Wave 2)
├── docker/                   # Multi-stage Dockerfiles + 4 compose files
├── docs/active/              # Living documentation (24 docs)
└── docs/images/              # README screenshots
```

---

## Citing PVL

```bibtex
@software{pvl_2026,
  author    = {Azaizah, Said and Ragonis-Bachar, Peleg and Golubev, Aleksandr},
  title     = {Peptide Visual Lab (PVL)},
  version   = {0.1.0},
  year      = {2026},
  url       = {https://github.com/saidaz24-meet/peptide_prediction},
  doi       = {10.5281/zenodo.PENDING},
  license   = {MIT}
}
```

The Zenodo DOI is auto-assigned on each GitHub release. The DOI badge will appear here once v0.1.0 ships.

PVL also exposes a per-analysis citation hook: every analysis URL is copyable + citable via the in-app **Reproducibility Ribbon**. Paste a permalink in your paper to give readers the exact same view you analyzed.

See [`CITATION.cff`](CITATION.cff) for machine-readable citation metadata.

---

## Authors

<table>
  <tr>
    <td><strong>Platform + UI</strong></td>
    <td>
      <a href="https://orcid.org/0009-0002-3596-5358">Said Azaizah</a>
      · Technion + DESY (→ MIT)
      <br/>
      <em>Builder, designer, AI-platform vision.</em>
    </td>
  </tr>
  <tr>
    <td><strong>Algorithms + scientific design</strong></td>
    <td>
      <strong>Dr. Peleg Ragonis-Bachar</strong> · Technion
      <br/>
      <em>4-category classification, threshold definitions, scientific review.</em>
    </td>
  </tr>
  <tr>
    <td><strong>Scientific advisor</strong></td>
    <td>
      <strong>Dr. Aleksandr Golubev</strong> · DESY + Technion
      <br/>
      <em>Research direction, lab adoption, infrastructure.</em>
    </td>
  </tr>
</table>

---

## Acknowledgements

PVL stands on the shoulders of these tools and groups. Cite them where appropriate.

- **[TANGO](https://tango.switchlab.org/)** — Fernandez-Escamilla et al., *Nat Biotechnol* 22, 1302–1306 (2004)
- **[S4PRED](https://github.com/psipred/s4pred)** — Moffat et al., *Bioinformatics* 38, 4647–4653 (2022)
- **[Mol\*](https://molstar.org/)** — RCSB PDB + EBI + ETH consortium
- **[AlphaFold DB](https://alphafold.ebi.ac.uk/)** — Jumper et al. (2021); Varadi et al. (2024)
- **DESY / CSSB** — Prof. Meytal Landau lab; Dr. Aleksandr Golubev

---

## License

[MIT](LICENSE). Maintained part-time by Said with support from Peleg and Alex. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for what part-time means in practice (TL;DR: 1–4 week response times during academic terms; bigger releases batched in summer breaks).
