# Clean push policy — what goes on GitHub, what stays local (2026-06-07)

**Problem**: `docs/active/` currently has ~80 files mixing publishable architecture references with one-shot dispatch prompts, terminal restart instructions, daily roadmap snapshots, and Peleg-Zoom briefing scratch. The repo on GitHub should look like a serious open-source scientific tool, not the inside of Said's head.

**Audience for the GitHub repo**: bioinformaticians, reviewers, scientific peers. They should see clean architecture + scientific reproducibility + honest known issues. They should NOT see "T2 prompt restart 2026-06-07" files.

**This policy**: every file in `docs/active/` falls into one of four buckets. Bucket A stays; Bucket B moves to a sub-folder; Bucket C archives; Bucket D gitignores.

---

## Bucket A — STAYS in `docs/active/` (publishable architecture + scientific references)

These are the documents a reviewer or contributor should see. Treat them like book chapters: stable names, evolved-not-replaced content.

| File | Why publishable |
|---|---|
| `ACTIVE_CONTEXT.md` | Architecture overview — entrypoint for any new contributor |
| `CONTRACTS.md` | API contract spec |
| `TESTING_GUIDE.md` | How to run + write tests |
| `KNOWN_ISSUES.md` | Honest known-bug list |
| `DEPLOYMENT.md` | How to self-host |
| `DEVELOPER_REFERENCE.md` | Pipeline internals reference |
| `SPECIALS.md` | Edge-case rules (Aβ42, etc.) |
| `MASTER_DEV_DOC.md` | Consolidated architecture + decisions |
| `ROADMAP.md` | Public-facing roadmap (slim it — see Bucket B) |
| `CHANGELOG_PELEG.md` | The scientific changelog Peleg has been reviewing |
| `MCP_RUNBOOK.md` | MCP server install + usage |
| `MOL3D_OVERLAY_SPEC.md` | Mol* overlay technical spec |
| `UNIPROT_ENRICHMENT_SPEC.md` | UniProt integration spec |
| `SENTRY_RUNBOOK.md` | Sentry deployment runbook |
| `DESIGN_SYSTEM.md` | Tailwind + shadcn conventions |
| `DECISIONS.md` | ADR log |
| `PAPER_DRAFT_v1.md` | The JOSS paper draft (publishable artifact) |
| `ECOSYSTEM_GUIDE.md` | 5-surface reference |
| `SELF_HOST_GUIDE.md` | Institute IT deployment guide |
| `RESEARCH_BRIEFS/` (subdir) | Scientific brief artifacts |
| `RESPONSES/` (subdir) | Peleg / Alex response log (already in subdir) |
| `A4_BIO_TOOLS_SUBMISSION.md` | bio.tools submission packet |
| `A5_ZENODO_RELEASE.md` | Zenodo release procedure |
| `PELEG_PAPER_AND_REPO_FINDINGS.md` | The audit of Peleg's algorithm — citable for the paper |

**Action**: leave as is. These get committed.

---

## Bucket B — MOVES to `docs/internal/` (development-process artifacts, useful but internal)

These are real artifacts but not for external eyes. Move into a `docs/internal/` subfolder so it's clear: "this is how we work, not what we ship".

| File | Why internal |
|---|---|
| `COWORK_V10_DESIGN_QUEUE.md` | Cowork dispatch queue — internal process |
| `MASTER_PUSH_PLAN.md` | Internal push planning |
| `TOP_CEO_RECOMMENDATIONS.md` | Said's strategic notes |
| `TECH_PLATFORM_VISION.md` | Internal vision doc |
| `PUSH_READINESS.md` | Pre-push checklist |
| `ALEX_BACKLOG.md` | Alex's feedback queue |
| `PELEG_REVIEW_TASKS.md` | Peleg task chunks |
| `PELEG_FEEDBACK_INSTRUCTIONS.md` | How we process Peleg feedback |
| `STATUS.md` | Status snapshot |
| `COMPACT_PUBLISH_LIST_2026_06_07.md` | Today's master compact list |
| `MASTER_PRIORITY_ROADMAP_2026_06_07.md` | Today's prioritisation |
| `FUNCTIONAL_DISPATCH_2026_06_07.md` | T2/T3 functional dispatch |
| `TERMINAL_DISPATCH_2026_06_07.md` | T2/T3 dispatch (superseded by T2_T3_RESTART) |
| `T2_T3_RESTART_2026_06_07.md` | Restart prompts after T2/T3 stopped |
| `GITOPS_TERMINAL_PROMPT_2026_06_07.md` | This T-OPS prompt |
| `T6_DISPATCH_WAVE_2_6.md` | T6 dispatch from earlier today |
| `EMAILS_TO_SEND_2026_06_07.md` | Drafted emails to Alex + Peleg/Landau |
| `THINGS_PELEG_DIDNT_CATCH_2026_06_07.md` | Umbrella issues map |
| `WAVE_2_5_LOCK_IN_PLAN.md` | Historical wave plan |
| `WAVE_C_EMAIL_DRAFT.md` | Email draft archive |

**Action**: `git mv docs/active/<file> docs/internal/<file>` for each. `docs/internal/` stays in the repo so we don't lose history, but it signals to a reviewer "skip this, it's process".

---

## Bucket C — ARCHIVES to `docs/archive/<date>/` (one-shot or historical, won't be referenced again)

These were useful in their moment. They've served their purpose. Move so they're traceable in git history without cluttering the live doc list.

| File | Date archived | Reason |
|---|---|---|
| `PELEG_ZOOM_PREP_2026_06_04.md` | Zoom over | Pre-Zoom prep, post-Zoom obsolete |
| `PELEG_ZOOM_BRIEFING_2026_06_04.md` | Zoom over | Same |
| `PELEG_ZOOM_FOLLOWUP_PLAN_2026_06_07.md` | Plan executed | Earlier plan for today, superseded by FUNCTIONAL_DISPATCH |
| `PELEG_DRIVE_COMMENTS_CONFUSION_MAP.md` | Drive comments processed | Mapped into Wave 2.6 + Wave 2.7 PRs |
| `PELEG_FOLLOWUP_DOC_V2.md` | Will be sent to Peleg, then archive | Once sent, archive — only the sent version matters |
| `PELEG_FOLLOWUP_PACKET_2_FULL_UPDATE.md` | Already sent | Historical |
| `PELEG_FOLLOWUP_PACKET_3_DIRECT_QA.md` | Already sent | Historical |
| `PELEG_FOLLOWUP_TECHNICAL_PACKET.md` | Already sent | Historical |
| `HELIX_PERCENTAGE_AUDIT.md` | Audit complete + acted on | Historical |
| `COVERAGE_AUDIT.md` | Audit complete | Historical |
| `COLLAB.md` | Superseded by ECOSYSTEM_GUIDE | Historical |
| `UNIPROT_TIMEOUT_INVESTIGATION.md` | Investigation done + fixed | Historical |
| `DEPLOY_WORKFLOW.md` | Superseded by DEPLOYMENT.md | Duplicate |

**Action**: `git mv docs/active/<file> docs/archive/2026-06-07/<file>`. Or write a single `docs/archive/2026-06-07/INDEX.md` describing what was archived.

---

## Bucket D — GITIGNORE (never committed, local-only)

| File / Pattern | Why local-only |
|---|---|
| `docs/active/SESSION_LOG.md` | Auto-generated, regenerated each session |
| `docs/active/*_DAILY_*.md` | Daily status snapshots — useful in the moment, never historical |
| `_external/` | Peleg's repo + paper copy — her unpublished work, do NOT redistribute |
| `.claude/` already gitignored — keep it |
| `_drafts/` | Any in-progress doc, by convention |
| `.cursor/` | Cursor editor state |
| `.vscode/` | Editor state |

**Action**: add these patterns to `.gitignore`. Anything matching gets stripped from future commits.

---

## Execution — one focused PR titled `chore(docs): clean-push reorganisation`

Single PR. Touches a lot of files but each file is a `git mv` or an addition to `.gitignore`. No content changes. Easy to review.

```bash
# Bucket B → docs/internal/
mkdir -p docs/internal
for f in COWORK_V10_DESIGN_QUEUE MASTER_PUSH_PLAN TOP_CEO_RECOMMENDATIONS \
         TECH_PLATFORM_VISION PUSH_READINESS ALEX_BACKLOG PELEG_REVIEW_TASKS \
         PELEG_FEEDBACK_INSTRUCTIONS STATUS \
         COMPACT_PUBLISH_LIST_2026_06_07 MASTER_PRIORITY_ROADMAP_2026_06_07 \
         FUNCTIONAL_DISPATCH_2026_06_07 TERMINAL_DISPATCH_2026_06_07 \
         T2_T3_RESTART_2026_06_07 GITOPS_TERMINAL_PROMPT_2026_06_07 \
         T6_DISPATCH_WAVE_2_6 EMAILS_TO_SEND_2026_06_07 \
         THINGS_PELEG_DIDNT_CATCH_2026_06_07 \
         WAVE_2_5_LOCK_IN_PLAN WAVE_C_EMAIL_DRAFT; do
  git mv "docs/active/${f}.md" "docs/internal/${f}.md" 2>/dev/null || true
done

# Bucket C → docs/archive/2026-06-07/
mkdir -p docs/archive/2026-06-07
for f in PELEG_ZOOM_PREP_2026_06_04 PELEG_ZOOM_BRIEFING_2026_06_04 \
         PELEG_ZOOM_FOLLOWUP_PLAN_2026_06_07 \
         PELEG_DRIVE_COMMENTS_CONFUSION_MAP \
         PELEG_FOLLOWUP_PACKET_2_FULL_UPDATE PELEG_FOLLOWUP_PACKET_3_DIRECT_QA \
         PELEG_FOLLOWUP_TECHNICAL_PACKET HELIX_PERCENTAGE_AUDIT \
         COVERAGE_AUDIT COLLAB UNIPROT_TIMEOUT_INVESTIGATION \
         DEPLOY_WORKFLOW; do
  git mv "docs/active/${f}.md" "docs/archive/2026-06-07/${f}.md" 2>/dev/null || true
done

# Bucket D → .gitignore
cat >> .gitignore <<'EOF'

# 2026-06-07 clean-push policy
docs/active/SESSION_LOG.md
docs/active/*_DAILY_*.md
_external/
_drafts/
.cursor/
.vscode/
EOF

# CLAUDE.md update — point new contributors at docs/active/ as the canonical
# architecture reference, not the full active set.
```

After this PR lands, `docs/active/` is ~25 files — all architecture + scientific reference + active research briefs. `docs/internal/` and `docs/archive/` are still in the repo (history preserved) but signal "internal".

---

## Pre-push checklist for every future PR

Before opening any PR, T-OPS verifies:

- [ ] Any new `docs/active/*` file is publishable per Bucket A criteria. If not, move to `docs/internal/` before committing.
- [ ] No `_external/` paths in the staged file list (Peleg's repo or paper accidentally committed).
- [ ] No dispatch / restart / daily-status doc in `docs/active/`.
- [ ] No `// TODO(Said): finish this before merging` comments left in shipped code.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npx vitest run` clean (or any failures explicitly documented in PR body).
- [ ] If backend touched: `make typecheck && cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest -q tests/` clean.
- [ ] CodeRabbit review requested.

If any check fails, fix or document before opening the PR.
