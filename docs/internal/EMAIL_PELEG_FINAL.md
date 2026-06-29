# Email — Peleg, FINAL (Wave 2.8/2.9 lock-in)

To: peleg.ragonis-bachar@... (Technion)
Cc: alex.golubev@cssb-hamburg.de
Subject: PVL — Wave 2.8 + 2.9 locked, paper methods ready, six open scientific questions

Hi Peleg,

Wrapping Wave 2.8 + 2.9. Every actionable item from your two PDF reviews and the Drive comments is shipped, tested, and live on both servers.

**Live**
- Public (paper-citable): http://94.130.178.182:3000 — Hetzner VPS, stable.
- DESY (institutional): `landau-webapp-dev`, internally reachable. Public DNS + HTTPS handover with Alex this week.

**What changed (researcher-facing)**
- 4-class KPI strip on Quick Analyze with reason text per class.
- Per-tool result chips below the sequence track, color-coded.
- Database tabs in the biochem block — compare a peptide vs the fibril-forming reference set or the gold standard, side-by-side.
- TANGO panel renamed and reordered — secondary structure first, aggregation second.
- One-click split-button on /compare: "vs fibril-forming peptides (118)" or "vs gold standard — Staphylococcus 2023 (2,916)". Both load instantly via precomputed artifacts.
- Per-peptide HTML report and PDF report — self-contained, openable cold in any browser, full provenance footer.
- Magenta SSW residue colour applied consistently — in plots, badges, Mol* 3D viewer, sequence track, exports.
- Provenance header on every CSV/TSV/XLSX export: 4 lines — Method, PVL version, Thresholds, Exported at.

**For the paper**
The Methods source-of-truth is `docs/active/PAPER_METHODS_REFERENCE.md`. Every algorithm, threshold, dataset, and primary literature citation is in there in JOSS-paper structure. When you start drafting Methods, that's the file to copy from.

**Six open questions I need from you before v1.0**
Filed as GitHub Issues for tracking; close them at our next sync.
1. [OQ1](https://github.com/saidaz24-meet/peptide_prediction/issues/106) — Coiled-coil terminology (3-state coil vs coiled-coil motif).
2. [OQ2](https://github.com/saidaz24-meet/peptide_prediction/issues/107) — "Rank & Merge" — what does Merge mean to the user?
3. [OQ4](https://github.com/saidaz24-meet/peptide_prediction/issues/108) — y=0.5 dashed line in the Aggregation-Structure overlay — what does it represent?
4. [OQ5](https://github.com/saidaz24-meet/peptide_prediction/issues/109) — SSW residue colour in the Mol* 3D viewer — magenta is shipped; want to confirm.
5. [OQ7](https://github.com/saidaz24-meet/peptide_prediction/issues/110) — Beta % calculation flagged as "too aggressive" (F10) — what threshold do you want?
6. [OQ8](https://github.com/saidaz24-meet/peptide_prediction/issues/111) — "AlphaFold-predicted structure" title — approved 2026-06-03 or delete per the 2026-06-18 meeting?

**Quality + scale**
- 672 frontend tests + 646 backend tests passing.
- Rate limiter on the two expensive routes (30 req/min/IP).
- Secret scanning, push protection, vulnerability alerts, CodeQL static analysis, Dependabot security updates — all live.
- Branch protection on main: 1 review + 4 CI checks required.

**Next steps from your end**
- Answer the 6 OQs at our next sync (or async if simpler).
- Walk through the demo on either URL — let me know what's missing for the paper.
- Confirm your ORCID `0000-0002-0979-8165` is the right one to list in `CITATION.cff`.

Said


---
*Internal note — what's shipping after this email*:
- v1.0.0 tag + Zenodo DOI (PUBLICATION_PATH.md §1–3)
- bio.tools submission (§4)
- JOSS paper submission (§5, after Zenodo DOI lands)
