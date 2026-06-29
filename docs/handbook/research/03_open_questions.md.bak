# Open questions: what is still unresolved

> **For the paper, the reviewers, and the next developer.** This page is an honest ledger of every scientific question PVL has not fully closed. Some are resolved-but-worth-recording, some are explicitly deferred by Peleg as "next-dev polish," and some are long-horizon research avenues. Nothing here is hidden: if a value in the UI rests on a judgement call that hasn't had final sign-off, it is listed below.
>
> Read this alongside [the validation evidence](../research/02_validation_evidence.md) (what we *can* defend with numbers) and [the science page](../humans/02_the_science.md) (what the classifications mean). This page is the inverse: what we cannot yet defend, and who has to decide.

## Contents

- [How to read the OQ ledger](#how-to-read-the-oq-ledger)
- [The resolved five (recorded for the why-trail)](#the-resolved-five-recorded-for-the-why-trail)
- [The open three (deferred, non-blocking)](#the-open-three-deferred-non-blocking)
- [Other open scientific / contract items](#other-open-scientific--contract-items)
- [Future scientific avenues (Tier 3 — not questions, directions)](#future-scientific-avenues-tier-3--not-questions-directions)
- [Bottom line](#bottom-line)

---

## How to read the OQ ledger

Peleg Ragonis-Bachar's PDF review of 2026-06-18 produced eight open questions (OQ1–OQ8) that needed her scientific call before PVL could be tagged. Six were filed as GitHub Issues #106–#111 with paste-ready context; two (OQ3, OQ6) were resolved by simply shipping the change and never needed a separate Issue.

On **2026-06-29 Peleg replied** (recorded in [`DECISIONS.md` ADR-021](../../active/DECISIONS.md)). Her verbatim guidance: *"the motif one. make sure its good for researchers. magenta confirmed. delete per meeting. other than that, keep everything as is. its fine. next dev will take care of the specifics."*

That close-out means: **5 of 8 OQs are resolved, 3 are deferred** (open, but Peleg does *not* consider them publication-blocking). The deferred three live on as Tier-4 polish entries in [`BACKLOG.md`](../../active/BACKLOG.md).

| OQ | Question | Issue | Status | Resolver |
|----|----------|-------|--------|----------|
| OQ1 | "Colid-coil" typo — 3-state coil vs coiled-coil *motif*? | #106 | ✅ Resolved — **coiled-coil motif** convention end-to-end | Peleg (science) |
| OQ2 | "Rank & Merge" → what does *Merge* mean to the user? | #107 | ⏸ Deferred to next dev | UX/dev decision |
| OQ3 | Aggregation-series color preference | — | ✅ Resolved — **magenta**, shipped | Peleg + design |
| OQ4 | What does the y=0.5 dashed line in the Aggregation-Structure Overlay represent? | #108 | ⏸ Deferred to next dev | dev decision |
| OQ5 | SSW residue color in the Mol\* 3D viewer | #109 | ✅ Resolved — **magenta confirmed** (`#E040FB`) | Peleg (design) |
| OQ6 | Unify hide/show toggles — one row or per-plot? | — | ✅ Resolved — per-plot toggles shipped | Peleg + design |
| OQ7 | **F10 — Beta % calculation "too aggressive"** | #110 | ⏸ Deferred to next dev | **Peleg (science)** |
| OQ8 | "AlphaFold-predicted structure" title — keep or delete? | #111 | ✅ Resolved — **delete per meeting** (shipped A8) | Peleg (science) |

**Tally: 5 resolved, 3 open (deferred).** All six Issues (#106–#111) were closed 2026-06-29 with ADR-021 linked; the three deferred items are closed-as-deferred, not closed-as-fixed.

---

## The resolved five (recorded for the why-trail)

These need no further action, but the *reasoning* matters for anyone who later wonders why the code looks the way it does.

- **OQ1 — coiled-coil motif.** Peleg confirmed the pipeline class label uses the **coiled-coil motif** convention (two-helix wrap), not the per-residue 3-state "coil" (irregular C-state). Note the subtlety: S4PRED's `P(Coil)` chart curve *stays as-is* because it is genuinely the per-residue 3-state secondary-structure probability — a different quantity from the motif label. The two coexist correctly; do not "fix" one to match the other.
- **OQ3 / OQ5 — magenta.** The aggregation series and the SSW residue overpaint both use magenta (`SSW_RESIDUE_HEX = #E040FB`, consolidated in `sswColor.ts`). Applied consistently across plots, badges, the Mol\* viewer, the sequence track, and exports.
- **OQ6 — per-plot toggles.** Hide/show controls sit under each plot title rather than in one shared row.
- **OQ8 — title deleted.** The "AlphaFold-predicted structure" title was replaced with "Predicted Secondary Structure" (`PeptideDetail.tsx:430`, commit 2026-06-23). This superseded an earlier 2026-06-03 Drive comment that had *approved* the old title — the 2026-06-18 meeting note to delete is authoritative.

---

## The open three (deferred, non-blocking)

### OQ7 / F10 — Beta % calculation flagged "too aggressive" ⚠ science

**The question, plainly:** the β-sheet / Beta % calculation surfaces more β-propensity than Peleg thinks is warranted. She flagged it "too aggressive" in the 2026-05-19 Likoiim review. This is a **scientific algorithm question** — changing the threshold or the calculation method changes a published number, so it requires Peleg's explicit sign-off on the desired threshold value before any code moves.

- **GitHub Issue:** [#110](https://github.com/) (closed-as-deferred 2026-06-29).
- **Current code state:** the existing threshold is *retained*. The Beta% sub-cards were already removed in Wave 2.5; what remains is the underlying calculation Peleg flagged.
- **Who resolves:** **Peleg.** She must specify the target threshold. Per ADR-021 she chose to defer ("next dev will take care of the specifics") and does not regard it as publication-blocking — but it is the single most science-sensitive open item, because it touches a displayed propensity number rather than a label or a color.

### OQ2 — "Rank & Merge" wording

What does *Merge* mean to a user on the ranking surface? Peleg asked whether it should collapse to just "Rank." Deferred; current wording retained. **Who resolves:** a UX/dev decision next time the ranking surface is touched — not a scientific question. No further Issue beyond #107.

### OQ4 — y=0.5 dashed line in the Aggregation-Structure Overlay

The overlay draws a horizontal dashed line at y=0.5 whose meaning was never labeled. Peleg asked what it represents. Deferred; the line is retained. **Who resolves:** a dev decision — either label it (if it is a genuine probability midpoint reference) or remove it. Filed as #108, closed-as-deferred.

---

## Other open scientific / contract items

### Q-FIX-022 — signed charge vs |charge| ⚠ science

**The question:** [net charge](../humans/02_the_science.md#4-biochemistry) is currently displayed/handled as an absolute value `|charge|` in at least the Cohort Comparison path, which **loses the sign**. A peptide at net −3 and one at net +3 are biochemically very different; collapsing them to `3` discards information. Peleg's own framing in the production-lockdown note: *"|charge| loses sign — okay to ship or revisit?"*

- **Source:** `PELEG-Q-FIX-022`, tracked in [`ROADMAP.md`](../../active/ROADMAP.md) Round-2 (Wave 2.7) and the Wave C discussion list (FIX-022, "charge handling: absolute vs signed"). Listed as Peleg co-design item **D6**.
- **GitHub Issue:** no dedicated Issue filed yet — it lives as a `# PELEG-Q-FIX-022` TODO comment in code and a backlog line.
- **Who resolves:** **Peleg** (whether signed charge is the scientifically correct display) with a small dev change to follow. Until then, `|charge|` ships with this caveat noted.

### Length-cap enforcement (route-level)

The 40-aa hard cap is currently *default-skipped* via the S4PRED length cap rather than enforced as a route-level hard-reject for >40-aa sequences. ROADMAP Round-2 lists "hard-reject route enforcement" as still pending. This is an engineering hardening item, not a scientific one — **resolver: dev**, no Peleg sign-off required.

### Section tallies still showing "open" in PELEG_NOTES

The 2026-06-23 revised tally in the Peleg-notes triage shows residual open items outside the OQ block — Q-section (3), B-section (4, mostly Cowork-owned chart/stat features like B7 SSE streaming, B16 Mol\* Phase 2, B20), and E4 export header. These are **implementation work, not unresolved science** — they have agreed designs and simply need shipping. Most have since landed (see BACKLOG "Recently shipped"). They are tracked in [`BACKLOG.md`](../../active/BACKLOG.md) Tiers 1–2, not here.

---

## Future scientific avenues (Tier 3 — not questions, directions)

These are not "unresolved bugs" — they are deliberate research directions where the science is sound but unbuilt. From [`BACKLOG.md`](../../active/BACKLOG.md) Tier 3 and [`ROADMAP.md`](../../active/ROADMAP.md) Phases G/I:

- **[Phase I — multi-predictor consensus](../humans/07_extending.md).** Add Waltz → AGGRESCAN3D → PASTA 2.0 side-by-side, producing a per-predictor verdict table with a consensus statement (Galagos-inspired). The overlay contract (`molstarOverlays.ts` `OverlayType` union) is already forward-compatible. **Open question for the field:** how to weight disagreeing predictors honestly — PVL's ranking design rule is *never* a single-predictor verdict. Resolver: dev + Peleg on the weighting scheme; partly a **literature-review** question (which benchmark defines "ground truth").
- **G2 — RAG + PubMed context.** Per-peptide UniProt context plus retrieved abstracts in a side panel (LanceDB + ESM-2, ADR-016/017; agentic PaperQA2 pattern, ADR-020). **Open question:** the zero-citation-hallucination guarantee — ADR-020 is still **PROPOSED**, pending Peleg's axiom-registry review and Alex's sign-off on hallucination-guard rules. Resolver: Peleg (axioms) + Alex (infra) + literature (PaperQA2 evaluation).
- **Phase G3 — agentic interpreter.** Long-horizon AI assistant that explains each classification with literature evidence. Pre-requisite: G2. Entirely future; no decision owed yet.

---

## Bottom line

PVL is **scientifically locked** at the Wave 2.8/2.9 close-out (ADR-021). Every OQ that touched a *shipped* behaviour landed on what was already in the code. The genuinely open scientific calls are narrow and named: **Beta % threshold (OQ7/F10)** and **signed-charge handling (Q-FIX-022)** — both await Peleg, both non-blocking for v1.0.0. Everything else open is either UX-polish deferred to the next developer or a future research direction with the science understood and the build pending.
