/**
 * Panel B — Radar overlay chart as standalone SVG.
 *
 * All selected peptides overlaid on one radar chart with metrics:
 * Hydrophobicity, uH, Charge, Length, S4PRED Helix.
 * Each peptide gets a different color from a qualitative palette.
 */
import type { Peptide, DatasetStats } from "@/types/peptide";

const FONT = "Arial, Helvetica, sans-serif";
const SIZE = 500;
const CX = SIZE / 2;
const CY = 220;
const RADIUS = 160;

/** 8-color qualitative palette (colorblind-friendly) */
const PALETTE = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
  "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
];

interface RadarAxis {
  label: string;
  shortLabel: string;
  getValue: (p: Peptide) => number | null | undefined;
  getMean: (s: DatasetStats) => number | null | undefined;
  /** Min/max for normalization */
  min: number;
  max: number;
}

const AXES: RadarAxis[] = [
  {
    label: "Hydrophobicity",
    shortLabel: "H",
    getValue: (p) => p.hydrophobicity,
    getMean: (s) => s.meanHydrophobicity,
    min: -1.5,
    max: 2.0,
  },
  {
    label: "Hydrophobic Moment",
    shortLabel: "uH",
    getValue: (p) => p.muH,
    getMean: (s) => s.meanMuH,
    min: 0,
    max: 1.5,
  },
  {
    label: "Charge",
    shortLabel: "Q",
    getValue: (p) => p.charge,
    getMean: (s) => s.meanCharge,
    min: -5,
    max: 10,
  },
  {
    label: "Length",
    shortLabel: "Len",
    getValue: (p) => p.length,
    getMean: (s) => s.meanLength,
    min: 0,
    max: 60,
  },
  {
    label: "S4PRED Helix %",
    shortLabel: "Helix%",
    getValue: (p) => p.s4predHelixPercent,
    getMean: (s) => s.meanS4predHelixPercent,
    min: 0,
    max: 100,
  },
];

function normalize(value: number | null | undefined, axis: RadarAxis): number {
  if (value == null) return 0;
  const range = axis.max - axis.min;
  if (range === 0) return 0;
  return Math.max(0, Math.min(1, (value - axis.min) / range));
}

function polarToXY(angle: number, r: number): [number, number] {
  // Start from top (subtract pi/2)
  const a = angle - Math.PI / 2;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateRadarOverlaySVG(peptides: Peptide[], stats: DatasetStats): string {
  const n = AXES.length;
  const angleStep = (2 * Math.PI) / n;
  const lines: string[] = [];

  // Panel label
  lines.push(`<text x="12" y="20" font-family="${FONT}" font-size="14" font-weight="bold" fill="#333">B</text>`);

  // Grid rings (3 levels)
  for (const frac of [0.33, 0.66, 1.0]) {
    const r = RADIUS * frac;
    const points = Array.from({ length: n }, (_, i) => {
      const [x, y] = polarToXY(i * angleStep, r);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    lines.push(
      `<polygon points="${points}" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>`,
    );
  }

  // Axis lines and labels
  for (let i = 0; i < n; i++) {
    const angle = i * angleStep;
    const [x1, y1] = polarToXY(angle, 0);
    const [x2, y2] = polarToXY(angle, RADIUS);
    lines.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ccc" stroke-width="0.5"/>`,
    );

    // Label
    const [lx, ly] = polarToXY(angle, RADIUS + 18);
    const anchor =
      Math.abs(lx - CX) < 5 ? "middle" : lx > CX ? "start" : "end";
    lines.push(
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-family="${FONT}" font-size="10" fill="#555" text-anchor="${anchor}" dominant-baseline="middle">${AXES[i].shortLabel}</text>`,
    );
  }

  // Database mean polygon (dashed)
  const meanPoints = AXES.map((axis, i) => {
    const val = axis.getMean(stats);
    const r = normalize(val, axis) * RADIUS;
    const [x, y] = polarToXY(i * angleStep, r);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  lines.push(
    `<polygon points="${meanPoints}" fill="rgba(150,150,150,0.1)" stroke="#999" stroke-width="1" stroke-dasharray="4,3"/>`,
  );

  // Peptide polygons
  peptides.forEach((p, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const points = AXES.map((axis, i) => {
      const val = axis.getValue(p);
      const r = normalize(val, axis) * RADIUS;
      const [x, y] = polarToXY(i * angleStep, r);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    lines.push(
      `<polygon points="${points}" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/>`,
    );

    // Dots at vertices
    AXES.forEach((axis, i) => {
      const val = axis.getValue(p);
      const r = normalize(val, axis) * RADIUS;
      const [x, y] = polarToXY(i * angleStep, r);
      lines.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"/>`,
      );
    });
  });

  // Legend at bottom
  const legendY = CY + RADIUS + 50;
  const legendX = 30;
  const perRow = 4;

  // Database mean legend entry
  lines.push(
    `<line x1="${legendX}" y1="${legendY - 4}" x2="${legendX + 20}" y2="${legendY - 4}" stroke="#999" stroke-width="1" stroke-dasharray="4,3"/>`,
  );
  lines.push(
    `<text x="${legendX + 25}" y="${legendY}" font-family="${FONT}" font-size="9" fill="#666">Database mean</text>`,
  );

  peptides.forEach((p, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const col = (idx + 1) % perRow;
    const row = Math.floor((idx + 1) / perRow);
    const lx = legendX + col * 120;
    const ly = legendY + row * 18;

    lines.push(
      `<rect x="${lx}" y="${ly - 8}" width="12" height="12" fill="${color}" rx="2"/>`,
    );
    lines.push(
      `<text x="${lx + 16}" y="${ly + 2}" font-family="${FONT}" font-size="9" fill="#333">${escapeXml(p.id.slice(0, 14))}</text>`,
    );
  });

  const totalHeight = legendY + Math.ceil((peptides.length + 1) / perRow) * 18 + 10;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${totalHeight}" width="${SIZE}" height="${totalHeight}">`,
    `<rect width="100%" height="100%" fill="white"/>`,
    ...lines,
    `</svg>`,
  ].join("\n");
}
