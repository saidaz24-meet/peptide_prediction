/** AlgorithmShowcase — 4-tab algorithm showcase with mini visualizations + animated transitions. */
import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import { smoothEase } from "@/lib/animations";

interface AlgorithmShowcaseProps { className?: string }

/* ── Mini Viz: S4PRED colored residue blocks ── */
const SEQ = "KLVFFAEDVGSNKGAIIGLM";
const SS  = "HHHHHEEEECCCEEEEEEEE";
const SS_VAR: Record<string, string> = { H: "--helix", E: "--beta", C: "--coil" };

function S4PredViz() {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
      <p className="text-[0.6rem] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mb-2">
        Per-residue prediction
      </p>
      <div className="flex flex-wrap gap-[3px]">
        {SEQ.split("").map((aa, i) => (
          <span
            key={i}
            className="inline-flex items-center justify-center w-[22px] h-[26px] rounded-[3px] text-[10px] font-mono font-semibold text-white"
            style={{ backgroundColor: `hsl(var(${SS_VAR[SS[i]]}))` }}
          >
            {aa}
          </span>
        ))}
      </div>
      <div className="flex gap-3 mt-3">
        {([["Helix", "--helix"], ["Sheet", "--beta"], ["Coil", "--coil"]] as const).map(([l, v]) => (
          <span key={l} className="flex items-center gap-1 text-[0.6rem] text-[hsl(var(--muted-foreground))]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(var(${v}))` }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Mini Viz: TANGO sparkline ── */
const AGG = [8, 12, 15, 45, 72, 88, 95, 65, 30, 15, 10, 8, 12, 20, 55, 78, 42, 18, 10, 5];

function TangoViz() {
  const W = 280, H = 100, P = 8, max = 100;
  const pts = AGG.map((v, i) => ({
    x: P + (i / (AGG.length - 1)) * (W - P * 2),
    y: P + (1 - v / max) * (H - P * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
  const refY = P + (1 - 50 / max) * (H - P * 2);
  const peak = pts.reduce((a, b) => (a.y < b.y ? a : b));

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
      <p className="text-[0.6rem] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mb-2">
        Per-residue aggregation score
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
        <defs>
          <linearGradient id="algo-agg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(0 84% 60%)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={P} y1={refY} x2={W - P} y2={refY} stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.4" />
        <text x={W - P - 1} y={refY - 3} textAnchor="end" className="fill-[hsl(var(--muted-foreground))]" fontSize="8" opacity="0.5">threshold</text>
        <path d={area} fill="url(#algo-agg-fill)" />
        <path d={line} fill="none" stroke="hsl(0 84% 60%)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={peak.x} cy={peak.y} r="3" fill="hsl(0 84% 60%)" stroke="hsl(var(--card))" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* ── Mini Viz: FF-Helix percentage ring ── */
function FFHelixViz() {
  const pct = 78, r = 40, circ = 2 * Math.PI * r;
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="mb-3">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="hsl(270 70% 60%)" strokeWidth="8"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
          strokeLinecap="round" transform="rotate(-90 60 60)"
        />
        <text x="60" y="56" textAnchor="middle" className="fill-[hsl(var(--foreground))]" fontSize="22" fontWeight="700">{pct}%</text>
        <text x="60" y="72" textAnchor="middle" className="fill-[hsl(var(--muted-foreground))]" fontSize="9">FF-Helix</text>
      </svg>
      <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="h-2 w-6 rounded-full bg-purple-500/30" />
        <span>12 / 42 residues in FF-Helix regions</span>
      </div>
    </div>
  );
}

/* ── Mini Viz: UniProt data card ── */
function UniProtViz() {
  const rows = [
    ["Function", "Delta-hemolysin"],
    ["Location", "Secreted"],
    ["Length", "26 aa"],
    ["PDB", "2KAM"],
  ];
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-[hsl(var(--foreground))] font-mono">P80154</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">· Staphylococcus aureus</span>
      </div>
      <div className="h-px bg-[hsl(var(--border)/0.5)] mb-3" />
      <div className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 text-sm">
            <span className="w-20 text-[hsl(var(--muted-foreground))] text-xs shrink-0">{k}</span>
            <span className="text-[hsl(var(--foreground))] font-mono text-xs">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tab data ── */
interface Tab { id: string; name: string; accentBg: string; accentText: string; title: string; desc: string; points: string[]; viz: React.ReactNode }

const TABS: Tab[] = [
  {
    id: "s4pred", name: "S4PRED", accentBg: "bg-blue-500", accentText: "text-blue-500",
    title: "Secondary Structure Prediction",
    desc: "S4PRED uses a deep neural network to predict three-state secondary structure (helix, beta-sheet, coil) at single-residue resolution. Trained on a non-redundant set of high-resolution crystal structures.",
    points: ["Three-state prediction: helix (H), sheet (E), coil (C)", "Single-residue resolution with confidence scores", "No sequence alignment or MSA required"],
    viz: <S4PredViz />,
  },
  {
    id: "tango", name: "TANGO", accentBg: "bg-red-500", accentText: "text-red-500",
    title: "Aggregation Propensity",
    desc: "TANGO predicts cross-beta aggregation propensity using a statistical mechanics model. It identifies aggregation-prone regions (APRs) that may drive amyloid fibril formation.",
    points: ["Per-residue aggregation scoring (0–100 scale)", "Identifies aggregation-prone regions (APRs)", "Based on statistical mechanics of beta-sheet formation"],
    viz: <TangoViz />,
  },
  {
    id: "ffhelix", name: "FF-Helix", accentBg: "bg-purple-500", accentText: "text-purple-500",
    title: "Fibril-Forming Helix Detection",
    desc: "FF-Helix identifies helical regions with fibril-forming potential by combining secondary structure prediction, hydrophobic moment analysis, and amphipathic helix scoring.",
    points: ["Combines structure, hydrophobicity, and amphipathicity", "Detects helices that may convert to cross-beta fibrils", "Based on Hamodrakas 2007 methodology"],
    viz: <FFHelixViz />,
  },
  {
    id: "uniprot", name: "UniProt", accentBg: "bg-teal-500", accentText: "text-teal-500",
    title: "Database Enrichment",
    desc: "Automatic UniProt lookup enriches your peptides with known annotations — function, subcellular location, disease associations, and cross-references to PDB structures.",
    points: ["Automatic sequence matching against UniProt", "Protein function and disease annotations", "Cross-references to PDB, Pfam, InterPro"],
    viz: <UniProtViz />,
  },
];

/* ── Tab accent colors for the animated underline ── */
const ACCENT_COLORS: Record<string, string> = {
  s4pred: "rgb(59, 130, 246)",   // blue-500
  tango: "rgb(239, 68, 68)",     // red-500
  ffhelix: "rgb(168, 85, 247)",  // purple-500
  uniprot: "rgb(20, 184, 166)",  // teal-500
};

/* ── Main Component ── */
export function AlgorithmShowcase({ className }: AlgorithmShowcaseProps) {
  const [active, setActive] = useState("s4pred");
  const current = TABS.find((t) => t.id === active)!;

  return (
    <div className={className}>
      {/* Heading */}
      <div className="max-w-2xl mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] mb-3">
          The Prediction Pipeline
        </h2>
        <p className="text-lg text-[hsl(var(--muted-foreground))] leading-relaxed">
          Four algorithms, one unified interface.
        </p>
      </div>

      {/* Tab bar with animated underline */}
      <LayoutGroup>
        <div className="flex border-b border-[hsl(var(--border))] mb-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "px-5 py-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                active === tab.id ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
            >
              {tab.name}
              {active === tab.id && (
                <motion.span
                  layoutId="algo-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: ACCENT_COLORS[tab.id] }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      </LayoutGroup>

      {/* Content with crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: smoothEase }}
          className="max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-start"
        >
          {/* Text side */}
          <div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[hsl(var(--foreground))] mb-3">{current.title}</h3>
            <p className="text-[hsl(var(--muted-foreground))] leading-relaxed mb-5">{current.desc}</p>
            <ul className="space-y-2">
              {current.points.map((p, i) => (
                <motion.li
                  key={p}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.3, ease: smoothEase }}
                  className="flex items-start gap-2 text-sm text-[hsl(var(--foreground))]"
                >
                  <div className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", current.accentBg)} />
                  {p}
                </motion.li>
              ))}
            </ul>
          </div>
          {/* Viz side */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4, ease: smoothEase }}
          >
            {current.viz}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
