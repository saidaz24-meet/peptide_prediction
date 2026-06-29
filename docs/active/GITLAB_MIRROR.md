# DESY GitLab Mirror — How To Migrate

> **Status (2026-06-29)**: Not configured. Repo lives at `github.com/saidaz24-meet/peptide_prediction` (public, MIT). DESY policy may require a GitLab mirror once PVL moves from "research prototype" → "DESY-hosted scientific tool." This doc is the runbook for that day.
>
> **When to do this**: when Alex confirms DESY's GitLab needs a mirror, OR when the JOSS paper is accepted and the DESY URL is the citable one.

---

## What "mirror" means here

- **GitHub stays the source of truth.** All issues, PRs, CI, CodeQL, and the contributor onboarding live on GitHub.
- **GitLab is a read-only follower.** Every push to `main` on GitHub mirrors automatically to GitLab within ~minutes.
- **Why both**: DESY infrastructure prefers GitLab for compliance + visibility, but the open-source contributor flow lives where it works (GitHub Issues, GitHub Discussions, JOSS-friendly tooling).

This pattern is standard in CERN, EMBL, and most public-research institutions that have an institutional GitLab but want public reach.

---

## One-time setup (~30 minutes)

### 1. Create the GitLab project
- DESY GitLab URL: <https://gitlab.desy.de/> (or wherever Alex points you)
- Sign in with DESY credentials (`azaizahs`).
- New project → Import → "Repository by URL"
- Source: `https://github.com/saidaz24-meet/peptide_prediction.git`
- Visibility: **Public** (matches GitHub MIT license; if DESY policy requires Internal, set Internal — but understand JOSS reviewers can't see Internal projects)
- Initial branch: `main`
- Click Create.

After import, the project lives at something like `gitlab.desy.de/azaizahs/peptide_prediction`. Confirm the import finished — main branch + tags + all history present.

### 2. Configure auto-mirror (GitHub → GitLab)
- In GitLab, go to **Settings → Repository → Mirroring repositories**.
- Direction: **Pull** (GitLab pulls from GitHub)
- Repository URL: `https://github.com/saidaz24-meet/peptide_prediction.git`
- Authentication: leave empty for public repo.
- Mirror options: ✅ Keep divergent refs, ✅ Trigger pipelines for mirror updates (if you want GitLab CI to run too).
- Save.

GitLab will pull every ~30 minutes. To force an immediate pull, click "Update now" on the mirror.

### 3. Add the GitLab URL to PVL metadata
Update three places:
- `CITATION.cff` → add a second `repository-code` entry pointing at the GitLab URL.
- `README.md` → add a badge:
  ```markdown
  [![GitLab mirror](https://img.shields.io/badge/gitlab-DESY%20mirror-orange?logo=gitlab)](https://gitlab.desy.de/azaizahs/peptide_prediction)
  ```
- `docs/active/DEPLOYMENT.md` → add a row to the Hosts table:
  ```markdown
  | **GitLab mirror** | gitlab.desy.de/azaizahs/peptide_prediction | DESY-side mirror (read-only follower) | Live |
  ```

### 4. (Optional) GitLab-side CI
If DESY wants its own CI to run on GitLab (e.g. for visibility on the DESY internal CI dashboard), add `.gitlab-ci.yml`. The minimal mirror of `.github/workflows/ci.yml`:

```yaml
stages: [test]

backend-tests:
  stage: test
  image: python:3.11
  before_script:
    - pip install -r backend/requirements.txt
  script:
    - cd backend && pytest -q

frontend-tests:
  stage: test
  image: node:20
  before_script:
    - cd ui && npm ci
  script:
    - cd ui && npx tsc --noEmit && npx vitest run
```

Keep this in sync with GitHub Actions only at major version bumps — diverging is OK as long as GitHub CI is the gate.

---

## Day-to-day

| Action | Where it happens | Notes |
|---|---|---|
| New code | GitHub | Push to main or open PR → CI/CodeRabbit/CodeQL run |
| New Issue | GitHub | Templates live there |
| Release / tag | GitHub | Zenodo DOI minted from GitHub releases |
| Dependabot alerts | GitHub | DESY GitLab mirror inherits everything |
| Contributors clone | GitHub | The MIT-licensed open URL |
| DESY internal links | GitLab | Slack messages, DESY wiki, internal docs |

If GitLab CI is wired (§4), the mirror also runs tests independently — useful for spotting GitHub-specific environment issues (rare but happens).

---

## Edge cases

- **GitLab pull lag**. The default poll is every ~30 minutes. For a release-day push, use GitLab's "Update now" button to force a sync.
- **Force-push to main on GitHub.** GitLab will follow. Don't force-push main; the branch-protection rule blocks it on GitHub anyway.
- **Sensitive data accidentally pushed.** Both forks have it. Revoke via GitHub history rewrite + force-push (last resort), then manually sync GitLab. Or stop the mirror, fix GitHub, restart mirror.
- **DESY GitLab outage**. No impact on PVL — GitHub is canonical. The mirror just lags until DESY GitLab is back.

---

## When NOT to mirror

- DESY policy doesn't require it. Mirrors are operational overhead.
- DESY GitLab requires Internal visibility — that disqualifies bio.tools / JOSS reviewers who can't read it. Skip the mirror, keep GitHub MIT.

---

## Cross-references
- DEPLOYMENT.md §"Hosts at a glance" → add GitLab row after migration
- PUBLICATION_PATH.md →  add a "deposit the GitLab URL in bio.tools/JOSS metadata" line under §4 + §5
- ROADMAP.md → close the "GitLab migration" line under "Waiting for DESY"
- `memory/reference_ssh_access.md` → add GitLab token reference if private
