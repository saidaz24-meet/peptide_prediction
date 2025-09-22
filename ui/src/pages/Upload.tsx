import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload as UploadIcon, FileText, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ColumnMapper } from '@/components/ColumnMapper';
import { DataPreview } from '@/components/DataPreview';
import { useDatasetStore } from '@/stores/datasetStore';
import { uploadCSV } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import AppFooter from "@/components/AppFooter";
// at the top
import { UploadDropzone } from "@/components/UploadDropzone";


import { fetchExampleDataset } from "@/lib/api";
import { toast } from "sonner"; // or your toast lib

// QC
import { Alert, AlertDescription } from '@/components/ui/alert';

const steps = [
  { id: 'upload', title: 'Upload File', icon: UploadIcon },
  { id: 'preview', title: 'Preview Data', icon: FileText },
  { id: 'mapping', title: 'Map Columns', icon: CheckCircle },
];

// QC helpers — minimal and safe
const AA20 = new Set('ACDEFGHIKLMNPQRSTVWY'.split(''));
function isValidSeq(s: string) {
  if (!s) return false;
  if (!/^[A-Za-z]+$/.test(s)) return false;
  for (const ch of s.toUpperCase()) if (!AA20.has(ch)) return false;
  return true;
}
function exportCsv(filename: string, rows: any[]) {
  if (!rows?.length) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LoadExampleButton() {
  const navigate = useNavigate();
  const { ingestBackendRows } = useDatasetStore();

  const onClick = async () => {
    try {
      const { rows, meta } = await fetchExampleDataset(0); // 0 = no recompute
      ingestBackendRows(rows, meta);   // your existing mapper
      toast.success("Loaded example dataset");
      navigate("/results");
    } catch (e: any) {
      toast.error(`Failed to load example: ${e.message || e}`);
    }
  };

  return (
    <Button variant="secondary" onClick={onClick}>
      Load example data
    </Button>
  );
}

export default function Upload() {
  const [currentStep, setCurrentStep] = useState(0);
  const [localFile, setLocalFile] = useState<File | null>(null);
  // QC state (only affects preview UI)
  const [qc, setQc] = useState<null | { rejectedCount: number; download: () => void }>(null);

  // your store API:
  const { rawData, isLoading, setRawPreview, ingestBackendRows } = useDatasetStore();

  const navigate = useNavigate();
  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  async function handleAnalyze() {
    if (!localFile) return;
    try {
      const response = await uploadCSV(localFile);   // FastAPI /api/upload-csv
      const { rows, meta } = response as any;
      // keep your existing ingestion path
      // @ts-ignore (in case your store signature expects (rows, meta))
      ingestBackendRows(rows, meta);
      navigate('/results');
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    }
  }

  // preview parser for step 1 -> 2
  function handleLocalPreview(file: File) {
    setLocalFile(file);
    setQc(null); // reset QC banner on new file
    const name = file.name.toLowerCase();
    const isTSV = name.endsWith('.tsv');
    const isXLSX = name.endsWith('.xlsx') || name.endsWith('.xls');

    if (isXLSX) {
      // Optional: skip client preview for Excel; backend will read it fine.
      setRawPreview({
        fileName: file.name,
        headers: [],
        rows: [],
        rowCount: 0,
      } as any);
      setCurrentStep(1);
      return;
    }

    // CSV/TSV preview with Papa
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: isTSV ? '\t' : undefined, // undefined lets Papa auto-detect for CSV; force tab for TSV
      complete: (res) => {
        const rowsObj = (res.data as any[]).filter(Boolean);
        const headers =
          res.meta.fields && res.meta.fields.length
            ? res.meta.fields
            : rowsObj.length
            ? Object.keys(rowsObj[0])
            : [];

        // ------- QC: split valid vs rejected by basic AA20 check on a likely sequence field -------
        const pickSeq = (r: any) =>
          r.Sequence ?? r.sequence ?? r.seq ?? r.SEQUENCE ?? r.Seq ?? '';
        const valid: any[] = [];
        const rejected: any[] = [];
        for (const r of rowsObj) {
          const seq = String(pickSeq(r) ?? '');
          if (isValidSeq(seq)) valid.push(r);
          else rejected.push(r);
        }
        // ------------------------------------------------------------------------------------------

        try {
          // support both signatures of setRawPreview
          // @ts-ignore
          if (setRawPreview.length >= 3)
            setRawPreview({
              fileName: file.name,
              headers,
              rows: valid.slice(0, 200),
              rowCount: valid.length,
            });
            
          else
            // @ts-ignore
            setRawPreview({
              fileName: file.name,
              headers,
              rows: valid.slice(0, 200),
              rowCount: valid.length,
            });
        } catch {
          // @ts-ignore
          setRawPreview({
            fileName: file.name,
            headers,
            rows: valid.slice(0, 200),
            rowCount: valid.length,
          });
        }

        // Set QC banner if any rejections (non-blocking, preview-only)
        if (rejected.length > 0) {
          setQc({
            rejectedCount: rejected.length,
            download: () => exportCsv('rejected_rows.csv', rejected),
          });
        } else {
          setQc(null);
        }

        setCurrentStep(1);
      },
      error: (err) => alert(`Failed to read file: ${err.message}`),
    });
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
          {/* Progress Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Upload & Process Dataset</h1>
            <p className="text-muted-foreground mb-6">
              Upload your peptide CSV and generate visualizations. (No live JPred needed.)
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
                            ? 'bg-primary border-primary text-primary-foreground'
                            : isActive
                            ? 'border-primary text-primary'
                            : 'border-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step Content */}
          <Card className="shadow-medium">
            <CardContent className="p-6">
              {currentStep === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                <UploadDropzone
                  onFileProcessed={() => {
                    // If a CSV was dropped, preview is already set by handleLocalPreview-equivalent.
                    // If XLS/XLSX was dropped, dropzone sets a minimal preview shell.
                    setCurrentStep(1);
                  }}
                />

                </motion.div>
              )}

              {currentStep === 1 && rawData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* QC banner (subtle, optional) */}
                  {qc && qc.rejectedCount > 0 && (
                    <Alert>
                      <AlertDescription className="flex items-center justify-between">
                        <span>Filtered out {qc.rejectedCount} invalid rows for preview.</span>
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
                    <Badge variant="secondary">
                      {(rawData.rowCount ?? rawData.rows?.length ?? 0)} preview rows
                    </Badge>
                  </div>
                  <DataPreview data={rawData} />
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>Back</Button>
                    <Button onClick={() => setCurrentStep(2)} disabled={isLoading}>Continue to Mapping</Button>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Map Columns (Optional)</h3>
                    <p className="text-muted-foreground">
                      Mapping is optional because the backend already understands UniProt exports.
                      You can adjust mapping for local processing, or just click <b>Analyze</b>.
                    </p>
                  </div>

                  {rawData && <ColumnMapper headers={rawData.headers} onMappingComplete={() => {}} />}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>Back</Button>
                    <Button onClick={handleAnalyze} disabled={!localFile}>Analyze</Button>
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
