// src/pages/Results.tsx
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ProviderBadge } from "@/components/ProviderBadge";
import { Slider } from "@/components/ui/slider";

import { ResultsKpis } from "@/components/ResultsKpis";
import { ResultsCharts } from "@/components/ResultsCharts";
import { PeptideTable } from "@/components/PeptideTable";
import { Legend } from "@/components/Legend";
import { ThresholdTuner } from "@/components/ThresholdTuner";
import { RankedTable } from "@/components/RankedTable";

import { useDatasetStore } from "@/stores/datasetStore";
import { useRankingStore, rankPeptides } from "@/stores/datasetStore";
import {
  METRIC_LABELS,
  METRIC_CATEGORIES,
  CATEGORY_LABELS,
  type RankingMetric,
  type RankingCategory,
  type RankingPreset,
} from "@/lib/ranking";
import { useThresholdStore } from "@/stores/thresholdStore";
import { exportShortlistPDF } from "@/lib/report";
import { DEFAULT_THRESHOLDS, type ResolvedThresholds } from "@/lib/thresholds";
import { uploadCSV, predictOne } from "@/lib/api";
import { RotateCcw, FlaskConical, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import type { Peptide } from "@/types/peptide";
// mapApiRowsToPeptides removed - peptides from store are already mapped

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
        // For predict, we convert single result to array format for consistency
        // result is PredictResponse: {row, meta}
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
  // Check if file-based run lost its File object (non-serializable, lost after refresh)
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

  // Percentile ranking
  const { weights, topN, preset, setWeight, setTopN, applyPreset } = useRankingStore();

  // Threshold store for real-time re-classification
  const {
    active: resolvedThresholds,
    initFromMeta,
    isModified: thresholdsModified,
  } = useThresholdStore();

  // threshold mode from meta (for display)
  const thresholdMode =
    meta?.thresholdConfigResolved?.mode || meta?.thresholdConfigRequested?.mode || "default";

  // Auto-show legend for first-time visitors
  const legendDefaultOpen = useMemo(() => {
    if (localStorage.getItem("pvl-legend-seen")) return false;
    localStorage.setItem("pvl-legend-seen", "1");
    return true;
  }, []);

  // Dismissible run quality banner (session only)
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());

  // Initialize threshold store from server meta.thresholds
  useEffect(() => {
    if (meta?.thresholds) {
      initFromMeta(meta.thresholds as ResolvedThresholds);
    }
  }, [meta?.thresholds, initFromMeta]);

  useEffect(() => {
    // Redirect to upload if no data
    if (peptides.length === 0) {
      navigate("/upload");
    }
  }, [peptides.length, navigate]);

  if (peptides.length === 0) {
    return null; // Will redirect
  }

  // peptides from store is already Peptide[] (mapped by ingestBackendRows)
  // No re-mapping needed - use directly
  const peptidesTyped: Peptide[] = peptides;

  // -------- Percentile-based Candidate Ranking --------
  const tangoAvailable =
    meta?.provider_status?.tango?.status !== "OFF" &&
    meta?.provider_status?.tango?.status !== "UNAVAILABLE";

  const rankings = useMemo(
    () => rankPeptides(peptidesTyped, weights, { tangoAvailable }),
    [peptidesTyped, weights, tangoAvailable]
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
    const fmtFragments = (frags: any): string => {
      if (!Array.isArray(frags) || frags.length === 0) return "";
      return frags
        .map((f: any) => {
          if (Array.isArray(f)) return `${f[0]}-${f[1]}`;
          if (f && typeof f === "object" && "start" in f) return `${f.start}-${f.end}`;
          return String(f);
        })
        .join(";");
    };
    const headers = [
      "Rank",
      "Entry",
      "Composite Score",
      "Physicochemical",
      "Structural",
      "Agg & Switch",
      "Sequence",
      "Length",
      "Charge",
      "Hydrophobicity",
      "Full length uH",
      "SSW prediction",
      "SSW score",
      "TANGO Agg Max",
      "FF-Helix %",
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
        return [
          i + 1,
          p.id,
          r.compositeScore.toFixed(1),
          r.categoryScores.physicochemical?.toFixed(1) ?? "",
          r.categoryScores.structural?.toFixed(1) ?? "",
          r.categoryScores.aggregation?.toFixed(1) ?? "",
          p.sequence,
          p.length,
          p.charge,
          p.hydrophobicity,
          p.muH ?? "",
          p.sswPrediction ?? "",
          p.sswScore ?? "",
          p.tangoAggMax ?? "",
          p.ffHelixPercent ?? "",
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
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8" id="results-root">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Analysis Results</h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive peptide analysis and visualizations
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {meta && (
                <div className="flex gap-2">
                  {meta.provider_status?.tango ? (
                    <ProviderBadge name="TANGO" status={meta.provider_status.tango as any} />
                  ) : (
                    <Badge variant="outline">TANGO: {meta.use_tango ? "ENABLED" : "OFF"}</Badge>
                  )}
                  {meta.provider_status?.s4pred ? (
                    <ProviderBadge name="S4PRED" status={meta.provider_status.s4pred as any} />
                  ) : (
                    <Badge variant="outline">S4PRED: OFF</Badge>
                  )}
                  <Badge variant="secondary">n = {peptidesTyped.length}</Badge>
                  {meta?.thresholds && (
                    <Badge variant="outline" className="text-xs">
                      Using{" "}
                      {thresholdMode === "default"
                        ? "default"
                        : thresholdMode === "recommended"
                          ? "recommended"
                          : "custom"}{" "}
                      thresholds
                    </Badge>
                  )}
                  {thresholdsModified && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-amber-100 text-amber-800 border-amber-300"
                    >
                      Custom Thresholds Active
                    </Badge>
                  )}
                </div>
              )}

              <Legend defaultOpen={legendDefaultOpen} />
              <Link to="/quick">
                <Button variant="outline" size="sm">
                  <FlaskConical className="w-4 h-4 mr-2" />
                  Single Sequence
                </Button>
              </Link>
              <ReproduceButton
                getLastRun={getLastRun}
                ingestBackendRows={ingestBackendRows}
                setLoading={setLoading}
                setError={setError}
              />
              <Button variant="outline" size="sm" onClick={exportAllFASTA}>
                <Download className="w-4 h-4 mr-2" />
                FASTA
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportShortlistPDF(peptidesTyped, stats!, meta, weights, topN, resolvedThresholds)
                }
              >
                <Download className="w-4 h-4 mr-2" />
                PDF Report
              </Button>
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
                icon: <XCircle className="h-4 w-4 text-red-600" />,
                borderClass: "border-l-4 border-l-red-400",
                message:
                  "S4PRED unavailable — secondary structure predictions not available for this run.",
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

          {/* KPIs */}
          <ResultsKpis stats={stats} meta={meta} />

          {/* Main Content Tabs — Data Table first (researcher workflow) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="data">Data Table</TabsTrigger>
              <TabsTrigger value="ranking">Candidate Ranking</TabsTrigger>
              <TabsTrigger value="charts">Charts & Analysis</TabsTrigger>
            </TabsList>

            {/* Data Table — default view */}
            <TabsContent value="data" className="space-y-6">
              <Card className="shadow-medium">
                <CardHeader>
                  <CardTitle>Peptide Dataset</CardTitle>
                  <CardDescription>
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
              <Card className="shadow-medium">
                <CardHeader>
                  <CardTitle>Smart Candidate Ranking</CardTitle>
                  <CardDescription>
                    Percentile-based scoring (0-100). Tune metric weights and presets to shortlist
                    top candidates.
                    {peptidesTyped.length <= 1 && (
                      <span className="block mt-1 text-amber-600">
                        Cohort ranking requires 2+ peptides.
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Preset buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium mr-1">Presets:</span>
                    {(["equal", "physicochemical", "aggregation"] as RankingPreset[]).map((p) => (
                      <Button
                        key={p}
                        variant={preset === p ? "default" : "outline"}
                        size="sm"
                        onClick={() => applyPreset(p)}
                      >
                        {p === "equal"
                          ? "Equal"
                          : p === "physicochemical"
                            ? "Physicochemical"
                            : "Aggregation"}
                      </Button>
                    ))}
                    {preset === "custom" && (
                      <Badge variant="secondary" className="text-xs">
                        Custom
                      </Badge>
                    )}
                  </div>

                  {/* Grouped sliders by category */}
                  <div className="space-y-5">
                    {(["physicochemical", "structural", "aggregation"] as RankingCategory[]).map(
                      (cat) => {
                        const metricsInCat = (
                          Object.entries(METRIC_CATEGORIES) as [RankingMetric, RankingCategory][]
                        )
                          .filter(([, c]) => c === cat)
                          .map(([m]) => m);
                        const isTangoCategory = cat === "aggregation";

                        return (
                          <div key={cat}>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">
                              {CATEGORY_LABELS[cat]}
                            </h4>
                            <div
                              className={`grid gap-4 ${metricsInCat.length === 1 ? "grid-cols-1 max-w-xs" : "md:grid-cols-2 lg:grid-cols-3"}`}
                            >
                              {metricsInCat.map((metric) => {
                                const disabled = isTangoCategory && !tangoAvailable;
                                return (
                                  <div key={metric} className={disabled ? "opacity-40" : ""}>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span>{METRIC_LABELS[metric]}</span>
                                      <span className="text-muted-foreground font-mono text-xs">
                                        {weights[metric].toFixed(1)}
                                      </span>
                                    </div>
                                    <Slider
                                      min={0}
                                      max={1}
                                      step={0.05}
                                      value={[weights[metric]]}
                                      onValueChange={([v]) => setWeight(metric, v)}
                                      disabled={disabled}
                                    />
                                    {disabled && (
                                      <span className="text-xs text-muted-foreground">
                                        TANGO OFF
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* Top N + Export */}
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
                    <RankedTable peptides={peptidesTyped} rankings={rankings} topN={topN} />
                  </div>
                </CardContent>
              </Card>

              {/* Threshold Controls (interactive re-classification) */}
              <ThresholdTuner peptides={peptidesTyped} />

              {/* FF-Helix explanation */}
              <Alert
                variant="default"
                className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20"
              >
                <Info className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-sm text-muted-foreground">
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
