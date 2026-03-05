import jsPDF from "jspdf";
import type { Peptide, DatasetStats, DatasetMetadata } from "@/types/peptide";
import type { ResolvedThresholds } from "@/lib/thresholds";
import { DEFAULT_THRESHOLDS } from "@/lib/thresholds";
import { rankPeptides, METRIC_LABELS, type RankingWeights } from "@/lib/ranking";

// ---- PDF report constants ----
const MARGIN = 40;
const LINE_H = 14;
const HEADER_FONT = 11;
const BODY_FONT = 9;
const TABLE_FONT = 8;
const COL_GAP = 6;

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "N/A";
  return v.toFixed(decimals);
}

function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "N/A";
  return `${v.toFixed(decimals)}%`;
}

function sswLabel(v: number | null | undefined): string {
  if (v === 1) return "Positive";
  if (v === -1) return "Negative";
  if (v === 0) return "Uncertain";
  return "N/A";
}

/** Add a horizontal line at current Y position */
function hline(pdf: jsPDF, y: number, w: number) {
  pdf.setDrawColor(180);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, w - MARGIN, y);
}

/**
 * Generate a structured PDF report from the analysis results.
 *
 * Includes:
 *  - Header with dataset metadata
 *  - Summary statistics
 *  - Top-N ranked peptides table
 *  - Methodology notes
 */
export function exportShortlistPDF(
  peptides: Peptide[],
  stats: DatasetStats,
  meta: DatasetMetadata | null,
  weights: RankingWeights,
  topN: number = 10,
  thresholds: ResolvedThresholds | number = 50.0
) {
  // Backward compat: accept number (old ffHelixThreshold) or full ResolvedThresholds
  const resolvedThresholds: ResolvedThresholds =
    typeof thresholds === "number" ? { ...DEFAULT_THRESHOLDS } : thresholds;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let y = MARGIN;

  // ---- Helper: check if we need a new page ----
  function checkPage(needed: number) {
    if (y + needed > pageH - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  }

  // ================================================================
  // 1. HEADER
  // ================================================================
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Peptide Visual Lab — Analysis Report", MARGIN, y);
  y += 20;

  pdf.setFontSize(BODY_FONT);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  const dateStr = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.text(`Generated: ${dateStr}`, MARGIN, y);
  if ((meta as any)?.filename) {
    pdf.text(`Dataset: ${(meta as any).filename}`, MARGIN + 200, y);
  }
  y += LINE_H;
  pdf.text(`Total peptides: ${stats.totalPeptides}`, MARGIN, y);

  // Provider status
  const tangoStatus = meta?.provider_status?.tango?.status ?? "OFF";
  const s4predStatus = meta?.provider_status?.s4pred?.status ?? "OFF";
  pdf.text(`TANGO: ${tangoStatus}  |  S4PRED: ${s4predStatus}`, MARGIN + 200, y);
  y += 8;
  pdf.setTextColor(0);
  hline(pdf, y, pageW);
  y += 16;

  // ================================================================
  // 2. SUMMARY STATISTICS
  // ================================================================
  pdf.setFontSize(HEADER_FONT);
  pdf.setFont("helvetica", "bold");
  pdf.text("Summary Statistics", MARGIN, y);
  y += LINE_H + 2;

  pdf.setFontSize(BODY_FONT);
  pdf.setFont("helvetica", "normal");

  const summaryRows = [
    ["TANGO SSW Rate", fmtPct(stats.sswPositivePercent)],
    ["Mean Hydrophobicity", fmt(stats.meanHydrophobicity)],
    ["Mean |Charge|", fmt(stats.meanCharge)],
    ["Mean μH", fmt(stats.meanMuH)],
    ["Mean CF Propensity %", fmtPct(stats.meanFFHelixPercent)],
    ["Mean S4PRED Helix %", fmtPct(stats.meanS4predHelixPercent)],
    ["Mean Length (aa)", fmt(stats.meanLength, 1)],
  ];

  for (const [label, value] of summaryRows) {
    pdf.setFont("helvetica", "bold");
    pdf.text(label + ":", MARGIN + 10, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, MARGIN + 160, y);
    y += LINE_H;
  }
  y += 4;
  hline(pdf, y, pageW);
  y += 16;

  // ================================================================
  // 2b. THRESHOLDS APPLIED
  // ================================================================
  checkPage(80);
  pdf.setFontSize(HEADER_FONT);
  pdf.setFont("helvetica", "bold");
  pdf.text("Thresholds Applied", MARGIN, y);
  y += LINE_H + 2;

  pdf.setFontSize(BODY_FONT);
  pdf.setFont("helvetica", "normal");

  // Detect if custom or server thresholds
  const isServerDefault =
    resolvedThresholds.muHCutoff === 0.0 && resolvedThresholds.hydroCutoff === 0.0;
  const thresholdSource = isServerDefault ? "Original (server)" : "Custom (client-adjusted)";

  const thresholdRows = [
    ["μH Cutoff", fmt(resolvedThresholds.muHCutoff)],
    ["Hydrophobicity Cutoff", fmt(resolvedThresholds.hydroCutoff)],
    ["Agg Threshold", fmtPct(resolvedThresholds.aggThreshold, 1)],
    ["Source", thresholdSource],
  ];

  for (const [label, value] of thresholdRows) {
    pdf.setFont("helvetica", "bold");
    pdf.text(label + ":", MARGIN + 10, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, MARGIN + 160, y);
    y += LINE_H;
  }
  y += 4;
  hline(pdf, y, pageW);
  y += 16;

  // ================================================================
  // 3. TOP-N RANKED PEPTIDES (percentile-based)
  // ================================================================
  const tangoAvailable = tangoStatus !== "OFF" && tangoStatus !== "UNAVAILABLE";
  const allRankings = rankPeptides(peptides, weights, { tangoAvailable });
  const ranked = [...allRankings]
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, Math.max(1, topN))
    .map((r, i) => ({
      rank: i + 1,
      p: peptides.find((p) => p.id === r.peptideId)!,
      r,
    }))
    .filter((x) => x.p != null);

  pdf.setFontSize(HEADER_FONT);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Top ${ranked.length} Candidate Peptides (by percentile score)`, MARGIN, y);
  y += 4;

  pdf.setFontSize(TABLE_FONT);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  const weightStr = Object.entries(weights)
    .map(([k, v]) => `${METRIC_LABELS[k as keyof typeof METRIC_LABELS] ?? k}: ${v}`)
    .join("  ");
  pdf.text(`Weights — ${weightStr}`, MARGIN, y + LINE_H);
  pdf.setTextColor(0);
  y += LINE_H + 10;

  // Table columns: Rank, ID, Seq, Len, Composite, Physico, Structural, Agg
  const cols = [
    { header: "#", width: 22 },
    { header: "ID", width: 85 },
    { header: "Sequence", width: 160 },
    { header: "Len", width: 28 },
    { header: "Score", width: 42 },
    { header: "Physico", width: 42 },
    { header: "Struct", width: 42 },
    { header: "Agg", width: 42 },
    { header: "SSW", width: 48 },
  ];

  // Table header
  checkPage(LINE_H * (ranked.length + 3));
  let x = MARGIN;
  pdf.setFont("helvetica", "bold");
  pdf.setFillColor(240, 240, 240);
  pdf.rect(MARGIN, y - 10, pageW - 2 * MARGIN, LINE_H + 2, "F");
  for (const col of cols) {
    pdf.text(col.header, x + 2, y);
    x += col.width + COL_GAP;
  }
  y += LINE_H + 2;

  // Table rows
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(TABLE_FONT);
  for (let i = 0; i < ranked.length; i++) {
    checkPage(LINE_H + 4);
    const { p, r: ranking } = ranked[i];

    // Alternate row background
    if (i % 2 === 0) {
      pdf.setFillColor(248, 248, 248);
      pdf.rect(MARGIN, y - 10, pageW - 2 * MARGIN, LINE_H, "F");
    }

    const seqTrunc = p.sequence.length > 30 ? p.sequence.slice(0, 27) + "..." : p.sequence;

    const fmtScore = (v: number | null) => (v != null ? Math.round(v).toString() : "-");

    const row = [
      String(i + 1),
      p.id.length > 15 ? p.id.slice(0, 13) + ".." : p.id,
      seqTrunc,
      p.length !== null ? String(p.length) : "-",
      fmtScore(ranking.compositeScore),
      fmtScore(ranking.categoryScores.physicochemical),
      fmtScore(ranking.categoryScores.structural),
      fmtScore(ranking.categoryScores.aggregation),
      sswLabel(p.sswPrediction),
    ];

    x = MARGIN;
    for (let c = 0; c < cols.length; c++) {
      pdf.text(row[c], x + 2, y);
      x += cols[c].width + COL_GAP;
    }
    y += LINE_H;
  }

  y += 8;
  hline(pdf, y, pageW);
  y += 16;

  // ================================================================
  // 4. METHODOLOGY NOTES
  // ================================================================
  checkPage(80);
  pdf.setFontSize(HEADER_FONT);
  pdf.setFont("helvetica", "bold");
  pdf.text("Methodology", MARGIN, y);
  y += LINE_H + 2;

  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80);
  const notes = [
    "Hydrophobicity: Fauchere-Pliska scale, mean per-residue value.",
    "μH (Hydrophobic Moment): Eisenberg consensus, α-helix angle (100°).",
    "FF-Helix %: Chou-Fasman (1978) context-free helix propensity.",
    "SSW Score: Secondary Structure Switch score from TANGO aggregation analysis.",
    "TANGO Agg Max: Maximum aggregation propensity from TANGO per-residue analysis.",
    "Ranking: Percentile-based (0-100). Each metric is converted to a percentile rank",
    "  within the cohort. Composite = weighted average of metric percentiles.",
    "",
    "Generated by Peptide Visual Lab (PVL) — https://github.com/your-org/peptide-visual-lab",
  ];
  for (const note of notes) {
    pdf.text(note, MARGIN + 10, y);
    y += 10;
  }

  // Save
  const timestamp = new Date().toISOString().slice(0, 10);
  pdf.save(`pvl_shortlist_report_${timestamp}.pdf`);
}

/**
 * Legacy screenshot-based PDF export (kept for backward compatibility).
 * Captures the visible results area as a PNG screenshot embedded in PDF.
 */
export async function exportResultsAsPDF(rootSelector = "#results-root") {
  const { default: html2canvas } = await import("html2canvas");
  const el = document.querySelector(rootSelector) as HTMLElement;
  if (!el) throw new Error(`Results root '${rootSelector}' not found`);
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, windowWidth: el.scrollWidth });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const r = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * r;
  const h = canvas.height * r;
  pdf.addImage(img, "PNG", (pageW - w) / 2, 20, w, h);
  pdf.save(`peptide_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
