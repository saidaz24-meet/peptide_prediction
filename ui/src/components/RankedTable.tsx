/**
 * Ranked peptide table with per-metric percentile columns.
 *
 * Displays the top-N candidates with composite score + per-metric score bars.
 * Row click navigates to /peptides/:id.
 *
 * Peleg FIX-013 / Wave Q.3: the Consensus tier column has been removed —
 * tier system is unjustified scientifically and must not surface to users.
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
        header: () => (
          <span
            className="cursor-help underline decoration-dotted underline-offset-2"
            title="Percentile rank within this dataset (0-100), weighted across the selected metrics. Higher = better."
          >
            Score (0-100)
          </span>
        ),
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
          // F11 (Peleg Wave 2.5): per-metric cells show PERCENTILE RANK
          // (0-100 within this database), not the raw metric value. The
          // composite column header already says "Score (0-100)"; do the
          // same for each metric column so users don't mistake the cells
          // for raw S4PRED helix percent / TANGO peak / etc.
          header: () => (
            <span
              className="cursor-help underline decoration-dotted underline-offset-2"
              title={`Percentile rank for ${METRIC_LABELS[metric]} within this database (0-100). Higher = the peptide is more extreme on this metric relative to the others. Click the column to sort.`}
            >
              {METRIC_LABELS[metric]}{" "}
              <span className="text-muted-foreground/70 font-normal">(pctile)</span>
            </span>
          ),
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
      // Wave Q.3 / Peleg FIX-013: Consensus tier column removed.
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
