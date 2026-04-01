// src/pages/Results.tsx
import { motion } from "framer-motion";
import { Download, ArrowUp, ArrowDown, ChevronDown, FileText, FileDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ProviderBadge } from "@/components/ProviderBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { ResultsKpis } from "@/components/ResultsKpis";
import { ResultsCharts } from "@/components/ResultsCharts";
import { PeptideTable } from "@/components/PeptideTable";
import { Legend } from "@/components/Legend";
import { ThresholdTuner } from "@/components/ThresholdTuner";
import { RankedTable } from "@/components/RankedTable";
import { WeightBar } from "@/components/WeightBar";

import { useDatasetStore } from "@/stores/datasetStore";
import { useRankingStore, rankPeptides } from "@/stores/datasetStore";
import {
  METRIC_LABELS,
  OPTIONAL_METRICS,
  type RankingMetric,
  type RankingPreset,
} from "@/lib/ranking";
import { useThresholdStore } from "@/stores/thresholdStore";
import { BgDotGrid } from "@/components/BgDotGrid";
import { exportShortlistPDF } from "@/lib/report";
import { DEFAULT_THRESHOLDS, type ResolvedThresholds } from "@/lib/thresholds";
import { uploadCSV, predictOne } from "@/lib/api";
import { RotateCcw, FlaskConical, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnimateIn, AnimateInChild } from "@/components/AnimateIn";
import { smoothEase } from "@/lib/animations";

import type { Peptide } from "@/types/peptide";

import { getConsensusSS } from "@/lib/consensus";
import { CorrelationCard } from "@/components/CorrelationCard";
import { PeptidePreviewSheet } from "@/components/PeptidePreviewSheet";
import { BinPeptideDialog } from "@/components/BinPeptideDialog";
import { useChartSelection } from "@/stores/chartSelectionStore";
import AppFooter from "@/components/AppFooter";
import { toast } from "sonner";

// Reproduce button component
function ReproduceButton({
  getLastRun,
  ingestBackendRows,
  setLoading,
  setError,
}: {
  getLastRun: () => { type: "upload" | "predict" | null; input: any; config: any };
  ingestBackendRows: (rows: any[], meta?: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}) {
  const handleReproduce = async () => {
    const { type, input, config } = getLastRun();

    if (!type || !input) {
      toast.error("No previous run to reproduce. Upload or analyze a sequence first.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (type === "upload") {
        // Reproduce upload
        if (!(input instanceof File)) {
          toast.error("Cannot reproduce: file data lost (page was refreshed). Please re-upload.");
          return;
        }
        const { rows, meta } = await uploadCSV(input, config);
        ingestBackendRows(rows, meta);
        toast.success("Run reproduced successfully");
      } else if (type === "predict") {
        // Reproduce predict (single sequence)
        if (typeof input !== "object" || !input.sequence) {
          toast.error("Cannot reproduce: sequence data lost. Please re-analyze.");
          return;
        }
        const result = await predictOne(input.sequence, input.entry, config);
        const rows = [result.row];
        const meta = result.meta || {};
        ingestBackendRows(rows, meta);
        toast.success("Run reproduced successfully");
      }
    } catch (e: any) {
      const errorMsg = e?.message || "Reproduce failed";
      setError(errorMsg);
      toast.error(`Reproduce failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const { type, input } = getLastRun();
  const canReproduce = type !== null;
  const fileLost = type === "upload" && !(input instanceof File);

  const tooltip = !canReproduce
    ? "No previous run available"
    : fileLost
      ? "Re-upload your CSV to re-run (file data is lost after refresh)"
      : "Re-run the same analysis with identical parameters";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReproduce}
      disabled={!canReproduce || fileLost}
      title={tooltip}
    >
      <RotateCcw className="w-4 h-4 mr-2" />
      Re-run
    </Button>
  );
}

export default function Results() {
  const { peptides, stats, meta, getLastRun, ingestBackendRows, setLoading, setError } =
    useDatasetStore();
  const navigate = useNavigate();
  const { activeTab, setActiveTab } = useChartSelection();

  // Ranking store v2
  const {
    activeMetrics,
    weights,
    directions,
    topN,
    preset,
    toggleOptionalMetric,
    setWeights,
    setDirection,
    setTopN,
    applyPreset,
  } = useRankingStore();

  // Threshold store for real-time re-classification
  const {
    active: resolvedThresholds,
    initFromMeta,
    isModified: thresholdsModified,
  } = useThresholdStore();

  const thresholdMode =
    meta?.thresholdConfigResolved?.mode || meta?.thresholdConfigRequested?.mode || "default";

  const legendDefaultOpen = useMemo(() => {
    if (localStorage.getItem("pvl-legend-seen")) return false;
    localStorage.setItem("pvl-legend-seen", "1");
    return true;
  }, []);

  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (meta?.thresholds) {
      initFromMeta(meta.thresholds as ResolvedThresholds);
    }
  }, [meta?.thresholds, initFromMeta]);

  useEffect(() => {
    if (peptides.length === 0) {
      navigate("/upload");
    }
  }, [peptides.length, navigate]);

  if (peptides.length === 0) {
    return null;
  }

  const peptidesTyped: Peptide[] = peptides;

  // -------- Ranking v2 --------
  const tangoAvailable =
    meta?.provider_status?.tango?.status !== "OFF" &&
    meta?.provider_status?.tango?.status !== "UNAVAILABLE";

  const rankings = useMemo(
    () => rankPeptides(peptidesTyped, weights, { tangoAvailable, directions }),
    [peptidesTyped, weights, tangoAvailable, directions]
  );

  const shortlist: Peptide[] = useMemo(() => {
    if (!peptidesTyped?.length) return [];
    const sorted = [...rankings]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, Math.max(1, topN));
    return sorted.map((r) => peptidesTyped.find((p) => p.id === r.peptideId)!).filter(Boolean);
  }, [peptidesTyped, rankings, topN]);

  function exportAllFASTA() {
    if (!peptidesTyped.length) return;
    const lines = peptidesTyped.map((p) => {
      const header = `>${p.id}${p.species ? `|${p.species}` : ""}${p.name ? ` ${p.name}` : ""}`;
      const wrapped = p.sequence.match(/.{1,80}/g)?.join("\n") ?? p.sequence;
      return `${header}\n${wrapped}`;
    });
    const fasta = lines.join("\n") + "\n";
    const blob = new Blob([fasta], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "peptides.fasta";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportShortlistCSV() {
    if (!shortlist.length) return;
    const escapeCSV = (val: unknown): string => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    // Build headers from active metrics + consensus
    const metricHeaders = activeMetrics.map((m) => METRIC_LABELS[m]);
    const headers = [
      "Rank",
      "Entry",
      "Composite Score",
      ...metricHeaders,
      "Consensus Tier",
      "Consensus Label",
      "Sequence",
      "Length",
      "Charge",
      "Hydrophobicity",
      "Full length uH",
      "SSW prediction",
      "SSW score",
      "TANGO Agg Max",
      "FF-Helix %",
      "Helix %",
      "Species",
      "Protein names",
    ];

    const sortedRankings = [...rankings]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, Math.max(1, topN));

    const rows = sortedRankings
      .map((r, i) => {
        const p = peptidesTyped.find((pp) => pp.id === r.peptideId);
        if (!p) return "";
        const consensus = getConsensusSS(p);
        return [
          i + 1,
          p.id,
          r.compositeScore.toFixed(1),
          ...activeMetrics.map((m) => {
            const pct = r.metricPercentiles[m];
            return pct != null ? pct.toFixed(1) : "";
          }),
          `T${consensus.tier}`,
          consensus.label,
          p.sequence,
          p.length,
          p.charge,
          p.hydrophobicity,
          p.muH ?? "",
          p.sswPrediction ?? "",
          p.sswScore ?? "",
          p.tangoAggMax ?? "",
          p.ffHelixPercent ?? "",
          p.s4predHelixPercent ?? "",
          p.species || "",
          p.name || "",
        ]
          .map(escapeCSV)
          .join(",");
      })
      .filter(Boolean);
    const csv = headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shortlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background relative">
      <BgDotGrid />
      <div
        className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-10 relative z-10"
        id="results-root"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: smoothEase }}
          className="space-y-8"
        >
          {/* ── Header ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-h1 text-foreground page-header-title">Analysis Results</h1>
              <p className="text-body text-muted-foreground mt-1">
                {peptidesTyped.length} peptide{peptidesTyped.length !== 1 ? "s" : ""} analyzed
                {meta?.source === "uniprot_api" && meta?.query && (
                  <>
                    {" "}
                    &middot; UniProt: &ldquo;<em>{meta.query}</em>&rdquo;
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Provider status — compact pills */}
              {meta && (
                <div className="flex items-center gap-1.5 mr-2">
                  {meta.provider_status?.tango ? (
                    <ProviderBadge name="TANGO" status={meta.provider_status.tango as any} />
                  ) : (
                    <Badge variant="outline" className="text-xs font-normal">
                      TANGO: {meta.use_tango ? "ON" : "OFF"}
                    </Badge>
                  )}
                  {meta.provider_status?.s4pred ? (
                    <ProviderBadge name="S4PRED" status={meta.provider_status.s4pred as any} />
                  ) : (
                    <Badge variant="outline" className="text-xs font-normal">
                      S4PRED: OFF
                    </Badge>
                  )}
                  {thresholdsModified && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                    >
                      Custom Thresholds
                    </Badge>
                  )}
                </div>
              )}

              <Legend defaultOpen={legendDefaultOpen} />

              <Link to="/quick">
                <Button variant="outline" size="sm" className="h-9 text-small btn-press">
                  <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                  Single Sequence
                </Button>
              </Link>

              <ReproduceButton
                getLastRun={getLastRun}
                ingestBackendRows={ingestBackendRows}
                setLoading={setLoading}
                setError={setError}
              />

              {/* Export dropdown — groups FASTA + PDF */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-small btn-press">
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export
                    <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportAllFASTA}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export FASTA
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      exportShortlistPDF(
                        peptidesTyped,
                        stats!,
                        meta,
                        weights,
                        topN,
                        resolvedThresholds,
                        activeMetrics,
                        directions
                      )
                    }
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Run Quality Banners */}
          {(() => {
            const banners: {
              key: string;
              icon: React.ReactNode;
              borderClass: string;
              message: string;
            }[] = [];
            const tangoStatus = meta?.provider_status?.tango?.status;
            const tangoStats = meta?.provider_status?.tango?.stats;
            const s4predStatus = meta?.provider_status?.s4pred?.status;
            const s4predStats = meta?.provider_status?.s4pred?.stats;

            if (tangoStatus === "PARTIAL" && !dismissedBanners.has("tango")) {
              banners.push({
                key: "tango",
                icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
                borderClass: "border-l-4 border-l-amber-400",
                message: `TANGO ran partially — ${tangoStats?.parsed_ok ?? "?"} of ${tangoStats?.requested ?? "?"} peptides have aggregation data.`,
              });
            }
            if (tangoStatus === "UNAVAILABLE" && !dismissedBanners.has("tango")) {
              banners.push({
                key: "tango",
                icon: <XCircle className="h-4 w-4 text-red-600" />,
                borderClass: "border-l-4 border-l-red-400",
                message: "TANGO unavailable — SSW and aggregation data not available for this run.",
              });
            }
            if (s4predStatus === "PARTIAL" && !dismissedBanners.has("s4pred")) {
              banners.push({
                key: "s4pred",
                icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
                borderClass: "border-l-4 border-l-amber-400",
                message: `S4PRED ran partially — ${s4predStats?.parsed_ok ?? "?"} of ${s4predStats?.requested ?? "?"} peptides have structure predictions.`,
              });
            }
            if (s4predStatus === "UNAVAILABLE" && !dismissedBanners.has("s4pred")) {
              banners.push({
                key: "s4pred",
                icon: <Info className="h-4 w-4 text-blue-600" />,
                borderClass: "border-l-4 border-l-blue-400",
                message:
                  "S4PRED not enabled — helix and SSW predictions require S4PRED to be configured.",
              });
            }

            // ISSUE-024: Sequence modification notes
            const modifiedCount = peptidesTyped.filter((p) => p.sequenceNotes).length;
            if (modifiedCount > 0 && !dismissedBanners.has("seq-notes")) {
              banners.push({
                key: "seq-notes",
                icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
                borderClass: "border-l-4 border-l-amber-400",
                message: `${modifiedCount} peptide${modifiedCount !== 1 ? "s" : ""} had non-standard residues that were substituted before analysis. Look for ⚠ icons in the ID column.`,
              });
            }

            if (banners.length === 0) return null;
            return (
              <div className="space-y-2">
                {banners.map((b) => (
                  <Alert key={b.key} className={b.borderClass}>
                    {b.icon}
                    <AlertDescription className="flex items-center justify-between">
                      <span className="text-sm">{b.message}</span>
                      <button
                        onClick={() => setDismissedBanners((prev) => new Set([...prev, b.key]))}
                        className="ml-4 text-muted-foreground hover:text-foreground"
                        aria-label="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            );
          })()}

          {/* UniProt source banner */}
          {meta?.source === "uniprot_api" && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-[hsl(var(--surface-1))] rounded-xl px-4 sm:px-5 py-3 text-small border border-[hsl(var(--border))]">
              <span className="text-muted-foreground">
                Showing <strong className="text-foreground">{meta.size_returned}</strong>
                {meta.total_available != null &&
                  meta.total_available > 0 &&
                  ` of ${meta.total_available.toLocaleString()}`}
                {meta.query && (
                  <>
                    {" "}
                    entries matching &ldquo;<em className="text-foreground">{meta.query}</em>&rdquo;
                  </>
                )}
              </span>
              {meta.url && (
                <a
                  href={meta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-small font-medium"
                >
                  View on UniProt &rarr;
                </a>
              )}
            </div>
          )}

          {/* KPIs */}
          <ResultsKpis stats={stats} meta={meta} />

          {/* Main Content Tabs — Data Table first (researcher workflow) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-11 bg-[hsl(var(--surface-1))] border border-[hsl(var(--border))] rounded-xl p-1">
              <TabsTrigger
                value="data"
                className="rounded-lg text-small font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Data Table
              </TabsTrigger>
              <TabsTrigger
                value="ranking"
                className="rounded-lg text-small font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <span className="hidden sm:inline">Candidate </span>Ranking
              </TabsTrigger>
              <TabsTrigger
                value="charts"
                className="rounded-lg text-small font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <span className="hidden sm:inline">Charts & </span>Analysis
              </TabsTrigger>
            </TabsList>

            {/* Data Table — default view */}
            <TabsContent value="data" className="space-y-6">
              <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-h3">Peptide Dataset</CardTitle>
                  <CardDescription className="text-small">
                    Interactive table with search, column filters, sorting, and export
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PeptideTable peptides={peptidesTyped} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Candidate Ranking */}
            <TabsContent value="ranking" className="space-y-6">
              <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-h3">Smart Candidate Ranking</CardTitle>
                  <CardDescription className="text-small">
                    Proportional percentile-based scoring (0-100). Adjust metric weights,
                    directions, and presets to shortlist top candidates.
                    {peptidesTyped.length <= 1 && (
                      <span className="block mt-1 text-amber-600">
                        Cohort ranking requires 2+ peptides.
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Row 1: Preset buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium mr-1">Presets:</span>
                    {(["equal", "amyloid", "switch"] as RankingPreset[]).map((p) => (
                      <Button
                        key={p}
                        variant={preset === p ? "default" : "outline"}
                        size="sm"
                        onClick={() => applyPreset(p)}
                      >
                        {p === "equal"
                          ? "Equal"
                          : p === "amyloid"
                            ? "Amyloid Focus"
                            : "Switch Focus"}
                      </Button>
                    ))}
                    {preset === "custom" && (
                      <Badge variant="secondary" className="text-xs">
                        Custom
                      </Badge>
                    )}
                  </div>

                  {/* Row 2: Direction toggles */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-medium text-muted-foreground">Direction:</span>
                    {/* S4PRED direction (prominent) */}
                    <div className="flex items-center gap-1 border rounded-md p-1">
                      <span className="text-xs font-medium px-1">Helix</span>
                      <Button
                        variant={directions.s4predHelixPercent === "high" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDirection("s4predHelixPercent", "high")}
                      >
                        <ArrowUp className="w-3 h-3 mr-1" />
                        Helix-Rich
                      </Button>
                      <Button
                        variant={directions.s4predHelixPercent === "low" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDirection("s4predHelixPercent", "low")}
                      >
                        <ArrowDown className="w-3 h-3 mr-1" />
                        Disordered
                      </Button>
                    </div>
                    {/* TANGO direction (smaller) */}
                    <div className="flex items-center gap-1 border rounded-md p-1">
                      <span className="text-xs font-medium px-1">TANGO</span>
                      <Button
                        variant={directions.tangoAggMax === "high" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDirection("tangoAggMax", "high")}
                        disabled={!tangoAvailable}
                      >
                        <ArrowUp className="w-3 h-3 mr-1" />
                        High
                      </Button>
                      <Button
                        variant={directions.tangoAggMax === "low" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDirection("tangoAggMax", "low")}
                        disabled={!tangoAvailable}
                      >
                        <ArrowDown className="w-3 h-3 mr-1" />
                        Low
                      </Button>
                    </div>
                  </div>

                  {/* Row 3: Optional metric toggles */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-muted-foreground">Add metrics:</span>
                    {OPTIONAL_METRICS.map((m) => {
                      const isActive = activeMetrics.includes(m);
                      return (
                        <Button
                          key={m}
                          variant={isActive ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => toggleOptionalMetric(m)}
                        >
                          {isActive ? "−" : "+"} {METRIC_LABELS[m]}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Row 4: Proportional Weight Bar */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Metric Weights (drag handles to adjust)
                    </h4>
                    <WeightBar
                      weights={weights}
                      activeMetrics={activeMetrics}
                      onChange={setWeights}
                      disabled={peptidesTyped.length <= 1}
                    />
                  </div>

                  {/* Row 5: Top N + Export */}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Top N</span>
                      <Input
                        type="number"
                        className="w-20"
                        value={topN}
                        min={1}
                        onChange={(e) => setTopN(Math.max(1, Number(e.target.value) || 10))}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={exportShortlistCSV}>
                      <Download className="w-4 h-4 mr-2" />
                      Export shortlist.csv
                    </Button>
                  </div>

                  {/* Ranked Table */}
                  <div className="mt-2">
                    <h3 className="text-base font-semibold mb-3">
                      Top {Math.min(topN, peptidesTyped.length)} Candidates
                    </h3>
                    <RankedTable
                      peptides={peptidesTyped}
                      rankings={rankings}
                      topN={topN}
                      activeMetrics={activeMetrics}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Threshold Controls (interactive re-classification) */}
              <ThresholdTuner peptides={peptidesTyped} />

              {/* FF-Helix explanation */}
              <Alert variant="default" className="border-primary/20 bg-primary/5 rounded-xl">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-small text-muted-foreground">
                  <strong className="text-foreground">FF-Helix %</strong> measures intrinsic amino
                  acid helix propensity using a sliding window (Fauchere-Pliska scale). It is{" "}
                  <strong className="text-foreground">not</strong> a prediction of actual helical
                  content. Values of 0% or 100% are expected for many peptides. Do not compare to CD
                  spectroscopy measurements. See the{" "}
                  <Link to="/help" className="underline text-purple-600 hover:text-purple-800">
                    Help page
                  </Link>{" "}
                  for details.
                </AlertDescription>
              </Alert>
            </TabsContent>

            {/* Charts & Analysis */}
            <TabsContent value="charts" className="space-y-6">
              <ResultsCharts
                peptides={peptidesTyped}
                providerStatus={meta?.provider_status}
                thresholds={resolvedThresholds}
              />
              <CorrelationCard peptides={peptidesTyped} />
            </TabsContent>
          </Tabs>

          <AppFooter />
        </motion.div>
      </div>

      {/* Quick-preview sheet (from chart selection) */}
      <PeptidePreviewSheet />
      {/* Histogram bin click dialog */}
      <BinPeptideDialog peptides={peptidesTyped} />
    </div>
  );
}
