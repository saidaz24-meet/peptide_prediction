/**
 * Panel A — Classification matrix table as standalone SVG.
 *
 * Renders a publication-ready table with columns:
 * ID | Sequence | Length | FF-Helix | SSW | FF-SSW | S4PRED Helix %
 */
import type { Peptide } from "@/types/peptide";

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 40;
const FONT = "Arial, Helvetica, sans-serif";

/** 8-color qualitative palette for consistent figure styling */
const FLAG_POSITIVE = "#2e7d32";
const FLAG_NEGATIVE = "#c62828";
const FLAG_NULL = "#9e9e9e";
const HEADER_BG = "#f5f5f5";
const BORDER_COLOR = "#e0e0e0";

function formatFlag(value: number | null | undefined): { text: string; color: string } {
  if (value === 1) return { text: "✓", color: FLAG_POSITIVE };
  if (value === -1) return { text: "✗", color: FLAG_NEGATIVE };
  return { text: "—", color: FLAG_NULL };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Truncate sequence for display, keeping first/last residues */
function truncateSeq(seq: string, maxLen = 20): string {
  if (seq.length <= maxLen) return seq;
  const half = Math.floor((maxLen - 3) / 2);
  return `${seq.slice(0, half)}...${seq.slice(-half)}`;
}

// Column definitions: [label, x, width, align]
const COLUMNS: Array<[string, number, number, "start" | "middle" | "end"]> = [
  ["ID", 40, 100, "start"],
  ["Sequence", 150, 180, "start"],
  ["Len", 340, 40, "end"],
  ["FF-Helix", 400, 60, "middle"],
  ["SSW", 480, 60, "middle"],
  ["FF-SSW", 560, 60, "middle"],
  ["S4PRED H%", 650, 80, "end"],
];

const TABLE_WIDTH = 800;

export function generateClassificationTableSVG(peptides: Peptide[]): string {
  const height = HEADER_HEIGHT + peptides.length * ROW_HEIGHT + 10;
  const rows: string[] = [];

  // Panel label
  rows.push(`<text x="12" y="20" font-family="${FONT}" font-size="14" font-weight="bold" fill="#333">A</text>`);

  // Header background
  rows.push(
    `<rect x="30" y="4" width="${TABLE_WIDTH - 40}" height="${HEADER_HEIGHT - 4}" fill="${HEADER_BG}" rx="2"/>`,
  );

  // Header row
  for (const [label, x, , align] of COLUMNS) {
    rows.push(
      `<text x="${x}" y="28" font-family="${FONT}" font-size="11" font-weight="bold" fill="#333" text-anchor="${align}">${label}</text>`,
    );
  }

  // Header separator
  rows.push(
    `<line x1="30" y1="${HEADER_HEIGHT}" x2="${TABLE_WIDTH - 10}" y2="${HEADER_HEIGHT}" stroke="${BORDER_COLOR}" stroke-width="1"/>`,
  );

  // Data rows
  peptides.forEach((p, i) => {
    const y = HEADER_HEIGHT + i * ROW_HEIGHT + 20;

    // Zebra striping
    if (i % 2 === 1) {
      rows.push(
        `<rect x="30" y="${HEADER_HEIGHT + i * ROW_HEIGHT + 2}" width="${TABLE_WIDTH - 40}" height="${ROW_HEIGHT}" fill="#fafafa"/>`,
      );
    }

    // ID
    rows.push(
      `<text x="${COLUMNS[0][1]}" y="${y}" font-family="${FONT}" font-size="10" fill="#333">${escapeXml(p.id.slice(0, 16))}</text>`,
    );

    // Sequence
    rows.push(
      `<text x="${COLUMNS[1][1]}" y="${y}" font-family="'Courier New', monospace" font-size="9" fill="#555">${escapeXml(truncateSeq(p.sequence))}</text>`,
    );

    // Length
    rows.push(
      `<text x="${COLUMNS[2][1]}" y="${y}" font-family="${FONT}" font-size="10" fill="#333" text-anchor="end">${p.length ?? "—"}</text>`,
    );

    // FF-Helix flag
    const ffH = formatFlag(p.ffHelixFlag);
    rows.push(
      `<text x="${COLUMNS[3][1]}" y="${y}" font-family="${FONT}" font-size="12" fill="${ffH.color}" text-anchor="middle">${ffH.text}</text>`,
    );

    // SSW prediction
    const ssw = formatFlag(p.sswPrediction);
    rows.push(
      `<text x="${COLUMNS[4][1]}" y="${y}" font-family="${FONT}" font-size="12" fill="${ssw.color}" text-anchor="middle">${ssw.text}</text>`,
    );

    // FF-SSW flag
    const ffSsw = formatFlag(p.ffSswFlag);
    rows.push(
      `<text x="${COLUMNS[5][1]}" y="${y}" font-family="${FONT}" font-size="12" fill="${ffSsw.color}" text-anchor="middle">${ffSsw.text}</text>`,
    );

    // S4PRED Helix %
    const helixPct =
      typeof p.s4predHelixPercent === "number"
        ? `${p.s4predHelixPercent.toFixed(1)}%`
        : "—";
    rows.push(
      `<text x="${COLUMNS[6][1]}" y="${y}" font-family="${FONT}" font-size="10" fill="#333" text-anchor="end">${helixPct}</text>`,
    );
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TABLE_WIDTH} ${height}" width="${TABLE_WIDTH}" height="${height}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    ...rows,
    `</svg>`,
  ].join("\n");
}
