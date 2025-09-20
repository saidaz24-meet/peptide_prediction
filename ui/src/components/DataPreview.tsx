import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ParsedCSVData } from '@/types/peptide';

interface DataPreviewProps {
  data: ParsedCSVData;
}

export function DataPreview({ data }: DataPreviewProps) {
  const previewRows = data.rows.slice(0, 5); // Show first 5 rows

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                First {previewRows.length} rows from {data.fileName}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                {data.headers.length} columns
              </Badge>
              <Badge variant="secondary">
                {data.rowCount} total rows
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    {data.headers.map((header, index) => (
                      <th
                        key={index}
                        className="text-left p-2 font-medium text-sm bg-muted/50 whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <motion.tr
                      key={rowIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: rowIndex * 0.1 }}
                      className="border-b hover:bg-muted/20 transition-colors"
                    >
                      {data.headers.map((header, colIndex) => (
                        <td
                          key={colIndex}
                          className="p-2 text-sm text-muted-foreground whitespace-nowrap max-w-[200px] truncate"
                          title={String(row[header] || '')}
                        >
                          {String(row[header] || '')}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
          
          {data.rowCount > 5 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                ... and {data.rowCount - 5} more rows
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}