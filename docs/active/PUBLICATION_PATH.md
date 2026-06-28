# PVL — Publication Path

> **Goal**: cut a citable v1.0 release, deposit it as a Zenodo DOI, register PVL on bio.tools, then submit the JOSS paper. Sequential — each step depends on the one before.

---

## TL;DR — the workflow

| Step | What | Time | Blocked by |
|------|------|------|------------|
| 0 | Resolve LICENSE (MIT confirmed on main) + collect Peleg + Alex ORCIDs | 1 day | Peleg / Alex reply |
| 1 | Cut `v1.0.0` GitHub release | 5 min | Step 0 |
| 2 | Zenodo issues DOI (auto) | 1–2 min | Step 1 |
| 3 | Wire DOI back into `CITATION.cff` + README badge | 5 min | Step 2 |
| 4 | Submit to bio.tools | 20 min | Step 2 (DOI ready) |
| 5 | Submit `paper/paper.md` to JOSS | 1 hr | Steps 2 + 4 |

When step 5 lands the JOSS DOI is the canonical paper citation; the Zenodo concept DOI is the canonical software citation. PVL is now a permanent, indexed, peer-reviewed scientific artifact.

---

## Step 0 — Pre-flight checklist

Resolve these BEFORE tagging a release. Each is an email to send, not work to do.

- [ ] **LICENSE**: `LICENSE` on main is MIT (verified). If `LICENSE-DESY-RESEARCH.md` exists alongside, delete it — bio.tools and JOSS both reject "MIT but also non-commercial."
- [ ] **Peleg ORCID**: in `CITATION.cff` as `0000-0002-0979-8165`. Already set.
- [ ] **Alex ORCID**: in `CITATION.cff` as `PENDING`. Ask once. Without it, JOSS will request it during review.
- [ ] **Said ORCID**: `0009-0002-3596-5358`. Already set.
- [ ] **Meytal Landau ORCID**: `0000-0002-1743-3430`. Already set (as PI).
- [ ] **Stable homepage URL**: pick one (Hetzner `94.130.178.182:3000` is fine for now; DESY URL once migration completes). bio.tools allows URL updates post-registration, so the Hetzner URL is acceptable as a placeholder.

---

## Step 1 — Cut the v1.0.0 release

### One-time Zenodo ↔ GitHub link (do this BEFORE the release if not yet done)

1. Go to https://zenodo.org/account/settings/github/
2. Sign in with the GitHub account that owns `saidaz24-meet/peptide_prediction` (Said's account).
3. Find `peptide_prediction` in the repo list. Toggle the switch to ON.
4. (Optional) fill in default metadata on Zenodo: license MIT, communities ("Bioinformatics"), keywords.

If Zenodo asks for OAuth permissions, accept `repo` scope — required for the integration to read release events.

### Verify CITATION.cff version

```bash
grep -E "^version|^date-released" CITATION.cff
```
Expected (update if not today):
```
version: "1.0.0"
date-released: "YYYY-MM-DD"
```

If wrong, edit, commit, push to main.

### Cut the release

```bash
gh release create v1.0.0 \
  --title "v1.0.0 — Wave 2.8 + 2.9 close-out" \
  --notes-file docs/active/RELEASE_NOTES.md \
  --target main

gh release view v1.0.0
```

Or web UI: https://github.com/saidaz24-meet/peptide_prediction/releases/new → tag `v1.0.0`, paste release notes.

### Release notes template

Use this for `docs/active/RELEASE_NOTES.md` — keeps Zenodo + GitHub both happy:

```markdown
# v1.0.0 — Wave 2.8 + 2.9 close-out

The first stable release of Peptide Visual Lab.

## Scientific pipeline
- **TANGO** aggregation propensity (subprocess, deterministic)
- **S4PRED** secondary structure prediction (5-network ensemble, primary helix predictor)
- **FF-Helix** classification (S4PRED helix + µH threshold, per ADR-003)
- **SSW** prediction (TANGO ∪ S4PRED, canonical OR)
- **FF-SSW** classification (SSW + hydrophobicity threshold)
- **Biochemistry** — Fauchère-Pliska hydrophobicity, charge (pH 7.4), µH (Eisenberg)

## Web surfaces
- Quick Analyze (single sequence), Upload (CSV/TSV/XLSX/FASTA), UniProt query
- Results dashboard with KPIs, Venn (4-class), threshold tuner, Smart Candidate Ranking
- PeptideDetail with Mol* AlphaFold overlay, sliding-window profiles, correlation matrix
- Database comparison with Welch's t-test backend
- Self-contained HTML report export per peptide

## Multi-surface ecosystem
- ✅ Web app, MCP server, Python helpers
- 🚧 `pvl-cli` (post-1.0)

## Quality gates
- 646 backend pytest cases · 672 frontend vitest cases · all passing
- `ruff check backend` clean · `tsc --noEmit` clean
- CI green · CodeRabbit AI review on every PR · Sentry observability

## Citing this release
See `CITATION.cff` for the canonical citation.

## Acknowledgements
- **Algorithms & scientific review**: Dr. Peleg Ragonis-Bachar (Technion)
- **Scientific advisor & deployment**: Dr. Aleksandr Golubev (DESY)
- **Lead developer**: Said Azaizah (Technion + DESY)
- **PI**: Prof. Meytal Landau (Technion + EMBL Hamburg + CSSB)

## License
MIT. See `LICENSE`.
```

---

## Step 2 — Zenodo auto-mints the DOI

After the GitHub release publishes, wait 1–2 minutes. Then:

```bash
open "https://zenodo.org/account/records"
```

You'll see a new `v1.0.0` entry with a freshly minted DOI like `10.5281/zenodo.XXXXXXX`.

Zenodo issues TWO DOIs:
- **Versioned DOI** — points specifically at v1.0.0 (immutable)
- **Concept DOI** — points at "the latest version of PVL" (rolls forward with each release)

The concept DOI is what you cite in papers ("PVL: DOI 10.5281/zenodo.YYYYYYY") because it doesn't drift when v1.1.0 lands.

---

## Step 3 — Wire the DOI back into the repo

### Update `CITATION.cff`

```yaml
identifiers:
  - description: "Zenodo archive DOI (versioned, v1.0.0)"
    type: doi
    value: "10.5281/zenodo.XXXXXXX"  # ← versioned
  - description: "Zenodo concept DOI (always-latest)"
    type: doi
    value: "10.5281/zenodo.YYYYYYY"  # ← concept
```

### Add the DOI badge to `README.md`

```markdown
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.YYYYYYY.svg)](https://doi.org/10.5281/zenodo.YYYYYYY)
```

### Commit (do NOT tag this one — lives between releases)

```bash
git add CITATION.cff README.md
git commit -m "docs: wire Zenodo DOI for v1.0.0"
git push
```

---

## Step 4 — bio.tools registration

Form: <https://bio.tools/contribute> (login with ELIXIR AAI or email)
Time: ~20 minutes once you start.

### Paste-ready field values

#### Identity
- **Name**: `Peptide Visual Lab`
- **bio.tools ID**: `peptide-visual-lab` or `pvl`
- **Short name**: `PVL`

#### Description (short, ≤200 chars)
> All-in-one web dashboard for peptide aggregation propensity (TANGO), secondary-structure prediction (S4PRED), fibril-forming helix detection, and AlphaFold 3D overlay.

#### Description (full, ≤1000 chars)
> Peptide Visual Lab (PVL) is an open-source web platform that unifies peptide aggregation propensity (TANGO), secondary-structure prediction (S4PRED), fibril-forming-helix (FF-Helix) candidate detection, secondary-structure-switch (SSW) prediction, and live 3D structure visualization (AlphaFold via Mol*) in a single interactive dashboard. Researchers can upload a CSV/FASTA, paste a single sequence, or query UniProt directly; every analysis becomes a citable permalink encoding version + thresholds for reproducibility. PVL is designed as a multi-surface research instrument: a web app, an MCP server so AI assistants can drive analyses, and a planned Python package + CLI. Built for structural biology and biophysics groups working on amyloid, antimicrobial, and chameleon peptides.

#### URLs
- **Homepage**: `http://94.130.178.182:3000` (or DESY URL once migrated)
- **Source code**: `https://github.com/saidaz24-meet/peptide_prediction`
- **Issue tracker**: `https://github.com/saidaz24-meet/peptide_prediction/issues`
- **Documentation**: `https://github.com/saidaz24-meet/peptide_prediction#readme`
- **Download**: `https://github.com/saidaz24-meet/peptide_prediction/releases`

#### License
- **License (OSI)**: `MIT`

#### EDAM topics
- `topic_0078` Proteins
- `topic_0166` Protein structural motifs
- `topic_0820` Membrane and lipoproteins
- `topic_2275` Molecular modelling
- `topic_3382` Imaging *(for AlphaFold 3D viewer)*
- `topic_3892` Sequence comparison *(for database comparison)*

EDAM browser: <https://ifb-elixirfr.github.io/edam-browser/>

#### EDAM operations
- **Primary**: `operation_0473` Protein secondary structure prediction *(via S4PRED)*
- `operation_0269` Protein property prediction *(hydrophobicity, charge, µH)*
- `operation_0407` Protein function annotation *(via UniProt cross-link)*
- `operation_0245` Protein architecture recognition *(FF-Helix + SSW classification)*
- `operation_0570` Structure visualisation *(Mol* / AlphaFold overlay)*
- `operation_0337` Visualisation

#### Inputs
- `data_2976` Protein sequence — `format_1929` FASTA, `format_3752` CSV, `format_3475` TSV, `format_3620` XLSX
- `data_3021` UniProt accession — `format_2330` text

#### Outputs
- Aggregation propensity (per-residue TANGO) — JSON
- Protein secondary structure (per-residue S4PRED) — JSON
- Classification flags (FF-Helix, SSW, FF-SSW, Helix) — JSON
- Publication-ready figures — SVG (`format_3604`) + PNG (`format_3603`)
- Citable permalink — URL

#### Tool type / platforms / maturity
- **Tool type**: `Web application` (primary), planned `Library` (`pvl-py`), planned `Command-line tool` (`pvl-cli`)
- **Platforms**: Linux (Docker, primary), macOS (dev), Windows (Docker Desktop), Browser
- **Maturity**: `Mature` — 646 backend + 672 frontend tests as of v1.0.0, CI green, deployed publicly.
- **Cost**: `Free of charge`
- **Accessibility**: `Open access`

#### Programming languages
- `Python` (backend, FastAPI), `TypeScript` (frontend, React + Vite)

#### Authors — paste from `CITATION.cff`
1. **Dr. Peleg Ragonis-Bachar** — Technion — ORCID `0000-0002-0979-8165`
2. **Said Azaizah** — Technion + DESY + MIT — ORCID `0009-0002-3596-5358`
3. **Dr. Aleksandr Golubev** — DESY + Technion — ORCID `PENDING-ASK-ALEX`
4. **Prof. Meytal Landau (PI)** — Technion + EMBL Hamburg + CSSB — ORCID `0000-0002-1743-3430`

#### Funding
- DESY / CSSB Hamburg (deployment infrastructure)
- Technion (algorithm collaboration)

#### Citations
After bio.tools approval, the **Publications** section should be populated with:
- **Other → Zenodo archive**: the concept DOI from Step 2
- **Primary → JOSS paper**: the JOSS DOI from Step 5 (once accepted)

### Submission flow

1. Resolve any remaining Step 0 blockers.
2. Sign in at https://bio.tools/login (ELIXIR AAI or email).
3. Click "Contribute" → "New tool".
4. Paste the fields above. Use the form's autosuggest for EDAM terms — paste the IDs, the form fills in human-readable labels.
5. Submit. Curator review takes ~1–2 weeks.
6. Once approved, add the bio.tools badge to README:
   ```markdown
   [![bio.tools](https://img.shields.io/badge/bio.tools-PVL-blue)](https://bio.tools/pvl)
   ```

---

## Step 5 — JOSS paper submission

The JOSS draft lives at `paper/paper.md` with bibliography at `paper/paper.bib`. Once you have the Zenodo DOI:

1. Edit `paper/paper.md` and fill in:
   ```yaml
   archive_doi: 10.5281/zenodo.YYYYYYY  # Zenodo concept DOI
   ```
2. Verify the bib entries resolve.
3. Submit at <https://joss.theoj.org/papers/new>.
4. JOSS reviewers test that PVL builds, runs, has documentation, and is scientifically credible. Expect ~4–8 weeks to acceptance.
5. Once accepted, JOSS issues a paper DOI (`10.21105/joss.XXXXX`). Add it to:
   - `CITATION.cff` (as the primary `preferred-citation`)
   - `README.md` (badge)
   - bio.tools "Publications" → Primary

---

## After all five steps

PVL is now:
- A permanent, citable software archive on Zenodo
- A discoverable tool in the ELIXIR bio.tools registry
- A peer-reviewed paper in JOSS

The README badge row should look like:

```markdown
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.YYYYYYY.svg)](https://doi.org/10.5281/zenodo.YYYYYYY)
[![bio.tools](https://img.shields.io/badge/bio.tools-PVL-blue)](https://bio.tools/pvl)
[![JOSS](https://joss.theoj.org/papers/XXXXX/status.svg)](https://joss.theoj.org/papers/XXXXX)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/saidaz24-meet/peptide_prediction/actions/workflows/ci.yml/badge.svg)](https://github.com/saidaz24-meet/peptide_prediction/actions)
```

That's the publication path. ~3 weeks of elapsed time end-to-end (mostly waiting on reviewers); ~2 hours of actual work.
