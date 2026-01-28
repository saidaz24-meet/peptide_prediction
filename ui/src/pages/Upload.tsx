import { useState } from "react";
import { motion } from "framer-motion";
import { Upload as UploadIcon, FileText, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ColumnMapper } from "@/components/ColumnMapper";
import { DataPreview } from "@/components/DataPreview";
import { useDatasetStore } from "@/stores/datasetStore";
import { uploadCSV } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import AppFooter from "@/components/AppFooter";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UniProtQueryInput } from "@/components/UniProtQueryInput";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { ThresholdConfig } from "@/types/peptide";

const steps = [
  { id: "upload", title: "Upload File", icon: UploadIcon },
  { id: "preview", title: "Preview Data", icon: FileText },
  { id: "mapping", title: "Map Columns", icon: CheckCircle },
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
  const [uploadMode, setUploadMode] = useState<'file' | 'uniprot'>('file');

  // threshold configuration
  const [thresholdMode, setThresholdMode] = useState<'default' | 'recommended' | 'custom'>('default');
  const [customThresholds, setCustomThresholds] = useState({
    muHCutoff: 0.0,
    hydroCutoff: 0.0,
    ffHelixPercentThreshold: 50.0,
  });

  // preview QC banner
  const [qc, setQc] = useState<null | { rejectedCount: number; download: () => void }>(null);

  // store
  const { rawData, isLoading, setRawPreview, ingestBackendRows, setLoading, setLastRun } = useDatasetStore();
  const navigate = useNavigate();
  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  // ---- CSV/TSV preview (XLSX skips preview) ----
  const handleLocalPreview = (file: File) => {
    console.log('[Upload] handleLocalPreview called with file:', file.name);
    setLocalFile(file); // <— KEY: remember the file so Analyze can enable
    setQc(null);

    const name = file.name.toLowerCase();
    const isTSV = name.endsWith(".tsv");
    const isXLSX = name.endsWith(".xlsx") || name.endsWith(".xls");

    if (isXLSX) {
      // Skip client preview; backend will read Excel directly.
      console.log('[Upload] Excel file detected, skipping preview');
      setRawPreview({ fileName: file.name, headers: [], rows: [], rowCount: 0 } as any);
      setCurrentStep(1);
      return;
    }

    console.log('[Upload] Parsing CSV/TSV file...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      delimiter: isTSV ? "\t" : undefined,
      complete: (res) => {
        console.log('[Upload] Papa.parse complete, rows:', res.data?.length);
        const rowsObj = (res.data as any[]).filter(Boolean);
        const headers =
          res.meta.fields?.length ? res.meta.fields : rowsObj.length ? Object.keys(rowsObj[0]) : [];

        console.log('[Upload] Headers:', headers);

        // For preview, we don't need strict validation - just show all rows
        // Validation will happen on the backend during analysis
        const previewData = {
          fileName: file.name,
          headers,
          rows: rowsObj.slice(0, 200), // Show first 200 rows for preview
          rowCount: rowsObj.length,
        };
        
        console.log('[Upload] Setting raw preview data:', previewData);
        setRawPreview(previewData as any);

        // Optional: still do validation to show warnings, but don't filter
        const pickSeq = (r: any) =>
          r.Sequence ?? r.sequence ?? r.seq ?? r.SEQUENCE ?? r.Seq ?? "";
        const rejected: any[] = [];
        for (const r of rowsObj) {
          const seq = String(pickSeq(r));
          if (seq && !isValidSeq(seq)) {
            rejected.push(r);
          }
        }

        console.log('[Upload] Rejected (invalid sequences):', rejected.length);

        if (rejected.length > 0) {
          setQc({
            rejectedCount: rejected.length,
            download: () => exportCsv("rejected_rows.csv", rejected),
          });
        } else setQc(null);

        console.log('[Upload] Advancing to step 1');
        setCurrentStep(1);
        console.log('[Upload] Step should now be 1, rawData:', previewData);
      },
      error: (err) => {
        console.error('[Upload] Papa.parse error:', err);
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
        ...(thresholdMode === 'custom' && { custom: customThresholds }),
      };
      
      // Store run input/config for reproduce
      setLastRun('upload', localFile, thresholdConfig);
      
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
          {/* Header & progress */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Upload & Process Dataset</h1>
            <p className="text-muted-foreground mb-6">
              Upload your peptide CSV/TSV/XLSX and generate visualizations. (Mapping optional.)
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
                      <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
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
                      variant={uploadMode === 'file' ? 'default' : 'outline'}
                      onClick={() => setUploadMode('file')}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Upload File
                    </Button>
                    <Button
                      variant={uploadMode === 'uniprot' ? 'default' : 'outline'}
                      onClick={() => setUploadMode('uniprot')}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Query UniProt
                    </Button>
                  </div>

                  {/* File Upload */}
                  {uploadMode === 'file' && (
                    <UploadDropzone
                      onFileSelected={(f: File) => handleLocalPreview(f)}
                      onFileProcessed={() => setCurrentStep(1)}
                    />
                  )}

                  {/* UniProt Query */}
                  {uploadMode === 'uniprot' && (
                    <UniProtQueryInput
                      onQueryExecuted={(rows, meta) => {
                        // Convert UniProt query results to the format expected by the store
                        if (rows && rows.length > 0) {
                          // Ingest rows directly (they're already in the right format from backend)
                          ingestBackendRows(rows, meta);
                          
                          // Navigate to results page
                          navigate('/results');
                        } else {
                          toast.error('No results returned from UniProt');
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
                    <div className="text-center py-8 text-muted-foreground">
                      Loading preview...
                    </div>
                  ) : (
                    <>
                      {qc && qc.rejectedCount > 0 && (
                        <Alert>
                          <AlertDescription className="flex items-center justify-between">
                            <span>{qc.rejectedCount} rows have invalid sequences (will be filtered during analysis).</span>
                            <Button variant="outline" size="sm" onClick={qc.download}>
                              Download rejected_rows.csv
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Data Preview</h3>
                          <p className="text-muted-foreground">Quick look before analysis</p>
                        </div>
                        <Badge variant="secondary">{rawData.rowCount ?? rawData.rows?.length ?? 0} preview rows</Badge>
                      </div>

                      <DataPreview data={rawData} />
                    </>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(2)} disabled={isLoading}>
                      Continue to Mapping
                    </Button>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Map Columns (Optional)</h3>
                    <p className="text-muted-foreground">
                      The backend recognizes UniProt headers and computes metrics even if you skip mapping.
                      You can still align columns here for clarity.
                    </p>
                  </div>

                  {rawData && <ColumnMapper headers={rawData.headers} onMappingComplete={() => {}} />}

                  {/* Threshold Configuration */}
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <Label htmlFor="threshold-mode">Threshold Mode</Label>
                      <Select value={thresholdMode} onValueChange={(v: 'default' | 'recommended' | 'custom') => setThresholdMode(v)}>
                        <SelectTrigger id="threshold-mode" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="recommended">Recommended (computed from data)</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {thresholdMode === 'default' && 'Use default threshold values'}
                        {thresholdMode === 'recommended' && 'Compute thresholds from data using median'}
                        {thresholdMode === 'custom' && 'Set custom threshold values'}
                      </p>
                    </div>

                    {thresholdMode === 'custom' && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="muH-cutoff">μH Cutoff</Label>
                          <input
                            id="muH-cutoff"
                            type="number"
                            step="0.1"
                            className="w-full mt-1 px-3 py-2 border rounded-md"
                            value={customThresholds.muHCutoff}
                            onChange={(e) => setCustomThresholds({ ...customThresholds, muHCutoff: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="hydro-cutoff">Hydrophobicity Cutoff</Label>
                          <input
                            id="hydro-cutoff"
                            type="number"
                            step="0.1"
                            className="w-full mt-1 px-3 py-2 border rounded-md"
                            value={customThresholds.hydroCutoff}
                            onChange={(e) => setCustomThresholds({ ...customThresholds, hydroCutoff: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="ffHelix-threshold">FF-Helix % Threshold</Label>
                          <input
                            id="ffHelix-threshold"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            className="w-full mt-1 px-3 py-2 border rounded-md"
                            value={customThresholds.ffHelixPercentThreshold}
                            onChange={(e) => setCustomThresholds({ ...customThresholds, ffHelixPercentThreshold: parseFloat(e.target.value) || 50 })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>
                      Back
                    </Button>
                    <Button onClick={handleAnalyze} disabled={!localFile || isAnalyzing}>
                      {isAnalyzing ? "Analyzing…" : "Analyze"}
                    </Button>
                  </div>
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
