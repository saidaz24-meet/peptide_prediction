/**
 * Figure Pack orchestration — generates multi-panel figure sets
 * ready for Nature/Science publication supplements.
 *
 * All panels produce standalone SVG strings (pure functions, no DOM).
 */
import type { Peptide, DatasetStats } from "@/types/peptide";
import type { ResolvedThresholds } from "@/lib/thresholds";
import { generateClassificationTableSVG } from "@/lib/figurePackPanels/classificationTable";
import { generateRadarOverlaySVG } from "@/lib/figurePackPanels/radarOverlay";
import { generateAggregationProfileSVG } from "@/lib/figurePackPanels/aggregationProfile";
import { generateMethodsSVG } from "@/lib/figurePackPanels/methodsText";

// Re-export ActiveThresholds as the resolved type
export type ActiveThresholds = ResolvedThresholds;

export interface FigurePackOptions {
  /** Selected peptides for the figure pack */
  peptides: Peptide[];
  /** All peptides in database (for distribution context) */
  allPeptides: Peptide[];
  /** Active thresholds */
  thresholds: ActiveThresholds;
  /** Database stats */
  stats: DatasetStats;
  /** Optional title for the cover page */
  title?: string;
}

export interface FigurePanel {
  id: string;
  label: string;
  title: string;
  description: string;
  /** SVG string content */
  svg: string;
}

const FONT = "Arial, Helvetica, sans-serif";

/** Generate a cover page SVG summarizing the figure pack contents */
export function generateCoverPage(options: FigurePackOptions): string {
  const { peptides, stats, title } = options;
  const displayTitle = title ?? "PVL Figure Pack";
  const date = new Date().toISOString().slice(0, 10);

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines: string[] = [];
  let y = 60;

  // Title
  lines.push(
    `<text x="400" y="${y}" font-family="${FONT}" font-size="20" font-weight="bold" fill="#222" text-anchor="middle">${escapeXml(displayTitle)}</text>`,
  );
  y += 30;

  // Subtitle
  lines.push(
    `<text x="400" y="${y}" font-family="${FONT}" font-size="12" fill="#666" text-anchor="middle">Peptide Visual Lab — Publication Figure Set</text>`,
  );
  y += 40;

  // Separator
  lines.push(`<line x1="100" y1="${y}" x2="700" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`);
  y += 30;

  // Summary stats
  const summaryLines = [
    `Peptides selected: ${peptides.length} / ${stats.totalPeptides} total`,
    `Mean hydrophobicity: ${stats.meanHydrophobicity.toFixed(3)}`,
    `Mean charge: ${stats.meanCharge.toFixed(2)}`,
    `Mean length: ${stats.meanLength.toFixed(1)} aa`,
    stats.meanS4predHelixPercent != null
      ? `Mean S4PRED helix: ${stats.meanS4predHelixPercent.toFixed(1)}%`
      : null,
    stats.ffHelixCandidatePercent != null
      ? `FF-Helix candidates: ${stats.ffHelixCandidatePercent.toFixed(1)}%`
      : null,
  ].filter(Boolean) as string[];

  for (const line of summaryLines) {
    lines.push(
      `<text x="120" y="${y}" font-family="${FONT}" font-size="11" fill="#444">${escapeXml(line)}</text>`,
    );
    y += 20;
  }

  y += 20;

  // Panel index
  lines.push(
    `<text x="120" y="${y}" font-family="${FONT}" font-size="12" font-weight="bold" fill="#333">Panels</text>`,
  );
  y += 22;

  const panelIndex = [
    "Panel A — Classification Table",
    "Panel B — Radar Overlay",
    "Panel C — Aggregation Propensity Profile",
    "Panel D — Methods & Thresholds",
  ];
  for (const entry of panelIndex) {
    lines.push(
      `<text x="130" y="${y}" font-family="${FONT}" font-size="10" fill="#555">${entry}</text>`,
    );
    y += 18;
  }

  y += 30;

  // Footer
  lines.push(
    `<text x="400" y="${y}" font-family="${FONT}" font-size="9" fill="#999" text-anchor="middle">Generated ${date} by PVL (Peptide Visual Lab) v0.1</text>`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${y + 30}" width="800" height="${y + 30}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    ...lines,
    `</svg>`,
  ].join("\n");
}

/** Generate all panels for the figure pack */
export async function generateFigurePack(
  options: FigurePackOptions,
): Promise<FigurePanel[]> {
  const { peptides, stats, thresholds } = options;

  const panels: FigurePanel[] = [
    {
      id: "panel-a-classification",
      label: "Panel A",
      title: "Classification Table",
      description:
        "Classification matrix showing FF-Helix, SSW, and FF-SSW flags for each peptide with S4PRED helix content.",
      svg: generateClassificationTableSVG(peptides),
    },
    {
      id: "panel-b-radar",
      label: "Panel B",
      title: "Radar Overlay",
      description:
        "Multi-peptide radar chart comparing hydrophobicity, hydrophobic moment, charge, length, and S4PRED helix content against database means.",
      svg: generateRadarOverlaySVG(peptides, stats),
    },
    {
      id: "panel-c-aggregation",
      label: "Panel C",
      title: "Aggregation Propensity Profile",
      description:
        "Per-residue TANGO aggregation propensity overlay for selected peptides.",
      svg: generateAggregationProfileSVG(peptides),
    },
    {
      id: "panel-d-methods",
      label: "Panel D",
      title: "Methods & Thresholds",
      description:
        "Auto-generated methods text with active thresholds, analysis date, and citation.",
      svg: generateMethodsSVG(thresholds, peptides.length),
    },
  ];

  return panels;
}

/**
 * Download a figure pack as a single HTML file embedding all SVG panels.
 * Fallback when JSZip is not available.
 */
export function downloadFigurePackAsHTML(
  panels: FigurePanel[],
  coverSvg: string,
  title: string,
): void {
  const panelSections = panels
    .map(
      (p) => `
    <section style="margin-bottom:40px;">
      <h2 style="font-family:Arial,sans-serif;color:#333;margin-bottom:8px;">${p.label} — ${p.title}</h2>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin-bottom:12px;">${p.description}</p>
      ${p.svg}
    </section>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { max-width: 900px; margin: 40px auto; padding: 0 20px; background: #fff; }
    section svg { max-width: 100%; height: auto; border: 1px solid #eee; }
    @media print { section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <section style="margin-bottom:40px;">
    <h1 style="font-family:Arial,sans-serif;color:#222;">Cover</h1>
    ${coverSvg}
  </section>
  ${panelSections}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}_figure_pack.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download individual SVG files via sequential anchor clicks.
 * Used as a final fallback.
 */
export function downloadSVGFiles(
  panels: FigurePanel[],
  coverSvg: string,
): void {
  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  downloadBlob(coverSvg, "00_cover.svg");
  panels.forEach((p, i) => {
    downloadBlob(p.svg, `${String(i + 1).padStart(2, "0")}_${p.id}.svg`);
  });
}
