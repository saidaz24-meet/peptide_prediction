# PVL — Clean Push Readiness Checklist + Manual Guides

**Author**: T1 (CEO terminal). **Date**: 2026-05-07.
**Target**: clean v0.1.0 push to GitHub `main` after this round.

---

## 1 — What's done vs. what's left before push

### Done ✅
- Wave 0 + 0.2 + A + B (red CI fix)
- Wave P0 (Peleg foundation: 4-category, threshold restructure, terminology)
- Wave P1-P5 (badge cleanup, Help text, ranking, Active Thresholds panel, etc.)
- Wave V3 (hover + drill-down architecture)
- Wave V4-1 (Reproducibility Ribbon)
- Wave V4-2 (Mol\* 3D viewer with PVL overlays)
- Wave V4-3 (Window-profile multi-channel chart)
- Wave V5-1 (Demo Mode auto-loaded dataset) — components built, NOT WIRED yet
- Wave V5-2 (Hero / How-It-Works / Trust / Footer) — components built, NOT WIRED yet
- Wave V6-1 (Sentry context wrapper) — components built, NOT WIRED yet
- Backend Wave B (contract hardening, S4PRED length cap, version endpoint)
- Helix-% audit + 8 fixes (Peleg's Hebrew flag resolved at root)
- Q1, Q5, Q6, Q7 from Wave C email — already implemented

### Left before push 🔄
1. T3 batch — wire V5/V6 + 4 visual bugs (this round, ~5-7h)
2. Comprehensive Peleg + Alex coverage audit (research, ~1-2h)
3. README.md polish (~2h)
4. CONTRIBUTING.md polish (~1h)
5. Send Wave C email to Peleg + Alex (depends on first 4)
6. Their reply (1-2 weeks parallel)
7. Final QA pass (~1h)
8. Push to main + GitHub release tag

---

## 2 — Step-by-step manual guides (Said does these; Claude can't)

### Guide A — GitHub Release v0.1.0 (after final commit on main)

**Time**: 5 minutes.

1. **On GitHub**, go to your repo → "Releases" → "Draft a new release".
2. **Tag version**: `v0.1.0`. Target: `main` branch. Release title: "PVL v0.1.0 — first public release".
3. **Description** (paste this template, fill in):
   ```markdown
   # Peptide Visual Lab v0.1.0

   First public release of PVL — an all-in-one peptide aggregation +
   secondary structure prediction dashboard combining TANGO + S4PRED +
   FF-Helix detection + AlphaFold structure overlay.

   ## What's included
   - 4-category peptide classification (Helix / FF-Helix / SSW / FF-SSW)
   - Multi-tool consensus dashboard with hover-everywhere drill-down
   - Live 3D structure overlay of predictions on AlphaFold structures
   - Reproducibility ribbon: every analysis becomes a citable permalink
   - Demo mode: try PVL with the Staphylococcus 2023 dataset (2,916
     peptides) without uploading
   - Self-host via Docker Compose

   ## Citing this release
   Said Azaizah, Peleg Ragonis-Bachar, Aleksandr Golubev. (2026).
   Peptide Visual Lab v0.1.0. https://github.com/[user]/peptide_prediction.
   DOI: 10.5281/zenodo.XXXXX (auto-archived to Zenodo).

   ## Acknowledgments
   Algorithms by Dr. Peleg Ragonis-Bachar (Technion). Scientific advisor:
   Dr. Aleksandr Golubev (DESY + Technion). Built by Said Azaizah.

   ## License
   MIT.
   ```
4. **"Publish release"**. This triggers the Zenodo webhook (after Guide B).

### Guide B — Connect Zenodo to GitHub (one-time, before Guide A)

**Time**: 10 minutes.

1. Go to https://zenodo.org. Log in with your **GitHub account** (top right → "Log in via GitHub").
2. Authorize Zenodo to access your GitHub repos.
3. After login, top right: your name → "GitHub".
4. Find your `peptide_prediction` repo in the list. Toggle the switch to ON.
5. Done. From now on, every GitHub release of this repo auto-archives to Zenodo and gets a DOI.
6. After your first release (Guide A), come back to this page → click your repo → see the new DOI badge. Copy that DOI.
7. Update `CITATION.cff` with the DOI:
   ```yaml
   doi: 10.5281/zenodo.XXXXX
   ```
8. Commit + push the updated `CITATION.cff` (or open as a PR).

### Guide C — bio.tools registration (after stable URL)

**Time**: 30 minutes.

1. Go to https://bio.tools/register. Click "Register tool".
2. Sign in with ORCID or create a bio.tools account.
3. Fill the form:
   - **Name**: "Peptide Visual Lab"
   - **Short name**: "PVL"
   - **Description**: 1-2 sentences from your README hero.
   - **Homepage**: `https://[your-domain]/` (DESY VPS or whatever)
   - **Topic**: "Peptides and amino acids" + "Protein structure analysis" + "Molecular interactions, pathways and networks"
   - **Operation**: "Aggregation prediction" + "Secondary structure prediction" + "Sequence visualisation"
   - **Input/output formats**: Sequence (FASTA, plain text), Output (CSV, SVG, PDB)
   - **License**: MIT
   - **Cost**: Free
   - **Maturity**: Mature (or Beta if pre-paper)
   - **Documentation**: link to GitHub README + JOSS paper (when published)
   - **Publication**: cite the Zenodo DOI and (later) the JOSS paper
   - **Credit**: Said Azaizah (developer), Peleg Ragonis-Bachar (algorithms), Aleksandr Golubev (scientific advisor)
4. Submit. Bio.tools curators may ask follow-up questions; reply within 1-2 weeks.

### Guide D — ORCID iDs in CITATION.cff

**Time**: 5 minutes.

1. Each of you (Said, Peleg, Alex) needs an ORCID iD if you don't already have one. Sign up at https://orcid.org.
2. Open `CITATION.cff` in the repo. Add `orcid:` to each author block:
   ```yaml
   authors:
     - family-names: Azaizah
       given-names: Said
       email: az.said2007@gmail.com
       orcid: https://orcid.org/0000-XXXX-XXXX-XXXX
       affiliation: Technion + DESY
     - family-names: Ragonis-Bachar
       given-names: Peleg
       orcid: https://orcid.org/0000-XXXX-XXXX-XXXX
       affiliation: Technion
     - family-names: Golubev
       given-names: Aleksandr
       orcid: https://orcid.org/0000-XXXX-XXXX-XXXX
       affiliation: DESY + Technion
   ```
3. Commit.

### Guide E — Sentry dashboard setup (S5/S6/S8/S9 from roadmap Phase S)

**Time**: 30-45 minutes.

This is the manual setup that Cowork's V6-1 deferred to you.

#### E.1 — Sentry account + organization
1. Sign up at https://sentry.io if you don't have an account.
2. Create an organization called `pvl` (or whatever). Project: `pvl-frontend`. Project: `pvl-backend`.
3. Copy the DSN for each project. Set them as env vars:
   - Frontend: `VITE_SENTRY_DSN` (in your `.env.local` and on the VPS)
   - Backend: `SENTRY_DSN` (on the VPS)

#### E.2 — Auth token for source maps (S1)
1. In Sentry: Settings → Auth Tokens → "Create New Token". Give it scopes: `project:write`, `release:admin`, `org:read`.
2. Copy the token.
3. In your GitHub repo: Settings → Secrets and variables → Actions → "New repository secret".
4. Name: `SENTRY_AUTH_TOKEN`. Value: paste the token.
5. Verify next CI run uploads source maps (look for "Sentry CLI" output in the build log).

#### E.3 — Slack webhook (S5)
1. In your Slack workspace: Apps → "Incoming Webhooks" → Add to a workspace.
2. Pick a channel (e.g., `#pvl-alerts`). Copy the webhook URL.
3. In Sentry: Settings → Integrations → Slack. Connect with the webhook URL.
4. Configure alert rules (Sentry → Alerts → "Create Alert"):
   - **Rule 1**: New issue → severity error/fatal → email + Slack
   - **Rule 2**: Issue spike (10+ events of same fingerprint in 1h) → email + Slack
   - **Rule 3**: Performance: p95 of `/api/predict` > 5s for 5 min → email
   - Suppress: 4xx contract validation errors. Quiet hours: 23:00-07:00.

#### E.4 — Cron monitoring (S8)
1. In Sentry: Crons → "Create Monitor".
2. Slug: `pvl-vps-health`. Schedule: every 5 min. Margin: 2 min.
3. Copy the check-in URL.
4. On the VPS, add a cron job: `*/5 * * * * curl -fsS http://localhost:8000/api/health && curl -fsS https://sentry.io/api/0/monitors/[slug]/checkins/`.
5. If the VPS goes down, no check-in arrives, Sentry alerts.

### Guide F — Dependabot setup (Phase O.1)

**Time**: 5 minutes.

Add `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/ui"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

Commit it. Dependabot will start opening PRs the next Monday.

---

## 3 — README.md polish checklist (T1 does this, ~2h)

When this round closes, T1 (Claude Code) writes a fresh README.md with:

- **Hero section**: 1-line tagline + 4 differentiator bullets (multi-tool, 3D overlay, permalinks, open source)
- **Demo GIF**: 12-second loop showing classification → drill-down → 3D overlay
- **Quick start**: paste a sequence at https://[url]/quick (1 line)
- **Self-host**: `docker compose up` (3-line block)
- **Citing**: BibTeX block (placeholder until DOI live)
- **Contributing**: link to CONTRIBUTING.md
- **Authors / Decisions**: per Said directive
  - **Built by**: Said Azaizah (Technion + DESY)
  - **Algorithms by**: Dr. Peleg Ragonis-Bachar (Technion)
  - **Scientific advisor**: Dr. Aleksandr Golubev (DESY + Technion)
  - **Decisions log**: 1-paragraph link to `docs/active/DECISIONS.md` (NEW — list of major project decisions with dates: 4-category classification, terminology cleanup, drop ffHelixPercent, etc.)
- **License**: MIT
- **Status badges**: build status, test count, license, version

Said-flagged: every contribution credit + every decision should be logged so the project history is transparent for collaborators / paper reviewers / future you.

---

## 4 — Peleg + Alex Coverage Audit (T1 produces, ~1-2h)

I'll produce `docs/active/COVERAGE_AUDIT.md` after T3 closes the current batch. Format:

For each FIX-001 through FIX-032 in `PELEG_FEEDBACK_INSTRUCTIONS.md` + every item in `ALEX_BACKLOG.md`:
- ✅ DONE (with commit SHA + brief note)
- ⚠️ PARTIAL (with what's done vs missing)
- ❌ TODO (blocked / deferred — with reason)
- 🔍 NEEDS PELEG/ALEX CONFIRM (open question)

The output answers Said's exact ask: "lets make sure all peleg comments are taken care of, and all alex suggestions from before are taken care of in terms of different types of sequences inserted and that we should be able to handle them".

Specifically for Alex's "complex sequences with dashes" question: tracked as `B-COMPLEX-SEQ` in the roadmap (research item, v0.2). Wave C email asks Alex which conventions his collaborators use.

---

## 5 — The clean-push timeline

```
Day 0 (today): Said pastes T3 final-polish batch → T3 lands
Day 1: T1 reviews, commits T3 batch
Day 1: T1 produces COVERAGE_AUDIT.md
Day 1-2: T1 polishes README + writes DECISIONS.md
Day 2: Said sends Wave C email to Peleg + Alex (with COVERAGE_AUDIT.md as attachment for context)
Day 2: Said does Guide D (ORCID iDs in CITATION.cff)
Day 2: Said does Guide F (Dependabot setup) — 5 min
Day 3-14: Wait for Peleg/Alex reply (parallel work continues)
Day 14: Integrate their answers
Day 14: Final QA pass (browser smoke test on every page)
Day 15: Said does Guide B (Zenodo connection) — 10 min, BEFORE the release
Day 15: Said does Guide A (GitHub Release v0.1.0) — 5 min
Day 15: Auto-archives to Zenodo, get the DOI
Day 15: Said updates CITATION.cff with DOI, commits
Day 16: Said does Guide C (bio.tools registration) — 30 min
Day 16: Said does Guide E (Sentry dashboard alerts + crons) — 45 min
Day 17: Done. v0.1.0 is live, citable, monitored, registered. Phase I + future waves continue at MIT pace.
```

That's the full path to a clean v0.1.0 push.
