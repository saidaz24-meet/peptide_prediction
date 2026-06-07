# PVL — Collaboration Protocol

> One page. Read this if you are a co-author (Peleg, Alex) or a future contributor. Defines how Said, Peleg, and Alex exchange feedback without ambiguity.

---

## Who does what

| Person | Role | Owns |
|---|---|---|
| **Said Azaizah** | Lead developer, full-stack architect | Platform code, design, deployment, AI integration, observability, technology choices |
| **Dr. Peleg Ragonis-Bachar** (Technion) | Scientific algorithms + benchmark data | Scientific definitions (FF-Helix, FF-SSW, SSW logic), Staphylococcus 2023 dataset, threshold justifications, paper science |
| **Dr. Aleksandr Golubev** (DESY) | Scientific advisor + project management | Scientific direction, DESY infrastructure liaison, AI-platform vision (Phase G), grant pathways |

Said owns the *platform*. Peleg owns the *science*. Alex owns the *vision + institutional liaison*.

---

## Feedback delivery — formats Said + T1 accept

| From whom | Preferred channel | Where it lands |
|---|---|---|
| **Peleg feedback** | Annotated PDF (Acrobat or paper-scanned), email, or direct line-edit on `docs/active/PELEG_REVIEW_TASKS.md` via shared Drive | T-PEL terminal processes → `docs/active/PELEG_REVIEW_TASKS.md` + relevant Cowork prompts |
| **Alex feedback** | Email, Slack screenshots, or items added to `docs/active/ALEX_BACKLOG.md` | T1 reads → updates ALEX_BACKLOG with priority + wave assignment |
| **Either, urgent bug** | One-line email or Slack with the broken URL/behavior | T1 opens entry in `docs/active/KNOWN_ISSUES.md`, dispatches fix |

### What we DO NOT want from Peleg or Alex
- We do NOT want either to file GitHub issues — that's an extra surface they don't need.
- We do NOT want them learning Git or branching — Said + T1 absorb that complexity.
- We do NOT need them to test on their own machine unless they want to — a Loom video or shared screen during a call is fine.

---

## Cadence

| Cadence | What | Who |
|---|---|---|
| **Biweekly** | `make changelog-peleg` → `docs/active/CHANGELOG_PELEG.md` generated. Said adds one paragraph of plain-language commentary at the top. Shared via email or Drive link with Peleg + Alex. | Said + T1 |
| **After major chunks** | Said emails Peleg + Alex with a "try this" message: 3 concrete URLs/actions + 2 specific questions they can answer in under 10 minutes | Said |
| **Monthly** | Said sends a 1-paragraph project state: % toward v1.0, biggest open question, next ask | Said |
| **Pre-paper-freeze** | 30 days before submission, API + thresholds + scientific definitions are frozen. No changes without co-author sign-off. | All three |
| **Loom milestone debriefs** | Optional. For major releases (v0.2, v1.0) only. Said records a 3-5 minute screen walkthrough. | Said |

**Ship-first, review-later** is the operating principle (Said directive 2026-05-12): T1 + Said ship what they find best, Peleg + Alex review in their own cadence. They are NOT blocking dependencies. Their feedback drives iteration, not gating.

---

## Pre-paper freeze protocol

Starting 30 days before any paper submission (JOSS, NAR, Bioinformatics, etc.):

1. API response shapes frozen — no changes to `backend/schemas/api_models.py` or `peptides.py` schemas.
2. Default thresholds frozen — no changes to `backend/config.py` threshold defaults.
3. Scientific definitions frozen — FF-Helix, FF-SSW, SSW logic locked.
4. Algorithm versions frozen — TANGO, S4PRED, ESM-2, FF-Helix Hamodrakas 2007 are immutable.
5. Sentry watch — any new error fingerprint is a freeze violation; T1 investigates within 24h.

Changes after freeze require Peleg + Alex sign-off + a rebuild of the manuscript.

---

## How co-authors test

- Open the live URL Said shares (Hetzner VPS or local). No installation needed.
- Try the 3 actions in Said's email.
- Respond with any of: ✅ works, 🟡 works but I'd change X, 🔴 broken on action Y.
- Loom or screen-recorded responses welcome but not required.

---

## When Peleg or Alex want to add something
- For a feature idea → email it to Said. T1 logs in `docs/active/ALEX_BACKLOG.md` or relevant phase in ROADMAP. Said replies with a wave assignment.
- For a science correction (algorithm definition, threshold, classification logic) → email Said. T1 + Said treat as a P0 — schedule for next wave.
- For paper writing → wait until v0.2 stable. Said sends draft for review.

---

## Reference
- `AGENTS.md` — multi-terminal architecture (for context if curious)
- `docs/active/STATUS.md` — current dispatch state
- `docs/active/ROADMAP.md` — full phase plan
- `docs/active/DECISIONS.md` — architectural decisions

Last updated: 2026-05-12. T1 maintains this. Said reviews quarterly.
