/**
 * HelicalWheel — Schiffer-Edmundson helical wheel projection.
 *
 * Renders an alpha-helix (3.6 residues/turn, 100 deg/residue) as an axial
 * SVG projection with:
 *  - HeliQuest categorical coloring (publication standard)
 *  - Eisenberg-consensus hydrophobic moment arrow
 *  - Concentric rings for sequences > 18 residues
 *  - Interactive hover tooltips
 *  - Connection lines showing sequence order
 *
 * Zero external dependencies — pure React SVG.
 */
import { useRef, useMemo, useState } from 'react';
import { exportSVG, exportPNG } from '@/lib/svgExport';

// ---------------------------------------------------------------------------
// Eisenberg consensus hydrophobicity scale (Nature 1982)
// ---------------------------------------------------------------------------
const EISENBERG: Record<string, number> = {
  A:  0.62, R: -2.53, N: -0.78, D: -0.90, C:  0.29,
  Q: -0.85, E: -0.74, G:  0.48, H: -0.40, I:  1.38,
  L:  1.06, K: -1.50, M:  0.64, F:  1.19, P:  0.12,
  S: -0.18, T: -0.05, W:  0.81, Y:  0.26, V:  1.08,
};

// ---------------------------------------------------------------------------
// HeliQuest color scheme — the standard in AMP / peptide literature
// ---------------------------------------------------------------------------
type ResidueCategory =
  | 'hydrophobic'
  | 'aromatic'
  | 'positive'
  | 'negative'
  | 'polar'
  | 'small'
  | 'special';

interface ResidueStyle {
  fill: string;
  text: string;
  category: ResidueCategory;
  label: string;
}

const RESIDUE_STYLES: Record<string, ResidueStyle> = {
  I: { fill: '#F4C430', text: '#000', category: 'hydrophobic', label: 'Hydrophobic' },
  V: { fill: '#F4C430', text: '#000', category: 'hydrophobic', label: 'Hydrophobic' },
  L: { fill: '#F4C430', text: '#000', category: 'hydrophobic', label: 'Hydrophobic' },
  M: { fill: '#F4C430', text: '#000', category: 'hydrophobic', label: 'Hydrophobic' },
  C: { fill: '#F4C430', text: '#000', category: 'hydrophobic', label: 'Hydrophobic' },
  A: { fill: '#C8C8C8', text: '#000', category: 'small',       label: 'Small / Neutral' },
  G: { fill: '#C8C8C8', text: '#000', category: 'small',       label: 'Small / Neutral' },
  F: { fill: '#F79318', text: '#000', category: 'aromatic', label: 'Aromatic' },
  W: { fill: '#F79318', text: '#000', category: 'aromatic', label: 'Aromatic' },
  Y: { fill: '#F79318', text: '#000', category: 'aromatic', label: 'Aromatic' },
  K: { fill: '#4169E1', text: '#FFF', category: 'positive', label: 'Basic (+)' },
  R: { fill: '#4169E1', text: '#FFF', category: 'positive', label: 'Basic (+)' },
  H: { fill: '#87CEEB', text: '#000', category: 'positive', label: 'Basic (+)' },
  D: { fill: '#DC143C', text: '#FFF', category: 'negative', label: 'Acidic (-)' },
  E: { fill: '#DC143C', text: '#FFF', category: 'negative', label: 'Acidic (-)' },
  N: { fill: '#FF69B4', text: '#000', category: 'polar', label: 'Polar' },
  Q: { fill: '#FF69B4', text: '#000', category: 'polar', label: 'Polar' },
  S: { fill: '#9370DB', text: '#FFF', category: 'polar', label: 'Polar (hydroxyl)' },
  T: { fill: '#9370DB', text: '#FFF', category: 'polar', label: 'Polar (hydroxyl)' },
  P: { fill: '#32CD32', text: '#000', category: 'special', label: 'Imino acid' },
};

const DEFAULT_STYLE: ResidueStyle = {
  fill: '#999', text: '#FFF', category: 'small', label: 'Unknown',
};

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------
const DEG_100 = (100 * Math.PI) / 180;

interface ResiduePos {
  index: number;
  aa: string;
  x: number;
  y: number;
  labelX: number;  // position number label coordinates
  labelY: number;
  angle: number;
  ring: number;
  style: ResidueStyle;
  eisenberg: number;
}

interface MomentVec {
  magnitude: number;
  angle: number;
  endX: number;
  endY: number;
}

function computePositions(
  seq: string,
  cx: number,
  cy: number,
  baseR: number,
  circleR: number,
): ResiduePos[] {
  return [...seq.toUpperCase()].map((aa, n) => {
    const angle = -Math.PI / 2 + n * DEG_100;
    const ring = Math.floor(n / 18);
    // Wider ring gap for better separation
    const r = baseR * (1 + ring * 0.35);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    // Place position number radially outward from the circle
    const labelR = r + circleR + 8;
    return {
      index: n,
      aa,
      x, y,
      labelX: cx + labelR * Math.cos(angle),
      labelY: cy + labelR * Math.sin(angle),
      angle,
      ring,
      style: RESIDUE_STYLES[aa] ?? DEFAULT_STYLE,
      eisenberg: EISENBERG[aa] ?? 0,
    };
  });
}

function computeMoment(
  seq: string,
  cx: number,
  cy: number,
  baseR: number,
): MomentVec {
  let sumX = 0;
  let sumY = 0;
  const upper = seq.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const angle = -Math.PI / 2 + i * DEG_100;
    const h = EISENBERG[upper[i]] ?? 0;
    sumX += h * Math.cos(angle);
    sumY += h * Math.sin(angle);
  }
  const N = upper.length || 1;
  const mag = Math.sqrt(sumX * sumX + sumY * sumY) / N;
  const dir = Math.atan2(sumY, sumX);

  // Arrow endpoint: scale to be visible, with minimum length
  const rawLen = Math.sqrt((sumX / N) ** 2 + (sumY / N) ** 2);
  const minLen = baseR * 0.25; // minimum visible arrow
  const maxLen = baseR * 0.65;
  const arrowLen = Math.max(minLen, Math.min(rawLen * baseR * 0.5, maxLen));

  return {
    magnitude: mag,
    angle: dir,
    endX: cx + arrowLen * Math.cos(dir),
    endY: cy + arrowLen * Math.sin(dir),
  };
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
const LEGEND_ORDER: { category: ResidueCategory; label: string; fill: string }[] = [
  { category: 'hydrophobic', label: 'Hydrophobic',    fill: '#F4C430' },
  { category: 'aromatic',    label: 'Aromatic',        fill: '#F79318' },
  { category: 'positive',    label: 'Basic (+)',        fill: '#4169E1' },
  { category: 'negative',    label: 'Acidic (-)',       fill: '#DC143C' },
  { category: 'polar',       label: 'Polar',            fill: '#9370DB' },
  { category: 'small',       label: 'Small / Neutral', fill: '#C8C8C8' },
  { category: 'special',     label: 'Imino acid',   fill: '#32CD32' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface HelicalWheelProps {
  sequence: string;
  className?: string;
}

export function HelicalWheel({ sequence, className }: HelicalWheelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  // Auto-size: larger for multi-ring sequences
  const rings = Math.floor(Math.max(0, sequence.length - 1) / 18) + 1;
  const size = rings > 1 ? 500 : 420;

  const cx = size / 2;
  const cy = size / 2 - 8;
  const baseR = size * 0.26;
  const circleR = size * 0.034;

  const positions = useMemo(
    () => computePositions(sequence, cx, cy, baseR, circleR),
    [sequence, cx, cy, baseR, circleR],
  );

  const moment = useMemo(
    () => computeMoment(sequence, cx, cy, baseR),
    [sequence, cx, cy, baseR],
  );

  const usedCategories = useMemo(() => {
    const cats = new Set(positions.map((p) => p.style.category));
    return LEGEND_ORDER.filter((l) => cats.has(l.category));
  }, [positions]);

  if (!sequence || sequence.length < 2) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Sequence too short for helical wheel projection.
      </div>
    );
  }

  const hovPos = hovered !== null ? positions[hovered] : null;

  // Show position numbers only for first, last, and every 5th residue
  const showLabel = (i: number) =>
    i === 0 || i === sequence.length - 1 || (i + 1) % 5 === 0;

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto"
      >
        <defs>
          <marker
            id="muH-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#E74C3C" />
          </marker>
        </defs>

        {/* Connection lines */}
        {positions.map((pos, i) => {
          if (i === 0) return null;
          const prev = positions[i - 1];
          return (
            <line
              key={`c-${i}`}
              x1={prev.x}
              y1={prev.y}
              x2={pos.x}
              y2={pos.y}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeOpacity={0.2}
            />
          );
        })}

        {/* Hydrophobic moment arrow */}
        {moment.magnitude > 0.01 && (
          <line
            x1={cx}
            y1={cy}
            x2={moment.endX}
            y2={moment.endY}
            stroke="#E74C3C"
            strokeWidth={2.5}
            markerEnd="url(#muH-arrow)"
          />
        )}

        {/* Residue circles */}
        {positions.map((pos) => {
          const isHov = hovered === pos.index;
          const r = isHov ? circleR * 1.15 : circleR;
          return (
            <g
              key={pos.index}
              onMouseEnter={() => setHovered(pos.index)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={pos.style.fill}
                stroke={isHov ? 'hsl(var(--foreground))' : '#555'}
                strokeWidth={isHov ? 2.5 : 1}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={circleR * 1.1}
                fontWeight="bold"
                fontFamily="monospace"
                fill={pos.style.text}
                pointerEvents="none"
              >
                {pos.aa}
              </text>
              {/* Position number — radially outside, sparse */}
              {showLabel(pos.index) && (
                <text
                  x={pos.labelX}
                  y={pos.labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fill="hsl(var(--muted-foreground))"
                  pointerEvents="none"
                >
                  {pos.index + 1}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip — positioned at top of SVG to avoid overlaps */}
        {hovPos && (() => {
          const tw = 160;
          const th = 48;
          const tx = Math.max(4, Math.min(cx - tw / 2, size - tw - 4));
          const ty = 4;
          return (
            <g>
              <rect
                x={tx} y={ty}
                width={tw} height={th} rx={6}
                fill="hsl(var(--card))"
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              <text
                x={tx + 10} y={ty + 18}
                fontSize={12} fontWeight="bold"
                fill="hsl(var(--foreground))"
              >
                {hovPos.aa}{hovPos.index + 1} — {hovPos.style.label}
              </text>
              <text
                x={tx + 10} y={ty + 36}
                fontSize={11}
                fill="hsl(var(--muted-foreground))"
              >
                H = {hovPos.eisenberg.toFixed(2)} (Eisenberg)
              </text>
            </g>
          );
        })()}

        {/* μH magnitude label */}
        <text
          x={cx}
          y={size - 12}
          textAnchor="middle"
          fontSize={11}
          fill="hsl(var(--muted-foreground))"
        >
          {'\u03BC'}H = {moment.magnitude.toFixed(3)}
          {moment.magnitude > 0.5 ? ' (amphipathic)' : ''}
        </text>
      </svg>

      {/* Legend below SVG */}
      <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
        {usedCategories.map((item) => (
          <div key={item.category} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full border"
              style={{ backgroundColor: item.fill, borderColor: '#555' }}
            />
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-[#E74C3C]" />
          <span className="text-muted-foreground">{'\u03BC'}H vector</span>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex justify-center gap-2 mt-3">
        <button
          type="button"
          className="text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => svgRef.current && exportSVG(svgRef.current, `helical-wheel-${sequence.slice(0, 8)}.svg`)}
        >
          Download SVG
        </button>
        <button
          type="button"
          className="text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => svgRef.current && exportPNG(svgRef.current, `helical-wheel-${sequence.slice(0, 8)}.png`)}
        >
          Download PNG
        </button>
      </div>
    </div>
  );
}
