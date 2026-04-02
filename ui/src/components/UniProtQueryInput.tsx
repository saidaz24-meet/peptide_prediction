import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2, Info, ChevronDown, ExternalLink, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, executeUniProtQuery } from "@/lib/api";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type QueryMode = "auto" | "accession" | "keyword" | "organism" | "keyword_organism";
type SortOrder =
  | "best"
  | "length-asc"
  | "length-desc"
  | "protein-asc"
  | "protein-desc"
  | "organism-asc"
  | "organism-desc";

interface ParsedQuery {
  mode: QueryMode;
  accession?: string;
  keyword?: string;
  organism_id?: string;
  normalized_query: string;
  api_query_string: string;
  error?: string;
}

interface UniProtQueryInputProps {
  onQueryExecuted: (rows: any[], meta: any) => void;
  onLoadingChange?: (loading: boolean) => void;
}

interface QueryControls {
  reviewed: boolean | null;
  lengthMin: number | null;
  lengthMax: number | null;
  sort: SortOrder;
  includeIsoforms: boolean;
  size: number;
  runTango: boolean;
  runS4pred: boolean;
}

const UNIPROT_SORT_MAP: Record<string, string | null> = {
  best: null,
  "length-asc": "length asc",
  "length-desc": "length desc",
  "protein-asc": "protein_name asc",
  "protein-desc": "protein_name desc",
  "organism-asc": "organism_name asc",
  "organism-desc": "organism_name desc",
};

export function UniProtQueryInput({ onQueryExecuted, onLoadingChange }: UniProtQueryInputProps) {
  const [query, setQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState<QueryMode>("auto");
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [finalApiQuery, setFinalApiQuery] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [controls, setControls] = useState<QueryControls>({
    reviewed: true,
    lengthMin: null,
    lengthMax: null,
    sort: "best",
    includeIsoforms: false,
    size: 500,
    runTango: false,
    runS4pred: false,
  });

  // Auto-parse query (debounced, non-blocking)
  useEffect(() => {
    if (!query.trim()) {
      setParsedQuery(null);
      setFinalApiQuery(null);
      return;
    }
    let cancelled = false;
    const tid = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/uniprot/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        if (cancelled || !res.ok) return;
        const parsed: ParsedQuery = await res.json();
        if (!cancelled) setParsedQuery(parsed);
      } catch {
        /* silent */
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [query, selectedMode]);

  const handleExecute = useCallback(
    async (retryWithoutSort = false, retryWithoutLength = false) => {
      if (!query.trim()) {
        toast.error("Please enter a query");
        return;
      }

      setIsExecuting(true);
      onLoadingChange?.(true);
      setFinalApiQuery(null);

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 120000);

      try {
        let sortValue: string | null = null;
        if (!retryWithoutSort) {
          const sortKey = (controls.sort as string) === "score" ? "best" : controls.sort;
          sortValue = UNIPROT_SORT_MAP[sortKey] ?? null;
        }

        const requestBody: any = {
          query,
          mode: selectedMode,
          include_isoforms: controls.includeIsoforms,
          size: controls.size,
          run_tango: controls.runTango,
          run_s4pred: controls.runS4pred,
          max_provider_sequences: 50,
        };

        if (controls.reviewed !== null) requestBody.reviewed = controls.reviewed;
        if (!retryWithoutLength) {
          if (controls.lengthMin != null) requestBody.length_min = controls.lengthMin;
          if (controls.lengthMax != null) requestBody.length_max = controls.lengthMax;
        }
        if (sortValue) requestBody.sort = sortValue;

        try {
          const result = await executeUniProtQuery(requestBody, abortController.signal);
          clearTimeout(timeoutId);
          setFinalApiQuery(result.meta?.api_query_string || parsedQuery?.api_query_string || query);
          onQueryExecuted(result.rows, result.meta);
          toast.success(
            `Retrieved ${result.meta?.row_count || result.rows.length} entries from UniProt`
          );
        } catch (error: any) {
          clearTimeout(timeoutId);
          const is400 =
            (error as any).status === 400 || error.message?.toLowerCase().includes("400");
          if (is400 && !retryWithoutSort && !retryWithoutLength) {
            toast("Adjusted query. Retrying...");
            setIsExecuting(false);
            onLoadingChange?.(false);
            return handleExecute(true, true);
          }
          if (error.name === "AbortError") {
            toast.error("Query timed out after 2 minutes.");
          } else {
            toast.error(error.message || "Failed to execute UniProt query");
          }
        }
      } finally {
        setIsExecuting(false);
        onLoadingChange?.(false);
      }
    },
    [query, selectedMode, controls, parsedQuery, onQueryExecuted, onLoadingChange]
  );

  const detectedMode = parsedQuery?.mode || "auto";
  const detectedLabel =
    detectedMode === "accession"
      ? "Accession"
      : detectedMode === "organism"
        ? "Organism"
        : detectedMode === "keyword"
          ? "Keyword"
          : detectedMode === "keyword_organism"
            ? "Keyword + Organism"
            : null;

  const hasFilters =
    controls.reviewed !== true ||
    controls.lengthMin != null ||
    controls.lengthMax != null ||
    controls.sort !== "best" ||
    controls.runTango ||
    controls.runS4pred;

  return (
    <div className="space-y-4">
      {/* ── Search Bar ── */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder='Search UniProt — e.g. "amyloid", P12345, 9606'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isExecuting) handleExecute();
              }}
              disabled={isExecuting}
              className="pl-9 h-11 text-base"
            />
            {/* Detected mode badge */}
            {detectedLabel && query.trim() && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                {detectedLabel}
              </span>
            )}
          </div>
          <Button
            onClick={() => handleExecute()}
            disabled={isExecuting || !query.trim()}
            className="h-11 px-6"
          >
            {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {/* Quick info line */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {controls.reviewed === true
              ? "Swiss-Prot (reviewed)"
              : controls.reviewed === false
                ? "TrEMBL (unreviewed)"
                : "All UniProtKB"}
            {controls.lengthMin || controls.lengthMax
              ? ` · ${controls.lengthMin ?? "any"}–${controls.lengthMax ?? "any"} aa`
              : ""}
            {controls.runTango ? " · TANGO" : ""}
            {controls.runS4pred ? " · S4PRED" : ""}
            {` · max ${controls.size}`}
          </span>
          <button
            onClick={() => setShowAdvanced((o) => !o)}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <SlidersHorizontal className="w-3 h-3" />
            {showAdvanced ? "Hide options" : "Options"}
            {hasFilters && !showAdvanced && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* ── Advanced Options (collapsible) ── */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleContent>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 space-y-4">
            {/* Row 1: Database + Sort + Mode */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Database</Label>
                <Select
                  value={
                    controls.reviewed === true
                      ? "reviewed"
                      : controls.reviewed === false
                        ? "unreviewed"
                        : "all"
                  }
                  onValueChange={(v) =>
                    setControls((p) => ({
                      ...p,
                      reviewed: v === "reviewed" ? true : v === "unreviewed" ? false : null,
                    }))
                  }
                  disabled={isExecuting}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewed">Reviewed (Swiss-Prot)</SelectItem>
                    <SelectItem value="unreviewed">Unreviewed (TrEMBL)</SelectItem>
                    <SelectItem value="all">All UniProtKB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort</Label>
                <Select
                  value={controls.sort}
                  onValueChange={(v) => setControls((p) => ({ ...p, sort: v as SortOrder }))}
                  disabled={isExecuting}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best">Best Match</SelectItem>
                    <SelectItem value="length-asc">Length (short first)</SelectItem>
                    <SelectItem value="length-desc">Length (long first)</SelectItem>
                    <SelectItem value="protein-asc">Protein Name (A-Z)</SelectItem>
                    <SelectItem value="organism-asc">Organism (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Query Mode</Label>
                <Select
                  value={selectedMode}
                  onValueChange={(v) => setSelectedMode(v as QueryMode)}
                  disabled={isExecuting}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="accession">Accession</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                    <SelectItem value="organism">Organism ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Length range + Max results */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Min Length</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={controls.lengthMin ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseInt(e.target.value) : null;
                    setControls((p) => ({ ...p, lengthMin: v && v > 0 ? v : null }));
                  }}
                  disabled={isExecuting}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Length</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 50"
                  value={controls.lengthMax ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseInt(e.target.value) : null;
                    setControls((p) => ({ ...p, lengthMax: v && v > 0 ? v : null }));
                  }}
                  disabled={isExecuting}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Results</Label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  placeholder="500"
                  value={controls.size}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setControls((p) => ({ ...p, size: v && v > 0 ? Math.min(v, 500) : 500 }));
                  }}
                  disabled={isExecuting}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Row 3: Analysis providers (compact) */}
            <div className="flex items-center gap-6 pt-2 border-t border-[hsl(var(--border))]">
              <span className="text-xs font-medium text-muted-foreground">Run predictions:</span>
              <div className="flex items-center gap-2">
                <Switch
                  id="run-tango"
                  checked={controls.runTango}
                  onCheckedChange={(c) => setControls((p) => ({ ...p, runTango: c }))}
                  disabled={isExecuting}
                  className="h-4 w-8"
                />
                <Label htmlFor="run-tango" className="text-xs cursor-pointer">
                  TANGO
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="run-s4pred"
                  checked={controls.runS4pred}
                  onCheckedChange={(c) => setControls((p) => ({ ...p, runS4pred: c }))}
                  disabled={isExecuting}
                  className="h-4 w-8"
                />
                <Label htmlFor="run-s4pred" className="text-xs cursor-pointer">
                  S4PRED
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="include-isoforms"
                  checked={controls.includeIsoforms}
                  onChange={(e) =>
                    setControls((p) => ({ ...p, includeIsoforms: e.target.checked }))
                  }
                  disabled={isExecuting}
                  className="h-3.5 w-3.5 rounded cursor-pointer"
                />
                <Label htmlFor="include-isoforms" className="text-xs cursor-pointer">
                  Isoforms
                </Label>
              </div>
              {(controls.runTango || controls.runS4pred) && (
                <p className="text-[10px] text-muted-foreground ml-auto">
                  Predictions limited to first 50 sequences
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── API Query Preview ── */}
      {(finalApiQuery || (parsedQuery?.api_query_string && query.trim())) && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono bg-muted/50 rounded-lg px-3 py-1.5 overflow-x-auto">
          <span className="shrink-0 text-muted-foreground/60">API:</span>
          <span className="break-all">{finalApiQuery || parsedQuery?.api_query_string}</span>
        </div>
      )}

      {/* ── Loading state ── */}
      <AnalysisProgress isActive={isExecuting} peptideCount={controls.size} />
    </div>
  );
}
