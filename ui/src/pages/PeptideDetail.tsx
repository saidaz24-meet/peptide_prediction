import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  ChevronDown,
  FileText,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useDatasetStore } from "@/stores/datasetStore";
import { SegmentTrack } from "@/components/SegmentTrack";
import { DualStructureTrack } from "@/components/DualStructureTrack";
import { ResidueCategoryLegend } from "@/components/ResidueCategoryLegend";
import { EvidencePanel } from "@/components/EvidencePanel";
// Peleg FIX-016: PeptideRadarChart + PositionBars + standalone stat tiles consolidated
// into BiochemComparison (single source of truth for the biochem comparison panel).
import { BiochemComparison, DEFAULT_PVL_METRICS } from "@/components/BiochemComparison";
import { ProviderBadge } from "@/components/ProviderBadge";
import { TangoBadge } from "@/components/TangoBadge";
import { SequenceTrack } from "@/components/SequenceTrack";
import { HelicalWheel } from "@/components/HelicalWheel";
import { AggregationHeatmap } from "@/components/AggregationHeatmap";
import { Mol3DViewer } from "@/components/Mol3DViewer";
import { BackboneViewer } from "@/components/BackboneViewer";
import { S4PredChart } from "@/components/S4PredChart";
import { WindowProfileChart, DEFAULT_PVL_CHANNELS } from "@/components/charts/WindowProfileChart";
// Peleg FIX-013: ConsensusCard tier system removed (certainty math unjustified).
import { useChartSelection } from "@/stores/chartSelectionStore";
import { useThresholdStore } from "@/stores/thresholdStore";
import { useDrillDown } from "@/components/drilldown/DrillDownProvider";
import { downloadPeptideReport } from "@/lib/peptideReport";
import { PVL_VERSION } from "@/stores/reproducibilityStore";
import { cn } from "@/lib/utils";
import { BgDotGrid } from "@/components/BgDotGrid";

import { useState } from "react";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import AppFooter from "@/components/AppFooter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** Collapsible card section with chevron toggle (P3: clickable/expandable titles) */
function CollapsibleCard({
  title,
  description,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer select-none hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-h3">{title}</CardTitle>
                {badge}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
              />
            </div>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/** Collapsible protein function — shows 3 lines, expands on click */
function FunctionBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 250;

  return (
    <div className="space-y-1">
      <p className="text-caption text-muted-foreground">Function</p>
      <div className="relative">
        <p
          className={cn(
            "text-small text-foreground/85 leading-relaxed",
            !expanded && isLong && "line-clamp-3"
          )}
        >
          {text}
        </p>
        {isLong && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export default function PeptideDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPeptideById, peptides, stats } = useDatasetStore();

  const { clearSelection } = useChartSelection();
  const tangoAggregationThreshold = useThresholdStore((s) => s.active.tangoAggregationThreshold);
  const muHCutoff = useThresholdStore((s) => s.active.muHCutoff);
  const hydroCutoff = useThresholdStore((s) => s.active.hydroCutoff);
  const { open: openDrillDown } = useDrillDown();

  const peptide = id ? getPeptideById(id) : undefined;

  if (!peptide) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle>Peptide Not Found</CardTitle>
            <CardDescription>
              The requested peptide could not be found in the current dataset.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/results")}>Back to Results</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCopySequence = () => {
    navigator.clipboard.writeText(peptide.sequence);
    toast.success("Sequence copied to clipboard");
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(peptide, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `peptide_${peptide.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Peptide data downloaded");
  };

  const handleDownloadFASTA = () => {
    const header = `>${peptide.id}${peptide.species ? `|${peptide.species}` : ""}${peptide.name ? ` ${peptide.name}` : ""}`;
    // Wrap sequence at 80 characters per FASTA convention
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

  const handleDownloadPDFReport = async () => {
    try {
      toast.loading("Generating PDF report...", { id: "pdf-report" });
      await downloadPeptideReport(peptide, {
        version: PVL_VERSION,
        permalink: window.location.href,
        thresholds: { muHCutoff, hydroCutoff },
      });
      toast.success("PDF report downloaded", { id: "pdf-report" });
    } catch (err) {
      toast.error("PDF generation failed", { id: "pdf-report" });
      console.error("downloadPeptideReport failed", err);
    }
  };

  const handleFindSimilar = () => {
    openDrillDown({ peptide: peptide.id, mode: "similar" });
  };

  // Use centralized TangoBadge for consistent display semantics
  const getSSWBadge = () => {
    // Use canonical tangoHasData field from backend (preferred)
    // Fallback to checking curves if tangoHasData not available
    const hasTangoData =
      peptide.tangoHasData ??
      Boolean(
        peptide.tango?.beta?.length ||
        peptide.tango?.helix?.length ||
        peptide.extra?.["Tango Beta curve"]?.length ||
        peptide.extra?.["Tango Helix curve"]?.length
      );
    return (
      <TangoBadge
        providerStatus={peptide.providerStatus?.tango}
        sswPrediction={peptide.sswPrediction}
        hasTangoData={hasTangoData}
        showIcon={true}
        sswContext={{ sswHelixPercentage: peptide.sswHelixPct, sswDiff: peptide.sswDiff }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background relative">
      <BgDotGrid />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto space-y-8"
        >
          {/* ─── Hero Header (open layout, no card wrapper) ─── */}
          <div className="space-y-6">
            {/* Back + actions bar */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 -ml-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  clearSelection();
                  navigate("/results");
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Back to Results
              </Button>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleCopySequence}
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleDownloadFASTA}
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  FASTA
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleDownloadJSON}
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  JSON
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleDownloadPDFReport}
                  title="Download a 6-page Nature-supplement-quality PDF report"
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  PDF Report
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleFindSimilar}
                  title="Find peptides similar to this one (vector similarity)"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Find Similar
                </Button>
              </div>
            </div>

            {/* ID + providers + subtitle */}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-display text-foreground break-all page-header-title">
                  {/^[A-Z][0-9][A-Z0-9]{3}[0-9](-\d+)?$/i.test(peptide.id) ? (
                    <a
                      href={`https://www.uniprot.org/uniprotkb/${peptide.id}/entry`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors inline-flex items-center gap-2"
                      title="Open UniProt entry"
                    >
                      {peptide.id}
                      <ExternalLink className="w-5 h-5 text-muted-foreground" />
                    </a>
                  ) : (
                    <span>{peptide.id}</span>
                  )}
                </h1>
                {peptide.providerStatus?.tango && (
                  <ProviderBadge name="Tango" status={peptide.providerStatus.tango as any} />
                )}
                {peptide.providerStatus?.s4pred && (
                  <ProviderBadge name="S4PRED" status={peptide.providerStatus.s4pred as any} />
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap mt-1 text-body text-muted-foreground">
                <span>{peptide.length ?? "?"} amino acids</span>
                {peptide.geneName && (
                  <>
                    <span className="text-[hsl(var(--faint))]">/</span>
                    <span className="font-semibold text-foreground">{peptide.geneName}</span>
                  </>
                )}
                {peptide.name && peptide.name !== peptide.geneName && (
                  <>
                    <span className="text-[hsl(var(--faint))]">/</span>
                    <span>{peptide.name}</span>
                  </>
                )}
                {peptide.species && (
                  <>
                    <span className="text-[hsl(var(--faint))]">&middot;</span>
                    <span className="italic">{peptide.species}</span>
                  </>
                )}
                {typeof peptide.annotationScore === "number" && (
                  <>
                    <span className="text-[hsl(var(--faint))]">&middot;</span>
                    <span
                      className="text-amber-500"
                      title={`Annotation score: ${peptide.annotationScore}/5`}
                    >
                      {"★".repeat(peptide.annotationScore)}
                      {"☆".repeat(5 - peptide.annotationScore)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Classification pills — what researchers care about FIRST */}
            <div className="flex items-center gap-2 flex-wrap">
              {getSSWBadge()}
              {typeof peptide.s4predHelixPercent === "number" && (
                <Badge
                  variant="outline"
                  className={`text-xs ${peptide.s4predHelixPercent > 30 ? "border-helix text-helix" : "text-muted-foreground"}`}
                >
                  Helix {peptide.s4predHelixPercent.toFixed(1)}%
                </Badge>
              )}
              {peptide.ffHelixFlag === 1 ? (
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 text-xs">
                  FF-Helix Candidate
                </Badge>
              ) : peptide.ffHelixFlag === -1 ? (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  FF-Helix: No
                </Badge>
              ) : null}
              {peptide.ffSswFlag === 1 ? (
                <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 text-xs">
                  FF-SSW Candidate
                </Badge>
              ) : peptide.ffSswFlag === -1 ? (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  FF-SSW: No
                </Badge>
              ) : null}
              {/* Peleg 2026-06-07 — classification row is for class flags only.
                  FF-Helix % is a feature, not a class — its raw score lives in
                  the scatter / table, not as a pill alongside class badges. */}
            </div>

            {/* Protein function — collapsible, 3 lines by default */}
            {peptide.proteinFunction && (
              <FunctionBlock text={peptide.proteinFunction.replace(/^FUNCTION:\s*/i, "")} />
            )}

            {/* Thin separator */}
            <div className="border-b border-[hsl(var(--border))]" />
          </div>

          {/* AlphaFold-predicted structure card. Renamed 2026-06-03 per
              Peleg's Drive comment 17: title should make the "predicted, not
              experimental" nature visible up front, not buried in a footnote. */}
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-h3">AlphaFold-predicted structure</CardTitle>
                {/* F10 (Said decided 2026-05-21, Peleg slide 18): drop the
                    Beta % and Coil % numerical subcards. The S4PRED
                    probability curves still render in <S4PredChart/> below —
                    Peleg's position is "showing the graph is enough". The
                    segment-based Helix % stays because it's used as a
                    classification anchor in FIX-013. */}
                {peptide.s4predHelixPercent != null && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-helix inline-block" />
                      Helix ({peptide.s4predHelixPercent.toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sequence with S4PRED coloring */}
              <SequenceTrack peptide={peptide} />

              {/* PELEG-FIX-010 (2026-05-07): explicit residue-coloring legend.
                  Sequence text uses S4PRED secondary-structure colors.
                  SequenceTrack already shows the per-class percentages on the
                  right; this row makes the color↔meaning link explicit so a
                  biologist new to the page understands the coloring at a glance. */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Residue colors:</span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-helix" />
                  Helix
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-beta" />
                  Beta strand
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-muted-foreground/40" />
                  Coil / disordered
                </span>
                <span className="ml-2">Predicted by S4PRED.</span>
              </div>

              {/* FIX-010 (2026-05-07): amino-acid category legend so the
                  biochemical meaning of each residue (hydrophobic, polar,
                  charged, special) is decodable at a glance — complements the
                  S4PRED secondary-structure colors above. */}
              <ResidueCategoryLegend />

              {/* Segment tracks — P8 (2026-05-07): SegmentTrack now takes a
                  `kind` prop so we can render the helix and SSW (structural-
                  switch) up/down diagrams side-by-side. Both fall back
                  silently when no fragments exist. */}
              {peptide.s4pred?.helixSegments?.length ? (
                <SegmentTrack
                  sequence={peptide.sequence}
                  fragments={peptide.s4pred.helixSegments}
                  kind="helix"
                />
              ) : null}
              {peptide.s4predSswFragments?.length || peptide.s4pred?.betaSegments?.length ? (
                <SegmentTrack
                  sequence={peptide.sequence}
                  fragments={
                    peptide.s4predSswFragments?.length
                      ? (peptide.s4predSswFragments as Array<[number, number]>)
                      : (peptide.s4pred!.betaSegments as Array<[number, number]>)
                  }
                  kind="ssw"
                />
              ) : null}

              {/* Dual structure tracks (P1+P2): Helix, SSW, FF-Helix with sequence letters */}
              <DualStructureTrack peptide={peptide} />

              {/* FF classification explanation */}
              {(peptide.ffHelixFlag === 1 || peptide.ffSswFlag === 1) && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  {peptide.ffHelixFlag === 1 && (
                    <span>
                      <strong>FF-Helix</strong> = S4PRED-predicted helix with above-average
                      amphipathic character (μH).{" "}
                    </span>
                  )}
                  {peptide.ffSswFlag === 1 && (
                    <span>
                      <strong>FF-SSW</strong> = TANGO structural switch with above-average
                      hydrophobicity.
                    </span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Peleg FIX-016: unified biochemical comparison (radar + percentile bars +
              database-mean stat cards in one panel, declarative metrics list). */}
          <BiochemComparison
            peptide={peptide}
            allPeptides={peptides}
            stats={stats}
            metrics={DEFAULT_PVL_METRICS}
          />

          {/* Helical Wheel Projection — only for short peptides WITH some helix prediction */}
          {peptide.length <= 40 &&
          ((typeof peptide.ffHelixPercent === "number" && peptide.ffHelixPercent > 0) ||
            (typeof peptide.s4predHelixPercent === "number" && peptide.s4predHelixPercent > 0)) ? (
            <CollapsibleCard
              title="Helical Wheel Projection"
              description="Schiffer-Edmundson axial view of the alpha-helix. The red arrow shows the hydrophobic moment direction (amphipathic face)."
            >
              <div className="flex justify-center">
                <HelicalWheel sequence={peptide.sequence} />
              </div>
              {/* PELEG-Q1-RESOLVED: Chou-Fasman fallback note removed — wheel
                  is shown only when S4PRED predicts helical structure. */}
            </CollapsibleCard>
          ) : peptide.length <= 40 ? (
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground text-center">
                  Helical wheel not shown — S4PRED does not predict helical structure for this
                  sequence.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* Sliding-Window Profiles — V4-3 unified chart (lines + bands + markers). */}
          {peptide.length <= 200 ? (
            <CollapsibleCard
              title="Sliding-Window Profiles"
              description="Hydrophobicity, hydrophobic moment (μH), and TANGO aggregation overlaid on a single axis. S4PRED helix and FF-Helix bands mark predicted segments; aggregation peaks above the threshold are highlighted."
            >
              <WindowProfileChart peptide={peptide} channels={DEFAULT_PVL_CHANNELS} />
            </CollapsibleCard>
          ) : (
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardContent>
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm mb-2">
                    Sequence too long for per-residue plot (length: {peptide.length}).
                  </p>
                  <p className="text-xs">
                    Use windowing or open advanced view for detailed analysis.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* S4PRED Secondary Structure Predictions */}
          <S4PredChart
            peptide={peptide}
            className="shadow-soft border-[hsl(var(--border))] rounded-xl"
          >
            {/* S4PRED summary stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="font-semibold text-helix">
                  {typeof peptide.s4predHelixPercent === "number"
                    ? `${peptide.s4predHelixPercent.toFixed(1)}%`
                    : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">Helix %</div>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="font-semibold">
                  {peptide.s4predSswPrediction === 1
                    ? "✓ Yes"
                    : peptide.s4predSswPrediction === -1
                      ? "✗ No"
                      : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">SSW Predicted</div>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <div className="font-semibold">{peptide.s4pred?.helixSegments?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground">Helix Segments</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              S4PRED: Single Sequence Secondary Structure Prediction.
            </div>
          </S4PredChart>

          {/* TANGO Aggregation Heatmap */}
          {peptide.tango?.agg && peptide.tango.agg.length > 0 && (
            <CollapsibleCard
              title="TANGO Aggregation Profile"
              description="Per-residue aggregation propensity from TANGO. Higher scores indicate regions with higher aggregation propensity."
            >
              <AggregationHeatmap
                sequence={peptide.sequence}
                aggCurve={peptide.tango.agg}
                betaCurve={peptide.tango.beta}
                helixCurve={peptide.tango.helix}
                s4predBetaCurve={peptide.s4pred?.pE}
                peptideId={peptide.id}
              />
            </CollapsibleCard>
          )}

          {/* FF-Helix vs Agg Max: cohort context scatter */}
          {typeof peptide.ffHelixPercent === "number" &&
            typeof peptide.tangoAggMax === "number" &&
            peptides.length > 1 && (
              <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
                <CardHeader>
                  <CardTitle>FF-Helix vs Aggregation Max</CardTitle>
                  <CardDescription>
                    Position of this peptide relative to the database. Current peptide highlighted
                    in red.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 30, bottom: 55, left: 55 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="FF-Helix score"
                          domain={[0, 100]}
                          label={{
                            value: "FF-Helix score",
                            position: "insideBottom",
                            offset: -10,
                            fontSize: 12,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name="Aggregation Max"
                          label={{
                            value: "Peak TANGO aggregation score",
                            angle: -90,
                            position: "insideLeft",
                            offset: -5,
                            fontSize: 12,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <Tooltip
                          content={({ payload }) => {
                            const item = payload?.[0]?.payload;
                            if (!item) return null;
                            return (
                              <div className="bg-background border border-border rounded p-2 text-xs">
                                <p className="font-medium">{item.id}</p>
                                <p>FF-Helix: {Number(item.x).toFixed(1)}%</p>
                                <p>Aggregation Max: {Number(item.y).toFixed(2)}</p>
                              </div>
                            );
                          }}
                        />
                        <Scatter
                          data={
                            peptides
                              .filter(
                                (p) =>
                                  typeof p.ffHelixPercent === "number" &&
                                  typeof p.tangoAggMax === "number"
                              )
                              .map((p) => ({
                                x: p.ffHelixPercent as number,
                                y: p.tangoAggMax as number,
                                id: p.id,
                                isCurrent: p.id === peptide.id,
                              }))
                              .sort((a, b) => (a.isCurrent ? 1 : 0) - (b.isCurrent ? 1 : 0)) // current on top
                          }
                        >
                          {peptides
                            .filter(
                              (p) =>
                                typeof p.ffHelixPercent === "number" &&
                                typeof p.tangoAggMax === "number"
                            )
                            .sort(
                              (a, b) =>
                                (a.id === peptide.id ? 1 : 0) - (b.id === peptide.id ? 1 : 0)
                            )
                            .map((p, i) => (
                              <Cell
                                key={i}
                                fill={p.id === peptide.id ? "#D55E00" : "#CCCCCC"}
                                r={p.id === peptide.id ? 6 : 3}
                              />
                            ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: "#D55E00" }}
                      />
                      Current peptide
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: "#CCCCCC" }}
                      />
                      Database
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* 2D Backbone Visualization (at-a-glance card) — has a "View in 3D →"
              button that scrolls to the Mol3DViewer section below. */}
          <BackboneViewer
            peptideId={peptide.id}
            onView3D={() =>
              document
                .getElementById("peptide-detail-mol3d")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />

          {/* V4-2: 3D structural deep-dive with TANGO / S4PRED-helix / FF-Helix /
              SSW overlays computed from peptide data via buildDefaultOverlays. */}
          <div id="peptide-detail-mol3d">
            <Mol3DViewer peptide={peptide} aggThreshold={tangoAggregationThreshold} />
          </div>

          {/* Peleg FIX-016: standalone feature tiles removed — moved into the
              BiochemComparison stat-card sub-panel above.
              Peleg FIX-013: ConsensusCard tier system removed. */}

          <EvidencePanel peptide={peptide} cohortStats={stats} />

          <AppFooter />
        </motion.div>
      </div>
    </div>
  );
}
