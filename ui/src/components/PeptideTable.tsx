import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Eye, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Peptide } from '@/types/peptide';
import { toast } from 'react-hot-toast';
import { TangoBadge } from '@/components/TangoBadge';
import { S4PredBadge } from '@/components/S4PredBadge';

// --- Column filter types ---
type CategoricalFilterValue = 'all' | '1' | '-1' | '0' | 'null';

interface ColumnFilters {
  sswPrediction: CategoricalFilterValue;
  ffHelixFlag: CategoricalFilterValue;
  ffSswFlag: CategoricalFilterValue;
  s4predHelixPrediction: CategoricalFilterValue;
  chargeMin: string;
  chargeMax: string;
  hydrophobicityMin: string;
  hydrophobicityMax: string;
  muHMin: string;
  muHMax: string;
  ffHelixPercentMin: string;
  ffHelixPercentMax: string;
  lengthMin: string;
  lengthMax: string;
  species: string;
}

const EMPTY_FILTERS: ColumnFilters = {
  sswPrediction: 'all',
  ffHelixFlag: 'all',
  ffSswFlag: 'all',
  s4predHelixPrediction: 'all',
  chargeMin: '', chargeMax: '',
  hydrophobicityMin: '', hydrophobicityMax: '',
  muHMin: '', muHMax: '',
  ffHelixPercentMin: '', ffHelixPercentMax: '',
  lengthMin: '', lengthMax: '',
  species: '',
};

function matchesCategorical(value: number | null | undefined, filter: CategoricalFilterValue): boolean {
  if (filter === 'all') return true;
  if (filter === 'null') return value == null;
  return value === Number(filter);
}

function matchesRange(value: number | null | undefined, min: string, max: string): boolean {
  if (value == null) return true; // show null values unless explicitly excluded
  if (min !== '' && value < Number(min)) return false;
  if (max !== '' && value > Number(max)) return false;
  return true;
}

function countActiveFilters(filters: ColumnFilters): number {
  let count = 0;
  if (filters.sswPrediction !== 'all') count++;
  if (filters.ffHelixFlag !== 'all') count++;
  if (filters.ffSswFlag !== 'all') count++;
  if (filters.s4predHelixPrediction !== 'all') count++;
  if (filters.chargeMin || filters.chargeMax) count++;
  if (filters.hydrophobicityMin || filters.hydrophobicityMax) count++;
  if (filters.muHMin || filters.muHMax) count++;
  if (filters.ffHelixPercentMin || filters.ffHelixPercentMax) count++;
  if (filters.lengthMin || filters.lengthMax) count++;
  if (filters.species) count++;
  return count;
}

interface PeptideTableProps {
  peptides: Peptide[];
}

const columnHelper = createColumnHelper<Peptide>();

export function PeptideTable({ peptides }: PeptideTableProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const navigate = useNavigate();

  const activeFilterCount = useMemo(() => countActiveFilters(columnFilters), [columnFilters]);

  // Apply column filters before passing to TanStack (handles hidden columns like ffHelixFlag)
  const filteredByColumns = useMemo(() => {
    return peptides.filter(p => {
      if (!matchesCategorical(p.sswPrediction, columnFilters.sswPrediction)) return false;
      if (!matchesCategorical(p.ffHelixFlag, columnFilters.ffHelixFlag)) return false;
      if (!matchesCategorical(p.ffSswFlag, columnFilters.ffSswFlag)) return false;
      if (!matchesCategorical(p.s4predHelixPrediction, columnFilters.s4predHelixPrediction)) return false;
      if (!matchesRange(p.charge, columnFilters.chargeMin, columnFilters.chargeMax)) return false;
      if (!matchesRange(p.hydrophobicity, columnFilters.hydrophobicityMin, columnFilters.hydrophobicityMax)) return false;
      if (!matchesRange(p.muH, columnFilters.muHMin, columnFilters.muHMax)) return false;
      if (!matchesRange(p.ffHelixPercent, columnFilters.ffHelixPercentMin, columnFilters.ffHelixPercentMax)) return false;
      if (!matchesRange(p.length, columnFilters.lengthMin, columnFilters.lengthMax)) return false;
      if (columnFilters.species && !(p.species || '').toLowerCase().includes(columnFilters.species.toLowerCase())) return false;
      return true;
    });
  }, [peptides, columnFilters]);

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
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="font-mono">
              {value != null ? value.toFixed(2) : '-'}
            </span>
          );
        },
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
          if (charge == null) return <span className="font-mono">-</span>;
          return (
            <span className="font-mono">
              {charge > 0 ? '+' : ''}{charge.toFixed(1)}
            </span>
          );
        },
      }),
      columnHelper.accessor('sswPrediction', {
        header: 'TANGO SSW',
        cell: (info) => {
          const peptide = info.row.original;
          const prediction = info.getValue();
          // Use canonical tangoHasData field from backend (preferred)
          // Fallback to checking curves if tangoHasData not available
          const hasTangoData = peptide.tangoHasData ?? Boolean(
            peptide.tango?.beta?.length ||
            peptide.tango?.helix?.length ||
            peptide.extra?.['Tango Beta curve']?.length ||
            peptide.extra?.['Tango Helix curve']?.length
          );
          // Use centralized TangoBadge for consistent display semantics
          return (
            <TangoBadge
              providerStatus={peptide.providerStatus?.tango}
              sswPrediction={prediction}
              hasTangoData={hasTangoData}
              showIcon={false}
            />
          );
        },
      }),
      columnHelper.accessor('s4predSswPrediction', {
        header: 'S4PRED SSW',
        cell: (info) => {
          const peptide = info.row.original;
          const prediction = info.getValue();
          // Use canonical s4predHasData field from backend (preferred)
          const hasS4PredData = peptide.s4predHasData ?? Boolean(
            peptide.s4pred?.pH?.length ||
            peptide.s4pred?.pE?.length
          );
          return (
            <S4PredBadge
              providerStatus={peptide.providerStatus?.s4pred}
              sswPrediction={prediction}
              hasS4PredData={hasS4PredData}
              showIcon={false}
            />
          );
        },
      }),
      columnHelper.accessor('s4predHelixPercent', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 p-0 font-medium"
          >
            S4PRED Helix %
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="font-mono">
              {value != null ? `${value.toFixed(1)}%` : '-'}
            </span>
          );
        },
      }),
      columnHelper.accessor('ffHelixPercent', {
        header: 'FF-Helix %',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="font-mono">
              {value != null ? `${value.toFixed(1)}%` : '-'}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const peptideId = info.row.original.id;
          const isValid = peptideId && String(peptideId).trim().length > 0;
          return (
            <Button
              variant="ghost"
              size="sm"
              disabled={!isValid}
              title={isValid ? 'View details' : 'ID is missing'}
              onClick={(e) => {
                e.stopPropagation();
                if (isValid) {
                  navigate(`/peptides/${peptideId}`);
                }
              }}
            >
              <Eye className="w-4 h-4" />
            </Button>
          );
        },
      }),
    ],
    [navigate]
  );

  const table = useReactTable({
    data: filteredByColumns,
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
      'TANGO_SSW_Prediction',
      'S4PRED_SSW_Prediction',
      'S4PRED_Helix_Percent',
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
        peptide.sswPrediction ?? '',
        peptide.s4predSswPrediction ?? '',
        peptide.s4predHelixPercent ?? '',
        peptide.ffHelixPercent ?? '',
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

        <div className="flex items-center space-x-2">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Button onClick={exportToCSV} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-md border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Column Filters</span>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setColumnFilters(EMPTY_FILTERS)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>

              {/* Row 1: Categorical filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* SSW Prediction */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">SSW Prediction</label>
                  <Select
                    value={columnFilters.sswPrediction}
                    onValueChange={(v) => setColumnFilters(f => ({ ...f, sswPrediction: v as CategoricalFilterValue }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">Positive</SelectItem>
                      <SelectItem value="-1">Negative</SelectItem>
                      <SelectItem value="0">Uncertain</SelectItem>
                      <SelectItem value="null">Missing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* FF-Helix Flag */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">FF-Helix Flag</label>
                  <Select
                    value={columnFilters.ffHelixFlag}
                    onValueChange={(v) => setColumnFilters(f => ({ ...f, ffHelixFlag: v as CategoricalFilterValue }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">Candidate</SelectItem>
                      <SelectItem value="-1">Not Candidate</SelectItem>
                      <SelectItem value="null">No Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* FF-SSW Flag */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">FF-SSW Flag</label>
                  <Select
                    value={columnFilters.ffSswFlag}
                    onValueChange={(v) => setColumnFilters(f => ({ ...f, ffSswFlag: v as CategoricalFilterValue }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">Candidate</SelectItem>
                      <SelectItem value="-1">Not Candidate</SelectItem>
                      <SelectItem value="null">No Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* S4PRED Helix */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">S4PRED Helix</label>
                  <Select
                    value={columnFilters.s4predHelixPrediction}
                    onValueChange={(v) => setColumnFilters(f => ({ ...f, s4predHelixPrediction: v as CategoricalFilterValue }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">Positive</SelectItem>
                      <SelectItem value="-1">Negative</SelectItem>
                      <SelectItem value="0">Uncertain</SelectItem>
                      <SelectItem value="null">Missing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Numeric range filters + species */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Charge */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Charge</label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={columnFilters.chargeMin}
                      onChange={(e) => setColumnFilters(f => ({ ...f, chargeMin: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={columnFilters.chargeMax}
                      onChange={(e) => setColumnFilters(f => ({ ...f, chargeMax: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Hydrophobicity */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Hydrophobicity</label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Min"
                      value={columnFilters.hydrophobicityMin}
                      onChange={(e) => setColumnFilters(f => ({ ...f, hydrophobicityMin: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Max"
                      value={columnFilters.hydrophobicityMax}
                      onChange={(e) => setColumnFilters(f => ({ ...f, hydrophobicityMax: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* μH */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">μH</label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Min"
                      value={columnFilters.muHMin}
                      onChange={(e) => setColumnFilters(f => ({ ...f, muHMin: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Max"
                      value={columnFilters.muHMax}
                      onChange={(e) => setColumnFilters(f => ({ ...f, muHMax: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* FF-Helix % */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">FF-Helix %</label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="1"
                      placeholder="Min"
                      value={columnFilters.ffHelixPercentMin}
                      onChange={(e) => setColumnFilters(f => ({ ...f, ffHelixPercentMin: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="1"
                      placeholder="Max"
                      value={columnFilters.ffHelixPercentMax}
                      onChange={(e) => setColumnFilters(f => ({ ...f, ffHelixPercentMax: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Length */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Length</label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="1"
                      placeholder="Min"
                      value={columnFilters.lengthMin}
                      onChange={(e) => setColumnFilters(f => ({ ...f, lengthMin: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="1"
                      placeholder="Max"
                      value={columnFilters.lengthMax}
                      onChange={(e) => setColumnFilters(f => ({ ...f, lengthMax: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Species */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Species</label>
                  <Input
                    placeholder="Search..."
                    value={columnFilters.species}
                    onChange={(e) => setColumnFilters(f => ({ ...f, species: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              table.getRowModel().rows.map((row) => {
                const peptideId = row.original.id;
                const isValid = peptideId && String(peptideId).trim().length > 0;
                return (
                  <TableRow
                    key={row.id}
                    className={isValid ? "cursor-pointer hover:bg-muted/50" : "opacity-50 cursor-not-allowed"}
                    onClick={() => {
                      if (isValid) {
                        navigate(`/peptides/${peptideId}`);
                      }
                    }}
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
                );
              })
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
          {activeFilterCount > 0 && ` (${peptides.length} total, ${filteredByColumns.length} matched filters)`}
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
