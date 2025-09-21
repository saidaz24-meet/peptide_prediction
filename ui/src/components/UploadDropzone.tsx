import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDatasetStore } from '@/stores/datasetStore';
import { ParsedCSVData } from '@/types/peptide';
import { toast } from 'react-hot-toast';

interface UploadDropzoneProps {
  onFileProcessed: () => void;
}

export function UploadDropzone({ onFileProcessed }: UploadDropzoneProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setRawData, setError } = useDatasetStore();

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setUploadProgress(0);
      setError(null);

      try {
        const ext = file.name.split('.').pop()?.toLowerCase();

        // --- CSV preview locally ---
        if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
          setUploadProgress(25);

          const isTSV = ext === 'tsv';
          Papa.parse(file, {
            header: true,
            skipEmptyLines: 'greedy',
            delimiter: isTSV ? '\t' : undefined,
            complete: (res) => {
              setUploadProgress(75);

              if (res.errors?.length) {
                setError(`CSV parsing error: ${res.errors[0].message}`);
                setIsProcessing(false);
                return;
              }

              const rows = (res.data as any[]).filter(Boolean);
              const headers =
                (res.meta.fields && res.meta.fields.length
                  ? res.meta.fields
                  : rows.length
                  ? Object.keys(rows[0])
                  : []) as string[];

              const parsed: ParsedCSVData = {
                headers,
                rows,
                fileName: file.name,
                rowCount: rows.length,
              };

              setRawData(parsed);
              setUploadProgress(100);
              toast.success(`Loaded ${rows.length} preview rows`);

              setTimeout(() => {
                setIsProcessing(false);
                onFileProcessed();
              }, 400);
            },
            error: (err) => {
              setError(`Failed to parse CSV: ${err.message}`);
              setIsProcessing(false);
            },
          });
          return;
        }

        // --- XLS/XLSX: skip client parsing; let backend handle it ---
        if (ext === 'xlsx' || ext === 'xls') {
          // Provide a minimal preview shell so the UI flow continues.
          const parsed: ParsedCSVData = {
            headers: [],
            rows: [],
            fileName: file.name,
            rowCount: 0,
          };
          setRawData(parsed);
          setUploadProgress(100);
          toast(
            'Excel detected. Preview is skipped; full parsing will run on the backend during Analyze.',
            { icon: 'ℹ️' }
          );
          setTimeout(() => {
            setIsProcessing(false);
            onFileProcessed();
          }, 300);
          return;
        }

        setError('Unsupported file format. Please upload CSV/TSV or Excel.');
        setIsProcessing(false);
      } catch (err) {
        setError(
          `Error processing file: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
        setIsProcessing(false);
      }
    },
    [setRawData, setError, onFileProcessed]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) processFile(accepted[0]);
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        'text/csv': ['.csv', '.tsv', '.txt'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
          '.xlsx',
        ],
        'application/vnd.ms-excel': ['.xls'],
      },
      multiple: false,
      disabled: isProcessing,
    });

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          {...getRootProps()}
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 border-2 border-dashed
            ${isDragActive && !isDragReject ? 'border-primary bg-primary/5' : ''}
            ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
            ${!isDragActive ? 'border-border hover:border-primary/50 hover:bg-muted/30' : ''}
            ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input {...getInputProps()} />
          <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <motion.div
              animate={{
                scale: isDragActive ? 1.1 : 1,
                rotate: isProcessing ? 360 : 0,
              }}
              transition={{
                scale: { duration: 0.2 },
                rotate: {
                  duration: 2,
                  repeat: isProcessing ? Infinity : 0,
                  ease: 'linear',
                },
              }}
              className="mb-4"
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isDragActive || isProcessing ? 'bg-primary/10' : 'bg-muted'
                }`}
              >
                {(isDragActive || isProcessing) ? (
                  <Upload className="w-8 h-8 text-primary" />
                ) : (
                  <FileText className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
            </motion.div>

            <h3 className="text-xl font-semibold mb-2">
              {isProcessing
                ? 'Processing your file…'
                : isDragActive
                ? 'Drop your file here'
                : 'Upload Peptide Dataset'}
            </h3>

            <p className="text-muted-foreground mb-4 max-w-sm">
              {isProcessing
                ? 'Please wait while we prepare your data'
                : 'Drag & drop your CSV/TSV or Excel file here, or click to browse'}
            </p>

            {!isProcessing && (
              <div className="text-sm text-muted-foreground">
                <p>Supported formats: CSV, TSV, XLSX, XLS</p>
                <p>Maximum file size: 50MB</p>
              </div>
            )}

            {isProcessing && (
              <div className="w-full max-w-xs mt-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">
                  {uploadProgress}% complete
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {uploadProgress === 100 && !isProcessing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Alert className="border-success bg-success/5">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              File ready! Proceed to the next step.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}


      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            const res = await fetch("/example/peptide_data.csv");
            const text = await res.text();

            Papa.parse(text, {
              header: true,
              skipEmptyLines: "greedy",
              complete: (parsed) => {
                const rows = (parsed.data as any[]).filter(Boolean);
                const headers =
                  parsed.meta.fields && parsed.meta.fields.length
                    ? parsed.meta.fields
                    : rows.length
                    ? Object.keys(rows[0])
                    : [];

                setRawData({
                  fileName: "peptide_data.csv",
                  headers,
                  rows: rows.slice(0, 200),
                  rowCount: rows.length,
                } as any);

                toast.success(`Loaded example dataset (${rows.length} rows)`);
                onFileProcessed(); // jump to Preview step
              },
              error: (err) => {
                toast.error(`Failed to load example dataset: ${err.message}`);
              },
            });
          } catch (err: any) {
            toast.error("Could not fetch example dataset");
          }
        }}
      >
        <FileText className="w-4 h-4 mr-2" />
        Load Example Dataset
      </Button>

    </div>
  );
}
