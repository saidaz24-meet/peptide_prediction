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
            <p className="mt-3 text-lg text-muted-foreground">
              DESY &middot; Landau Group
            </p>
          </section>

          {/* Content sections — wider container (max-w-5xl, was max-w-4xl) */}
          <div className="max-w-5xl mx-auto px-6 sm:px-12 pb-20 space-y-8">
            {/* Purpose */}
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>Purpose</CardTitle>
                <CardDescription>Internal, non-public application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Explore peptide properties and fibril-forming predictions. Upload UniProt exports
                  (TSV/CSV/XLSX), compute hydrophobicity, charge, μH, and visualize TANGO/S4PRED
                  outputs when available.
                </p>
              </CardContent>
            </Card>

            {/* Credits — extended with Peleg per ADR-014 (2026-05-08). */}
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
                <div data-testid="credit-said">
                  <p className="font-semibold text-foreground">Said Azaizah</p>
                  <p className="text-muted-foreground">
                    Lead developer · full-stack architect · all platform code, design, and
                    deployment.
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

                <div data-testid="credit-peleg">
                  <p className="font-semibold text-foreground">Dr. Peleg Ragonis-Bachar</p>
                  <p className="text-xs text-muted-foreground/80">Technion</p>
                  <p className="text-muted-foreground">
                    Scientific algorithms — FF-Helix, FF-SSW classification, threshold definitions,
                    and the Staphylococcus 2023 benchmark dataset.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">ORCID — pending</p>
                </div>

                <div data-testid="credit-alex">
                  <p className="font-semibold text-foreground">Dr. Aleksandr Golubev</p>
                  <p className="text-xs text-muted-foreground/80">DESY</p>
                  <p className="text-muted-foreground">
                    Scientific advisor · project management · research direction and lab adoption.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">ORCID — pending</p>
                </div>

                <p className="pt-2 text-xs text-muted-foreground/80 border-t border-border/40">
                  <b>Predictor providers:</b> TANGO (Fernandez-Escamilla et al., 2004) and S4PRED
                  (Moffat et al., 2022). See the README's Acknowledgements block for the full
                  reference list.
                </p>
              </CardContent>
            </Card>

            {/* Dataset attribution — Staphylococcus 2023 benchmark (ADR-014) */}
            <DatasetCreditCard />

            {/* Key Features */}
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>Key Features</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Flexible upload with QC (+ rejected rows export)</li>
                  <li>Hydrophobicity, Charge, μH; SSW & Helix prediction</li>
                  <li>Database visualizations + correlation matrix</li>
                  <li>Sliding-window profiles with helix overlays</li>
                  <li>Helical wheel projection (HeliQuest colors)</li>
                </ul>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Smart ranking & Top-N shortlist</li>
                  <li>CSV, PDF, and FASTA export (single + bulk)</li>
                  <li>UniProt & AlphaFold quick links</li>
                  <li>Per-residue S4PRED coloring & probability curves</li>
                  <li>Citable via CITATION.cff (CFF 1.2.0)</li>
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
