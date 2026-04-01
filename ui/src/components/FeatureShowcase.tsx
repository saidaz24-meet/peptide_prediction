/** FeatureShowcase — 3-up Stripe-style cards with live mini-visualizations. */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { staggerChild } from "@/lib/animations";

interface FeatureShowcaseProps { className?: string }

/* ── Mini SequenceTrack (inline colored blocks) ── */

const SEQ = "KLVFFAEDVGSNKGAIIGLM";
const SS = "HHHHHEEEECCCEEEEEEEE";
const SS_VAR: Record<string, string> = { H: "--helix", E: "--beta", C: "--coil" };

function MiniSequenceTrack() {
  return (
    <div className="px-4 py-3">
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

/* ── Mini Sparkline (SVG area chart) ── */

const AGG_SCORES = [8, 12, 15, 45, 72, 88, 95, 65, 30, 15, 10, 8, 12, 20, 55, 78, 42, 18, 10, 5];

function MiniSparkline() {
  const W = 280, H = 100, PAD = 8;
  const max = 100;
  const points = AGG_SCORES.map((v, i) => ({
    x: PAD + (i / (AGG_SCORES.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - v / max) * (H - PAD * 2),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${H} L${points[0].x.toFixed(1)},${H} Z`;
  const refY = PAD + (1 - 50 / max) * (H - PAD * 2);

  return (
    <div className="px-4 py-3">
      <p className="text-[0.6rem] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mb-2">
        Per-residue aggregation score
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
        <defs>
          <linearGradient id="agg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(0 84% 60%)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Reference line at 50 */}
        <line
          x1={PAD} y1={refY} x2={W - PAD} y2={refY}
          stroke="hsl(var(--muted-foreground))" strokeWidth="0.8"
          strokeDasharray="4 3" opacity="0.4"
        />
        <text x={W - PAD - 1} y={refY - 3} textAnchor="end"
          className="fill-[hsl(var(--muted-foreground))]" fontSize="8" opacity="0.5">
          threshold
        </text>
        {/* Area fill */}
        <path d={area} fill="url(#agg-fill)" />
        {/* Line */}
        <path d={line} fill="none" stroke="hsl(0 84% 60%)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* Peak dot */}
        {(() => {
          const peak = points.reduce((a, b) => (a.y < b.y ? a : b));
          return <circle cx={peak.x} cy={peak.y} r="3" fill="hsl(0 84% 60%)" stroke="hsl(var(--card))" strokeWidth="1.5" />;
        })()}
      </svg>
    </div>
  );
}

/* ── Mini Browser Chrome (for screenshot) ── */

function MiniBrowserChrome({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-4 my-3 rounded-lg border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--surface-1))]">
      {/* Chrome bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--surface-2)/0.5)]">
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--destructive)/0.5)]" />
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--warning)/0.5)]" />
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--success)/0.5)]" />
        <span className="ml-2 text-[0.55rem] text-[hsl(var(--faint))] font-mono truncate">
          pvl.desy.de/peptides/P80154
        </span>
      </div>
      {/* Screenshot */}
      <img src={src} alt={alt} className="w-full h-auto object-cover" loading="lazy" />
    </div>
  );
}

/* ── Expand Button ── */

function ExpandBtn({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className={cn(
        "absolute top-3 right-3 z-10 flex items-center justify-center h-7 w-7 rounded-md",
        "bg-[hsl(var(--background)/0.8)] backdrop-blur-sm border border-[hsl(var(--border)/0.5)]",
        "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))]",
        "transition-colors",
      )}
      aria-label="Explore"
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </button>
  );
}

/* ── Card data ── */

interface CardDef {
  gradient: string;
  title: string;
  description: string;
  link: string;
  preview: React.ReactNode;
}

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    setDark(el.classList.contains("dark"));
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/* ── Main Component ── */

export function FeatureShowcase({ className }: FeatureShowcaseProps) {
  const isDark = useIsDark();

  const cards: CardDef[] = [
    {
      gradient: "bg-gradient-to-r from-blue-500 to-cyan-400",
      title: "Secondary Structure Prediction",
      description: "S4PRED predicts helix, beta-sheet, and coil conformation at every residue position.",
      link: "/quick",
      preview: <MiniSequenceTrack />,
    },
    {
      gradient: "bg-gradient-to-r from-red-500 to-orange-400",
      title: "Aggregation Propensity",
      description: "Per-residue aggregation scoring identifies amyloid-prone hotspot regions in your peptide.",
      link: "/quick",
      preview: <MiniSparkline />,
    },
    {
      gradient: "bg-gradient-to-r from-purple-500 to-violet-400",
      title: "3D Structure Prediction",
      description: "AlphaFold integration provides predicted 3D structures with pLDDT confidence scores.",
      link: "/quick",
      preview: (
        <MiniBrowserChrome
          src={isDark ? "/screenshots/dark/alphafold-viewer.png" : "/screenshots/light/alphafold-viewer.png"}
          alt="AlphaFold 3D structure viewer"
        />
      ),
    },
  ];

  return (
    <div className={className}>
      {/* Heading */}
      <div className="max-w-2xl mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] mb-3">
          Everything in One View
        </h2>
        <p className="text-lg text-[hsl(var(--muted-foreground))] leading-relaxed">
          No more switching between PASTA, Waltz, and AGGRESCAN. One tool, every analysis.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <motion.div
            key={card.title}
            variants={staggerChild}
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "group relative rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden cursor-pointer",
              "card-glow",
            )}
            onClick={() => window.location.href = card.link}
          >
            {/* Gradient top bar */}
            <div className={cn("h-1.5 w-full", card.gradient)} />

            {/* Preview area */}
            <div className="relative min-h-[220px] bg-[hsl(var(--muted)/0.3)]">
              <ExpandBtn to={card.link} />
              {card.preview}
            </div>

            {/* Content */}
            <div className="p-5 border-t border-[hsl(var(--border)/0.5)]">
              <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                {card.title}
              </h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1.5 line-clamp-2">
                {card.description}
              </p>
              <Link
                to={card.link}
                className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] mt-3 hover:underline"
              >
                Explore
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-0.5">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
