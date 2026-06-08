# A5 — Zenodo DOI release packet

> Outcome: an immutable DOI for v0.3.0 that bio.tools, JOSS, and the paper supplement can cite.
> Estimated time: 15 min (linking Zenodo to GitHub if not done) + 5 min (create release).

## How Zenodo + GitHub work together

Zenodo has a built-in GitHub integration. Once configured:

1. You link the GitHub repo on Zenodo's settings page (one-time).
2. Every GitHub release tag (e.g. `v0.3.0`) auto-triggers a Zenodo snapshot.
3. Zenodo issues a versioned DOI for that snapshot AND a concept DOI that always points to the latest.

The concept DOI is what we cite in papers ("PVL: DOI 10.5281/zenodo.XXXXXXX") because it doesn't drift when v0.2.0 lands.

---

## One-time setup (do this first)

1. Go to https://zenodo.org/account/settings/github/
2. Sign in with the GitHub account that owns `saidaz24-meet/peptide_prediction` (Said's account).
3. Find `peptide_prediction` in the repo list. Toggle the switch to ON.
4. (Optional) On Zenodo's settings page, fill in default metadata: license MIT, communities (e.g. "Bioinformatics"), keywords. This pre-populates every future release.

If Zenodo asks for OAuth permissions on first link, accept "repo" scope. Required for the integration to read release events.

---

## Release flow

### Step 1 — Pre-flight

Verify CITATION.cff version matches what you're about to tag:

```bash
grep -E "^version|^date-released" CITATION.cff
# Expected:
# version: "0.3.0"
# date-released: "2026-05-20"   ← update if it's not today
```

If the date is wrong, edit CITATION.cff, commit, push.

### Step 2 — Create the GitHub release

Using `gh`:

```bash
# Create an annotated tag at current main HEAD
gh release create v0.3.0 \
  --title "v0.3.0 — Peleg-aligned algorithm + 5-surface ecosystem" \
  --notes-file docs/active/RELEASE_NOTES_v0.3.0.md \
  --target main

# Confirm:
gh release view v0.3.0
```

Or via the GitHub web UI: https://github.com/saidaz24-meet/peptide_prediction/releases/new — fill in tag `v0.3.0`, paste the release notes below.

### Step 3 — Verify Zenodo picked it up

Wait ~1-2 minutes after the release publishes. Then:

```bash
# Open Zenodo's record list for your account:
open "https://zenodo.org/account/records"
```

You should see a new `v0.3.0` entry with a freshly minted DOI like `10.5281/zenodo.XXXXXXX`.

### Step 4 — Wire the DOI back into the repo

Update `CITATION.cff`:

```yaml
identifiers:
  - description: "Zenodo archive DOI (versioned, v0.3.0)"
    type: doi
    value: "10.5281/zenodo.XXXXXXX"   # ← paste actual DOI
  - description: "Zenodo concept DOI (always-latest)"
    type: doi
    value: "10.5281/zenodo.YYYYYYY"   # ← paste concept DOI
```

Update `README.md` badge:

```markdown
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.YYYYYYY.svg)](https://doi.org/10.5281/zenodo.YYYYYYY)
```

Commit the metadata update (don't tag this commit — it lives between releases):

```bash
git add CITATION.cff README.md
git commit -m "docs: wire Zenodo DOI for v0.3.0"
git push
```

### Step 5 — Update bio.tools

Once A4 (bio.tools registration) is also done, add the DOI to bio.tools' "Publications" section.

---

## Release notes for v0.3.0

The canonical release notes live in [`RELEASE_NOTES_v0.3.0.md`](RELEASE_NOTES_v0.3.0.md). Use that file as the `--notes-file` arg in step 2 above; both the `scripts/publish_v0_3_0.sh` script and the `gh release create` invocation already do this.

The block below is the LEGACY draft from when this packet was first written (PVL v0.1.0 era). Kept for the why-trail; do NOT paste into the v0.3.0 release.

<details>
<summary>Legacy v0.1.0 draft — historical only</summary>

```markdown
# v0.1.0 — Paper-Ready Baseline (Wave 2 + 2.5)

The first public release of Peptide Visual Lab. This is the version Peleg + Alex reviewed for the paper.

## What's in this release

PVL is an all-in-one web platform for peptide aggregation + structure analysis. This release ships the complete Wave 2 (web app + MCP backend routes + AlphaFold 3D overlay + reproducibility-as-permalink) and the Wave 2.5 fix-pack closing out Peleg's holistic review (rounds 1 and 2).

### Scientific pipeline
- **TANGO** aggregation propensity (subprocess, deterministic)
- **S4PRED** secondary structure prediction (neural-net ensemble, primary helix predictor)
- **FF-Helix** classification (S4PRED helix + µH threshold, per ADR-003)
- **SSW** prediction (TANGO **or** S4PRED, canonical OR — fixed in ISSUE-032)
- **FF-SSW** classification (SSW + hydrophobicity threshold)
- **Biochemistry** — Fauchère-Pliska hydrophobicity, charge (pH 7.4), µH

### Web surfaces
- Quick Analyze (single sequence)
- Upload (CSV/TSV/XLSX/FASTA)
- UniProt query (accession / keyword / organism / cross-search)
- Results dashboard with KPIs, Venn (4-class), threshold tuner, Smart Candidate Ranking
- PeptideDetail with Mol* AlphaFold overlay, sliding-window profiles, correlation matrix
- Cohort/Database comparison

### Multi-surface ecosystem (partial)
- ✅ Web app (this release)
- ✅ MCP server (Wave 2 §I — get_peptide_detail, rank_candidates, compare_cohorts routes)
- 🚧 `pvl-py` (T2 dispatch ready, ships in v0.2.0)
- 🚧 `pvl-cli` (T2 dispatch ready, ships in v0.2.0)

### Quality gates
- 538 backend tests (pytest, deterministic, no network)
- 611 frontend tests (vitest + jsdom)
- `tsc --noEmit` clean
- CI green on every PR
- Sentry observability (production)
- CodeRabbit AI review on every PR

### Scientific corrections from Peleg's review
- Fauchère-Pliska correctly attributed as a **hydrophobicity** scale (not helix propensity) — applies to FF-Helix definition
- All CD spectroscopy mentions removed
- Aggregation ≠ fibril formation (TANGO outputs are aggregation propensity only)
- 4-class classification (Helix / FF-Helix / SSW / FF-SSW) surfaced
- Venn diagram enforces `FF-Helix ⊆ Helix` and `FF-SSW ⊆ SSW` axioms
- **ISSUE-032** (P0, this release): FF-SSW axiom violation fixed at three layers (dataframe unified column, API normalize axiom enforcement, 9 invariant tests)
- **ISSUE-033** (P1, this release): perf regression — ESM-2 vector indexing moved off the predict hot path (background executor)

### Known limitations
- The Hetzner Docker deployment is temporary; DESY VM migration is queued for v0.2.0.
- ORCID for Peleg + Alex pending.
- JOSS paper draft pending (A7 in roadmap).

## Citing this release

If you use PVL in your research, please cite:

```bibtex
@software{azaizah2026pvl,
  author       = {Azaizah, Said and Ragonis-Bachar, Peleg and Golubev, Aleksandr},
  title        = {Peptide Visual Lab (PVL): v0.3.0},
  year         = 2026,
  publisher    = {Zenodo},
  version      = {v0.3.0},
  doi          = {10.5281/zenodo.XXXXXXX},
  url          = {https://github.com/saidaz24-meet/peptide_prediction}
}
```

## Acknowledgements

- **Algorithms & scientific review**: Dr. Peleg Ragonis-Bachar (Technion)
- **Scientific advisor & deployment infrastructure**: Dr. Aleksandr Golubev (DESY)
- **Lead developer**: Said Azaizah (Technion + DESY)
- **Hosting**: DESY CSSB Hamburg

## License

MIT. See `LICENSE`.

```

</details>

---

## Blockers (resolve before tagging)

1. ✅ **LICENSE** — MIT shipped on main.

2. ✅ **Version** — 0.3.0 per CITATION.cff. (Was 0.1.0 in the original draft; bumped twice through Waves 2.5 → 2.6 → 2.7.)

3. ✅ **Code on main** — Waves 2 → 2.7 complete.
4. ✅ **Tests green** — 633/633 frontend + 619/619 backend verified 2026-06-08.

---

## After A5 lands

- bio.tools submission (A4) — add Zenodo DOI to "Publications".
- README — add DOI badge.
- JOSS paper draft (A7) — uses concept DOI as `archive` field.
- Email Peleg + Alex with the DOI link so they can cite PVL in their own work / talks.
