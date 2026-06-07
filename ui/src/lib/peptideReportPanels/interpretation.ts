/**
 * Interpretation panel — Narrative summary page.
 *
 * Contents:
 * - Auto-generated interpretation paragraphs based on peptide data
 * - Helix propensity assessment
 * - Aggregation risk assessment
 * - Structural switching assessment
 * - FF candidate summary
 */

import type { jsPDF } from "jspdf";
import type { Peptide } from "@/types/peptide";
import type { ReportData, ReportPanel, RenderContext } from "../peptideReport";
import { drawSectionHeading, drawParagraph } from "../peptideReport";

/** Build interpretation paragraphs from peptide data. */
function buildInterpretation(peptide: Peptide): string[] {
  const paragraphs: string[] = [];

  // ── Helix propensity ───────────────────────────────────────────
  if (peptide.s4predHelixPrediction === 1) {
    const pct =
      peptide.s4predHelixPercent != null
        ? ` with ${peptide.s4predHelixPercent.toFixed(1)}% helical content`
        : "";
    paragraphs.push(
      `S4PRED predicts ${peptide.id} to adopt a helical conformation${pct}. ` +
        `This suggests the peptide has a propensity to form alpha-helical structures ` +
        `under physiological conditions.`
    );
  } else if (peptide.s4predHelixPrediction === -1) {
    paragraphs.push(
      `S4PRED does not predict significant helical content for ${peptide.id}. ` +
        `The peptide is predicted to adopt predominantly coil or beta-strand conformations.`
    );
  }

  // ── FF-Helix assessment ────────────────────────────────────────
  if (peptide.ffHelixFlag === 1) {
    paragraphs.push(
      `${peptide.id} is classified as an FF-Helix candidate, indicating it meets the ` +
        `hydrophobicity and hydrophobic moment thresholds associated with fibril-forming ` +
        `helical peptides. This classification is based on the combined helix score ` +
        `(helix_uH + helix_score) exceeding the reference threshold.`
    );
  } else if (peptide.ffHelixFlag === -1) {
    paragraphs.push(
      `${peptide.id} does not meet the criteria for FF-Helix classification. ` +
        `The peptide's biophysical properties fall below the thresholds for ` +
        `fibril-forming helical candidates.`
    );
  }

  // ── Aggregation risk ───────────────────────────────────────────
  const maxAgg =
    peptide.tangoAggMax ?? (peptide.tango?.agg ? Math.max(...peptide.tango.agg) : null);
  if (maxAgg != null) {
    if (maxAgg > 50) {
      paragraphs.push(
        // 2026-06-08: terminology aligned to Peleg's "fibril-formation" framing
        // per project_peleg_drive_review_2026_05_22 (AMP shared feature space).
        `TANGO analysis reveals a high aggregation propensity for ${peptide.id} ` +
          `(peak AGG = ${maxAgg.toFixed(1)}%). Regions exceeding 5% aggregation score ` +
          `are considered aggregation-prone and may participate in fibril formation ` +
          `under appropriate conditions.`
      );
    } else if (maxAgg > 5) {
      paragraphs.push(
        `TANGO analysis indicates moderate aggregation propensity for ${peptide.id} ` +
          `(peak AGG = ${maxAgg.toFixed(1)}%). Some residues exceed the 5% aggregation ` +
          `threshold, suggesting localized aggregation-prone regions.`
      );
    } else {
      paragraphs.push(
        `TANGO analysis shows low aggregation propensity for ${peptide.id} ` +
          `(peak AGG = ${maxAgg.toFixed(1)}%). No residues exceed the 5% aggregation ` +
          `threshold, suggesting the peptide is not aggregation-prone.`
      );
    }
  }

  // ── SSW assessment ─────────────────────────────────────────────
  if (peptide.sswPrediction === 1 || (peptide.s4predSswPrediction ?? 0) === 1) {
    paragraphs.push(
      // 2026-06-08: "amyloidogenic peptides" → "fibril-forming peptides" per
      // Peleg's terminology. SSW = helix↔β indecision; the conformational
      // transition is what makes them fibril-formation candidates in her
      // 2022 algorithm.
      `A secondary structure switch (SSW) is predicted for ${peptide.id}. ` +
        `This indicates the peptide may undergo a conformational transition between ` +
        `helical and beta-strand states, a hallmark of fibril-forming peptides.`
    );

    if (peptide.ffSswFlag === 1) {
      paragraphs.push(
        // 2026-06-08: "amyloid fibril formation" → "fibril formation" per
        // Peleg's framing — amyloid is a structural subtype, not the gate.
        `Furthermore, ${peptide.id} is classified as an FF-SSW candidate, meeting ` +
          `the combined criteria for fibril-forming structural switching. This places it ` +
          `in the highest-risk category for fibril formation under appropriate conditions.`
      );
    }
  } else if (peptide.sswPrediction === -1) {
    paragraphs.push(
      `No secondary structure switch is predicted for ${peptide.id}. ` +
        `The peptide is expected to maintain a stable secondary structure.`
    );
  }

  // ── Fallback ───────────────────────────────────────────────────
  if (paragraphs.length === 0) {
    paragraphs.push(
      `Insufficient prediction data is available for a detailed interpretation of ${peptide.id}. ` +
        `Please ensure TANGO and S4PRED predictions have been computed for this peptide.`
    );
  }

  return paragraphs;
}

function drawInterpretationContent(
  doc: jsPDF,
  peptide: Peptide,
  _data: ReportData,
  ctx: RenderContext
): void {
  let y = ctx.contentTop;

  y = drawSectionHeading(doc, `Interpretation — ${peptide.id}`, y);

  const paragraphs = buildInterpretation(peptide);

  for (const para of paragraphs) {
    if (y > ctx.footerY - 20) break; // don't overrun footer
    y = drawParagraph(doc, para, y, 9);
    y += 2;
  }

  // ── Disclaimer ─────────────────────────────────────────────────
  if (y < ctx.footerY - 25) {
    y += 6;
    y = drawParagraph(
      doc,
      "Note: These interpretations are computationally generated based on TANGO and S4PRED " +
        "predictions. They should be considered as guides for further experimental investigation, " +
        "not as definitive characterizations. Experimental validation is required to confirm " +
        "predicted structural and aggregation properties.",
      y,
      8
    );
  }
}

export const interpretationPanel: ReportPanel = {
  id: "interpretation",
  title: "Interpretation",
  render: drawInterpretationContent,
};
