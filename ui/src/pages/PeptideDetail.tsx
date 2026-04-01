import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Download, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useDatasetStore } from "@/stores/datasetStore";
import { SegmentTrack } from "@/components/SegmentTrack";
import { EvidencePanel } from "@/components/EvidencePanel";
import { PeptideRadarChart } from "@/components/PeptideRadarChart";
import { PositionBars } from "@/components/PositionBars";
import { ProviderBadge } from "@/components/ProviderBadge";
import { TangoBadge } from "@/components/TangoBadge";
import { SequenceTrack } from "@/components/SequenceTrack";
import { HelicalWheel } from "@/components/HelicalWheel";
import { AggregationHeatmap } from "@/components/AggregationHeatmap";
import { ChartExportButtons } from "@/components/ChartExportButtons";
import { AlphaFoldViewer } from "@/components/AlphaFoldViewer";
import { S4PredChart } from "@/components/S4PredChart";
import { ConsensusCard } from "@/components/ConsensusCard";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { BgDotGrid } from "@/components/BgDotGrid";

// NEW: small additions for sliding-window profiles
import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { buildProfilePoints, helixRanges } from "@/lib/profile";
import { useBrushZoom } from "@/components/ZoomableChart";
import AppFooter from "@/components/AppFooter";

export default function PeptideDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPeptideById, peptides, stats } = useDatasetStore();

  const { clearSelection } = useChartSelection();
  const hydroZoom = useBrushZoom({ minSpan: 1 });
  const muHZoom = useBrushZoom({ minSpan: 1 });

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

  // NEW: sliding-window profiles state + derived data (non-invasive)
  const [win, setWin] = useState(11); // window size (odd numbers recommended)
  const profilePoints = useMemo(
    () => buildProfilePoints(peptide.sequence, win),
    [peptide.sequence, win]
  );
  const helixBands = useMemo(
    () => helixRanges(peptide.s4pred?.helixSegments as [number, number][] | undefined, win),
    [peptide.s4pred, win]
  );

  // FF-Helix overlay bands (green, distinct from S4PRED helix bands)
  const ffHelixBands = useMemo(
    () => helixRanges(peptide.ffHelixFragments as [number, number][] | undefined, win),
    [peptide.ffHelixFragments, win]
  );

  // Merge TANGO agg curve into profile points for overlay
  const enrichedProfilePoints = useMemo(() => {
    const tangoAgg = peptide.tango?.agg;
    if (!tangoAgg || tangoAgg.length === 0) return profilePoints;
    return profilePoints.map((pt) => {
      // TANGO agg is per-residue (1-indexed in our x); window center = x + floor(win/2)
      const residueIdx = pt.x - 1 + Math.floor(win / 2);
      return {
        ...pt,
        agg: residueIdx < tangoAgg.length ? tangoAgg[residueIdx] : undefined,
      };
    });
  }, [profilePoints, peptide.tango?.agg, win]);

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
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="h-9 btn-press"
                onClick={() => {
                  clearSelection();
                  navigate("/results");
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Results
              </Button>

              <div>
                <h1 className="text-h1 text-foreground flex items-center gap-2 break-all page-header-title">
                  {/^[A-Z][0-9][A-Z0-9]{3}[0-9](-\d+)?$/i.test(peptide.id) ? (
                    <a
                      href={`https://www.uniprot.org/uniprotkb/${peptide.id}/entry`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      title="Open UniProt entry"
                    >
                      {peptide.id}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span>{peptide.id}</span>
                  )}
                </h1>
                <p className="text-body text-muted-foreground mt-0.5">
                  {peptide.length ?? "?"} amino acids
                  {peptide.species && <> &middot; {peptide.species}</>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {peptide.providerStatus?.tango && (
                <ProviderBadge name="Tango" status={peptide.providerStatus.tango as any} />
              )}
              {peptide.providerStatus?.s4pred && (
                <ProviderBadge name="S4PRED" status={peptide.providerStatus.s4pred as any} />
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant="outline" size="sm" className="h-9 text-small btn-press" onClick={handleCopySequence}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-small btn-press" onClick={handleDownloadFASTA}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  FASTA
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-small btn-press" onClick={handleDownloadJSON}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  JSON
                </Button>
              </div>
            </div>
          </div>

          {/* Main Info Card */}
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-h3">Peptide Information</CardTitle>
                </div>
                <div className="flex items-center flex-wrap gap-1.5">
                  {getSSWBadge()}
                  {typeof peptide.s4predHelixPercent === "number" && (
                    <Badge variant="outline" className="text-helix border-helix">
                      S4PRED Helix: {peptide.s4predHelixPercent.toFixed(1)}%
                    </Badge>
                  )}
                  {peptide.ffHelixFlag === 1 && (
                    <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100">
                      FF-Helix: Candidate
                    </Badge>
                  )}
                  {peptide.ffHelixFlag === -1 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      FF-Helix: Not Candidate
                    </Badge>
                  )}
                  {peptide.ffSswFlag === 1 && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100">
                      FF-SSW: Candidate
                    </Badge>
                  )}
                  {peptide.ffSswFlag === -1 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      FF-SSW: Not Candidate
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sequence with S4PRED coloring */}
              <SequenceTrack peptide={peptide} />

              {/* Segment track (visual bar) */}
              {peptide.s4pred?.helixSegments?.length ? (
                <SegmentTrack
                  sequence={peptide.sequence}
                  helixFragments={peptide.s4pred.helixSegments}
                />
              ) : null}

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

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>Feature Comparison</CardTitle>
                <CardDescription>How this peptide compares to the cohort</CardDescription>
              </CardHeader>
              <CardContent>
                <PeptideRadarChart peptide={peptide} cohortStats={stats} />
              </CardContent>
            </Card>

            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>Cohort Position</CardTitle>
                <CardDescription>Percentile ranking across key metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <PositionBars peptide={peptide} allPeptides={peptides} />
              </CardContent>
            </Card>
          </div>

          {/* Helical Wheel Projection — only for short peptides WITH some helix prediction */}
          {peptide.length <= 40 &&
          ((typeof peptide.ffHelixPercent === "number" && peptide.ffHelixPercent > 0) ||
            (typeof peptide.s4predHelixPercent === "number" && peptide.s4predHelixPercent > 0)) ? (
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>Helical Wheel Projection</CardTitle>
                <CardDescription>
                  Schiffer-Edmundson axial view of the alpha-helix. The red arrow shows the
                  hydrophobic moment direction (amphipathic face).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <HelicalWheel sequence={peptide.sequence} />
                </div>
                {typeof peptide.s4predHelixPercent === "number" &&
                  peptide.s4predHelixPercent === 0 &&
                  typeof peptide.ffHelixPercent === "number" &&
                  peptide.ffHelixPercent > 0 && (
                    <div className="mt-3 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                      <strong>Note:</strong> S4PRED predicts no helical segments for this sequence.
                      The wheel shows the hypothetical helix projection based on Chou-Fasman
                      propensity ({peptide.ffHelixPercent.toFixed(0)}%).
                    </div>
                  )}
              </CardContent>
            </Card>
          ) : peptide.length <= 40 ? (
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground text-center">
                  Helical wheel not shown — neither Chou-Fasman nor S4PRED predict helical structure
                  for this sequence.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* NEW: Sliding-Window Profiles (frontend-only, non-destructive) */}
          {/* Gate: Hide per-residue charts for sequences > 200 residues (unreadable and slow) */}
          {peptide.length <= 200 ? (
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>Sliding-Window Profiles</CardTitle>
                <CardDescription>
                  Hydrophobicity (Fauchere-Pliska) and hydrophobic moment (μH), computed on the fly
                  from the sequence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Window size</span>
                    <span className="text-muted-foreground">{win}</span>
                  </div>
                  <Slider
                    min={5}
                    max={21}
                    step={2}
                    value={[win]}
                    onValueChange={([v]) => setWin(v)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Odd sizes recommended (e.g., 9, 11, 13). Larger window = smoother profiles.
                  </p>
                </div>

                {/* Hydrophobicity (KD) + optional TANGO Agg overlay */}
                <div className="space-y-2" data-chart-export>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Hydrophobicity (Fauchere-Pliska)</h3>
                    {hydroZoom.ZoomControls}
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={enrichedProfilePoints} {...hydroZoom.chartHandlers}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="x"
                          tickCount={10}
                          domain={hydroZoom.zoomDomain ?? ["auto", "auto"]}
                          type="number"
                          allowDataOverflow
                        />
                        <YAxis
                          yAxisId="left"
                          label={{
                            value: "Hydrophobicity (KD)",
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
                          }}
                        />
                        {peptide.tango?.agg && peptide.tango.agg.length > 0 && (
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            label={{
                              value: "TANGO Agg %",
                              angle: 90,
                              position: "insideRight",
                              style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
                            }}
                          />
                        )}
                        <Tooltip formatter={(v: number) => v.toFixed(3)} />
                        {helixBands.map((r, i) => (
                          <ReferenceArea
                            key={`s4-${i}`}
                            x1={r.x1}
                            x2={r.x2}
                            fill="#6366f1"
                            opacity={0.12}
                          />
                        ))}
                        {ffHelixBands.map((r, i) => (
                          <ReferenceArea
                            key={`ff-${i}`}
                            x1={r.x1}
                            x2={r.x2}
                            fill="#32CD32"
                            opacity={0.12}
                          />
                        ))}
                        <Line
                          type="monotone"
                          dataKey="H"
                          name="Hydrophobicity"
                          stroke="#2563eb"
                          dot={false}
                          yAxisId="left"
                        />
                        {peptide.tango?.agg && peptide.tango.agg.length > 0 && (
                          <Line
                            type="monotone"
                            dataKey="agg"
                            name="TANGO Agg %"
                            stroke="#D55E00"
                            strokeDasharray="5 3"
                            dot={false}
                            yAxisId="right"
                          />
                        )}
                        {hydroZoom.brushProps && <ReferenceArea {...hydroZoom.brushProps} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between">
                    <ChartExportButtons filename={`${peptide.id}-hydrophobicity-w${win}`} />
                    {hydroZoom.zoomHint}
                  </div>
                </div>

                {/* Hydrophobic moment (μH) */}
                <div className="space-y-2" data-chart-export>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Hydrophobic Moment (μH)</h3>
                    {muHZoom.ZoomControls}
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={profilePoints} {...muHZoom.chartHandlers}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="x"
                          tickCount={10}
                          domain={muHZoom.zoomDomain ?? ["auto", "auto"]}
                          type="number"
                          allowDataOverflow
                        />
                        <YAxis
                          label={{
                            value: "μH",
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
                          }}
                        />
                        <Tooltip formatter={(v: number) => v.toFixed(3)} />
                        {helixBands.map((r, i) => (
                          <ReferenceArea
                            key={`s4-${i}`}
                            x1={r.x1}
                            x2={r.x2}
                            fill="#6366f1"
                            opacity={0.12}
                          />
                        ))}
                        {ffHelixBands.map((r, i) => (
                          <ReferenceArea
                            key={`ff-${i}`}
                            x1={r.x1}
                            x2={r.x2}
                            fill="#32CD32"
                            opacity={0.12}
                          />
                        ))}
                        <Line type="monotone" dataKey="muH" name="μH" dot={false} />
                        {muHZoom.brushProps && <ReferenceArea {...muHZoom.brushProps} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between">
                    <ChartExportButtons filename={`${peptide.id}-muH-w${win}`} />
                    {muHZoom.zoomHint}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <span
                    className="inline-block w-3 h-3 rounded-sm mr-1"
                    style={{ backgroundColor: "#6366f1", opacity: 0.3 }}
                  />{" "}
                  S4PRED helix segments
                  {ffHelixBands.length > 0 && (
                    <span className="ml-3">
                      <span
                        className="inline-block w-3 h-3 rounded-sm mr-1"
                        style={{ backgroundColor: "#32CD32", opacity: 0.3 }}
                      />{" "}
                      FF-Helix candidate regions
                    </span>
                  )}
                  {peptide.tango?.agg && peptide.tango.agg.length > 0 && (
                    <span className="ml-3">
                      <span
                        className="inline-block w-4 h-0.5 mr-1"
                        style={{
                          backgroundColor: "#D55E00",
                          display: "inline-block",
                          borderTop: "2px dashed #D55E00",
                        }}
                      />{" "}
                      TANGO aggregation
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>Sliding-Window Profiles</CardTitle>
                <CardDescription>
                  Per-residue profiles not available for long sequences.
                </CardDescription>
              </CardHeader>
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
          <S4PredChart peptide={peptide} className="shadow-soft border-[hsl(var(--border))] rounded-xl">
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
              S4PRED: Single Sequence Secondary Structure PREDiction (neural network ensemble).
            </div>
          </S4PredChart>

          {/* TANGO Aggregation Heatmap */}
          {peptide.tango?.agg && peptide.tango.agg.length > 0 && (
            <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
              <CardHeader>
                <CardTitle>TANGO Aggregation Profile</CardTitle>
                <CardDescription>
                  Per-residue aggregation propensity from TANGO. High scores indicate
                  amyloid-forming regions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AggregationHeatmap
                  sequence={peptide.sequence}
                  aggCurve={peptide.tango.agg}
                  betaCurve={peptide.tango.beta}
                  helixCurve={peptide.tango.helix}
                  s4predBetaCurve={peptide.s4pred?.pE}
                  peptideId={peptide.id}
                />
              </CardContent>
            </Card>
          )}

          {/* FF-Helix vs Agg Max: cohort context scatter */}
          {typeof peptide.ffHelixPercent === "number" &&
            typeof peptide.tangoAggMax === "number" &&
            peptides.length > 1 && (
              <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
                <CardHeader>
                  <CardTitle>FF-Helix vs Aggregation Max</CardTitle>
                  <CardDescription>
                    Position of this peptide relative to the cohort. Current peptide highlighted in
                    red.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="FF-Helix %"
                          tickFormatter={(v) => `${v}%`}
                          domain={[0, 100]}
                        />
                        <YAxis type="number" dataKey="y" name="Agg Max" />
                        <Tooltip
                          content={({ payload }) => {
                            const item = payload?.[0]?.payload;
                            if (!item) return null;
                            return (
                              <div className="bg-background border border-border rounded p-2 text-xs">
                                <p className="font-medium">{item.id}</p>
                                <p>FF-Helix: {Number(item.x).toFixed(1)}%</p>
                                <p>Agg Max: {Number(item.y).toFixed(1)}%</p>
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
                </CardContent>
              </Card>
            )}

          {/* AlphaFold Structure Viewer */}
          <AlphaFoldViewer peptideId={peptide.id} />

          {/* Feature tiles */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">
                  {peptide.hydrophobicity !== null ? peptide.hydrophobicity.toFixed(2) : "N/A"}
                </div>
                <div className="text-sm text-muted-foreground">Hydrophobicity</div>
                {stats && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cohort: {stats.meanHydrophobicity.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">
                  {peptide.muH?.toFixed(2) ?? "N/A"}
                </div>
                <div className="text-sm text-muted-foreground">μH</div>
                {stats && stats.meanMuH !== null && stats.meanMuH !== undefined && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cohort: {stats.meanMuH.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">
                  {peptide.charge !== null
                    ? `${peptide.charge > 0 ? "+" : ""}${peptide.charge.toFixed(1)}`
                    : "N/A"}
                </div>
                <div className="text-sm text-muted-foreground">Charge</div>
                {stats && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cohort: {stats.meanCharge > 0 ? "+" : ""}
                    {stats.meanCharge.toFixed(1)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-helix">
                  {typeof peptide.s4predHelixPercent === "number"
                    ? `${peptide.s4predHelixPercent.toFixed(0)}%`
                    : "N/A"}
                </div>
                <div className="text-sm text-muted-foreground">S4PRED Helix</div>
                <div className="text-[10px] text-muted-foreground/60">
                  neural network prediction
                </div>
                {stats &&
                  stats.meanS4predHelixPercent !== null &&
                  stats.meanS4predHelixPercent !== undefined && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Cohort: {stats.meanS4predHelixPercent.toFixed(0)}%
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Consensus Analysis */}
          <ConsensusCard peptide={peptide} />

          <EvidencePanel peptide={peptide} cohortStats={stats} />

          <AppFooter />
        </motion.div>
      </div>
    </div>
  );
}
