# Contributing to Peptide Visual Lab

Thanks for the interest. PVL is an open-source MIT-licensed peptide-analysis platform maintained part-time by [Said Azaizah](https://orcid.org/0009-0002-3596-5358) (Technion + DESY → starting MIT). Contributions are welcome with a few clear expectations.

## What to expect

- **Response times**: 1–4 weeks during academic terms; faster during summer breaks. PVL is a research-grade open-source project, not a commercial product. We'll get to your PR / issue when we get to it.
- **AI-reviewed PRs**: every pull request gets an automatic [CodeRabbit](https://coderabbit.ai/) review with line-level comments. Address the AI's notes before requesting human review — it catches obvious issues for free.
- **Tone**: peer-to-peer, direct, signal-over-style. We don't do "consider" or "might want to" — say what's wrong and what to change.
- **Decisions**: load-bearing architectural choices are documented in [`docs/active/DECISIONS.md`](docs/active/DECISIONS.md) (12 ADRs). Read the relevant ones before proposing changes that contradict them.
- **Releases**: major features ship in summer-vacation cycles. v0.2 target: summer 2026 (MCP server, multi-predictor consensus). Don't expect rapid iteration during semester time — we batch.

If those tradeoffs work for you, we're glad to have you.

---

## Quick start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (optional, for containerized development)
- (Optional) TANGO binary in `tools/tango/bin/`
- (Optional) S4PRED weights in `tools/s4pred/models/`

### Setup

```bash
git clone https://github.com/saidaz24-meet/peptide_prediction.git
cd peptide_prediction

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Frontend
cd ../ui
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local
```

### Run dev servers

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — frontend
cd ui && npm run dev
```

Open <http://localhost:5173>.

---

## Workflow

### Branch naming

- `feature/<description>` — new features
- `fix/<description>` — bug fixes
- `docs/<description>` — documentation changes
- `refactor/<description>` — code restructure with no behavior change
- `chore/<description>` — deps, CI, tooling

### Commit messages

Conventional Commits style:

```
<type>(<scope>): <short description>

[longer body if needed]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Example: `feat(backend): add MCP server scaffolding for G1`

### PR checklist

- [ ] `make ci` passes locally (lint + typecheck + test)
- [ ] Tests added for new behavior; tests updated for changed behavior
- [ ] CodeRabbit review addressed (or explicitly disagreed with in a comment)
- [ ] Relevant docs updated (CONTRACTS.md if API; DECISIONS.md if architectural)
- [ ] PR description explains the *why*, not just the *what*

### Code style

#### Python
- `ruff` for linting and formatting (`ruff check . && ruff format .`)
- `mypy` for typing (`mypy .`)
- Follow PEP 8; explicit type hints on every function signature
- See [`backend/CLAUDE.md`](backend/CLAUDE.md) for backend-specific patterns

#### TypeScript
- Prettier (already configured) and ESLint
- **Always** use `??` not `||` for numeric fallbacks (numeric `0` is valid)
- Theme tokens (`bg-card`, `text-foreground`) — no hardcoded colors
- See [`ui/CLAUDE.md`](ui/CLAUDE.md) for frontend-specific patterns

---

## What's in scope

### Good first issues

Look for the [`good-first-issue` label on GitHub](https://github.com/saidaz24-meet/peptide_prediction/labels/good-first-issue). Small, well-scoped tickets we've vetted as approachable.

Common themes:
- Bug fixes in chart components
- Minor UI polish (theme tokens, mobile responsiveness)
- Test coverage gaps in `ui/src/components/__tests__/`
- Documentation improvements

### Big-feature work

Major features (Phase I multi-predictor, Phase G MCP server, Phase L landing redesign) are tracked in [`docs/active/ROADMAP.md`](docs/active/ROADMAP.md). If you want to take one on:

1. Open an issue first ("I'd like to work on Phase G1 MCP server").
2. We discuss scope + design.
3. You pick it up; we coordinate via the issue thread.

This keeps Said + the work contributor in sync without surprise large PRs.

### Out of scope (for v0.x)

- Commercial / SaaS features (see ADR-011 in DECISIONS.md)
- Alternate 3D viewers (Mol\* is canonical per ADR-008)
- Re-introducing dropped metrics (Chou-Fasman propensity, SSW score, "Aggregation per-residue %" — see ADR audit)

---

## Protected files

Some files require explicit reviewer approval before changes merge:

- **`backend/schemas/api_models.py`** — public API contract. Changes here can break clients.
- **`backend/api/routes/*.py`** — endpoint signatures are public API.
- **`docs/active/DECISIONS.md`** — adding/superseding ADRs requires reasoning in the PR body.

---

## Testing

```bash
make test          # All — 887 tests, deterministic, no network
make test-unit     # Fast unit tests
make lint          # Linters
make typecheck     # Type checks
make ci            # Full pipeline (run before submitting a PR)

# Backend in isolation
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ -v --tb=short

# Frontend in isolation
cd ui && npx vitest run
```

Add tests when:
- You add a new component (vitest snapshot + behavior tests)
- You add a new API route (pytest contract test using TestClient)
- You fix a bug (regression test pinning the bug)

---

## Sentry / observability

Production errors auto-route to Sentry with rich context. If you're working on a feature that could fail at runtime:

- Wrap risky operations with `Sentry.startTransaction({...})` for tracing.
- Add custom tags via `setPVLSentryContext({...})` so errors are triagable.
- See [`docs/active/SENTRY_RUNBOOK.md`](docs/active/SENTRY_RUNBOOK.md) for context conventions.

---

## Dependencies

- **Backend**: add to `requirements.txt` with a version pin and brief comment on why.
- **Frontend**: `npm install <package>` and document in your PR.
- **Major-version bumps**: open an issue first; we'll discuss timing (often deferred to summer release cycles to batch breaking changes).

Dependabot opens weekly batched PRs for minor/patch updates automatically.

---

## Questions?

- Bugs / feature requests → [GitHub Issues](https://github.com/saidaz24-meet/peptide_prediction/issues)
- Design discussions → [GitHub Discussions](https://github.com/saidaz24-meet/peptide_prediction/discussions)
- Scientific questions about TANGO / S4PRED / FF-Helix definitions → check [`README_EXPLAINER.md`](README_EXPLAINER.md) and [`docs/active/PELEG_FEEDBACK_INSTRUCTIONS.md`](docs/active/PELEG_FEEDBACK_INSTRUCTIONS.md) first; reach out via issue if unanswered.

---

## License

By contributing, you agree your contributions are licensed under [MIT](LICENSE).
