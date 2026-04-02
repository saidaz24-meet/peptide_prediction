import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { Upload, CheckCircle } from "lucide-react";
import Papa from "papaparse";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDatasetStore } from "@/stores/datasetStore";
import { ParsedCSVData } from "@/types/peptide";
import { toast } from "sonner";

/** so we now should try to do the one sequence immideate results rq. */

interface UploadDropzoneProps {
  /** Fire as soon as a File object is available (enables Analyze upstream) */
  onFileSelected?: (file: File) => void;
  /** Fire after preview/processing finishes (to advance steps) */
  onFileProcessed: () => void;
}

export function UploadDropzone({ onFileSelected, onFileProcessed }: UploadDropzoneProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setRawData, setError } = useDatasetStore();

  const processFile = useCallback(
    async (file: File) => {
      // If onFileSelected is provided, let parent handle all processing
      if (onFileSelected) {
        onFileSelected(file);
        // Parent will call onFileProcessed when ready
        return;
      }

      // Otherwise, handle processing internally (for backward compatibility)
      setIsProcessing(true);
      setUploadProgress(0);
      setError(null);

      try {
        const ext = file.name.split(".").pop()?.toLowerCase();

        // --- CSV/TSV/TXT: preview locally ---
        if (ext === "csv" || ext === "tsv" || ext === "txt") {
          setUploadProgress(25);

          const isTSV = ext === "tsv";
          Papa.parse(file, {
            header: true,
            skipEmptyLines: "greedy",
            delimiter: isTSV ? "\t" : undefined,
            complete: (res) => {
              setUploadProgress(75);

              if (res.errors?.length) {
                setError(`CSV parsing error: ${res.errors[0].message}`);
                setIsProcessing(false);
                return;
              }

              const rows = (res.data as any[]).filter(Boolean);
              const headers = (
                res.meta.fields && res.meta.fields.length
                  ? res.meta.fields
                  : rows.length
                    ? Object.keys(rows[0])
                    : []
              ) as string[];

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

        // --- XLS/XLSX: skip client parsing; backend will parse on Analyze ---
        if (ext === "xlsx" || ext === "xls") {
          const parsed: ParsedCSVData = {
            headers: [],
            rows: [],
            fileName: file.name,
            rowCount: 0,
          };
          setRawData(parsed);
          setUploadProgress(100);
          toast(
            "Excel detected. Preview is skipped; full parsing will run on the backend during Analyze.",
            { icon: "ℹ️" }
          );
          setTimeout(() => {
            setIsProcessing(false);
            onFileProcessed();
          }, 300);
          return;
        }

        setError("Unsupported file format. Please upload CSV/TSV, Excel, or FASTA.");
        setIsProcessing(false);
      } catch (err) {
        setError(`Error processing file: ${err instanceof Error ? err.message : "Unknown error"}`);
        setIsProcessing(false);
      }
    },
    [setRawData, setError, onFileProcessed, onFileSelected]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) processFile(accepted[0]);
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv", ".tsv", ".txt"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/octet-stream": [".fasta", ".fa"],
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
          className={`relative overflow-hidden cursor-pointer transition-all duration-200 border-2 border-dashed rounded-xl
            ${isDragActive && !isDragReject ? "border-primary bg-primary/10 shadow-lg shadow-primary/10" : ""}
            ${isDragReject ? "border-destructive bg-destructive/5" : ""}
            ${!isDragActive ? "border-primary/30 bg-primary/[0.02] hover:border-primary hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5" : ""}
            ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            {...getInputProps()}
            onChange={(e) => {
              // ensure manual click selection also triggers our pipeline
              const f = e.currentTarget.files?.[0];
              if (f) processFile(f);
            }}
          />
          <CardContent className="flex flex-col items-center justify-center py-8 px-6 text-center">
            <motion.div
              animate={{
                scale: isDragActive ? 1.15 : 1,
                rotate: isProcessing ? 360 : 0,
              }}
              transition={{
                scale: { duration: 0.2 },
                rotate: {
                  duration: 2,
                  repeat: isProcessing ? Infinity : 0,
                  ease: "linear",
                },
              }}
              className="mb-4"
            >
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                  isDragActive || isProcessing
                    ? "bg-primary/15 border-2 border-primary/30"
                    : "bg-primary/5 border-2 border-primary/10"
                }`}
              >
                {isDragActive || isProcessing ? (
                  <Upload className="w-6 h-6 text-primary" />
                ) : (
                  <Upload className="w-6 h-6 text-primary/60" />
                )}
              </div>
            </motion.div>

            <h3 className="text-base font-semibold mb-1">
              {isProcessing
                ? "Processing your file..."
                : isDragActive
                  ? "Drop your file here"
                  : "Drop your file here"}
            </h3>

            <p className="text-muted-foreground mb-3 max-w-sm">
              {isProcessing ? (
                "Please wait while we prepare your data"
              ) : (
                <>
                  or{" "}
                  <span className="text-primary font-medium underline underline-offset-2">
                    click to browse
                  </span>{" "}
                  your computer
                </>
              )}
            </p>

            {!isProcessing && (
              <div className="text-xs text-muted-foreground/70 space-y-0.5">
                <p>CSV, TSV, Excel (.xlsx), FASTA</p>
                <p>
                  Up to 50 MB &middot; Required column:{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-[11px]">Sequence</code>
                </p>
              </div>
            )}

            {isProcessing && (
              <div className="w-full max-w-xs mt-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">{uploadProgress}% complete</p>
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
    </div>
  );
}
