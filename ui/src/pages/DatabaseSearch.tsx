import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Database,
  ExternalLink,
  ArrowRight,
  CheckSquare,
  Square,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UniProtQueryInput } from "@/components/UniProtQueryInput";
import { useDatasetStore } from "@/stores/datasetStore";
import { BgDotGrid } from "@/components/BgDotGrid";
import AppFooter from "@/components/AppFooter";
import { setNavGuard } from "@/hooks/use-nav-guard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BrowseRow {
  id: string;
  name?: string;
  geneName?: string;
  species?: string;
  length?: number;
  annotationScore?: number;
  proteinFunction?: string;
  sequence: string;
  raw: any; // raw backend row for re-analysis
}

export default function DatabaseSearch() {
  const navigate = useNavigate();
  const { ingestBackendRows } = useDatasetStore();
  const [searchMeta, setSearchMeta] = useState<any>(null);
  const [browseRows, setBrowseRows] = useState<BrowseRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);

  // Navigation guard — warn when search results exist OR analysis is running
  const shouldGuard = browseRows.length > 0 || isLoading;

  useEffect(() => {
    if (!shouldGuard) {
      setNavGuard(false);
      return;
    }
    setNavGuard(true, (dest: string) => {
      setPendingNavPath(dest);
      setShowLeaveDialog(true);
    });
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      setNavGuard(false);
      window.removeEventListener("beforeunload", handler);
    };
  }, [shouldGuard]);

  const handleQueryExecuted = useCallback((rows: any[], meta: any) => {
    setSearchMeta(meta);
    setHasSearched(true);

    // Map to browse rows
    const mapped: BrowseRow[] = rows.map((r: any) => ({
      id: r.id ?? r.accession ?? "?",
      name: r.name ?? r.proteinName ?? null,
      geneName: r.geneName ?? null,
      species: r.species ?? r.organism ?? null,
      length: r.length ?? r.sequence?.length ?? null,
      annotationScore: r.annotationScore ?? null,
      proteinFunction: r.proteinFunction ?? null,
      sequence: r.sequence ?? "",
      raw: r,
    }));

    setBrowseRows(mapped);
    setSelectedIds(new Set(mapped.map((r) => r.id))); // select all by default
    setExpandedId(null);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === browseRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(browseRows.map((r) => r.id)));
    }
  }, [selectedIds.size, browseRows]);

  const handleAnalyzeSelected = useCallback(() => {
    // Filter raw rows to selected only, ingest and navigate to results
    const selectedRaws = browseRows.filter((r) => selectedIds.has(r.id)).map((r) => r.raw);

    if (selectedRaws.length === 0) {
      toast.error("Select at least one entry to analyze");
      return;
    }

    ingestBackendRows(selectedRaws, searchMeta);
    toast.success(`Loaded ${selectedRaws.length} entries for analysis`);
    navigate("/results");
  }, [browseRows, selectedIds, searchMeta, ingestBackendRows, navigate]);

  const handleAnalyzeAll = useCallback(() => {
    // Ingest all rows and navigate
    const allRaws = browseRows.map((r) => r.raw);
    ingestBackendRows(allRaws, searchMeta);
    toast.success(`Loaded ${allRaws.length} entries for analysis`);
    navigate("/results");
  }, [browseRows, searchMeta, ingestBackendRows, navigate]);

  const allSelected = selectedIds.size === browseRows.length && browseRows.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 relative"
    >
      <BgDotGrid opacity={0.02} />

      {/* Header */}
      <div>
        <h1 className="text-h1 text-foreground page-header-title flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" />
          Database Search
        </h1>
        <p className="text-body text-muted-foreground mt-1 hidden md:block">
          Search UniProt for protein sequences, browse results, then analyze selected entries.
        </p>
      </div>

      {/* Search interface */}
      <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <UniProtQueryInput onQueryExecuted={handleQueryExecuted} onLoadingChange={setIsLoading} />
        </CardContent>
      </Card>

      {/* Browse Results Table */}
      {hasSearched && browseRows.length > 0 && (
        <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl overflow-hidden">
          <CardContent className="p-0">
            {/* Table header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <span className="text-sm font-medium">
                  {selectedIds.size} of {browseRows.length} selected
                </span>
                {searchMeta?.total_available != null &&
                  searchMeta.total_available > browseRows.length && (
                    <span className="text-xs text-muted-foreground">
                      ({searchMeta.total_available.toLocaleString()} total in UniProt)
                    </span>
                  )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeAll}
                  className="text-xs h-8"
                >
                  Analyze All ({browseRows.length})
                </Button>
                <Button
                  size="sm"
                  onClick={handleAnalyzeSelected}
                  disabled={selectedIds.size === 0}
                  className="text-xs h-8"
                >
                  Analyze Selected ({selectedIds.size})
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[auto_1fr_minmax(80px,120px)_minmax(80px,160px)_60px_40px] gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-[hsl(var(--border))]">
              <div className="w-5" />
              <div>Entry / Protein</div>
              <div>Gene</div>
              <div>Organism</div>
              <div className="text-right">Length</div>
              <div className="text-center">Score</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[hsl(var(--border))] max-h-[500px] overflow-y-auto">
              {browseRows.map((row) => {
                const isSelected = selectedIds.has(row.id);
                const isExpanded = expandedId === row.id;
                const isAccession = /^[A-Z][0-9][A-Z0-9]{3}[0-9](-\d+)?$/i.test(row.id);

                return (
                  <div key={row.id}>
                    <div
                      className={`grid grid-cols-[auto_1fr_minmax(80px,120px)_minmax(80px,160px)_60px_40px] gap-2 px-4 py-2.5 items-center text-sm cursor-pointer hover:bg-[hsl(var(--accent))] transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(row.id);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      {/* Entry + Protein Name */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <ChevronRight
                            className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                          {isAccession ? (
                            <a
                              href={`https://www.uniprot.org/uniprotkb/${row.id}/entry`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs font-medium text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.id}
                            </a>
                          ) : (
                            <span className="font-mono text-xs font-medium">{row.id}</span>
                          )}
                          {row.name && (
                            <span className="text-xs text-muted-foreground truncate">
                              {row.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Gene */}
                      <div className="text-xs text-muted-foreground truncate">
                        {row.geneName || "—"}
                      </div>

                      {/* Organism */}
                      <div className="text-xs text-muted-foreground truncate">
                        {row.species || "—"}
                      </div>

                      {/* Length */}
                      <div className="text-xs text-right font-mono text-muted-foreground">
                        {row.length ?? "—"}
                      </div>

                      {/* Annotation Score */}
                      <div
                        className="text-center"
                        title={row.annotationScore ? `${row.annotationScore}/5` : "No score"}
                      >
                        {typeof row.annotationScore === "number" ? (
                          <span className="text-[10px] text-amber-500">
                            {"★".repeat(Math.min(row.annotationScore, 5))}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30">—</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded: protein function */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pl-12 space-y-2 bg-[hsl(var(--surface-1))]">
                        {row.proteinFunction && (
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                              Function
                            </p>
                            <p className="text-xs text-foreground leading-relaxed">
                              {row.proteinFunction.replace(/^FUNCTION:\s*/i, "")}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>
                            Sequence:{" "}
                            <span className="font-mono">
                              {row.sequence.substring(0, 40)}
                              {row.sequence.length > 40 ? "..." : ""}
                            </span>
                          </span>
                          {isAccession && (
                            <a
                              href={`https://www.uniprot.org/uniprotkb/${row.id}/entry`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              View on UniProt <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
              <span className="text-xs text-muted-foreground">
                {searchMeta?.query && <>Results for &ldquo;{searchMeta.query}&rdquo;</>}
                {searchMeta?.url && (
                  <>
                    {" "}
                    &middot;{" "}
                    <a
                      href={searchMeta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View on UniProt
                    </a>
                  </>
                )}
              </span>
              <Button
                size="sm"
                onClick={handleAnalyzeSelected}
                disabled={selectedIds.size === 0}
                className="h-8"
              >
                Analyze {selectedIds.size} Selected <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state after search */}
      {hasSearched && browseRows.length === 0 && !isLoading && (
        <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              No results found. Try a different query or adjust your filters.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick tips (only before first search) */}
      {!hasSearched && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <TipCard
              title="Keyword Search"
              example='"amyloid", "antimicrobial", "fibril"'
              description="Full-text search across all UniProt fields"
            />
            <TipCard
              title="Organism Search"
              example="9606 (human), 1280 (S. aureus)"
              description="NCBI taxonomy ID for organism-specific search"
            />
            <TipCard
              title="Accession Lookup"
              example="P02743, P05067, P84528"
              description="Direct lookup by UniProt accession ID"
            />
          </div>

          <div className="flex items-center justify-between bg-[hsl(var(--surface-1))] rounded-xl px-4 py-3 border border-[hsl(var(--border))]">
            <div className="text-sm text-muted-foreground">
              Have a file? Upload CSV, Excel, or FASTA directly.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/upload")}
              className="btn-press"
            >
              Upload File <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </>
      )}

      <AppFooter />

      {/* Leave confirmation dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLoading ? "Analysis in progress" : "Leave search results?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLoading
                ? "An analysis is currently running. Leaving will cancel it and discard any results."
                : `Your search results (${browseRows.length} entries) will be lost if you navigate away.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowLeaveDialog(false);
                setPendingNavPath(null);
              }}
            >
              Stay
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLeaveDialog(false);
                setBrowseRows([]);
                if (pendingNavPath) {
                  navigate(pendingNavPath);
                  setPendingNavPath(null);
                }
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function TipCard({
  title,
  example,
  description,
}: {
  title: string;
  example: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3.5 space-y-1">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[11px] font-mono text-primary">{example}</p>
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}
