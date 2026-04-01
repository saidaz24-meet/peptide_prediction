import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Upload,
  Zap,
  ArrowRight,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConstellationBackground } from "@/components/ConstellationBackground";
import { BgDotGrid } from "@/components/BgDotGrid";
import { MolecularGlobe } from "@/components/MolecularGlobe";
import { GradientLine } from "@/components/GradientLine";
import { FeatureShowcase } from "@/components/FeatureShowcase";
import { UseCaseSection } from "@/components/UseCaseSection";
import { AlgorithmShowcase } from "@/components/AlgorithmShowcase";
import { TrustSection } from "@/components/TrustSection";
import { PipelineDiagram } from "@/components/PipelineDiagram";
import { ShowcaseGallery } from "@/components/ShowcaseGallery";
import { AnimateIn, AnimateInChild } from "@/components/AnimateIn";
import { smoothEase } from "@/lib/animations";

// ── Mock data: Amyloid-beta 1-42 ──────────────────────────────
const HERO_SEQUENCE = "DAEFRHDSGYEVHHQKLVFFAEDVGSNKGAIIGLMVGGVVIA";
const HERO_SS: ("H" | "E" | "C")[] = [
  "C","C","C","C","C","C","C","C","C","C","C","C",
  "H","H","H","H","H","H","H","H","H","H",
  "C","C","C","C","C","C","C",
  "E","E","E","E","E","E","E","E","E","E","E","E","E",
];

const SS_COLORS: Record<string, string> = {
  H: "hsl(var(--helix))",
  E: "hsl(var(--beta))",
  C: "hsl(var(--coil))",
};

// ── Hero stagger (not scroll-triggered, plays on mount) ──────
const heroStagger = {
  animate: { transition: { staggerChildren: 0.15 } },
};
const heroChild = {
  initial: { opacity: 0, y: 40 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: smoothEase },
  },
};

// ── Typing animation hook ─────────────────────────────────────
function useTypingAnimation(text: string, speed = 40, delay = 800) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const startTyping = () => {
      timeout = setTimeout(function type() {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1));
          i++;
          timeout = setTimeout(type, speed);
        } else {
          setDone(true);
        }
      }, speed);
    };

    const delayTimeout = setTimeout(startTyping, delay);
    return () => {
      clearTimeout(delayTimeout);
      clearTimeout(timeout);
    };
  }, [text, speed, delay]);

  return { displayed, done };
}

// ── Hero SequenceTrack Preview ────────────────────────────────
function HeroSequenceTrack({
  sequence,
  ss,
  revealed,
}: {
  sequence: string;
  ss: ("H" | "E" | "C")[];
  revealed: number;
}) {
  return (
    <div className="flex flex-wrap gap-[2px] font-mono text-[11px] leading-none">
      {sequence.split("").map((aa, i) => {
        const isRevealed = i < revealed;
        const color = SS_COLORS[ss[i]] || SS_COLORS.C;
        return (
          <span
            key={i}
            className="inline-flex items-center justify-center w-5 h-6 rounded-sm font-semibold transition-all duration-200"
            style={{
              backgroundColor: isRevealed ? `${color}` : "transparent",
              color: isRevealed ? "#ffffff" : "hsl(var(--faint))",
              opacity: isRevealed ? 1 : 0.3,
              transform: isRevealed ? "scale(1)" : "scale(0.85)",
            }}
          >
            {aa}
          </span>
        );
      })}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════

const Index = () => {
  const { displayed, done } = useTypingAnimation(HERO_SEQUENCE, 35, 1000);
  const revealedCount = displayed.length;

  return (
    <div className="min-h-screen bg-background relative">
      {/* Dark: animated constellation. Light: static dot grid (paper-like) */}
      <ConstellationBackground className="!z-0 dark:opacity-100 opacity-0" />
      <BgDotGrid className="!z-0 dark:opacity-0" />

      {/* ═══════════════════════════════════════════
          SECTION 1: HERO
          ═══════════════════════════════════════════ */}
      <section className="relative z-10 min-h-[75vh] sm:min-h-[90vh] flex flex-col items-center justify-center overflow-hidden pt-16 sm:pt-24 pb-12 sm:pb-16 px-4 sm:px-6">
        {/* Globe — single instance, hidden on mobile */}
        <div className="absolute inset-0 overflow-hidden z-0 hidden md:block">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, delay: 0.2, ease: smoothEase }}
            className="absolute top-1/2 -translate-y-1/2"
            style={{ right: "-35%" }}
          >
            <MolecularGlobe size={1200} />
          </motion.div>
        </div>

        {/* Hero text — stagger on mount */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={heroStagger}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <motion.div variants={heroChild} className="mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-small font-medium border border-primary/30 bg-primary/10 text-primary">
              Open Source Research Platform
            </span>
          </motion.div>

          <motion.h1 variants={heroChild} className="text-display text-foreground mb-4">
            Peptide Visual Lab
          </motion.h1>

          <motion.p variants={heroChild} className="text-body text-muted-foreground max-w-2xl mx-auto mb-8">
            Multi-algorithm prediction and visualization for peptide aggregation,
            structural switching, and fibril formation. One paste, full profile.
          </motion.p>

          <motion.div variants={heroChild} className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-3">
            <Link to="/upload" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 py-6 btn-press">
                <Upload className="w-4 h-4 mr-2" />
                Start Analysis
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/quick" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-base px-6 py-6 border-[hsl(var(--border-hover))] hover:bg-[hsl(var(--surface-2))] btn-press"
              >
                <Zap className="w-4 h-4 mr-2" />
                Try Quick Analyze
              </Button>
            </Link>
          </motion.div>

          <motion.p variants={heroChild} className="text-small text-[hsl(var(--faint))]">
            No signup required. Paste a sequence, get results in seconds.
          </motion.p>
        </motion.div>

        {/* SequenceTrack Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: smoothEase }}
          className="relative z-10 max-w-xl mx-auto w-full mt-8 sm:mt-12"
        >
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl px-3 sm:px-5 py-4 sm:py-5 shadow-strong backdrop-blur-sm bg-opacity-90 card-glow">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-caption text-muted-foreground">Sequence Input</span>
              <span className="text-caption text-[hsl(var(--faint))]">
                {revealedCount} / {HERO_SEQUENCE.length} aa
              </span>
            </div>
            <div className="bg-background rounded-lg px-3 py-2 mb-4 font-mono text-small text-foreground min-h-[28px] border border-[hsl(var(--border))]">
              {displayed}
              {!done && <span className="animate-pulse text-primary">|</span>}
            </div>
            <div className="mb-3">
              <span className="text-caption text-muted-foreground mb-2 block">Structure Prediction</span>
              <HeroSequenceTrack sequence={HERO_SEQUENCE} ss={HERO_SS} revealed={revealedCount} />
            </div>
            <div className="flex gap-4 mt-2">
              {[
                { label: "Helix", color: "bg-[hsl(var(--helix))]" },
                { label: "Sheet", color: "bg-[hsl(var(--beta))]" },
                { label: "Coil", color: "bg-[hsl(var(--coil))]" },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1.5 text-small text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="relative z-10 max-w-5xl mx-auto w-full mt-16">
          <GradientLine />
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2: FEATURE SHOWCASE
          ═══════════════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 bg-[hsl(var(--surface-1)/0.85)] dark:bg-[hsl(var(--surface-1)/0.7)]">
        <AnimateIn className="max-w-5xl mx-auto">
          <FeatureShowcase />
        </AnimateIn>
      </section>

      {/* GradientLine */}
      <div className="relative z-10 max-w-5xl mx-auto w-full px-6">
        <GradientLine />
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 3: USE CASES
          ═══════════════════════════════════════════ */}
      <AnimateIn as="section" className="relative z-10 bg-transparent">
        <UseCaseSection />
      </AnimateIn>

      {/* GradientLine */}
      <div className="relative z-10 max-w-5xl mx-auto w-full px-6">
        <GradientLine />
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 4: PIPELINE DIAGRAM
          ═══════════════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 bg-transparent">
        <AnimateIn className="max-w-4xl mx-auto">
          <PipelineDiagram />
        </AnimateIn>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5: ALGORITHM SHOWCASE
          ═══════════════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 bg-[hsl(var(--surface-1)/0.85)] dark:bg-[hsl(var(--surface-1)/0.7)]">
        <AnimateIn className="max-w-5xl mx-auto">
          <AlgorithmShowcase />
        </AnimateIn>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 6: TRUST
          ═══════════════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 bg-[hsl(var(--surface-1)/0.85)] dark:bg-[hsl(var(--surface-1)/0.7)]">
        <AnimateIn className="max-w-5xl mx-auto">
          <TrustSection />
        </AnimateIn>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 7: SHOWCASE GALLERY
          ═══════════════════════════════════════════ */}
      <AnimateIn as="section" className="relative z-10">
        <ShowcaseGallery />
      </AnimateIn>

      {/* ═══════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 bg-transparent">
        <AnimateIn stagger className="max-w-3xl mx-auto text-center">
          <AnimateInChild>
            <h2 className="text-h1 text-foreground mb-4">Free. Open Source. Start Analyzing.</h2>
          </AnimateInChild>
          <AnimateInChild>
            <p className="text-body text-muted-foreground mb-8">
              Built at Technion &amp; DESY for the research community.
            </p>
          </AnimateInChild>
          <AnimateInChild>
            <div className="flex items-center justify-center gap-4 mb-8">
              <Link to="/upload">
                <Button size="lg" className="text-base px-10 py-6 btn-press">
                  Start Analyzing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </AnimateInChild>
          <AnimateInChild>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-small text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-[hsl(var(--surface-2))] font-mono text-[10px]">MIT</span>
                Licensed
              </span>
              <a
                href="https://github.com/saidaz24-meet/peptide_prediction"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                GitHub
              </a>
              <span>Cite PVL in your research</span>
            </div>
          </AnimateInChild>
          <AnimateInChild>
            <p className="mt-8 text-xs text-[hsl(var(--faint))]">
              Said Azaizah &middot; Peleg Ragonis-Bachar &middot; Alexander Golubev &middot; &copy; 2026
            </p>
          </AnimateInChild>
        </AnimateIn>
      </section>
    </div>
  );
};

export default Index;
