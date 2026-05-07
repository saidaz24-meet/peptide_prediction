# Peptide Visual Lab (PVL)

**The all-in-one peptide aggregation + structure prediction dashboard. Multi-tool consensus, live 3D overlay, reproducibility-as-permalink, AI-platform-ready.**

[![CI](https://github.com/saidaz24-meet/peptide_prediction/actions/workflows/ci.yml/badge.svg)](https://github.com/saidaz24-meet/peptide_prediction/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tests: 887 passing](https://img.shields.io/badge/tests-887%20passing-brightgreen)](#running-tests)
[![Sentry monitored](https://img.shields.io/badge/Sentry-monitored-blueviolet)](https://sentry.io)
[![CodeRabbit reviewed](https://img.shields.io/badge/CodeRabbit-AI%20reviewed-orange)](.coderabbit.yaml)

---

## What makes PVL different

- 🧬 **Multi-tool consensus** — TANGO + S4PRED + FF-Helix + biochemical metrics + AlphaFold structure in **one** dashboard. No tab-switching, no ad-hoc CSV merging.
- 🔬 **Live 3D structure overlay** — TANGO peaks, S4PRED helix segments, FF-Helix candidate regions, and SSW switch zones rendered **directly on the AlphaFold structure** via [Mol\*](https://molstar.org/). No competing peptide tool offers this.
- 🔗 **Reproducibility-as-permalink** — every analysis becomes a URL. Paste it in your paper, Slack, or email; recipient sees the exact same view, same parameters, same version.
- 🤖 **AI-platform-ready** — designed as a multi-surface ecosystem (web + Python package + CLI + planned [MCP](https://modelcontextprotocol.io) server). Researchers will call PVL from Claude Desktop / Cursor / their own LLM agents.
- 🆓 **Open source, MIT, runs locally** — `docker compose up` on your laptop. Your data never leaves your machine.

---

## Quick start

### Try it instantly (no install)
Visit the demo: <https://[demo-url-pending]>. The Staphylococcus 2023 dataset (2,916 peptides) auto-loads. Click any peptide to drill in.

### Run a single sequence
Go to **Quick Analyze** (`/quick`) and paste a peptide sequence. Results in seconds.

### Self-host
```bash
git clone https://github.com/saidaz24-meet/peptide_prediction.git
cd peptide_prediction
cp backend/.env.example backend/.env
make docker-up
```
Open <http://localhost:3000>. Done.

---

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** | React 18 + TypeScript 5 + Vite + Tailwind + shadcn/ui + Zustand + Recharts + Mol\* |
| **Backend** | FastAPI + Pydantic v2 + pandas + PyTorch (CPU) |
| **Predictors** | TANGO (subprocess) + S4PRED (BiLSTM) + FF-Helix (pure Python) + biochem (vectorized) |
| **Observability** | Sentry (release-tagged + rich context + source maps + Slack alerts) |
| **CI/CD** | GitHub Actions + CodeRabbit AI review + Dependabot |
| **Deployment** | Docker Compose + Caddy auto-TLS (current) → DESY K8s (planned) |
| **Reproducibility** | Permalink-encoded analysis state + auto-archived Zenodo DOIs per release |

See [`docs/active/TECH_PLATFORM_VISION.md`](docs/active/TECH_PLATFORM_VISION.md) for the full technology radar (adopt now / plan next / parked) and [`docs/active/DECISIONS.md`](docs/active/DECISIONS.md) for the 12 architectural decision records.

---

## Architecture (block diagram)

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser / Claude Desktop / Cursor  (multi-surface clients)        │
└──────────────┬───────────────────────────────────────┬─────────────┘
               │ React + Mol*                          │ MCP (planned v0.2)
               ▼                                       ▼
┌────────────────────────────────────────────────────────────────────┐
│  FastAPI backend (Pydantic v2 strict, OpenAPI auto-generated)      │
│  Routes: /api/predict · /api/upload · /api/uniprot · /api/jobs     │
└──────────────┬─────────────────────────────────────────────────────┘
               │
   ┌───────────┼───────────────┬───────────┬───────────┐
   ▼           ▼               ▼           ▼           ▼
TANGO    S4PRED (BiLSTM)   FF-Helix    biochem    UniProt + AlphaFold
                                                  (external)
```

---

## Features

### Analysis
- Quick single-sequence analysis (paste & go) or batch CSV / FASTA / XLSX upload
- UniProt query integration (search by keyword, organism, length, accession; live API)
- 4-category peptide classification: Helix / FF-Helix / SSW / FF-SSW (per Peleg's verbatim definitions)
- Per-residue sliding-window profiles (hydrophobicity, μH, TANGO) with multi-channel coloring
- S4PRED per-residue probability curves with colored sequence track
- TANGO per-residue aggregation heatmap with beta + helix overlays
- Helical wheel projection (Schiffer-Edmundson, Eisenberg μH arrow)
- Live 3D AlphaFold structure overlay with PVL prediction annotations
- Hover-everywhere drill-down: every metric reveals scientific definition + percentile + 2-3 related peptides

### Visualization & export
- 12-color publication-ready charts (distribution, classification comparison, correlation matrix, set diagram)
- Universal slide-over inspector (`↗` icon on any chart) with chart 2× + underlying peptide table
- SVG / PNG / CSV / FASTA / PDF report export with embedded permalink
- Reproducibility ribbon: persistent URL + version + build SHA at top of every analysis page

### Maintenance & observability
- Sentry release-tagged events with rich context (peptide count, predictors, viewport, theme)
- Source maps in CI for readable production stack traces
- Trace ID correlation between frontend and backend events
- Auto-suggested fix PRs via Sentry Seer
- AI code review on every PR via CodeRabbit
- Weekly Dependabot batched updates (npm + pip + GitHub Actions)

---

## Documentation

| Document | What it covers |
|---|---|
| [`docs/active/TECH_PLATFORM_VISION.md`](docs/active/TECH_PLATFORM_VISION.md) | Platform thesis, technology radar, AI-platform vision, sustainability plan |
| [`docs/active/DECISIONS.md`](docs/active/DECISIONS.md) | 12 architectural decision records (ADR-001 through ADR-012) |
| [`docs/active/ROADMAP.md`](docs/active/ROADMAP.md) | Phases A–L plus O / S — every planned feature with effort estimates |
| [`docs/active/ACTIVE_CONTEXT.md`](docs/active/ACTIVE_CONTEXT.md) | Architecture overview, entry points, data flow |
| [`docs/active/CONTRACTS.md`](docs/active/CONTRACTS.md) | API endpoints, request / response shapes |
| [`docs/active/TESTING_GUIDE.md`](docs/active/TESTING_GUIDE.md) | Test patterns, golden fixtures, debugging |
| [`docs/active/SENTRY_RUNBOOK.md`](docs/active/SENTRY_RUNBOOK.md) | Observability ops, alert rules, error-fingerprint reference |
| [`docs/active/DEPLOYMENT.md`](docs/active/DEPLOYMENT.md) | VM + Docker + Caddy step-by-step |
| [`README_EXPLAINER.md`](README_EXPLAINER.md) | Non-technical biologist-facing A-to-Z guide |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute (and what to expect from a part-time-maintained project) |

---

## Running tests

```bash
make test          # Backend (pytest) — 463 deterministic, no-network tests
cd ui && npx vitest run   # Frontend (vitest) — 424 component tests
make lint          # Linters (ruff + ESLint)
make typecheck     # Type checks (mypy + tsc)
make ci            # Full pipeline
```

Total: **887 tests, all green**. Tests are deterministic and run without network access.

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

The Zenodo DOI is auto-assigned on each GitHub release. The latest DOI badge will appear here once v0.1.0 ships. See [`CITATION.cff`](CITATION.cff) for machine-readable citation metadata.

PVL also exposes a per-analysis citation hook: every analysis URL is copyable + citable via the in-app Reproducibility Ribbon. Paste a permalink in your paper to give readers the exact same view you analyzed.

---

## Authors

- **Platform + UI**: [Said Azaizah](https://orcid.org/0009-0002-3596-5358) — Technion + DESY
- **Algorithms + scientific design**: Dr. Peleg Ragonis-Bachar — Technion
- **Scientific advisor**: Dr. Aleksandr Golubev — DESY + Technion

---

## Acknowledgements

- **[TANGO](https://tango.switchlab.org/)** — Fernandez-Escamilla et al., *Nat Biotechnol* 22, 1302–1306 (2004)
- **[S4PRED](https://github.com/psipred/s4pred)** — Moffat et al., *Bioinformatics* 38, 4647–4653 (2022)
- **[Mol\*](https://molstar.org/)** — RCSB PDB + EBI + ETH consortium
- **[AlphaFold DB](https://alphafold.ebi.ac.uk/)** — DeepMind + EBI
- **DESY / CSSB (Landau Lab)** — Prof. Meytal Landau, Dr. Aleksandr Golubev

---

## License

[MIT](https://opensource.org/licenses/MIT). Maintained part-time. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for what that means in practice.
