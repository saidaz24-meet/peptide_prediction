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

const steps = [
  { id: 'upload', title: 'Upload File', icon: UploadIcon },
  { id: 'preview', title: 'Preview Data', icon: FileText },
  { id: 'mapping', title: 'Map Columns', icon: CheckCircle },
];

export default function Upload() {
  const [currentStep, setCurrentStep] = useState(0);
  const [localFile, setLocalFile] = useState<File | null>(null);

  // your store API:
  const { rawData, isLoading, setRawPreview, ingestBackendRows } = useDatasetStore();

  const navigate = useNavigate();
  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  async function handleAnalyze() {
    if (!localFile) return;
    try {
      const { rows } = await uploadCSV(localFile);   // FastAPI /api/upload-csv
      ingestBackendRows(rows);                       // map + compute stats
      navigate('/results');                          // show dashboard
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    }
  }

  // preview parser for step 1 -> 2
  function handleLocalPreview(file: File) {
    setLocalFile(file);
    const name = file.name.toLowerCase();
    const isTSV = name.endsWith(".tsv");
    const isXLSX = name.endsWith(".xlsx") || name.endsWith(".xls");
  
    if (isXLSX) {
      // Optional: skip client preview for Excel; backend will read it fine.
      // You can show a simple banner instead of parsing.
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
      skipEmptyLines: "greedy",
      delimiter: isTSV ? "\t" : undefined, // undefined lets Papa auto-detect for CSV; force tab for TSV
      complete: (res) => {
        const rowsObj = (res.data as any[]).filter(Boolean);
        const headers =
          res.meta.fields && res.meta.fields.length
            ? res.meta.fields
            : rowsObj.length ? Object.keys(rowsObj[0]) : [];
        try {
          // support both signatures of setRawPreview
          // @ts-ignore
          if (setRawPreview.length >= 3) setRawPreview(file.name, headers, rowsObj.slice(0, 200));
          else
            // @ts-ignore
            setRawPreview({ fileName: file.name, headers, rows: rowsObj.slice(0, 200), rowCount: rowsObj.length });
        } catch {
          // @ts-ignore
          setRawPreview({ fileName: file.name, headers, rows: rowsObj.slice(0, 200), rowCount: rowsObj.length });
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
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Choose a UniProt CSV file</label>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,.xlsx"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLocalPreview(f);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      We only parse a small preview locally for mapping; full analysis runs on the backend.
                    </p>
                  </div>
                </motion.div>
              )}

              {currentStep === 1 && rawData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
        </motion.div>
      </div>
    </div>
  );
}
