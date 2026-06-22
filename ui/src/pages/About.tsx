import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion, cubicBezier } from "framer-motion";
import * as Sentry from "@sentry/react";
import { WaveBackground } from "@/components/WaveBackground";
import AppFooter from "@/components/AppFooter";
import { DatasetCreditCard } from "@/components/DatasetCreditCard";

/** ---------- ScreenTransition (local, no extra files) ---------- */
type Phase = "idle" | "enter" | "exit";
function ScreenTransition({
  phase,
  clickPosition,
  onHalfway,
  onDone,
}: {
  phase: Phase;
  clickPosition: { x: number; y: number };
  onHalfway: () => void;
  onDone: () => void;
}) {
  if (phase === "idle") return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dx = Math.max(clickPosition.x, vw - clickPosition.x);
  const dy = Math.max(clickPosition.y, vh - clickPosition.y);
  const maxR = Math.sqrt(dx * dx + dy * dy);

  const isEntering = phase === "enter";
  const from = 0.0001;
  const to = maxR;

  return (
    <motion.div
      initial={{ clipPath: `circle(${from}px at ${clickPosition.x}px ${clickPosition.y}px)` }}
      animate={{
        clipPath: `circle(${isEntering ? to : from}px at ${clickPosition.x}px ${clickPosition.y}px)`,
      }}
      transition={{ duration: 0.6, ease: cubicBezier(0.22, 1, 0.36, 1) }}
      onUpdate={(latest) => {
        const m = /circle\((\d+\.?\d*)px/.exec(String((latest as any).clipPath));
        if (m) {
          const r = parseFloat(m[1]);
          if (isEntering && r > to * 0.5) {
            onHalfway();
          }
        }
      }}
      onAnimationComplete={onDone}
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}
      className="bg-background"
    />
  );
}

export default function About() {
  const navigate = useNavigate();

  // Transition state (preserved from previous implementation)
  const [phase, setPhase] = useState<Phase>("idle");
  const [clickPos, setClickPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  // navigate, clickPos, setPhase used by ScreenTransition below

  return (
    <>
      {/* TRANSITION OVERLAY */}
      <ScreenTransition
        phase={phase}
        clickPosition={clickPos}
        onHalfway={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate("/results");
          }
          setPhase("exit");
        }}
        onDone={() => setPhase("idle")}
      />

      {/* Full-viewport wave background with hero-scale layout */}
      <div className="min-h-screen bg-background relative overflow-hidden">
        <WaveBackground className="absolute inset-0 z-0" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: cubicBezier(0.22, 1, 0.36, 1) }}
          className="relative z-10"
        >
          {/* Hero — full viewport width, wave fully visible behind */}
          <section className="min-h-[60vh] max-w-7xl mx-auto px-6 sm:px-12 py-20 flex flex-col justify-end">
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-foreground">
              Peptide Visual Lab
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">DESY &middot; Landau Group</p>
          </section>

          {/* Content sections — wider container (max-w-5xl, was max-w-4xl) */}
          <div className="max-w-5xl mx-auto px-6 sm:px-12 pb-20 space-y-8">
            {/* Purpose — 2026-06-08: rewritten for publish-readiness (was
                "Internal, non-public application"). PVL is now headed for
                Zenodo + bio.tools + JOSS submission. */}
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>About PVL</CardTitle>
                <CardDescription>
                  Open-source peptide aggregation + structure prediction platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  PVL is a research instrument that implements{" "}
                  <a
                    href="https://doi.org/10.1021/acs.biomac.2c00582"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary hover:underline"
                  >
                    Ragonis-Bachar et al. 2022
                  </a>
                  's four-category peptide classification (Helix · FF-Helix · SSW · FF-SSW),
                  combined with TANGO aggregation propensity, S4PRED secondary structure prediction,
                  an AlphaFold 3D structure overlay, and reproducibility-as-permalink.
                </p>
                <p>
                  Upload UniProt exports (TSV/CSV/XLSX), paste a single sequence, or query UniProt
                  directly. Every analysis becomes a citation-stable URL that regenerates the same
                  view for a paper reviewer.
                </p>
              </CardContent>
            </Card>

            {/* Credits — author order matches CITATION.cff + README:
                Ragonis-Bachar (algorithms) → Azaizah (software) → Golubev (advisor)
                → Landau (corresponding). 2026-06-08 update. */}
            <Card
              className="shadow-soft border-[hsl(var(--border))] rounded-xl"
              data-testid="about-credits"
            >
              <CardHeader>
                <CardTitle>Credits</CardTitle>
                <CardDescription>
                  People behind the platform, the algorithms, and the science.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div data-testid="credit-peleg">
                  <p className="font-semibold text-foreground">Dr. Peleg Ragonis-Bachar</p>
                  <p className="text-xs text-muted-foreground/80">
                    Technion — Department of Biology
                  </p>
                  <p className="text-muted-foreground">
                    Scientific lead — four-category classification algorithm, threshold definitions,
                    validation database, scientific review across every release.
                  </p>
                  <p className="mt-1">
                    <a
                      href="https://orcid.org/0000-0002-0979-8165"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      aria-label="Peleg Ragonis-Bachar ORCID profile"
                      data-testid="peleg-orcid"
                    >
                      ORCID 0000-0002-0979-8165
                    </a>
                  </p>
                </div>

                <div data-testid="credit-said">
                  <p className="font-semibold text-foreground">Said Azaizah</p>
                  <p className="text-xs text-muted-foreground/80">
                    Massachusetts Institute of Technology + DESY
                  </p>
                  <p className="text-muted-foreground">
                    Lead developer — backend, frontend, ecosystem (web · Python · CLI · MCP ·
                    self-host), CI/CD, observability, deployment.
                  </p>
                  <p className="mt-1">
                    <a
                      href="https://orcid.org/0009-0002-3596-5358"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      aria-label="Said Azaizah ORCID profile"
                      data-testid="said-orcid"
                    >
                      ORCID 0009-0002-3596-5358
                    </a>
                  </p>
                </div>

                <div data-testid="credit-alex">
                  <p className="font-semibold text-foreground">Dr. Aleksandr Golubev</p>
                  <p className="text-xs text-muted-foreground/80">DESY + Technion</p>
                  <p className="text-muted-foreground">
                    Scientific advisor — research direction, lab adoption, DESY infrastructure
                    access.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">ORCID — pending</p>
                </div>

                <div data-testid="credit-landau">
                  <p className="font-semibold text-foreground">Prof. Meytal Landau</p>
                  <p className="text-xs text-muted-foreground/80">
                    Technion + EMBL Hamburg + Centre for Structural Systems Biology
                  </p>
                  <p className="text-muted-foreground">
                    Corresponding author — lab PI, structural biology direction, paper
                    correspondence.
                  </p>
                  <p className="mt-1">
                    <a
                      href="https://orcid.org/0000-0002-1743-3430"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      aria-label="Meytal Landau ORCID profile"
                      data-testid="landau-orcid"
                    >
                      ORCID 0000-0002-1743-3430
                    </a>
                  </p>
                </div>

                <p className="pt-2 text-xs text-muted-foreground/80 border-t border-border/40">
                  <b>External predictors:</b> TANGO (Fernandez-Escamilla et al., 2004), S4PRED
                  (Moffat et al., 2022), AlphaFold (Jumper et al., 2021), Mol* (Sehnal et al.,
                  2021). See the README's Acknowledgements block for the full reference list.
                </p>
              </CardContent>
            </Card>

            {/* Dataset attribution — Staphylococcus 2023 benchmark (ADR-014) */}
            <DatasetCreditCard />

            {/* Key Features — refreshed 2026-06-08 for v0.3.0 publish-ready release. */}
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>Key Features</CardTitle>
                <CardDescription>
                  Five surfaces — web · Python package · CLI · MCP server · Docker self-host
                </CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Peleg's four-category classification: Helix · FF-Helix · SSW · FF-SSW</li>
                  <li>
                    Dataset-derived fibril-formation thresholds (μH-positive mean for FF-Helix,
                    hydrophobicity-positive mean for FF-SSW)
                  </li>
                  <li>Gap-smoothed segment finder for helix and SSW fragments</li>
                  <li>TANGO aggregation + S4PRED secondary structure overlays</li>
                  <li>Per-residue colouring derived from her fragment columns</li>
                  <li>UniProt query → analysis pipeline in one step</li>
                  <li>AlphaFold 3D structure overlay via Mol*</li>
                </ul>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Reproducibility-as-permalink (every analysis is a citable URL)</li>
                  <li>Symmetric 4-card KPI overview with click-to-filter</li>
                  <li>
                    Candidate Ranking with Fibril-Formation Focus preset (defaults to Peleg's
                    weights)
                  </li>
                  <li>Correlation matrix with TANGO + FF-flag binary targets</li>
                  <li>PDF report + CSV + FASTA export (single + bulk)</li>
                  <li>MCP server — use PVL from Claude Desktop, Cursor, Continue</li>
                  <li>Citable via CITATION.cff + Zenodo DOI per release</li>
                </ul>
              </CardContent>
            </Card>

            {/* TANGO / S4PRED Providers */}
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>TANGO / S4PRED Providers</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>
                  Prediction providers are controlled via environment variables in{" "}
                  <code>backend/.env</code>: <code>USE_TANGO=1</code> enables TANGO aggregation
                  prediction, <code>USE_S4PRED=1</code> enables S4PRED secondary structure
                  prediction. Without these providers enabled, related metrics display{" "}
                  <em>Not available</em>.
                </p>
              </CardContent>
            </Card>

            {/* Sentry Test (Development Only) */}
            {import.meta.env.MODE === "development" && (
              <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="w-5 h-5" />
                    Sentry Test
                  </CardTitle>
                  <CardDescription>Test Sentry error tracking (development only)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        Sentry.captureMessage("Test message from About page", "info");
                        alert("Test message sent! Check Sentry dashboard.");
                      }}
                    >
                      Send Test Message
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        Sentry.captureException(new Error("Test exception from About page"));
                        alert("Test exception sent! Check Sentry dashboard.");
                      }}
                    >
                      Send Test Exception
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        Sentry.captureMessage("Test breadcrumb from About page", "warning");
                        alert("Warning-level message sent! Check Sentry dashboard.");
                      }}
                    >
                      Send Test Warning
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        throw new Error("Test React error from About page");
                      }}
                    >
                      Throw React Error
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use browser console (F12) and run <code>testSentry()</code> for more tests.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <AppFooter />
        </motion.div>
      </div>
    </>
  );
}
