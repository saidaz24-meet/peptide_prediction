import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
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

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setUploadProgress(0);
    setError(null);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        // Process CSV file
        setUploadProgress(25);
        
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            setUploadProgress(75);
            
            if (results.errors.length > 0) {
              setError(`CSV parsing error: ${results.errors[0].message}`);
              setIsProcessing(false);
              return;
            }

            const data = results.data as string[][];
            if (data.length < 2) {
              setError('CSV file must contain at least a header row and one data row');
              setIsProcessing(false);
              return;
            }

            const headers = data[0];
            const rows = data.slice(1).map(row => {
              const rowObj: Record<string, any> = {};
              headers.forEach((header, index) => {
                rowObj[header] = row[index] || '';
              });
              return rowObj;
            });

            const parsedData: ParsedCSVData = {
              headers,
              rows,
              fileName: file.name,
              rowCount: rows.length,
            };

            setRawData(parsedData);
            setUploadProgress(100);
            toast.success(`Successfully loaded ${rows.length} rows`);
            
            setTimeout(() => {
              setIsProcessing(false);
              onFileProcessed();
            }, 500);
          },
          error: (error) => {
            setError(`Failed to parse CSV: ${error.message}`);
            setIsProcessing(false);
          }
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Process Excel file
        setUploadProgress(25);
        
        const arrayBuffer = await file.arrayBuffer();
        setUploadProgress(50);
        
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        setUploadProgress(75);
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        if (jsonData.length < 2) {
          setError('Excel file must contain at least a header row and one data row');
          setIsProcessing(false);
          return;
        }

        const headers = jsonData[0];
        const rows = jsonData.slice(1).map(row => {
          const rowObj: Record<string, any> = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] || '';
          });
          return rowObj;
        });

        const parsedData: ParsedCSVData = {
          headers,
          rows,
          fileName: file.name,
          rowCount: rows.length,
        };

        setRawData(parsedData);
        setUploadProgress(100);
        toast.success(`Successfully loaded ${rows.length} rows from Excel`);
        
        setTimeout(() => {
          setIsProcessing(false);
          onFileProcessed();
        }, 500);
      } else {
        setError('Unsupported file format. Please upload a CSV or Excel file.');
        setIsProcessing(false);
      }
    } catch (error) {
      setError(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  }, [setRawData, setError, onFileProcessed]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
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
          className={`
            relative overflow-hidden cursor-pointer transition-all duration-200 border-2 border-dashed
            ${isDragActive && !isDragReject ? 'border-primary bg-primary/5' : ''}
            ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
            ${!isDragActive ? 'border-border hover:border-primary/50 hover:bg-muted/30' : ''}
            ${isProcessing ? 'pointer-events-none opacity-60' : ''}
          `}
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
                rotate: { duration: 2, repeat: isProcessing ? Infinity : 0, ease: 'linear' }
              }}
              className="mb-4"
            >
              {isProcessing ? (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
              ) : isDragActive ? (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </motion.div>

            <h3 className="text-xl font-semibold mb-2">
              {isProcessing 
                ? 'Processing your file...' 
                : isDragActive 
                ? 'Drop your file here' 
                : 'Upload Peptide Dataset'
              }
            </h3>
            
            <p className="text-muted-foreground mb-4 max-w-sm">
              {isProcessing 
                ? 'Please wait while we parse your data'
                : 'Drag and drop your CSV or Excel file here, or click to browse'
              }
            </p>

            {!isProcessing && (
              <div className="text-sm text-muted-foreground">
                <p>Supported formats: CSV, XLSX, XLS</p>
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

      {/* Success/Error States */}
      {uploadProgress === 100 && !isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert className="border-success bg-success/5">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              File uploaded successfully! Ready to proceed to the next step.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Example Files */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Don't have a file? Try our example dataset:
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // This would load an example dataset
            toast('Example dataset loading feature coming soon', { icon: 'ℹ️' });
          }}
        >
          <FileText className="w-4 h-4 mr-2" />
          Load Example Dataset
        </Button>
      </div>
    </div>
  );
}