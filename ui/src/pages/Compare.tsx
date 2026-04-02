import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { Upload, ArrowRight, Info } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDatasetStore } from "@/stores/datasetStore";
import { uploadCSV } from "@/lib/api";
import { mapApiRowToPeptide } from "@/lib/peptideMapper";
import type { Peptide, DatasetStats } from "@/types/peptide";
import { BgDotGrid } from "@/components/BgDotGrid";

// Colors for the two cohorts
const COHORT_A_COLOR = "hsl(210, 80%, 55%)"; // blue
const COHORT_B_COLOR = "hsl(25, 85%, 55%)"; // orange

function computeStats(peptides: Peptide[]): DatasetStats {
  const n = peptides.length;
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

  const hVals = peptides
    .map((p) => p.hydrophobicity)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const cVals = peptides
    .map((p) => Math.abs(p.charge ?? 0))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const muHVals = peptides
    .map((p) => p.muH)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const ffVals = peptides
    .map((p) => p.ffHelixPercent)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const s4Vals = peptides
    .map((p) => p.s4predHelixPercent)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const lenVals = peptides
    .map((p) => p.length)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const sswPos = peptides.filter((p) => p.sswPrediction === 1).length;
  const sswTotal = peptides.filter(
    (p) => p.sswPrediction !== null && p.sswPrediction !== undefined
  ).length;

  return {
    totalPeptides: n,
    sswPositivePercent: sswTotal > 0 ? (sswPos / sswTotal) * 100 : null,
    meanHydrophobicity: hVals.length > 0 ? mean(hVals) : 0,
    meanCharge: cVals.length > 0 ? mean(cVals) : 0,
    meanMuH: muHVals.length > 0 ? mean(muHVals) : null,
    meanFFHelixPercent: ffVals.length > 0 ? mean(ffVals) : null,
    meanS4predHelixPercent: s4Vals.length > 0 ? mean(s4Vals) : null,
    meanLength: lenVals.length > 0 ? mean(lenVals) : 0,
  };
}

function fmt(v: number | null | undefined, d = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "N/A";
  return v.toFixed(d);
}

function deltaStr(a: number | null | undefined, b: number | null | undefined): string {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return "-";
  const diff = b - a;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}`;
}

function deltaColor(a: number | null | undefined, b: number | null | undefined): string {
  if (a == null || b == null) return "text-muted-foreground";
  const diff = b - a;
  if (Math.abs(diff) < 0.01) return "text-muted-foreground";
  return diff > 0 ? "text-green-600" : "text-red-500";
}

/** Build overlay histogram data for two cohorts */
function buildHistogram(
  valsA: number[],
  valsB: number[],
  bins = 10
): { range: string; A: number; B: number }[] {
  const all = [...valsA, ...valsB];
  if (all.length === 0) return [];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1e-6, max - min);
  const binSize = span / bins;

  return Array.from({ length: bins }, (_, i) => {
    const lo = min + i * binSize;
    const hi = lo + binSize;
    const isLast = i === bins - 1;
    return {
      range: `${lo.toFixed(2)}`,
      A: valsA.filter((v) => (isLast ? v >= lo && v <= hi : v >= lo && v < hi)).length,
      B: valsB.filter((v) => (isLast ? v >= lo && v <= hi : v >= lo && v < hi)).length,
    };
  });
}

export default function Compare() {
  const { peptides } = useDatasetStore();
  const navigate = useNavigate();

  const [cohortB, setCohortB] = useState<Peptide[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bFilename, setBFilename] = useState<string>("");

  const cohortA = peptides;

  const processFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setBFilename(file.name);

    try {
      const response = await uploadCSV(file);
      const rows = response.rows || response.data || [];
      const mapped = rows
        .map((r: any, idx: number) => {
          try {
            return mapApiRowToPeptide(r, `compare[${idx}]`);
          } catch {
            return null;
          }
        })
        .filter((p: any): p is Peptide => p !== null);

      if (mapped.length === 0) {
        setError("No valid peptides found in comparison file.");
      } else {
        setCohortB(mapped);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process comparison file.");
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) processFile(accepted[0]);
    },
    accept: {
      "text/csv": [".csv", ".tsv", ".txt"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/octet-stream": [".fasta", ".fa"],
    },
    multiple: false,
    disabled: uploading,
  });

  // Dual upload mode: allow uploading Cohort A directly from Compare page
  const [cohortALocal, setCohortALocal] = useState<Peptide[] | null>(null);
  const [uploadingA, setUploadingA] = useState(false);
  const [aFilename, setAFilename] = useState<string>("");

  const processFileA = useCallback(async (file: File) => {
    setUploadingA(true);
    setError(null);
    setAFilename(file.name);
    try {
      const response = await uploadCSV(file);
      const rows = response.rows || response.data || [];
      const mapped = rows
        .map((r: any, idx: number) => {
          try {
            return mapApiRowToPeptide(r, `cohortA[${idx}]`);
          } catch {
            return null;
          }
        })
        .filter((p: any): p is Peptide => p !== null);
      if (mapped.length === 0) {
        setError("No valid peptides in Cohort A file.");
      } else {
        setCohortALocal(mapped);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process Cohort A file.");
    } finally {
      setUploadingA(false);
    }
  }, []);

  const dropzoneA = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) processFileA(accepted[0]);
    },
    accept: {
      "text/csv": [".csv", ".tsv", ".txt"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/octet-stream": [".fasta", ".fa"],
    },
    multiple: false,
    disabled: uploadingA,
  });

  // Use local Cohort A if uploaded here, otherwise fall back to dataset store
  const effectiveCohortA = cohortALocal ?? cohortA;

  // Stats
  const statsA = useMemo(() => computeStats(effectiveCohortA), [effectiveCohortA]);
  const statsB = useMemo(() => (cohortB ? computeStats(cohortB) : null), [cohortB]);

  // Histogram data (use effectiveCohortA for dual-upload support)
  const hydroHistA = useMemo(
    () =>
      effectiveCohortA
        .map((p) => p.hydrophobicity)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
    [effectiveCohortA]
  );
  const hydroHistB = useMemo(
    () =>
      (cohortB ?? [])
        .map((p) => p.hydrophobicity)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
    [cohortB]
  );
  const hydroHist = useMemo(() => buildHistogram(hydroHistA, hydroHistB), [hydroHistA, hydroHistB]);

  const lenHistA = useMemo(
    () =>
      effectiveCohortA
        .map((p) => p.length)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
    [effectiveCohortA]
  );
  const lenHistB = useMemo(
    () =>
      (cohortB ?? [])
        .map((p) => p.length)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
    [cohortB]
  );
  const lenHist = useMemo(() => buildHistogram(lenHistA, lenHistB), [lenHistA, lenHistB]);

  // Scatter data (H vs μH) for both cohorts
  const scatterA = useMemo(
    () =>
      effectiveCohortA
        .filter((p) => typeof p.muH === "number" && Number.isFinite(p.muH))
        .map((p) => ({ h: p.hydrophobicity, muH: p.muH as number })),
    [effectiveCohortA]
  );
  const scatterB = useMemo(
    () =>
      (cohortB ?? [])
        .filter((p) => typeof p.muH === "number" && Number.isFinite(p.muH))
        .map((p) => ({ h: p.hydrophobicity, muH: p.muH as number })),
    [cohortB]
  );

  // Show dual upload mode if no primary dataset and no local Cohort A
  if (effectiveCohortA.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 relative">
        <BgDotGrid opacity={0.02} />
        <div>
          <h1 className="text-h1 text-foreground page-header-title">Cohort Comparison</h1>
          <p className="text-body text-muted-foreground mt-1">
            Compare two datasets side by side. Upload both cohorts below.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Cohort A upload */}
          <Card
            {...dropzoneA.getRootProps()}
            className={`cursor-pointer border-2 border-dashed rounded-xl transition-all ${
              dropzoneA.isDragActive
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-blue-300/50 hover:border-blue-400"
            }`}
          >
            <input {...dropzoneA.getInputProps()} />
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <p className="font-medium text-sm">Cohort A</p>
              <p className="text-xs text-muted-foreground mt-1">Drop file or click to browse</p>
            </CardContent>
          </Card>
          {/* Cohort B upload */}
          <Card
            {...getRootProps()}
            className={`cursor-pointer border-2 border-dashed rounded-xl transition-all ${
              isDragActive
                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                : "border-orange-300/50 hover:border-orange-400"
            }`}
          >
            <input {...getInputProps()} />
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                <Upload className="w-5 h-5 text-orange-600" />
              </div>
              <p className="font-medium text-sm">Cohort B</p>
              <p className="text-xs text-muted-foreground mt-1">Drop file or click to browse</p>
            </CardContent>
          </Card>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="text-center text-sm text-muted-foreground">
          Or{" "}
          <button onClick={() => navigate("/upload")} className="text-primary hover:underline">
            upload a primary dataset first
          </button>
          , then return here.
        </div>
      </div>
    );
  }

  const metrics = [
    {
      label: "Total Peptides",
      a: String(statsA.totalPeptides),
      b: statsB ? String(statsB.totalPeptides) : "-",
      delta: null,
    },
    {
      label: "TANGO SSW %",
      a: fmt(statsA.sswPositivePercent, 1),
      b: fmt(statsB?.sswPositivePercent, 1),
      delta: deltaStr(statsA.sswPositivePercent, statsB?.sswPositivePercent),
      deltaCls: deltaColor(statsA.sswPositivePercent, statsB?.sswPositivePercent),
    },
    {
      label: "Mean H",
      a: fmt(statsA.meanHydrophobicity),
      b: fmt(statsB?.meanHydrophobicity),
      delta: deltaStr(statsA.meanHydrophobicity, statsB?.meanHydrophobicity),
      deltaCls: deltaColor(statsA.meanHydrophobicity, statsB?.meanHydrophobicity),
    },
    {
      label: "Mean |Charge|",
      a: fmt(statsA.meanCharge),
      b: fmt(statsB?.meanCharge),
      delta: deltaStr(statsA.meanCharge, statsB?.meanCharge),
      deltaCls: deltaColor(statsA.meanCharge, statsB?.meanCharge),
    },
    {
      label: "Mean μH",
      a: fmt(statsA.meanMuH),
      b: fmt(statsB?.meanMuH),
      delta: deltaStr(statsA.meanMuH, statsB?.meanMuH),
      deltaCls: deltaColor(statsA.meanMuH, statsB?.meanMuH),
    },
    {
      label: "Mean S4PRED Helix %",
      a: fmt(statsA.meanS4predHelixPercent, 1),
      b: fmt(statsB?.meanS4predHelixPercent, 1),
      delta: deltaStr(statsA.meanS4predHelixPercent, statsB?.meanS4predHelixPercent),
      deltaCls: deltaColor(statsA.meanS4predHelixPercent, statsB?.meanS4predHelixPercent),
    },
    {
      label: "Mean Length",
      a: fmt(statsA.meanLength, 1),
      b: fmt(statsB?.meanLength, 1),
      delta: deltaStr(statsA.meanLength, statsB?.meanLength),
      deltaCls: deltaColor(statsA.meanLength, statsB?.meanLength),
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-8 sm:py-10 max-w-[1400px] mx-auto space-y-8 relative">
      <BgDotGrid />
      {/* Header */}
      <div>
        <h1 className="text-h1 text-foreground page-header-title">Cohort Comparison</h1>
        <p className="text-body text-muted-foreground mt-1 page-header-title">
          Compare your current dataset (Cohort A) against a second dataset (Cohort B).
        </p>
      </div>

      {/* Upload comparison dataset (drag & drop) */}
      {!cohortB && (
        <Card
          {...getRootProps()}
          className={`border-2 border-dashed cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input {...getInputProps()} />
          <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
            <Upload
              className={`h-10 w-10 ${isDragActive ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="text-center space-y-1">
              <p className="font-medium">
                {uploading
                  ? "Processing..."
                  : isDragActive
                    ? "Drop your file here"
                    : "Upload Comparison Dataset"}
              </p>
              <p className="text-sm text-muted-foreground">
                Drag & drop a CSV file, or click to browse. Same format as your primary dataset.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Cohort labels */}
      {cohortB && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COHORT_A_COLOR }} />
            <span className="font-medium">Cohort A</span>
            <span className="text-muted-foreground">
              ({statsA.totalPeptides} peptides — current dataset)
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COHORT_B_COLOR }} />
            <span className="font-medium">Cohort B</span>
            <span className="text-muted-foreground">
              ({statsB?.totalPeptides} peptides — {bFilename})
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCohortB(null);
              setError(null);
            }}
          >
            Change
          </Button>
        </div>
      )}

      {/* Cohort size imbalance warning */}
      {cohortB &&
        statsB &&
        (() => {
          const a = statsA.totalPeptides;
          const b = statsB.totalPeptides;
          const maxN = Math.max(a, b);
          const minN = Math.min(a, b);
          const pctDiff = maxN > 0 ? Math.round(((maxN - minN) / maxN) * 100) : 0;
          if (pctDiff <= 20) return null;
          return (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Cohort A (N={a}) and Cohort B (N={b}) differ in size by {pctDiff}%. Statistical
                comparisons may be skewed by unequal sample sizes.
              </AlertDescription>
            </Alert>
          );
        })()}

      {/* Comparison table */}
      {cohortB && (
        <>
          {/* KPI delta table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary Comparison</CardTitle>
              <CardDescription>Side-by-side statistics with deltas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Metric</th>
                      <th
                        className="text-right py-2 px-4 font-medium"
                        style={{ color: COHORT_A_COLOR }}
                      >
                        Cohort A
                      </th>
                      <th
                        className="text-right py-2 px-4 font-medium"
                        style={{ color: COHORT_B_COLOR }}
                      >
                        Cohort B
                      </th>
                      <th className="text-right py-2 pl-4 font-medium">Delta (B−A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((row) => (
                      <tr key={row.label} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-muted-foreground">{row.label}</td>
                        <td className="text-right py-2 px-4 font-mono">{row.a}</td>
                        <td className="text-right py-2 px-4 font-mono">{row.b}</td>
                        <td
                          className={`text-right py-2 pl-4 font-mono ${row.deltaCls || "text-muted-foreground"}`}
                        >
                          {row.delta ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Hydrophobicity overlay */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hydrophobicity Distribution</CardTitle>
                <CardDescription>Overlay histogram</CardDescription>
              </CardHeader>
              <CardContent>
                {hydroHist.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={hydroHist} barGap={0}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="A" name="Cohort A" fill={COHORT_A_COLOR} opacity={0.7} />
                      <Bar dataKey="B" name="Cohort B" fill={COHORT_B_COLOR} opacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Length overlay */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sequence Length Distribution</CardTitle>
                <CardDescription>Overlay histogram</CardDescription>
              </CardHeader>
              <CardContent>
                {lenHist.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={lenHist} barGap={0}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="A" name="Cohort A" fill={COHORT_A_COLOR} opacity={0.7} />
                      <Bar dataKey="B" name="Cohort B" fill={COHORT_B_COLOR} opacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            {/* H vs μH scatter overlay */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div>
                    <CardTitle className="text-base">Hydrophobicity vs μH Scatter</CardTitle>
                    <CardDescription>Overlay of both cohorts</CardDescription>
                  </div>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {scatterA.length > 0 || scatterB.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="h"
                        name="Hydrophobicity"
                        tickFormatter={(v: number) => v.toFixed(2)}
                        label={{
                          value: "Hydrophobicity",
                          position: "insideBottom",
                          offset: -10,
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="muH"
                        name="μH"
                        tickFormatter={(v: number) => v.toFixed(2)}
                        label={{ value: "μH", angle: -90, position: "insideLeft", fontSize: 11 }}
                      />
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload?.length) return null;
                          const d = payload[0]?.payload;
                          return (
                            <div className="bg-background border rounded p-2 text-xs">
                              <p>H: {d?.h?.toFixed(3)}</p>
                              <p>μH: {d?.muH?.toFixed(3)}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Scatter
                        data={scatterA}
                        name="Cohort A"
                        fill={COHORT_A_COLOR}
                        opacity={0.6}
                      />
                      <Scatter
                        data={scatterB}
                        name="Cohort B"
                        fill={COHORT_B_COLOR}
                        opacity={0.6}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">
                    No μH data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
