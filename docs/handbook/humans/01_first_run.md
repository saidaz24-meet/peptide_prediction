# First Run — From `git clone` to "I see the UI"

> 12 minutes start to finish on a clean macOS or Linux box. If you've used Python and Node before, half that.

## Contents

- [What you'll have when you finish](#what-youll-have-when-you-finish)
- [Pre-flight check (1 min)](#pre-flight-check-1-min)
- [Clone (10 sec)](#clone-10-sec)
- [Backend (4 min)](#backend-4-min)
- [Frontend (3 min)](#frontend-3-min)
- [Quick smoke test (1 min)](#quick-smoke-test-1-min)
- [Run the tests](#run-the-tests)
- [Where to go next](#where-to-go-next)
- [Troubleshooting](#troubleshooting)

## What you'll have when you finish

A local PVL instance at <http://localhost:5173> with the example dataset loaded, every panel rendering, and a `make test` you can run against your changes.

## Pre-flight check (1 min)

```bash
python3 --version   # need 3.11+
node --version      # need 18+
docker --version    # not required for dev, but useful
git --version       # any modern git
```

If `python3` is < 3.11, install via pyenv / asdf / Homebrew. PVL targets 3.11 in CI; older versions silently break the [TANGO](02_the_science.md#2-tango) subprocess path because of `dataclass(slots=True)` usage.

## Clone (10 sec)

```bash
git clone https://github.com/saidaz24-meet/peptide_prediction
cd peptide_prediction
```

## Backend (4 min)

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
```

Optional but recommended — verify the TANGO binary works:

```bash
ls backend/Tango/bin/tango    # macOS dev binary, checked into the repo
# If on Linux: ls tools/tango/bin/tango_linux_x86_64
```

Start the FastAPI server:

```bash
cd backend
USE_TANGO=1 USE_S4PRED=1 .venv/bin/uvicorn api.main:app --reload --port 8000
```

The first start takes ~10 seconds because [S4PRED](02_the_science.md#3-s4pred) loads 5 PyTorch model weights. Subsequent starts (with `--reload`) reuse them. You should see:

```
{"event": "boot", "message": "USE_TANGO=True • USE_S4PRED=True • CELERY=False"}
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

Verify in another terminal:

```bash
curl http://localhost:8000/api/health
# {"ok":true}
```

## Frontend (3 min)

```bash
cd ui
npm install
npm run dev
```

Vite starts in ~5 seconds:

```
VITE v5.x.x  ready in 642 ms
➜  Local:   http://localhost:5173/
```

Open <http://localhost:5173>. You should see the PVL landing page with a "Try the demo" CTA. The first-visit auto-load fetches the bundled Staphylococcus 2023 dataset (2,916 peptides) — this is also where you'll spot whether the precompute endpoint is wired (instant) or the live pipeline is running (~20 min on first run).

## Quick smoke test (1 min)

In the UI:

1. Go to `/quick`.
2. Paste `LKLLKLLLKLLLKLL` into the sequence box.
3. Click **Analyze**.
4. The result should show:
   - **Helix 100% · SSW 0% · Coiled-coil 0%** in the pipeline strip
   - Per-tool chips: S4PRED helix, no FF-Helix, no FF-SSW
   - A blue sequence track (every residue Helix-colored)

If you see those, the backend is correctly classifying via the 4-class pipeline. You're done with the first run.

## Run the tests

```bash
# Backend (fast — < 1 min)
cd backend
USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ -q

# Frontend (slower — ~45 sec)
cd ../ui
npx vitest run
```

Both should report `passed` with no fails. Numbers as of 2026-06-29: 646 backend + 672 frontend.

## Where to go next

- Curious about the science → `humans/02_the_science.md`
- Curious how a request flows from UI to predictor → `humans/03_the_pipeline.md`
- Want to walk every page in the UI → `humans/04_the_ui_walkthrough.md`
- Want to ship a change → `agents/03_doing_a_safe_change.md`

## Troubleshooting

| Symptom | Fix |
|---|---|
| `TANGO binary not found` on first request | Set `USE_TANGO=0` for dev — you'll still get S4PRED + biochem + FF-Helix. Or build the platform binary per `humans/06_deploying.md`. |
| S4PRED first request takes 30 s+ | One-time PyTorch weights load. With `--reload`, subsequent restarts reuse the warm process. |
| `Cannot find module @/components/...` | Run `npm install` again — Vite cache occasionally desyncs. |
| Port 5173 already in use | `lsof -ti:5173 \| xargs kill -9` |
| `make test` fails on a fresh clone | You haven't activated the venv. `source backend/.venv/bin/activate` then re-run. |

For anything else, `humans/08_troubleshooting.md` has the full set.
