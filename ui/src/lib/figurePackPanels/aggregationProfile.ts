/**
 * Panel C — Aggregation propensity profile overlay as standalone SVG.
 *
 * If peptides have per-residue TANGO data, overlays aggregation profiles.
 * Otherwise, renders a placeholder message.
 */
import type { Peptide } from "@/types/peptide";

const FONT = "Arial, Helvetica, sans-serif";
const WIDTH = 800;
const HEIGHT = 300;
const PLOT_LEFT = 60;
const PLOT_RIGHT = WIDTH - 30;
const PLOT_TOP = 40;
const PLOT_BOTTOM = HEIGHT - 60;
const PLOT_W = PLOT_RIGHT - PLOT_LEFT;
const PLOT_H = PLOT_BOTTOM - PLOT_TOP;

/** 8-color qualitative palette */
const PALETTE = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
  "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
];

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateAggregationProfileSVG(peptides: Peptide[]): string {
  const lines: string[] = [];

  // Panel label
  lines.push(`<text x="12" y="20" font-family="${FONT}" font-size="14" font-weight="bold" fill="#333">C</text>`);

  // Check if any peptide has TANGO agg data
  const withAgg = peptides.filter(
    (p) => p.tango?.agg && p.tango.agg.length > 0,
  );

  if (withAgg.length === 0) {
    // Placeholder
    lines.push(
      `<rect x="${PLOT_LEFT}" y="${PLOT_TOP}" width="${PLOT_W}" height="${PLOT_H}" fill="#fafafa" stroke="#e0e0e0" rx="4"/>`,
    );
    lines.push(
      `<text x="${WIDTH / 2}" y="${HEIGHT / 2}" font-family="${FONT}" font-size="13" fill="#999" text-anchor="middle">TANGO per-residue data not available</text>`,
    );
    lines.push(
      `<text x="${WIDTH / 2}" y="${HEIGHT / 2 + 20}" font-family="${FONT}" font-size="10" fill="#bbb" text-anchor="middle">Enable TANGO analysis to generate aggregation profiles</text>`,
    );
  } else {
    // Find global max for Y-axis and max length for X-axis
    let yMax = 10;
    let xMax = 0;
    for (const p of withAgg) {
      const agg = p.tango!.agg!;
      xMax = Math.max(xMax, agg.length);
      for (const v of agg) {
        if (v > yMax) yMax = v;
      }
    }
    // Round yMax up
    yMax = Math.ceil(yMax / 10) * 10 || 10;

    // Axes
    lines.push(
      `<line x1="${PLOT_LEFT}" y1="${PLOT_BOTTOM}" x2="${PLOT_RIGHT}" y2="${PLOT_BOTTOM}" stroke="#333" stroke-width="1"/>`,
    );
    lines.push(
      `<line x1="${PLOT_LEFT}" y1="${PLOT_TOP}" x2="${PLOT_LEFT}" y2="${PLOT_BOTTOM}" stroke="#333" stroke-width="1"/>`,
    );

    // Y-axis ticks
    for (let i = 0; i <= 4; i++) {
      const val = (yMax * i) / 4;
      const y = PLOT_BOTTOM - (i / 4) * PLOT_H;
      lines.push(
        `<line x1="${PLOT_LEFT - 4}" y1="${y.toFixed(1)}" x2="${PLOT_LEFT}" y2="${y.toFixed(1)}" stroke="#333" stroke-width="1"/>`,
      );
      lines.push(
        `<text x="${PLOT_LEFT - 8}" y="${(y + 3).toFixed(1)}" font-family="${FONT}" font-size="9" fill="#555" text-anchor="end">${val.toFixed(0)}</text>`,
      );
      if (i > 0) {
        lines.push(
          `<line x1="${PLOT_LEFT}" y1="${y.toFixed(1)}" x2="${PLOT_RIGHT}" y2="${y.toFixed(1)}" stroke="#f0f0f0" stroke-width="0.5"/>`,
        );
      }
    }

    // X-axis label
    lines.push(
      `<text x="${PLOT_LEFT + PLOT_W / 2}" y="${HEIGHT - 10}" font-family="${FONT}" font-size="10" fill="#555" text-anchor="middle">Residue position</text>`,
    );

    // Y-axis label
    lines.push(
      `<text x="16" y="${PLOT_TOP + PLOT_H / 2}" font-family="${FONT}" font-size="10" fill="#555" text-anchor="middle" transform="rotate(-90, 16, ${PLOT_TOP + PLOT_H / 2})">Aggregation propensity</text>`,
    );

    // Plot each peptide
    withAgg.forEach((p, idx) => {
      const agg = p.tango!.agg!;
      const color = PALETTE[idx % PALETTE.length];
      const pathParts: string[] = [];

      for (let r = 0; r < agg.length; r++) {
        const x = PLOT_LEFT + (r / (xMax - 1)) * PLOT_W;
        const y = PLOT_BOTTOM - (agg[r] / yMax) * PLOT_H;
        pathParts.push(`${r === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
      }

      lines.push(
        `<path d="${pathParts.join(" ")}" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.8"/>`,
      );
    });

    // Legend
    const legendY = PLOT_BOTTOM + 30;
    withAgg.forEach((p, idx) => {
      const color = PALETTE[idx % PALETTE.length];
      const lx = PLOT_LEFT + idx * 120;
      lines.push(
        `<line x1="${lx}" y1="${legendY}" x2="${lx + 16}" y2="${legendY}" stroke="${color}" stroke-width="2"/>`,
      );
      lines.push(
        `<text x="${lx + 20}" y="${legendY + 3}" font-family="${FONT}" font-size="9" fill="#333">${escapeXml(p.id.slice(0, 14))}</text>`,
      );
    });
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    ...lines,
    `</svg>`,
  ].join("\n");
}
