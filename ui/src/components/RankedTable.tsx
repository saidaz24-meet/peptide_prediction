/**
 * Ranked peptide table with per-metric percentile columns and consensus badge.
 *
 * Displays the top-N candidates with composite score + per-metric score bars.
 * Row click navigates to /peptides/:id.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreBar } from "@/components/ScoreBar";
import { ConsensusBadge } from "@/components/ConsensusBadge";
import { getConsensusSS, type ConsensusResult } from "@/lib/consensus";
import { type PeptideRanking, type RankingMetric, METRIC_LABELS } from "@/lib/ranking";
import type { Peptide } from "@/types/peptide";

interface RankedTableProps {
  peptides: Peptide[];
  rankings: PeptideRanking[];
  topN: number;
  activeMetrics: RankingMetric[];
}

type RankedRow = {
  rank: number;
  peptide: Peptide;
  ranking: PeptideRanking;
  consensus: ConsensusResult;
};

const columnHelper = createColumnHelper<RankedRow>();

export function RankedTable({ peptides, rankings, topN, activeMetrics }: RankedTableProps) {
  const navigate = useNavigate();

  const rows: RankedRow[] = useMemo(() => {
    const sorted = [...rankings]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, Math.max(1, topN));

    return sorted
      .map((ranking, i) => {
        const peptide = peptides.find((p) => p.id === ranking.peptideId);
        if (!peptide) return null;
        return {
          rank: i + 1,
          peptide,
          ranking,
          consensus: getConsensusSS(peptide),
        };
      })
      .filter((r): r is RankedRow => r != null);
  }, [peptides, rankings, topN]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("rank", {
        header: "#",
        cell: (info) => <span className="font-mono text-muted-foreground">{info.getValue()}</span>,
        size: 40,
      }),
      columnHelper.accessor((r) => r.peptide.id, {
        id: "entry",
        header: "Entry",
        cell: (info) => (
          <span className="font-mono text-sm font-medium truncate max-w-[120px] block">
            {info.getValue()}
          </span>
        ),
        size: 130,
      }),
      columnHelper.accessor((r) => r.ranking.compositeScore, {
        id: "composite",
        header: "Score",
        cell: (info) => (
          <div className="min-w-[100px]">
            <ScoreBar score={info.getValue()} size="md" />
          </div>
        ),
        size: 140,
      }),
      // Dynamic per-metric columns
      ...activeMetrics.map((metric) =>
        columnHelper.accessor((r) => r.ranking.metricPercentiles[metric], {
          id: metric,
          header: METRIC_LABELS[metric],
          cell: (info) => {
            const score = info.getValue();
            if (score == null) {
              return <span className="text-muted-foreground text-xs">N/A</span>;
            }
            return (
              <div className="min-w-[70px]">
                <ScoreBar score={score} size="sm" />
              </div>
            );
          },
          size: 110,
        })
      ),
      // Consensus tier badge
      columnHelper.accessor((r) => r.consensus, {
        id: "consensus",
        header: "Consensus",
        cell: (info) => <ConsensusBadge consensus={info.getValue()} />,
        size: 120,
        enableSorting: false,
      }),
      columnHelper.accessor((r) => r.peptide.length, {
        id: "length",
        header: "Len",
        cell: (info) => <span className="font-mono text-xs">{info.getValue() ?? "-"}</span>,
        size: 50,
      }),
    ],
    [activeMetrics]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No peptides to rank.</div>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
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
          {table.getRowModel().rows.map((row) => {
            const peptideId = row.original.peptide.id;
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/peptides/${peptideId}`)}
              >
                {row.getVisibleCells().map((cell) => (
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
