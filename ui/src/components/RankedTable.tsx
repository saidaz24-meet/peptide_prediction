/**
 * Ranked peptide table with percentile score bars.
 *
 * Displays the top-N candidates with composite + category score bars.
 * Row click navigates to /peptides/:id.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScoreBar } from '@/components/ScoreBar';
import {
  type PeptideRanking,
  type RankingCategory,
  METRIC_CATEGORIES,
  METRIC_LABELS,
  CATEGORY_LABELS,
  type RankingMetric,
} from '@/lib/ranking';
import { Abbr } from '@/components/Abbr';
import type { Peptide } from '@/types/peptide';

interface RankedTableProps {
  peptides: Peptide[];
  rankings: PeptideRanking[];
  topN: number;
}

type RankedRow = {
  rank: number;
  peptide: Peptide;
  ranking: PeptideRanking;
};

const columnHelper = createColumnHelper<RankedRow>();

/** Format metric breakdown for tooltip */
function categoryBreakdown(
  ranking: PeptideRanking,
  category: RankingCategory,
): string {
  const metrics = (Object.entries(METRIC_CATEGORIES) as [RankingMetric, RankingCategory][])
    .filter(([, cat]) => cat === category)
    .map(([metric]) => {
      const pct = ranking.metricPercentiles[metric];
      return `${METRIC_LABELS[metric]}: ${pct != null ? Math.round(pct) : 'N/A'}`;
    });
  return metrics.join('\n');
}

export function RankedTable({ peptides, rankings, topN }: RankedTableProps) {
  const navigate = useNavigate();

  const rows: RankedRow[] = useMemo(() => {
    // Sort by composite score descending, take topN
    const sorted = [...rankings]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, Math.max(1, topN));

    return sorted.map((ranking, i) => ({
      rank: i + 1,
      peptide: peptides.find(p => p.id === ranking.peptideId)!,
      ranking,
    })).filter(r => r.peptide != null);
  }, [peptides, rankings, topN]);

  const columns = useMemo(() => [
    columnHelper.accessor('rank', {
      header: '#',
      cell: (info) => (
        <span className="font-mono text-muted-foreground">{info.getValue()}</span>
      ),
      size: 40,
    }),
    columnHelper.accessor(r => r.peptide.id, {
      id: 'entry',
      header: 'Entry',
      cell: (info) => (
        <span className="font-mono text-sm font-medium truncate max-w-[120px] block">
          {info.getValue()}
        </span>
      ),
      size: 130,
    }),
    columnHelper.accessor(r => r.ranking.compositeScore, {
      id: 'composite',
      header: 'Composite',
      cell: (info) => (
        <div className="min-w-[100px]">
          <ScoreBar score={info.getValue()} size="md" />
        </div>
      ),
      size: 140,
    }),
    ...(['physicochemical', 'structural', 'aggregation'] as RankingCategory[]).map(cat =>
      columnHelper.accessor(r => r.ranking.categoryScores[cat], {
        id: cat,
        header: () => cat === 'aggregation'
          ? <><Abbr title="Aggregation & Structural Switching">Agg & Switch</Abbr></>
          : CATEGORY_LABELS[cat],
        cell: (info) => {
          const score = info.getValue();
          const ranking = info.row.original.ranking;
          if (score == null) {
            return <span className="text-muted-foreground text-xs">N/A</span>;
          }
          return (
            <TooltipProvider delayDuration={200}>
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="min-w-[90px] cursor-help">
                    <ScoreBar score={score} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <pre className="text-xs whitespace-pre-wrap">
                    {categoryBreakdown(ranking, cat)}
                  </pre>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          );
        },
        size: 130,
      }),
    ),
    columnHelper.accessor(r => r.peptide.length, {
      id: 'length',
      header: 'Len',
      cell: (info) => (
        <span className="font-mono text-xs">{info.getValue() ?? '-'}</span>
      ),
      size: 50,
    }),
  ], []);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No peptides to rank.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => {
            const peptideId = row.original.peptide.id;
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/peptides/${peptideId}`)}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
