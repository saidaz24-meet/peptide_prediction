import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Filter,
  Info,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Peptide } from "@/types/peptide";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { TangoBadge } from "@/components/TangoBadge";
import { S4PredBadge } from "@/components/S4PredBadge";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { CsvExportDialog } from "@/components/CsvExportDialog";

/**
 * Compute mean per-residue S4PRED probabilities for hover preview.
 *
 * Returns probability means (0..1), not percentages, to avoid colliding with
 * the segment-based "Helix %" column. See HELIX_PERCENTAGE_AUDIT.md.
 *
 * Exported for unit testing only.
 */
export function getS4PredComposition(p: Peptide): string | null {
  const pH = p.s4pred?.pH;
  const pE = p.s4pred?.pE;
  const pC = p.s4pred?.pC;
  if (!pH?.length && !pE?.length) return null;
  const n = Math.max(pH?.length ?? 0, pE?.length ?? 0, pC?.length ?? 0);
  if (n === 0) return null;
  const meanH = (pH?.reduce((a, b) => a + b, 0) ?? 0) / n;
  const meanE = (pE?.reduce((a, b) => a + b, 0) ?? 0) / n;
  const meanC = (pC?.reduce((a, b) => a + b, 0) ?? 0) / n;
  return `Dominant: H ${meanH.toFixed(2)} · E ${meanE.toFixed(2)} · C ${meanC.toFixed(2)}`;
}

/** Compact info-icon tooltip for column headers */
function HeaderTip({ tip }: { tip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <Info className="ml-1 inline h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
          {tip}
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

// --- Column filter types ---
type CategoricalFilterValue = "all" | "1" | "-1" | "0" | "null";

// PELEG-Q1-RESOLVED: ffHelixPercentMin/Max filters dropped (FF-Helix %
// column removed per Said+Peleg 2026-05-06).
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
  lengthMin: string;
  lengthMax: string;
  species: string;
}

const EMPTY_FILTERS: ColumnFilters = {
  sswPrediction: "all",
  ffHelixFlag: "all",
  ffSswFlag: "all",
  s4predHelixPrediction: "all",
  chargeMin: "",
  chargeMax: "",
  hydrophobicityMin: "",
  hydrophobicityMax: "",
  muHMin: "",
  muHMax: "",
  lengthMin: "",
  lengthMax: "",
  species: "",
};

function matchesCategorical(
  value: number | null | undefined,
  filter: CategoricalFilterValue
): boolean {
  if (filter === "all") return true;
  if (filter === "null") return value == null;
  return value === Number(filter);
}

function matchesRange(value: number | null | undefined, min: string, max: string): boolean {
  if (value == null) return true; // show null values unless explicitly excluded
  if (min !== "" && value < Number(min)) return false;
  if (max !== "" && value > Number(max)) return false;
  return true;
}

function countActiveFilters(filters: ColumnFilters): number {
  let count = 0;
  if (filters.sswPrediction !== "all") count++;
  if (filters.ffHelixFlag !== "all") count++;
  if (filters.ffSswFlag !== "all") count++;
  if (filters.s4predHelixPrediction !== "all") count++;
  if (filters.chargeMin || filters.chargeMax) count++;
  if (filters.hydrophobicityMin || filters.hydrophobicityMax) count++;
  if (filters.muHMin || filters.muHMax) count++;
  if (filters.lengthMin || filters.lengthMax) count++;
  if (filters.species) count++;
  return count;
}

interface PeptideTableProps {
  peptides: Peptide[];
}

const columnHelper = createColumnHelper<Peptide>();

export function PeptideTable({ peptides }: PeptideTableProps) {
  const isMobile = useIsMobile();
  const [globalFilter, setGlobalFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  // §I: which export dialog (if any) is currently open. null = closed.
  const [csvDialog, setCsvDialog] = useState<"filtered" | "full" | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  // Peleg FIX-006: default column visibility must be identical regardless of
  // data source (CSV upload, Quick Analyze, UniProt query). Gene name and
  // Protein function are kept off by default; users enable via Columns dropdown.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    species: false, // Secondary info — available via detail view
    geneName: false, // Optional: toggle via Columns dropdown
    proteinFunction: false, // Optional: toggle via Columns dropdown
    s4predSswPrediction: false, // S4PRED SSW is secondary to TANGO SSW
    // PELEG-Q1-RESOLVED: ffHelixPercent column removed entirely.
    tangoSswResidues: false, // TANGO SSW residue overlap count — advanced
  });
  const navigate = useNavigate();
  const { tableFilter, setTableFilter } = useChartSelection();

  // Hide dense columns on mobile — user can re-enable via Columns dropdown
  useEffect(() => {
    if (isMobile) {
      setColumnVisibility((prev) => ({
        ...prev,
        sequence: false,
        charge: false,
        hydrophobicity: false,
        muH: false,
        ffSswFlag: false,
        helixBinary: false,
        s4predHelixPercent: false,
        species: false,
        geneName: false,
        proteinFunction: false,
      }));
    }
  }, [isMobile]);

  const activeFilterCount = useMemo(() => countActiveFilters(columnFilters), [columnFilters]);

  // Apply column filters + KPI table filter before passing to TanStack
  const filteredByColumns = useMemo(() => {
    return peptides.filter((p) => {
      // KPI-driven filter
      if (tableFilter) {
        const val = (p as any)[tableFilter.field];
        if (val !== tableFilter.value) return false;
      }
      if (!matchesCategorical(p.sswPrediction, columnFilters.sswPrediction)) return false;
      if (!matchesCategorical(p.ffHelixFlag, columnFilters.ffHelixFlag)) return false;
      if (!matchesCategorical(p.ffSswFlag, columnFilters.ffSswFlag)) return false;
      if (!matchesCategorical(p.s4predHelixPrediction, columnFilters.s4predHelixPrediction))
        return false;
      if (!matchesRange(p.charge, columnFilters.chargeMin, columnFilters.chargeMax)) return false;
      if (
        !matchesRange(
          p.hydrophobicity,
          columnFilters.hydrophobicityMin,
          columnFilters.hydrophobicityMax
        )
      )
        return false;
      if (!matchesRange(p.muH, columnFilters.muHMin, columnFilters.muHMax)) return false;
      // PELEG-Q1-RESOLVED: ffHelixPercent range filter removed.
      if (!matchesRange(p.length, columnFilters.lengthMin, columnFilters.lengthMax)) return false;
      if (
        columnFilters.species &&
        !(p.species || "").toLowerCase().includes(columnFilters.species.toLowerCase())
      )
        return false;
      return true;
    });
  }, [peptides, columnFilters, tableFilter]);

  const columns = useMemo(
    () => [
      /* ── Left side: identity & decision columns ── */

      // 1. ID (Entry)
      columnHelper.accessor("id", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const id = String(info.getValue());
          const row = info.row.original;
          const isUniprot = /^[A-Z][0-9][A-Z0-9]{3}[0-9](-\d+)?$/i.test(id);
          const uni = `https://www.uniprot.org/uniprotkb/${id}/entry`;
          return (
            <div className="flex items-center gap-2">
              {isUniprot ? (
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
              ) : (
                <span className="font-mono text-sm">{id}</span>
              )}
              {row.sequenceNotes && (
                <TooltipProvider delayDuration={200}>
                  <UITooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="w-3 h-3 text-[hsl(var(--warning))] inline" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs">
                      {row.sequenceNotes}
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      }),

      // 2. Length
      columnHelper.accessor("length", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            Length
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => <span className="font-mono">{info.getValue()}</span>,
      }),

      // 3. Helix (yes/no binary from S4PRED)
      columnHelper.accessor("s4predHelixPrediction", {
        id: "helixBinary",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            Helix
            <HeaderTip tip="S4PRED helix detection. Helix = segments found with ≥5 consecutive residues at P(Helix) ≥ 0.5." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        // Peleg FIX-005: feature-name-as-text badges. Helix=blue (--helix token).
        // Negative/null → em dash, no red.
        cell: (info) => {
          const value = info.getValue();
          if (value == null) return <span className="text-muted-foreground/50 text-xs">—</span>;
          return value === 1 ? (
            <Badge className="bg-helix text-helix-foreground hover:bg-helix/90 text-xs">
              Helix
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          );
        },
      }),

      // 4. SSW (badge)
      columnHelper.accessor("sswPrediction", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            SSW
            <HeaderTip tip="Secondary Structure Switch — overlapping helix/beta regions detected via TANGO aggregation analysis, suggesting conformational switching potential." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const peptide = info.row.original;
          const prediction = info.getValue();
          const hasTangoData =
            peptide.tangoHasData ??
            Boolean(
              peptide.tango?.beta?.length ||
              peptide.tango?.helix?.length ||
              peptide.extra?.["Tango Beta curve"]?.length ||
              peptide.extra?.["Tango Helix curve"]?.length
            );
          return (
            <TangoBadge
              providerStatus={peptide.providerStatus?.tango}
              sswPrediction={prediction}
              hasTangoData={hasTangoData}
              showIcon={false}
              sswContext={{ sswHelixPercentage: peptide.sswHelixPct, sswDiff: peptide.sswDiff }}
            />
          );
        },
      }),

      // 5. FF-Helix (badge)
      columnHelper.accessor("ffHelixFlag", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            FF-Helix
            <HeaderTip tip="Fibril-forming helix candidate. Based on S4PRED helix μH ≥ database average — helix detected with amphipathic character above threshold." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        // Peleg FIX-005: feature-name text + --ff-helix token. Negative/null → em dash.
        cell: (info) => {
          const value = info.getValue();
          if (value == null) return <span className="text-muted-foreground/50 text-xs">—</span>;
          return value === 1 ? (
            <Badge className="bg-ff-helix text-ff-helix-foreground hover:bg-ff-helix/90 text-xs">
              FF-Helix
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          );
        },
      }),

      // 6. FF-SSW (badge)
      columnHelper.accessor("ffSswFlag", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            FF-SSW
            <HeaderTip tip="Fibril-forming SSW candidate. Requires SSW prediction AND hydrophobicity ≥ database average — structural switch with hydrophobic core." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        // Peleg FIX-005: feature-name text + --ff-ssw token. Negative/null → em dash.
        cell: (info) => {
          const value = info.getValue();
          if (value == null) return <span className="text-muted-foreground/50 text-xs">—</span>;
          return value === 1 ? (
            <Badge className="bg-ff-ssw text-ff-ssw-foreground hover:bg-ff-ssw/90 text-xs">
              FF-SSW
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          );
        },
      }),

      /* ── Right side: bio calculations ── */

      // 7. Helix %
      columnHelper.accessor("s4predHelixPercent", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            Helix %
            <HeaderTip tip="S4PRED helix content (context-dependent). Percentage of residues predicted as helical." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const value = info.getValue();
          return <span className="font-mono">{value != null ? `${value.toFixed(1)}%` : "-"}</span>;
        },
      }),

      // 8. Charge
      columnHelper.accessor("charge", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            Charge
            <HeaderTip tip="Net charge at pH 7.0. Positive charge enhances electrostatic interaction with negatively charged membranes." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const charge = info.getValue();
          if (charge == null) return <span className="font-mono">-</span>;
          return (
            <span className="font-mono">
              {charge > 0 ? "+" : ""}
              {charge.toFixed(1)}
            </span>
          );
        },
      }),

      // 9. Hydrophobicity (H)
      columnHelper.accessor("hydrophobicity", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            H
            <HeaderTip tip="Hydrophobicity. Higher values = greater preference for non-polar environments, correlating with membrane affinity." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const value = info.getValue();
          return <span className="font-mono">{value != null ? value.toFixed(2) : "-"}</span>;
        },
      }),

      // 10. μH
      columnHelper.accessor("muH", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            μH
            <HeaderTip tip="Hydrophobic moment — measures amphipathic character. Values > 0.5 suggest strong hydrophobic/hydrophilic face separation." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => <span className="font-mono">{info.getValue()?.toFixed(2) || "-"}</span>,
      }),

      // PELEG-Q1-RESOLVED: FF-Helix % column removed from table (Chou-Fasman
      // propensity dropped from UI per Said+Peleg 2026-05-06; backend field
      // retained for back-compat). FF-Helix CANDIDATE (ffHelixFlag) is a
      // separate column above and remains the user-facing classification.

      /* ── Far right: optional metadata (via column toggle) ── */

      // 12. Organism
      columnHelper.accessor("species", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            Organism
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => info.getValue() || "-",
      }),

      // 13. Gene Name
      columnHelper.accessor("geneName", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            Gene
            <HeaderTip tip="Gene name from UniProt, when available." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => info.getValue() || "-",
      }),

      // 14. Function
      columnHelper.accessor("proteinFunction", {
        header: () => (
          <span className="font-medium">
            Function
            <HeaderTip tip="Protein function annotation from UniProt." />
          </span>
        ),
        cell: (info) => {
          const val = info.getValue();
          if (!val) return "-";
          const truncated = val.length > 60 ? val.slice(0, 60) + "…" : val;
          return (
            <TooltipProvider delayDuration={200}>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs cursor-help">{truncated}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[400px] text-xs leading-relaxed">
                  {val}
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          );
        },
      }),

      /* ── Hidden by default: advanced columns ── */

      // SSW Residues
      columnHelper.accessor(
        (row) => {
          const helix = row.tango?.helix;
          const beta = row.tango?.beta;
          if (!helix?.length || !beta?.length) return null;
          const total = Math.min(helix.length, beta.length);
          let count = 0;
          for (let i = 0; i < total; i++) {
            if (helix[i] > 0 && beta[i] > 0) count++;
          }
          return count;
        },
        {
          id: "tangoSswResidues",
          header: ({ column }) => (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-8 p-0 font-medium"
            >
              SSW Residues
              <HeaderTip tip="Count of residues where both helix and beta curves are > 0, indicating potential secondary structure switch regions." />
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          ),
          cell: (info) => {
            const p = info.row.original;
            const helix = p.tango?.helix;
            const beta = p.tango?.beta;
            if (!helix?.length || !beta?.length)
              return <span className="text-muted-foreground">-</span>;
            const total = Math.min(helix.length, beta.length);
            const count = info.getValue() ?? 0;
            const pct = total > 0 ? (((count as number) / total) * 100).toFixed(1) : "0.0";
            return (
              <span className="font-mono text-xs">
                {count}/{total} ({pct}%)
              </span>
            );
          },
        }
      ),

      // S4PRED SSW (hidden by default)
      columnHelper.accessor("s4predSswPrediction", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 p-0 font-medium"
          >
            S4PRED SSW
            <HeaderTip tip="Secondary Structure Switch from S4PRED. Compares helix/beta probabilities to detect structure-switching regions." />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: (info) => {
          const peptide = info.row.original;
          const prediction = info.getValue();
          const hasS4PredData =
            peptide.s4predHasData ??
            Boolean(peptide.s4pred?.pH?.length || peptide.s4pred?.pE?.length);
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
      columnVisibility,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: "includesString",
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  const escapeCSV = (val: unknown): string => {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  /** Format segments as "start-end;start-end" for CSV */
  const fmtFragments = (frags: any): string => {
    if (!Array.isArray(frags) || frags.length === 0) return "";
    return frags
      .map((f: any) => {
        if (Array.isArray(f)) return `${f[0]}-${f[1]}`;
        if (f && typeof f === "object" && "start" in f) return `${f.start}-${f.end}`;
        return String(f);
      })
      .join(";");
  };

  // PELEG-SSW-SCORE-RESOLVED: SSW score / SSW diff / S4PRED SSW diff dropped
  //   per Peleg "no real meaning" (FIX-023.3 broader sweep, 2026-05-06).
  // PELEG-Q1-RESOLVED: FF-Helix score (Chou-Fasman) dropped from default export.
  const GOLD_STANDARD_HEADERS = [
    "Entry",
    "Sequence",
    "Length",
    "Charge",
    "Hydrophobicity",
    "Full length uH",
    "Beta full length uH",
    "SSW prediction",
    "SSW helix percentage",
    "SSW beta percentage",
    "SSW fragments",
    "Helix percentage (S4PRED)",
    "Helix score (S4PRED)",
    "Helix fragments (S4PRED)",
    "S4PRED SSW prediction",
    "TANGO Agg Max",
    "FF-Secondary structure switch",
    "FF-SSW score",
    "FF-Helix",
    "Species",
    "Protein names",
  ];

  const peptideToRow = (p: Peptide) => [
    p.id,
    p.sequence,
    p.length,
    p.charge,
    p.hydrophobicity,
    p.muH ?? "",
    p.extra?.["Beta full length uH"] ?? "",
    p.sswPrediction ?? "",
    p.sswHelixPct ?? "",
    p.sswBetaPct ?? "",
    fmtFragments(p.extra?.["SSW fragments"]),
    p.s4predHelixPercent ?? "",
    p.s4predHelixScore ?? "",
    fmtFragments(p.s4predHelixFragments),
    p.s4predSswPrediction ?? "",
    p.tangoAggMax ?? "",
    p.ffSswFlag ?? "",
    p.ffSswScore ?? "",
    p.ffHelixFlag ?? "",
    p.species || "",
    p.name || "",
  ];

  const buildCSV = (data: Peptide[]) =>
    [
      GOLD_STANDARD_HEADERS.join(","),
      ...data.map((p) => peptideToRow(p).map(escapeCSV).join(",")),
    ].join("\n");

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // §I: route both export buttons through CsvExportDialog so the user sees a
  // metadata preview (predictor versions, thresholds, run timestamp) before
  // the download fires. The dialog calls `onConfirm` which runs the original
  // download path; cancelling does nothing.
  const performExportFiltered = () => {
    const filteredData = table.getFilteredRowModel().rows.map((row) => row.original);
    const filename = `peptide_data_${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(buildCSV(filteredData), filename);
    toast.success(`Exported ${filteredData.length} peptides to CSV`);
  };

  const performExportFull = () => {
    const filename = `peptide_data_full_${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(buildCSV(peptides), filename);
    toast.success(`Exported all ${peptides.length} peptides to CSV`);
  };

  const filteredCount = table.getFilteredRowModel().rows.length;
  const todayStamp = new Date().toISOString().split("T")[0];
  const filteredFilename = `peptide_data_${todayStamp}.csv`;
  const fullFilename = `peptide_data_full_${todayStamp}.csv`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search peptides..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm min-w-0"
          />
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="w-[130px] sm:w-[180px]">
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

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle column filters"
          >
            <Filter className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" title="Show/hide table columns">
                <Columns3 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((col) => col.getCanHide())
                .map((col) => {
                  const labels: Record<string, string> = {
                    id: "ID",
                    length: "Length",
                    helixBinary: "Helix",
                    sswPrediction: "SSW",
                    ffHelixFlag: "FF-Helix",
                    ffSswFlag: "FF-SSW",
                    s4predHelixPercent: "Helix %",
                    charge: "Charge",
                    hydrophobicity: "Hydrophobicity",
                    muH: "μH",
                    species: "Organism",
                    geneName: "Gene",
                    proteinFunction: "Function",
                    tangoSswResidues: "SSW Residues",
                    s4predSswPrediction: "S4PRED SSW",
                  };
                  return (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={col.getIsVisible()}
                      onCheckedChange={(v) => col.toggleVisibility(!!v)}
                    >
                      {labels[col.id] ?? col.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => setCsvDialog("filtered")}
            size="sm"
            variant="outline"
            title="Export filtered rows as CSV"
            data-testid="peptide-table-export-filtered"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export Filtered</span>
          </Button>
          <Button
            onClick={() => setCsvDialog("full")}
            size="sm"
            title="Export all rows as CSV"
            data-testid="peptide-table-export-full"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export All</span>
          </Button>
        </div>
      </div>

      {/* KPI-driven filter badge */}
      {tableFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Filtered by: {tableFilter.label}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setTableFilter(null)}
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-md border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Column Filters</span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setColumnFilters(EMPTY_FILTERS)}>
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
                    onValueChange={(v) =>
                      setColumnFilters((f) => ({
                        ...f,
                        sswPrediction: v as CategoricalFilterValue,
                      }))
                    }
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
                  <label className="text-xs text-muted-foreground">
                    FF-Helix Flag (S4PRED-based)
                  </label>
                  <Select
                    value={columnFilters.ffHelixFlag}
                    onValueChange={(v) =>
                      setColumnFilters((f) => ({ ...f, ffHelixFlag: v as CategoricalFilterValue }))
                    }
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
                    onValueChange={(v) =>
                      setColumnFilters((f) => ({ ...f, ffSswFlag: v as CategoricalFilterValue }))
                    }
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
                    onValueChange={(v) =>
                      setColumnFilters((f) => ({
                        ...f,
                        s4predHelixPrediction: v as CategoricalFilterValue,
                      }))
                    }
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
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, chargeMin: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={columnFilters.chargeMax}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, chargeMax: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, hydrophobicityMin: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Max"
                      value={columnFilters.hydrophobicityMax}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, hydrophobicityMax: e.target.value }))
                      }
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
                      onChange={(e) => setColumnFilters((f) => ({ ...f, muHMin: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Max"
                      value={columnFilters.muHMax}
                      onChange={(e) => setColumnFilters((f) => ({ ...f, muHMax: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* PELEG-Q1-RESOLVED: FF-Helix % / CF Propensity range filter removed. */}

                {/* Length */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Length</label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="1"
                      placeholder="Min"
                      value={columnFilters.lengthMin}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, lengthMin: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      step="1"
                      placeholder="Max"
                      value={columnFilters.lengthMax}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, lengthMax: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Organism */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Organism</label>
                  <Input
                    placeholder="Search..."
                    value={columnFilters.species}
                    onChange={(e) => setColumnFilters((f) => ({ ...f, species: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto max-h-[70vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <TooltipProvider delayDuration={400}>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const p = row.original;
                  const isValid = p.id && String(p.id).trim().length > 0;
                  const composition = getS4PredComposition(p);

                  return (
                    <UITooltip key={row.id}>
                      <TooltipTrigger asChild>
                        <TableRow
                          className={
                            isValid
                              ? "cursor-pointer hover:bg-muted/50"
                              : "opacity-50 cursor-not-allowed"
                          }
                          onClick={() => {
                            if (isValid) {
                              navigate(`/peptides/${p.id}`);
                            }
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TooltipTrigger>
                      {composition && (
                        <TooltipContent side="top" align="start" className="max-w-xs">
                          <div className="space-y-0.5 text-xs">
                            <p className="font-medium">
                              {p.id} ({p.length ?? "?"} amino acids)
                            </p>
                            <p>S4PRED: {composition}</p>
                          </div>
                        </TooltipContent>
                      )}
                    </UITooltip>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TooltipProvider>
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length}{" "}
          peptides
          {activeFilterCount > 0 &&
            ` (${peptides.length} total, ${filteredByColumns.length} matched filters)`}
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
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
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

      {/* §I: pre-export confirmation dialogs — one per export variant. */}
      <CsvExportDialog
        open={csvDialog === "filtered"}
        onOpenChange={(open) => setCsvDialog(open ? "filtered" : null)}
        filename={filteredFilename}
        peptideCount={filteredCount}
        onConfirm={performExportFiltered}
      />
      <CsvExportDialog
        open={csvDialog === "full"}
        onOpenChange={(open) => setCsvDialog(open ? "full" : null)}
        filename={fullFilename}
        peptideCount={peptides.length}
        onConfirm={performExportFull}
      />
    </motion.div>
  );
}
