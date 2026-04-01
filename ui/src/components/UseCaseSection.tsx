/** UseCaseSection — 3 alternating text + floating screenshot blocks. */
import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { smoothEase } from "@/lib/animations";

interface UseCaseSectionProps { className?: string }

/* ── Theme hook ── */
function useIsDark() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    setD(el.classList.contains("dark"));
    const obs = new MutationObserver(() => setD(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return d;
}

/* ── Data ── */
interface UseCase {
  accent: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  link: string;
  lightImg: string;
  darkImg: string;
  url: string;
}

const CASES: UseCase[] = [
  {
    accent: "text-blue-500",
    label: "Batch Analysis",
    title: "Analyze Peptide Datasets at Scale",
    description: "Upload hundreds of peptides via CSV. Every sequence gets the full prediction pipeline — secondary structure, aggregation scoring, fibril-forming helix detection — ranked and ready to filter.",
    bullets: [
      "CSV batch upload with automatic validation",
      "Multi-algorithm prediction pipeline in parallel",
      "Smart ranking across all computed properties",
      "Export filtered results as CSV or FASTA",
    ],
    cta: "Start batch analysis",
    link: "/upload",
    lightImg: "/screenshots/light/data-table.png",
    darkImg: "/screenshots/dark/data-table.png",
    url: "pvl.desy.de/results",
  },
  {
    accent: "text-purple-500",
    label: "Deep Dive",
    title: "Explore Every Structural Property",
    description: "Click any peptide for a full structural profile — helical wheel projections, per-residue charts, hydrophobic moment vectors, and secondary structure tracks. All interactive.",
    bullets: [
      "Edmundson helical wheel with amphipathic moment",
      "Per-residue aggregation and structure overlay",
      "Interactive charge and hydrophobicity profiles",
      "AlphaFold 3D structure when available",
    ],
    cta: "Try quick analyze",
    link: "/quick",
    lightImg: "/screenshots/light/helical-wheel.png",
    darkImg: "/screenshots/dark/helical-wheel.png",
    url: "pvl.desy.de/peptides/P80154",
  },
  {
    accent: "text-teal-500",
    label: "3D Visualization",
    title: "See Your Peptide in Three Dimensions",
    description: "AlphaFold integration predicts 3D structure directly from sequence. View the result in an interactive Mol* viewer with pLDDT confidence coloring — no external tools needed.",
    bullets: [
      "AlphaFold structure prediction from sequence",
      "Interactive Mol* 3D viewer embedded in the page",
      "pLDDT confidence scoring per residue",
      "Download PDB files for further analysis",
    ],
    cta: "Try quick analyze",
    link: "/quick",
    lightImg: "/screenshots/light/alphafold-viewer.png",
    darkImg: "/screenshots/dark/alphafold-viewer.png",
    url: "pvl.desy.de/peptides/P80154/structure",
  },
];

/* ── Browser Chrome Frame ── */
function BrowserFrame({ src, alt, url, tiltDeg }: { src: string; alt: string; url: string; tiltDeg: number }) {
  return (
    <div className="relative group" style={{ perspective: "1200px" }}>
      <div
        className={cn(
          "rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--card))]",
          "shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
          "transition-all duration-500 ease-out",
          "group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.15),0_0_40px_hsl(var(--primary)/0.08)]",
          "group-hover:border-[hsl(var(--border-hover))]",
        )}
        style={{ transform: `rotateY(${tiltDeg}deg)` }}
      >
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[hsl(var(--border)/0.5)] bg-[hsl(var(--surface-2)/0.5)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--destructive)/0.4)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--warning)/0.4)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success)/0.4)]" />
          <span className="ml-3 text-[0.6rem] text-[hsl(var(--faint))] font-mono truncate">{url}</span>
        </div>
        <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
      </div>
    </div>
  );
}

/* ── Text Side with animated bullets ── */
function TextBlock({ c }: { c: UseCase }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref}>
      <motion.span
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: smoothEase }}
        className={cn("inline-block text-sm font-semibold uppercase tracking-wider", c.accent)}
      >
        {c.label}
      </motion.span>
      <motion.h3
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.08, ease: smoothEase }}
        className="text-2xl sm:text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] mt-2 mb-4"
      >
        {c.title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.15, ease: smoothEase }}
        className="text-[hsl(var(--muted-foreground))] leading-relaxed mb-6"
      >
        {c.description}
      </motion.p>
      <ul className="space-y-2.5 mb-6">
        {c.bullets.map((b, i) => (
          <motion.li
            key={b}
            initial={{ opacity: 0, x: -16 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.25 + i * 0.1, ease: smoothEase }}
            className="flex items-start gap-2.5 text-sm text-[hsl(var(--foreground))]"
          >
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-[hsl(var(--success))] shrink-0" />
            {b}
          </motion.li>
        ))}
      </ul>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.55, ease: smoothEase }}
      >
        <Link to={c.link} className={cn("inline-flex items-center gap-1.5 text-sm font-semibold hover:underline", c.accent)}>
          {c.cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </motion.div>
    </div>
  );
}

/* ── Main Component ── */
export function UseCaseSection({ className }: UseCaseSectionProps) {
  const isDark = useIsDark();

  return (
    <div className={className}>
      {CASES.map((c, i) => {
        const reversed = i % 2 === 1;
        const tilt = reversed ? 2 : -2;
        const src = isDark ? c.darkImg : c.lightImg;

        return (
          <div key={c.label}>
            {i > 0 && (
              <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="h-px bg-[hsl(var(--border)/0.3)]" />
              </div>
            )}
            <div className="py-12 sm:py-16 lg:py-24">
              <div
                className={cn(
                  "max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center",
                  reversed && "lg:[direction:rtl]",
                )}
              >
                <div className={reversed ? "lg:[direction:ltr]" : undefined}>
                  <TextBlock c={c} />
                </div>
                <div className={reversed ? "lg:[direction:ltr]" : undefined}>
                  <BrowserFrame src={src} alt={c.title} url={c.url} tiltDeg={tilt} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
