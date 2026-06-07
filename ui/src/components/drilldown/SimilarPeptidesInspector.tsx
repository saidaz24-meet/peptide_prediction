/**
 * SimilarPeptidesInspector — Slide-over drill-down for similar peptides.
 *
 * V9-1: Shows k nearest peptides by embedding similarity when user
 * clicks "Find similar peptides" on PeptideDetail.
 *
 * Features:
 * - Distance score bars (green = close, red = distant)
 * - Classification pills (Helix / FF-Helix / SSW / FF-SSW)
 * - Click-to-switch: clicking a result switches the detail view
 * - Compare + Export CSV footer actions
 * - Loading shimmer, empty state, error state
 *
 * The actual similarity search API is not wired yet (placeholder).
 * This component defines the visual design + contract.
 */

import { useState, useMemo } from "react";
import {
  Search,
  Download,
  GitCompare,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Peptide } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimilarPeptideResult {
  peptide: Peptide;
  /** Embedding distance (lower = more similar). */
  distance: number;
}

interface SimilarPeptidesInspectorProps {
  /** The reference peptide to find similarities for. */
  reference: Peptide;
  /** Results from the similarity search. */
  results?: SimilarPeptideResult[];
  /** Loading state. */
  isLoading?: boolean;
  /** Error message. */
  error?: string | null;
  /** Called when user clicks retry on error. */
  onRetry?: () => void;
  /** Called when user clicks a result row to switch peptide view. */
  onSelectPeptide?: (peptideId: string) => void;
  /** Called when user clicks "Compare with original". */
  onCompare?: (selected: string[]) => void;
  /** Called when user clicks "Export CSV". */
  onExport?: () => void;
  /** Number of results to show (default 10). */
  k?: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Classification pill (small badge). */
function ClassPill({
  label,
  active,
  color,
}: {
  label: string;
  active: boolean;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
        active
          ? `text-white`
          : "text-muted-foreground/60 border border-border/50"
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {label}
    </span>
  );
}

/** Distance bar — green (close) → red (distant). */
function DistanceBar({
  distance,
  maxDistance,
}: {
  distance: number;
  maxDistance: number;
}) {
  const pct = maxDistance > 0 ? Math.min(distance / maxDistance, 1) : 0;
  // Interpolate green→yellow→red
  const hue = Math.round((1 - pct) * 120); // 120 = green, 0 = red

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(pct * 100, 5)}%`,
            backgroundColor: `hsl(${hue}, 70%, 45%)`,
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
        {distance.toFixed(3)}
      </span>
    </div>
  );
}

/** Shimmer row for loading state. */
function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 py-2.5 animate-pulse">
      <div className="h-2 w-20 bg-muted rounded" />
      <div className="h-4 w-20 bg-muted rounded" />
      <div className="h-3 flex-1 bg-muted/60 rounded" />
      <div className="flex gap-1">
        <div className="h-4 w-10 bg-muted/50 rounded" />
        <div className="h-4 w-10 bg-muted/50 rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SimilarPeptidesInspector({
  reference,
  results,
  isLoading = false,
  error = null,
  onRetry,
  onSelectPeptide,
  onCompare,
  onExport,
  k = 10,
}: SimilarPeptidesInspectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const maxDistance = useMemo(() => {
    if (!results || results.length === 0) return 1;
    return Math.max(...results.map((r) => r.distance));
  }, [results]);

  const displayResults = useMemo(() => {
    return (results ?? []).slice(0, k);
  }, [results, k]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Loading state ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="similar-loading">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching for similar peptides…
        </div>
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <ShimmerRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center space-y-4"
        data-testid="similar-error"
      >
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            Search failed
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5"
            data-testid="similar-retry"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────
  if (!results || displayResults.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center space-y-3"
        data-testid="similar-empty"
      >
        <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            No similar peptides found
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            This usually means the current peptide isn&apos;t in the vector index.
            The pre-loaded demo dataset is served via a fast-path JSON that
            skips the backend embedding step — so similarity search only
            populates results once you upload your own CSV/FASTA or run a
            UniProt query through the backend.
          </p>
        </div>
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────
  return (
    <div className="space-y-4" data-testid="similar-results">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Peptides similar to {reference.id}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Sorted by embedding distance (lower = more similar)
        </p>
      </div>

      {/* Reference peptide (highlighted) */}
      <div
        className="rounded-lg border-2 border-amber-400/60 bg-amber-50/5 px-3 py-2.5"
        data-testid="similar-reference"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-amber-500 uppercase tracking-wider">
            Reference
          </span>
          <span className="text-sm font-mono font-medium text-foreground">
            {reference.id}
          </span>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {reference.sequence.length > 30
              ? reference.sequence.slice(0, 30) + "…"
              : reference.sequence}
          </span>
        </div>
      </div>

      {/* Results table */}
      <div className="space-y-0.5" data-testid="similar-table">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span className="w-[100px]">Distance</span>
          <span className="w-[90px]">Accession</span>
          <span className="flex-1">Sequence</span>
          <span className="w-[140px] text-right">Classification</span>
        </div>

        {/* Result rows */}
        {displayResults.map((result) => {
          const p = result.peptide;
          const isSelected = selectedIds.has(p.id);

          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/40 ${
                isSelected ? "bg-primary/5 ring-1 ring-primary/20" : ""
              }`}
              onClick={() => toggleSelect(p.id)}
              data-testid={`similar-row-${p.id}`}
            >
              {/* Distance */}
              <div className="w-[100px]">
                <DistanceBar
                  distance={result.distance}
                  maxDistance={maxDistance}
                />
              </div>

              {/* Accession (clickable) */}
              <button
                className="w-[90px] text-sm font-mono text-primary hover:underline text-left truncate"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPeptide?.(p.id);
                }}
                data-testid={`similar-link-${p.id}`}
              >
                {p.id}
              </button>

              {/* Sequence (truncated) */}
              <span
                className="flex-1 text-xs text-muted-foreground font-mono truncate"
                title={p.sequence}
              >
                {p.sequence.length > 25
                  ? p.sequence.slice(0, 25) + "…"
                  : p.sequence}
              </span>

              {/* Classification pills */}
              <div className="w-[140px] flex items-center justify-end gap-1">
                <ClassPill
                  label="H"
                  active={(p.s4predHelixPrediction ?? 0) === 1}
                  color="#a855f7"
                />
                <ClassPill
                  label="FFH"
                  active={p.ffHelixFlag === 1}
                  color="#22c55e"
                />
                <ClassPill
                  label="SSW"
                  active={
                    p.sswPrediction === 1 ||
                    (p.s4predSswPrediction ?? 0) === 1
                  }
                  color="#f59e0b"
                />
                <ClassPill
                  label="FFS"
                  active={p.ffSswFlag === 1}
                  color="#ef4444"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <span className="text-xs text-muted-foreground">
          k = {displayResults.length} results
        </span>
        <div className="flex items-center gap-2">
          {onCompare && selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCompare(Array.from(selectedIds))}
              className="gap-1.5 h-7 text-xs"
              data-testid="similar-compare"
            >
              <GitCompare className="h-3.5 w-3.5" />
              Compare ({selectedIds.size})
            </Button>
          )}
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="gap-1.5 h-7 text-xs"
              data-testid="similar-export"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
