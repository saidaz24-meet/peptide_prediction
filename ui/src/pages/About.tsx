import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, cubicBezier } from "framer-motion";

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
      animate={{ clipPath: `circle(${isEntering ? to : from}px at ${clickPosition.x}px ${clickPosition.y}px)` }}
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

  // NEW: transition state
  const [phase, setPhase] = useState<Phase>("idle");
  const [clickPos, setClickPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: cubicBezier(0.22, 1, 0.36, 1) }}
        className="max-w-4xl mx-auto p-6"
      >
        <div className="container mx-auto max-w-4xl py-8 space-y-6">
          {/* Back button with animated transition */}
          <div className="mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setClickPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                setPhase("enter");
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          {/* Title */}
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">Peptide Visual Lab</h1>
            <Badge variant="secondary">DESY • Landau Group</Badge>
          </div>

          {/* Purpose */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Purpose</CardTitle>
              <CardDescription>Internal, non-public application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Explore peptide properties and fibril-forming predictions. Upload UniProt exports (TSV/CSV/XLSX), compute
                hydrophobicity, charge, μH, and visualize JPred/Tango outputs when available.
              </p>
            </CardContent>
          </Card>

          {/* Acknowledgements */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Acknowledgements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><b>Frontend design & implementation:</b> Said Azaizah</p>
              <p><b>Algorithmic approach & backend code:</b> provided by <b>Dr. Aleksandr Golubev</b></p>
              <p><b>JPred / Tango predictions:</b> courtesy of the lab’s existing pipelines</p>
            </CardContent>
          </Card>

          {/* Key Features */}
          <Card className="shadow-medium">
            <CardHeader><CardTitle>Key Features</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
              <ul className="list-disc pl-5 space-y-1">
                <li>Flexible upload with QC (+ rejected rows export)</li>
                <li>Hydrophobicity, Charge, μH; SSW & FF-Helix</li>
                <li>Cohort visualizations + correlation matrix</li>
                <li>Sliding-window profiles with helix overlays</li>
              </ul>
              <ul className="list-disc pl-5 space-y-1">
                <li>Smart ranking & Top-N shortlist</li>
                <li>CSV & PDF report export</li>
                <li>UniProt & AlphaFold quick links</li>
                <li>Optional cloud save/load</li>
              </ul>
            </CardContent>
          </Card>

          {/* JPred / Tango note */}
          <Card className="shadow-medium">
            <CardHeader><CardTitle>JPred / Tango</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                The app reads local result files from <code>backend/Jpred/</code> and <code>backend/Tango/</code>. Set{" "}
                <code>USE_JPRED=1</code> / <code>USE_TANGO=1</code> before starting the API. Without these assets, related
                metrics display <em>Not available</em>.
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  );
}
