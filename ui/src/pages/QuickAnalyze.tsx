import { useState, useEffect, useCallback } from "react";
import { motion, cubicBezier } from "framer-motion";
import {
  FlaskConical,
  ChevronRight,
  ArrowLeft,
  AlertTriangle as AlertTriangleIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { predictOne as apiPredictOne } from "@/lib/api";
import { mapApiRowToPeptide } from "@/lib/peptideMapper";
import { Peptide, ThresholdConfig } from "@/types/peptide";
import { ThresholdConfigPanel } from "@/components/ThresholdConfigPanel";
import { PeptideViewer } from "@/components/PeptideViewer";
import { useDatasetStore } from "@/stores/datasetStore";
import { BgDotGrid } from "@/components/BgDotGrid";
import { setNavGuard } from "@/hooks/use-nav-guard";
import AppFooter from "@/components/AppFooter";

async function predictSequence(
  sequence: string,
  entry?: string,
  thresholdConfig?: ThresholdConfig
): Promise<Peptide> {
  const response = await apiPredictOne(sequence, entry, thresholdConfig);
  return mapApiRowToPeptide(response.row, "/api/predict");
}

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

/** -------------------- Page -------------------- */
export default function QuickAnalyze() {
  const [sequence, setSequence] = useState("");
  const [entry, setEntry] = useState("");
  const [loading, setLoading] = useState(false);
  const [peptide, setPeptide] = useState<Peptide | null>(null);
  const navigate = useNavigate();

  // Threshold configuration
  const [thresholdMode, setThresholdMode] = useState<"default" | "recommended" | "custom">(
    "recommended"
  );
  const [customThresholds, setCustomThresholds] = useState({
    muHCutoff: 0.0,
    hydroCutoff: 0.0,
    aggThreshold: 5.0,
    percentOfLengthCutoff: 20,
    minSswResidues: 3,
    sswMaxDifference: 0.0,
    minPredictionPercent: 50.0,
    minS4predHelixScore: 0.0,
    maxTangoDifference: 0.0,
  });

  const [phase, setPhase] = useState<Phase>("idle");
  const [clickPos, setClickPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Navigation guard state
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);

  const hasUnsavedResults = peptide !== null;

  // Prevent tab close/reload while analyzing OR when results exist
  useEffect(() => {
    if (!loading && !hasUnsavedResults) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loading, hasUnsavedResults]);

  // Register global nav guard so sidebar intercepts navigation
  useEffect(() => {
    if (hasUnsavedResults) {
      setNavGuard(true, (dest: string) => {
        setPendingNavPath(dest);
        setShowLeaveDialog(true);
      });
    } else {
      setNavGuard(false);
    }
    return () => setNavGuard(false);
  }, [hasUnsavedResults]);

  // Guarded navigation — shows dialog if results exist
  const guardedNavigate = useCallback(
    (path: string) => {
      if (hasUnsavedResults) {
        setPendingNavPath(path);
        setShowLeaveDialog(true);
      } else {
        navigate(path);
      }
    },
    [hasUnsavedResults, navigate]
  );

  const confirmLeave = useCallback(() => {
    setShowLeaveDialog(false);
    setPeptide(null); // Clear results so guard is deactivated
    if (pendingNavPath) {
      navigate(pendingNavPath);
      setPendingNavPath(null);
    }
  }, [pendingNavPath, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = sequence.trim();
    if (!trimmed) {
      toast.error("Please paste an amino-acid sequence");
      return;
    }
    if (!/^[A-Za-z]+$/.test(trimmed)) {
      toast.error(
        "Sequence must contain only amino acid letters (A-Z). Remove numbers, spaces, or symbols."
      );
      return;
    }
    setLoading(true);
    setPeptide(null);
    try {
      const thresholdConfig: ThresholdConfig = {
        mode: thresholdMode,
        version: "1.0.0",
        ...(thresholdMode === "custom" && { custom: customThresholds }),
      };
      const res = await predictSequence(sequence, entry, thresholdConfig);
      setPeptide(res);
      // Store source for recalculate
      useDatasetStore.getState().setLastRun("predict", { sequence, entry }, thresholdConfig);
      toast.success("Prediction ready");
    } catch (err: any) {
      toast.error(err?.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const p = peptide; // alias for brevity in JSX

  return (
    <>
      {/* Navigation guard dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="rounded-xl border-[hsl(var(--border))] shadow-strong max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <AlertDialogTitle className="text-h3">Leave Quick Analyze?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-small text-muted-foreground">
              Your prediction results will be lost. This analysis hasn't been saved to a dataset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="btn-press">Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLeave}
              className="bg-amber-600 hover:bg-amber-700 text-white btn-press"
            >
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScreenTransition
        phase={phase}
        clickPosition={clickPos}
        onHalfway={() => {
          navigate("/upload");
          setPhase("exit");
        }}
        onDone={() => setPhase("idle")}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: cubicBezier(0.22, 1, 0.36, 1) }}
        className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 relative"
      >
        <BgDotGrid opacity={0.02} />
        {useDatasetStore.getState().peptides.length > 0 && (
          <button
            onClick={() => guardedNavigate("/results")}
            className="inline-flex items-center text-small text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Batch Results
          </button>
        )}

        <div>
          <h1 className="text-h1 text-foreground page-header-title">Quick Analyze</h1>
          <p className="text-body text-muted-foreground mt-1 hidden md:block">
            Paste a single peptide sequence for instant prediction.
          </p>
        </div>

        <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-h3">Sequence Input</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <Label htmlFor="seq">Sequence</Label>
                  <Input
                    id="seq"
                    value={sequence}
                    onChange={(e) => setSequence(e.target.value)}
                    placeholder="e.g. MRWQEMGYIFYPRKLR"
                  />
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="entry">Name (optional)</Label>
                  <Input
                    id="entry"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="e.g. Amyloid-beta"
                  />
                </div>
              </div>

              <ThresholdConfigPanel
                thresholdMode={thresholdMode}
                onModeChange={setThresholdMode}
                customThresholds={customThresholds}
                onCustomChange={setCustomThresholds}
                variant="details"
              />

              {/* Example peptides */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Try an example:</span>
                {[
                  { label: "Amyloid-β(25-35)", seq: "GSNKGAIIGLM", entry: "Amyloid-beta(25-35)" },
                  {
                    label: "LL-37",
                    seq: "LLGDFFRKSKEKIGKEFKRIVQRIKDFLRNLVPRTES",
                    entry: "LL-37",
                  },
                  { label: "KLVFF", seq: "KLVFF", entry: "KLVFF-core" },
                ].map((ex) => (
                  <Button
                    key={ex.seq}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    type="button"
                    onClick={() => {
                      setSequence(ex.seq);
                      setEntry(ex.entry);
                    }}
                  >
                    {ex.label}
                  </Button>
                ))}
              </div>

              {/* Sequence length warnings */}
              {sequence.trim().length > 0 && sequence.trim().length < 5 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {sequence.trim().length} aa — too short for TANGO (&lt;5 aa minimum)
                  </AlertDescription>
                </Alert>
              )}
              {sequence.trim().length >= 5 && sequence.trim().length < 15 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {sequence.trim().length} aa — S4PRED may be unreliable below 15 aa. Biochemical
                    properties remain valid.
                  </AlertDescription>
                </Alert>
              )}
              {sequence.trim().length > 100 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {sequence.trim().length} aa — reduced TANGO accuracy above 100 aa. S4PRED
                    remains reliable.
                  </AlertDescription>
                </Alert>
              )}
              {sequence &&
                !/^[A-Za-z]*$/.test(sequence) &&
                (() => {
                  // Check if it looks like a chemical modification pattern (Ac-SEQ-NH2, pGlu-SEQ, etc.)
                  const chemModPattern =
                    /^(Ac-|Acetyl-|pGlu-|Pyr-|For-|Myr-|Palm-)?[A-Za-z]+(-(NH2|amide|OH|COOH|CONH2))?$/i;
                  const isChemMod = chemModPattern.test(sequence.trim());
                  return isChemMod ? (
                    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 animate-attention">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        Chemical modifications detected — these will be stripped before prediction
                        and noted in the results.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive" className="animate-attention">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Sequence must contain only amino acid letters (A-Z). Remove numbers, spaces,
                        or symbols.
                      </AlertDescription>
                    </Alert>
                  );
                })()}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button type="submit" disabled={loading} className="px-6 btn-press">
                  {loading ? "Analyzing..." : "Analyze"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  className="btn-press"
                  onClick={(e) => {
                    if (hasUnsavedResults) {
                      setPendingNavPath("/upload");
                      setShowLeaveDialog(true);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setClickPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                      setPhase("enter");
                    }
                  }}
                >
                  Batch mode
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ==================== SEQUENCE NOTES ==================== */}
        {p?.sequenceNotes && (
          <div className="animate-attention">
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Sequence modified:</strong> {p.sequenceNotes}
                {p.originalSequence && (
                  <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400 font-mono break-all">
                    Original: {p.originalSequence}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* ==================== RESULTS ==================== */}
        {p && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <PeptideViewer peptide={p} />
          </motion.div>
        )}
        <AppFooter />
      </motion.div>
    </>
  );
}
