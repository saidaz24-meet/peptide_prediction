import { useState } from "react";
import { motion } from "framer-motion";
import { Upload as UploadIcon, FileText, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
// ColumnMapper removed - columns are auto-detected by backend
import { DataPreview } from "@/components/DataPreview";
import { useDatasetStore } from "@/stores/datasetStore";
import { uploadCSV } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import AppFooter from "@/components/AppFooter";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UniProtQueryInput } from "@/components/UniProtQueryInput";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";
import { Search } from "lucide-react";
import { ThresholdConfigPanel } from "@/components/ThresholdConfigPanel";
import type { ThresholdConfig } from "@/types/peptide";

const steps = [
  { id: "upload", title: "Upload File", icon: UploadIcon },
  { id: "analyze", title: "Preview & Analyze", icon: CheckCircle },
];

// 20-AA quick validator (preview-only)
const AA20 = new Set("ACDEFGHIKLMNPQRSTVWY".split(""));
function isValidSeq(s: string) {
  if (!s) return false;
  if (!/^[A-Za-z]+$/.test(s)) return false;
  for (const ch of s.toUpperCase()) if (!AA20.has(ch)) return false;
  return true;
}
function exportCsv(filename: string, rows: any[]) {
  if (!rows?.length) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Upload() {
  const [currentStep, setCurrentStep] = useState(0);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "uniprot">("file");

  // threshold configuration
  const [thresholdMode, setThresholdMode] = useState<"default" | "recommended" | "custom">(
    "recommended"
  );
  const [customThresholds, setCustomThresholds] = useState({
    muHCutoff: 0.0,
    hydroCutoff: 0.0,
    aggThreshold: 5.0,
  });

  // preview QC banner
  const [qc, setQc] = useState<null | { rejectedCount: number; download: () => void }>(null);

  // store
  const {
    rawData,
    isLoading,
    setRawPreview,
    ingestBackendRows,
    setLoading,
    setLastRun,
    setSourceFile,
  } = useDatasetStore();
  const navigate = useNavigate();
  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  // ---- CSV/TSV preview (XLSX skips preview) ----
  const handleLocalPreview = (file: File) => {
    setLocalFile(file);
    setQc(null);

    const name = file.name.toLowerCase();
    const isTSV = name.endsWith(".tsv");
    const isXLSX = name.endsWith(".xlsx") || name.endsWith(".xls");

    if (isXLSX) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          if (jsonData.length < 2) {
            toast.error("Excel file has no data rows");
            return;
          }

          const xlHeaders = (jsonData[0] as string[]).map((h) => String(h ?? ""));
          const xlRows = jsonData.slice(1, 201).map((row) => {
            const obj: Record<string, any> = {};
            xlHeaders.forEach((h, i) => {
              obj[h] = row[i] ?? "";
            });
            return obj;
          });

          setRawPreview({
            fileName: file.name,
            headers: xlHeaders,
            rows: xlRows,
            rowCount: jsonData.length - 1,
          } as any);

          // QC check for invalid sequences
          const pickSeq = (r: any) =>
            r.Sequence ?? r.sequence ?? r.seq ?? r.SEQUENCE ?? r.Seq ?? "";
          const allRows = jsonData.slice(1).map((row) => {
            const obj: Record<string, any> = {};
            xlHeaders.forEach((h, i) => {
              obj[h] = row[i] ?? "";
            });
            return obj;
          });
          const rejected = allRows.filter((r) => {
            const seq = String(pickSeq(r));
            return seq && !isValidSeq(seq);
          });
          if (rejected.length > 0) {
            setQc({
              rejectedCount: rejected.length,
              download: () => exportCsv("rejected_rows.csv", rejected),
            });
          } else {
            setQc(null);
          }

          setCurrentStep(1);
        } catch (err: any) {
          toast.error(`Failed to read Excel file: ${err?.message || err}`);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      delimiter: isTSV ? "\t" : undefined,
      complete: (res) => {
        const rowsObj = (res.data as any[]).filter(Boolean);
        const headers = res.meta.fields?.length
          ? res.meta.fields
          : rowsObj.length
            ? Object.keys(rowsObj[0])
            : [];

        const previewData = {
          fileName: file.name,
          headers,
          rows: rowsObj.slice(0, 200),
          rowCount: rowsObj.length,
        };
        setRawPreview(previewData as any);

        const pickSeq = (r: any) => r.Sequence ?? r.sequence ?? r.seq ?? r.SEQUENCE ?? r.Seq ?? "";
        const rejected: any[] = [];
        for (const r of rowsObj) {
          const seq = String(pickSeq(r));
          if (seq && !isValidSeq(seq)) {
            rejected.push(r);
          }
        }

        if (rejected.length > 0) {
          setQc({
            rejectedCount: rejected.length,
            download: () => exportCsv("rejected_rows.csv", rejected),
          });
        } else setQc(null);

        setCurrentStep(1);
      },
      error: (err) => {
        toast.error(`Failed to read file: ${err.message}`);
      },
    });
  };

  const handleAnalyze = async () => {
    if (!localFile) return;
    try {
      setIsAnalyzing(true);

      // Build thresholdConfig from state
      const thresholdConfig: ThresholdConfig = {
        mode: thresholdMode,
        version: "1.0.0",
        ...(thresholdMode === "custom" && { custom: customThresholds }),
      };

      // Store run input/config for reproduce and recalculate
      setLastRun("upload", localFile, thresholdConfig);
      setSourceFile(localFile);

      const { rows, meta } = (await uploadCSV(localFile, thresholdConfig)) as any; // POST /api/upload-csv
      ingestBackendRows(rows, meta);
      navigate("/results");
    } catch (e: any) {
      toast.error(`Analyze failed: ${e.message || e}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header & progress */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Upload & Process Dataset</h1>
            <p className="text-muted-foreground mb-6">
              Upload your peptide CSV/TSV/XLSX — columns are auto-detected.
            </p>

            <div className="space-y-4">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index === currentStep;
                  const isCompleted = index < currentStep;
                  return (
                    <div key={step.id} className="flex items-center space-x-2">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                          isCompleted
                            ? "bg-primary border-primary text-primary-foreground"
                            : isActive
                              ? "border-primary text-primary"
                              : "border-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {step.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step content */}
          <Card className="shadow-medium">
            <CardContent className="p-6">
              {currentStep === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* Upload Mode Selector */}
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant={uploadMode === "file" ? "default" : "outline"}
                      onClick={() => setUploadMode("file")}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Upload File
                    </Button>
                    <Button
                      variant={uploadMode === "uniprot" ? "default" : "outline"}
                      onClick={() => setUploadMode("uniprot")}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Query UniProt
                    </Button>
                  </div>

                  {/* Try Example Data */}
                  {uploadMode === "file" && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">
                        Or try an example dataset:
                      </p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {[
                          {
                            label: "Antimicrobial Peptides (12)",
                            file: "/example/antimicrobial_peptides.csv",
                          },
                          { label: "Amyloid Peptides (9)", file: "/example/amyloid_peptides.csv" },
                          { label: "Venom Peptides (16)", file: "/example/peptide_data.csv" },
                        ].map((ex) => (
                          <Button
                            key={ex.file}
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={async () => {
                              try {
                                const resp = await fetch(ex.file);
                                if (!resp.ok) {
                                  toast.error("Failed to load example dataset");
                                  return;
                                }
                                const text = await resp.text();
                                if (!text.trim()) {
                                  toast.error("Failed to load example dataset");
                                  return;
                                }
                                const blob = new Blob([text], { type: "text/csv" });
                                const file = new File(
                                  [blob],
                                  ex.file.split("/").pop() || "example.csv",
                                  { type: "text/csv" }
                                );
                                handleLocalPreview(file);
                              } catch {
                                toast.error("Failed to load example dataset");
                              }
                            }}
                          >
                            {ex.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File Upload */}
                  {uploadMode === "file" && (
                    <>
                      <UploadDropzone
                        onFileSelected={(f: File) => handleLocalPreview(f)}
                        onFileProcessed={() => setCurrentStep(1)}
                      />

                      {/* Upload guidance */}
                      <Alert className="bg-muted/50 border-muted">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs space-y-1">
                          <p>
                            <strong>Required:</strong> Your file must include a{" "}
                            <code>Sequence</code> column.
                          </p>
                          <p>
                            <strong>Recommended:</strong> Up to ~500 sequences. Larger batches take
                            longer with TANGO enabled.
                          </p>
                          <p>
                            <strong>From UniProt:</strong> Search → Download → TSV → include Entry
                            and Sequence columns.
                          </p>
                        </AlertDescription>
                      </Alert>
                    </>
                  )}

                  {/* UniProt Query */}
                  {uploadMode === "uniprot" && (
                    <UniProtQueryInput
                      onQueryExecuted={(rows, meta) => {
                        // Convert UniProt query results to the format expected by the store
                        if (rows && rows.length > 0) {
                          // Ingest rows directly (they're already in the right format from backend)
                          ingestBackendRows(rows, meta);

                          // Navigate to results page
                          navigate("/results");
                        } else {
                          toast.error("No results returned from UniProt");
                        }
                      }}
                      onLoadingChange={(loading) => {
                        setLoading(loading);
                      }}
                    />
                  )}
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {!rawData ? (
                    <div className="text-center py-8 text-muted-foreground">Loading preview...</div>
                  ) : (
                    <>
                      {qc && qc.rejectedCount > 0 && (
                        <Alert>
                          <AlertDescription className="flex items-center justify-between">
                            <span>
                              {qc.rejectedCount} rows with invalid sequences (filtered during
                              analysis).
                            </span>
                            <Button variant="outline" size="sm" onClick={qc.download}>
                              Download rejected_rows.csv
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Data Preview</h3>
                          <p className="text-muted-foreground">
                            Columns are auto-detected. Click Analyze to process your data.
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {rawData.rowCount ?? rawData.rows?.length ?? 0} rows
                        </Badge>
                      </div>

                      <DataPreview data={rawData} />

                      {/* Sequence length summary */}
                      {rawData.rows &&
                        rawData.rows.length > 0 &&
                        (() => {
                          const pickSeq = (r: any) =>
                            r.Sequence ?? r.sequence ?? r.seq ?? r.SEQUENCE ?? r.Seq ?? "";
                          const lengths = rawData.rows
                            .map((r) => String(pickSeq(r)).length)
                            .filter((l) => l > 0);
                          const short = lengths.filter((l) => l < 15).length;
                          const optimal = lengths.filter((l) => l >= 15 && l <= 100).length;
                          const long = lengths.filter((l) => l > 100).length;
                          const hasWarnings = short > 0 || long > 0;
                          if (!hasWarnings) return null;
                          return (
                            <Alert>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                <div className="text-sm space-y-1">
                                  {short > 0 && (
                                    <p>
                                      {short} sequences too short (&lt;15 aa) — S4PRED may be
                                      unreliable
                                    </p>
                                  )}
                                  <p>{optimal} sequences in optimal range (15–100 aa)</p>
                                  {long > 0 && (
                                    <p>
                                      {long} sequences too long (&gt;100 aa) — reduced TANGO
                                      accuracy
                                    </p>
                                  )}
                                </div>
                              </AlertDescription>
                            </Alert>
                          );
                        })()}

                      {/* Auto-detected columns info */}
                      {rawData.headers && rawData.headers.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-sm font-medium mb-2">Detected columns:</p>
                          <div className="flex flex-wrap gap-2">
                            {rawData.headers.slice(0, 8).map((h: string) => (
                              <Badge key={h} variant="outline" className="text-xs">
                                {h}
                              </Badge>
                            ))}
                            {rawData.headers.length > 8 && (
                              <Badge variant="outline" className="text-xs">
                                +{rawData.headers.length - 8} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Threshold Configuration (collapsed by default) */}
                      <ThresholdConfigPanel
                        thresholdMode={thresholdMode}
                        onModeChange={setThresholdMode}
                        customThresholds={customThresholds}
                        onCustomChange={setCustomThresholds}
                        variant="details"
                      />
                    </>
                  )}

                  <div className="flex justify-between items-center">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      Back
                    </Button>
                    <Button onClick={handleAnalyze} disabled={!localFile || isAnalyzing} size="lg">
                      {isAnalyzing ? "Analyzing…" : "Analyze Dataset"}
                    </Button>
                  </div>
                  <AnalysisProgress
                    isActive={isAnalyzing}
                    peptideCount={rawData?.rowCount ?? rawData?.rows?.length ?? 0}
                  />
                </motion.div>
              )}
            </CardContent>
          </Card>

          <AppFooter />
        </motion.div>
      </div>
    </div>
  );
}
