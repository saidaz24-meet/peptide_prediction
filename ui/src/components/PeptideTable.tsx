import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Peptide } from '@/types/peptide';
import { toast } from 'react-hot-toast';

interface PeptideTableProps {
  peptides: Peptide[];
}

const columnHelper = createColumnHelper<Peptide>();

export function PeptideTable({ peptides }: PeptideTableProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 font-medium"
          >
            ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const id = String(info.getValue());
          const uni = `https://www.uniprot.org/uniprotkb/${id}/entry`;
          const af = `https://alphafold.ebi.ac.uk/entry/${id}`;
          return (
            <div className="flex items-center gap-2">
              <a
                href={uni}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
                title="Open UniProt entry"
              >
                {id}
              </a>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(af, '_blank', 'noopener,noreferrer');
                }}
                title="Open AlphaFold entry"
              >
                AlphaFold
              </Button>
            </div>
          );
        },
      }),
      columnHelper.accessor('species', {
        header: 'Species',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('length', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 font-medium"
          >
            Length
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => (
          <span className="font-mono">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('hydrophobicity', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 font-medium"
          >
            Hydrophobicity
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => (
          <span className="font-mono">{info.getValue().toFixed(2)}</span>
        ),
      }),
      columnHelper.accessor('muH', {
        header: 'μH',
        cell: (info) => (
          <span className="font-mono">
            {info.getValue()?.toFixed(2) || '-'}
          </span>
        ),
      }),
      columnHelper.accessor('charge', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 font-medium"
          >
            Charge
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const charge = info.getValue();
          return (
            <span className="font-mono">
              {charge > 0 ? '+' : ''}{charge.toFixed(1)}
            </span>
          );
        },
      }),
      columnHelper.accessor('chameleonPrediction', {
        header: 'Chameleon',
        cell: (info) => {
          const prediction = info.getValue();
          if (prediction === 1) {
            return (
              <Badge className="bg-chameleon-positive text-white">
                Positive
              </Badge>
            );
          } else if (prediction === -1) {
            return (
              <Badge variant="secondary">
                Negative
              </Badge>
            );
          } else {
            return (
              <Badge variant="outline">
                Not available
              </Badge>
            );
          }
        },
      }),
      columnHelper.accessor('ffHelixPercent', {
        header: 'FF-Helix %',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="font-mono">
              {value !== undefined ? `${value.toFixed(1)}%` : 'Not available'}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/peptides/${info.row.original.id}`);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
        ),
      }),
    ],
    [navigate]
  );

  const table = useReactTable({
    data: peptides,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  const exportToCSV = () => {
    const filteredData = table.getFilteredRowModel().rows.map(row => row.original);
    
    const headers = [
      'ID',
      'Species',
      'Sequence',
      'Length',
      'Hydrophobicity',
      'Hydrophobic_Moment',
      'Charge',
      'Chameleon_Prediction',
      'FF_Helix_Percent',
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredData.map(peptide => [
        peptide.id,
        peptide.species || '',
        peptide.sequence,
        peptide.length,
        peptide.hydrophobicity,
        peptide.muH || '',
        peptide.charge,
        peptide.chameleonPrediction,
        peptide.ffHelixPercent || '',
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `peptide_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${filteredData.length} peptides to CSV`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search peptides..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={exportToCSV} size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/peptides/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} peptides
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
