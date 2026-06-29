# 07 — Artifacts Index

Single lookup table for every binary, model checkpoint, JSON, CSV, and named
volume PVL depends on but does not (or cannot) keep purely as source code. If
you are hunting for a file an import or endpoint expects, find it here first.

For each artifact: **where it lives**, **how it is generated**, **how it is
regenerated if lost**, and **who may overwrite it**. Paths are repo-relative
unless they start with `/data` (a container path). Deploy specifics live in
[../humans/06_deploying.md](../humans/06_deploying.md).

---

## 1. TANGO binaries (committed, per-platform)

| | |
|---|---|
| **Lives at** | `backend/Tango/bin/tango` (the runtime copy the backend execs; built for the dev host — macOS x86_64 here) and `tools/tango/bin/` which holds all four prebuilt variants: `tango_darwin_x86_64`, `tango_linux_x86_64`, `tango_linux_i386`, `tango_win32.exe`. |
| **Generated** | Closed-source third-party binary from the TANGO authors. Not built from source in this repo. |
| **Regenerated** | Cannot be rebuilt — these are vendored. If lost, restore from git (`backend/Tango/bin/tango`, `tools/tango/bin/tango_linux_x86_64`, and `tango_darwin_x86_64` are all tracked) or re-obtain from the upstream TANGO distribution. The Linux x86_64 variant is the one Docker/VPS uses. |
| **Overwritten by** | Nobody, routinely. Only a deliberate vendor-binary update. Verify any swap with `make smoke-tango`. |

Note: the prompt's guessed Linux path `tools/tango/bin/tango_linux_x86_64` is
**correct and present**.

## 2. S4PRED model weights (gitignored, host-cached)

| | |
|---|---|
| **Lives at** | `tools/s4pred/models/weights_1.pt` … `weights_5.pt` (5-model ensemble). |
| **Generated** | Pretrained checkpoints from the S4PRED project — downloaded, not trained here. |
| **Regenerated** | **Gitignored** (`.gitignore` line 49: `*.pt`). They will not come back from `git checkout`. Re-fetch from the S4PRED upstream release into `tools/s4pred/models/`. First validation run also lazy-downloads them (see `rerun_validation_2026_06_07.py` prereqs). |
| **Overwritten by** | The S4PRED installer/downloader only. Never edit by hand. |

## 3. Precomputed reference datasets (host-generated, not committed)

| | |
|---|---|
| **Lives at** | `backend/data/precomputed/peleg_118.json` and `backend/data/precomputed/gold_standard.json`. The directory currently exists but is **empty** on this checkout. |
| **Generated** | `backend/scripts/precompute_dataset.py` runs the full pipeline (TANGO + S4PRED) over a reference input and writes the normalized `POST /api/predict/batch` response shape. Powers the instant "Try example" / `/api/precomputed/<id>` serve path. |
| **Regenerated** | From `backend/`: `USE_TANGO=1 USE_S4PRED=1 python scripts/precompute_dataset.py peleg_118` (and again with `gold_standard`). The script passes `force_recompute=True` + `bypass_tango_budget=True` so TANGO actually runs and the 2,916-row gold set is not budget-gated (see KNOWN_ISSUES ISSUE-034). Output must be **byte-reproducible** from the same PVL version + thresholds. |
| **Overwritten by** | Only `precompute_dataset.py` on a host with both predictors. Never hand-edit — a hand-tuned curve breaks single-vs-batch reproducibility. |

## 4. Reference dataset inputs (committed)

| | |
|---|---|
| **Lives at** | `backend/data/reference_datasets/peleg_118_fibril_validated.json` (118 curated fibril-forming peptides, ≤40 aa, curator Peleg) and `backend/data/reference_datasets/staphylococcus_2023.xlsx` (the `gold_standard` input, n=2,916 with 66 labelled). |
| **Generated** | Hand-curated by Peleg / sourced from the Staphylococcus 2023 benchmark. Versioned by `schema_version` (see `backend/data/reference_datasets/README.md`). |
| **Regenerated** | Tracked in git — restore with `git checkout`. There is no script that re-derives them; they are primary curated inputs. |
| **Overwritten by** | Only a deliberate, reviewed dataset revision (bump `schema_version` / `ingested_at`). These are the source of truth the precomputed JSONs in §3 are built from. |

The prompt's note "any staphylococcus_2023 file" resolves to the single
`staphylococcus_2023.xlsx`.

## 5. Example datasets (committed, served to the browser)

| | |
|---|---|
| **Lives at** | `ui/public/example/`: `amyloid_peptides.csv`, `antimicrobial_peptides.csv`, `fibril_forming_peptides_118.csv`, `peptide_data.csv`. |
| **Generated** | Static CSVs shipped with the frontend for the homepage example flow / upload demos. |
| **Regenerated** | Tracked in git — restore with `git checkout`. `fibril_forming_peptides_118.csv` mirrors the Peleg-118 set; regenerate it from the reference JSON if it drifts, otherwise treat as committed source. |
| **Overwritten by** | A frontend change to the example set only. Build copies `ui/public/` into `ui/dist/`. |

## 6. Demo dataset (committed)

| | |
|---|---|
| **Lives at** | `ui/public/Final_Staphylococcus_2023_new.xlsx` (copied into `ui/dist/` at build). |
| **Generated** | Static demo spreadsheet for the upload walkthrough. |
| **Regenerated** | Tracked in git — `git checkout`. |
| **Overwritten by** | Deliberate demo refresh only. |

## 7. Named Docker volumes (runtime state, never in git)

Declared in `docker/docker-compose.base.yml` (`volumes:` block) and mounted by
every service. All `driver: local`.

| Volume | Mount | Holds |
|---|---|---|
| `pvl-cache` | `/data/cache` | DuckDB-backed provider caches + runtime cache (provider state, TANGO/S4PRED memoization). |
| `pvl-runs` | `/data/runs` | Run outputs; **TANGO scratch** at `/data/runs/tango` (`TANGO_RUNTIME_DIR`). |
| `pvl-lance` | `/data/lance` | **LanceDB** vector index (`LANCE_DB_PATH=/data/lance`). |
| `pvl-uploads` | `/data/uploads` | User-uploaded files. |
| `pvl-redis` | `/data` (redis svc) | Redis persistence. |

| | |
|---|---|
| **Generated** | Created on first container start; populated as the app runs (caches fill, TANGO writes scratch, Lance indexes peptides). In dev, Lance also lives at `<repo_root>/data/lance/` — **gitignored** (`.gitignore` lines 14–15). |
| **Regenerated** | Ephemeral by design. Delete the volume and the app rebuilds it on next run. Rebuild the Lance index explicitly with `backend/scripts/reindex_lance.py` (idempotent; re-embeds every row — needed after an embedding-model dimension swap, ADR-016/017). Provider caches refill on demand. |
| **Overwritten by** | The running app, continuously. Safe to wipe for a clean slate; never commit. |

## 8. Sentry DSN (secret, never in repo)

| | |
|---|---|
| **Lives at** | Environment variable / deployment secret — **not in the repo**. See `docs/active/SENTRY_RUNBOOK.md` and the memory `reference_vps.md`. |
| **Regenerated** | Re-issued from the Sentry project settings; re-inject as an env var on the host. |
| **Overwritten by** | Whoever rotates the secret in the deploy environment. Never paste into source or docs. |

## 9. Paper + provenance docs (committed)

| | |
|---|---|
| **Lives at** | `paper/paper.md` + `paper/paper.bib` (JOSS draft); `docs/active/DECISIONS.md` (ADR log). |
| **Generated** | Authored by hand. Validation numbers cited in the paper come from `backend/scripts/rerun_validation_2026_06_07.py`, which writes `data/validation/2026_06_07_run.json` (raw, hash + thresholds + per-peptide classes) and a brief under `docs/active/RESEARCH_BRIEFS/`. |
| **Regenerated** | Tracked in git. Re-run the validation script (≈45 min for the Staph cohort) to refresh the reproducibility JSON; the prose is manual. |
| **Overwritten by** | Authors, in PRs. ADRs are append-only — add a new entry, don't rewrite history. |

---

## When in doubt

**If an artifact is missing, re-run the script that generates it — never
substitute a hand-made stand-in.** A precomputed JSON typed or tweaked by hand
silently breaks PVL's core invariant: precomputed output must be
**byte-reproducible** from the same PVL version + the same thresholds, and must
match what `POST /api/predict/batch` returns for the same peptides (single ≡
batch). The regeneration commands above are the only authoritative way to
recreate these files:

- Precomputed datasets → `scripts/precompute_dataset.py <id>` (with `USE_TANGO=1 USE_S4PRED=1`).
- Lance index → `scripts/reindex_lance.py`.
- Validation JSON → `scripts/rerun_validation_2026_06_07.py`.
- Vendored binaries / weights (TANGO, S4PRED) → restore from git or re-fetch upstream; verify TANGO with `make smoke-tango`.
- Docker volumes → wipe and let the app rebuild them.

Deployment-side regeneration (which host, which env vars, which volumes to
preserve) is in [../humans/06_deploying.md](../humans/06_deploying.md).
