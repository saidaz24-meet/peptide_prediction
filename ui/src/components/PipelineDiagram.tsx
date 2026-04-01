/** PipelineDiagram — SVG blueprint of PVL's prediction pipeline. */
import { ClipboardPaste, ShieldCheck, Dna, Flame, Orbit, Trophy, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface PipelineDiagramProps { className?: string }

/* ── Layout constants ── */
const W = 500, NW = 120, NH = 56, R = 12;
const CX = W / 2;                        // center x
const ROWS = [30, 110, 210, 320, 400];   // y positions for each row
const SPREAD = 150;                       // horizontal spread for parallel nodes
const PAR_X = [CX - SPREAD, CX, CX + SPREAD]; // x centers for 3 parallel nodes

interface NodeDef { x: number; y: number; label: string; Icon: LucideIcon; accent?: string }
const NODES: NodeDef[] = [
  { x: CX, y: ROWS[0], label: "Sequence Input", Icon: ClipboardPaste },
  { x: CX, y: ROWS[1], label: "Validation", Icon: ShieldCheck },
  { x: PAR_X[0], y: ROWS[2], label: "S4PRED", Icon: Dna, accent: "#3b82f6" },
  { x: PAR_X[1], y: ROWS[2], label: "TANGO", Icon: Flame, accent: "#ef4444" },
  { x: PAR_X[2], y: ROWS[2], label: "FF-Helix", Icon: Orbit, accent: "#a855f7" },
  { x: CX, y: ROWS[3], label: "Rank & Merge", Icon: Trophy },
  { x: CX, y: ROWS[4], label: "Export", Icon: Download },
];

/* ── Bezier paths: fork (validate → 3 algos) and merge (3 algos → rank) ── */
function forkPath(tx: number) {
  const sy = ROWS[1] + NH / 2, ey = ROWS[2] - NH / 2;
  const mid = (sy + ey) / 2;
  return `M${CX},${sy} C${CX},${mid} ${tx},${mid} ${tx},${ey}`;
}
function mergePath(tx: number) {
  const sy = ROWS[2] + NH / 2, ey = ROWS[3] - NH / 2;
  const mid = (sy + ey) / 2;
  return `M${tx},${sy} C${tx},${mid} ${CX},${mid} ${CX},${ey}`;
}

const BRANCHES = [
  { path: forkPath(PAR_X[0]), color: "#3b82f6", delay: "0s" },
  { path: forkPath(PAR_X[1]), color: "#ef4444", delay: "0.4s" },
  { path: forkPath(PAR_X[2]), color: "#a855f7", delay: "0.8s" },
];
const MERGES = [
  { path: mergePath(PAR_X[0]), color: "#3b82f6", delay: "0.2s" },
  { path: mergePath(PAR_X[1]), color: "#ef4444", delay: "0.6s" },
  { path: mergePath(PAR_X[2]), color: "#a855f7", delay: "1.0s" },
];

/* Straight vertical segments */
const STRAIGHTS = [
  `M${CX},${ROWS[0] + NH / 2} L${CX},${ROWS[1] - NH / 2}`,
  `M${CX},${ROWS[3] + NH / 2} L${CX},${ROWS[4] - NH / 2}`,
];

/* ── Render helpers ── */
function NodeRect({ x, y, label, Icon, accent }: NodeDef) {
  const lx = x - NW / 2, ly = y - NH / 2;
  return (
    <g>
      {accent && <rect x={lx} y={ly} width={3} height={NH} rx={1.5} fill={accent} />}
      <rect x={lx} y={ly} width={NW} height={NH} rx={R} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1.5} />
      <foreignObject x={x - 8} y={y - 20} width={16} height={16}>
        <Icon size={16} className="text-[hsl(var(--muted-foreground))]" />
      </foreignObject>
      <text x={x} y={y + 8} textAnchor="middle" fontSize="11" fontWeight="500" className="fill-[hsl(var(--foreground))]" fontFamily="Inter, system-ui, sans-serif">
        {label}
      </text>
    </g>
  );
}

export function PipelineDiagram({ className }: PipelineDiagramProps) {
  return (
    <div className={className}>
      <div className="max-w-2xl mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] mb-3">How It Works</h2>
        <p className="text-lg text-[hsl(var(--muted-foreground))] leading-relaxed">From sequence to ranked results in seconds.</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <svg viewBox={`0 0 ${W} 440`} className="w-full" style={{ maxHeight: 500 }}>
          <style>{`
            @keyframes travel{0%{offset-distance:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:0}}
            .dot{animation:travel 3s ease-in-out infinite}
          `}</style>

          {/* Straight lines */}
          {STRAIGHTS.map((d, i) => <path key={`s${i}`} d={d} fill="none" stroke="hsl(var(--border))" strokeWidth={1.5} />)}

          {/* Fork + merge curves */}
          {[...BRANCHES, ...MERGES].map((b, i) => (
            <path key={`c${i}`} d={b.path} fill="none" stroke="hsl(var(--border))" strokeWidth={1.5} />
          ))}

          {/* Animated dots on fork branches */}
          {BRANCHES.map((b, i) => (
            <circle key={`df${i}`} r={3} fill={b.color} className="dot" style={{ offsetPath: `path('${b.path}')`, animationDelay: b.delay }} />
          ))}

          {/* Animated dots on merge branches */}
          {MERGES.map((b, i) => (
            <circle key={`dm${i}`} r={3} fill={b.color} className="dot" style={{ offsetPath: `path('${b.path}')`, animationDelay: b.delay }} />
          ))}

          {/* Nodes (rendered last so they sit on top) */}
          {NODES.map((n) => <NodeRect key={n.label} {...n} />)}
        </svg>
      </div>
    </div>
  );
}
