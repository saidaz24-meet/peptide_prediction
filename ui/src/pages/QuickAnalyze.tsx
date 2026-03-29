import { useState } from "react";
import { motion, cubicBezier } from "framer-motion";
import { FlaskConical, ChevronRight, Copy, Download, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { predictOne as apiPredictOne } from "@/lib/api";
import { mapApiRowToPeptide } from "@/lib/peptideMapper";
import { Peptide, ThresholdConfig } from "@/types/peptide";
import { ThresholdConfigPanel } from "@/components/ThresholdConfigPanel";
import { TangoBadge } from "@/components/TangoBadge";
import { SequenceTrack } from "@/components/SequenceTrack";
import { HelicalWheel } from "@/components/HelicalWheel";
import { AggregationHeatmap } from "@/components/AggregationHeatmap";
import { AlphaFoldViewer } from "@/components/AlphaFoldViewer";
import { S4PredChart } from "@/components/S4PredChart";
import { ConsensusCard } from "@/components/ConsensusCard";
import { useDatasetStore } from "@/stores/datasetStore";

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
  });

  const [phase, setPhase] = useState<Phase>("idle");
  const [clickPos, setClickPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

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

  const handleCopySequence = () => {
    if (!peptide) return;
    navigator.clipboard.writeText(peptide.sequence);
    toast.success("Sequence copied to clipboard");
  };

  const handleDownloadFASTA = () => {
    if (!peptide) return;
    const header = `>${peptide.id}`;
    const wrapped = peptide.sequence.match(/.{1,80}/g)?.join("\n") ?? peptide.sequence;
    const fasta = `${header}\n${wrapped}\n`;
    const blob = new Blob([fasta], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${peptide.id}.fasta`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("FASTA downloaded");
  };

  const p = peptide; // alias for brevity in JSX

  return (
    <>
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
        transition={{ duration: 0.35, ease: cubicBezier(0.22, 1, 0.36, 1) }}
        className="max-w-5xl mx-auto p-6 space-y-8"
      >
        {useDatasetStore.getState().peptides.length > 0 && (
          <Link
            to="/results"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Batch Results
          </Link>
        )}

        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Quick Analyze (single peptide)</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Paste a sequence (A-Z amino-acid letters)</CardTitle>
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
                  <Label htmlFor="entry">Label (optional)</Label>
                  <Input
                    id="entry"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="e.g. custom-1"
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
              {sequence && !/^[A-Za-z]*$/.test(sequence) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Non-amino-acid characters detected (digits, spaces, symbols). These will be
                    rejected before analysis.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? "Analyzing..." : "Analyze"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setClickPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                    setPhase("enter");
                  }}
                >
                  Batch mode
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ==================== RESULTS ==================== */}
        {p && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* ── Header: Entry + Length + Badges + Actions ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-xl">
                      {/^[A-Z][0-9][A-Z0-9]{3}[0-9](-\d+)?$/i.test(p.id) ? (
                        <a
                          href={`https://www.uniprot.org/uniprotkb/${p.id}/entry`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {p.id}
                        </a>
                      ) : (
                        p.id
                      )}
                    </CardTitle>
                    <CardDescription>{p.length ?? "?"} amino acids</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <TangoBadge
                      providerStatus={p.providerStatus?.tango}
                      sswPrediction={p.sswPrediction}
                      hasTangoData={p.tangoHasData ?? false}
                      showIcon
                      sswContext={{ sswHelixPercentage: p.sswHelixPct, sswDiff: p.sswDiff }}
                    />
                    {typeof p.s4predHelixPercent === "number" && (
                      <Badge variant="outline" className="text-helix border-helix">
                        S4PRED Helix: {p.s4predHelixPercent.toFixed(1)}%
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={handleCopySequence}>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadFASTA}>
                      <Download className="w-4 h-4 mr-1" />
                      FASTA
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <SequenceTrack peptide={p} />
              </CardContent>
            </Card>

            {/* ── KPI tiles ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">
                    {p.charge !== null ? `${p.charge > 0 ? "+" : ""}${p.charge.toFixed(1)}` : "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">Charge</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">
                    {p.hydrophobicity !== null ? p.hydrophobicity.toFixed(2) : "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">Hydrophobicity</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">
                    {p.muH != null ? p.muH.toFixed(2) : "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">Hydrophobic moment</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-helix">
                    {typeof p.s4predHelixPercent === "number"
                      ? `${p.s4predHelixPercent.toFixed(0)}%`
                      : "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">S4PRED Helix</div>
                  <div className="text-[10px] text-muted-foreground/60">
                    neural network prediction
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Consensus Analysis ── */}
            <ConsensusCard peptide={p} />

            {/* ── Helical Wheel + Biochem side by side ── */}
            {p.length != null && p.length <= 40 && (
              <Card>
                <CardHeader>
                  <CardTitle>Helical Wheel Projection</CardTitle>
                  <CardDescription>
                    Schiffer-Edmundson axial view. The red arrow shows the hydrophobic moment
                    direction.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <HelicalWheel sequence={p.sequence} />
                </CardContent>
              </Card>
            )}

            {/* ── S4PRED Per-Residue Probabilities ── */}
            <S4PredChart peptide={p} />

            {/* ── TANGO Aggregation Heatmap ── */}
            {p.tango?.agg && p.tango.agg.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>TANGO Aggregation Profile</CardTitle>
                  <CardDescription>
                    Per-residue aggregation propensity. High scores indicate amyloid-forming
                    regions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AggregationHeatmap
                    sequence={p.sequence}
                    aggCurve={p.tango.agg}
                    betaCurve={p.tango.beta}
                    helixCurve={p.tango.helix}
                    peptideId={p.id}
                  />
                </CardContent>
              </Card>
            )}

            {/* ── AlphaFold Viewer ── */}
            <AlphaFoldViewer peptideId={p.id} />

            {/* ── Interpretation guidance ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interpretation Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Charge</strong> and{" "}
                  <strong className="text-foreground">hydrophobicity</strong> help screen
                  antimicrobial and amyloid-prone candidates. Higher hydrophobicity with positive
                  charge can suggest membrane activity.
                </p>
                <p>
                  <strong className="text-foreground">Hydrophobic moment</strong> measures
                  amphipathicity — the asymmetry of hydrophobic residue distribution around a helix
                  axis.
                </p>
                <p>
                  TANGO and S4PRED predictions show "N/A" if those tools are not installed on the
                  server. Biochemical properties (charge, hydrophobicity, hydrophobic moment) are
                  always computed.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
