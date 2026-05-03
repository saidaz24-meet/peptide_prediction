/**
 * Peptide drill-down inspector content.
 *
 * Design philosophy: shows a single peptide in full detail -- identity,
 * sequence, classification badges, and every metric value from the
 * registry in a clean grid. No external dependencies beyond datasetStore
 * and metricRegistry.
 */

import { useMemo } from "react";
import { METRIC_REGISTRY } from "@/lib/metricRegistry";
import { useDatasetStore } from "@/stores/datasetStore";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeptideInspectorProps {
  peptideId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeptideInspector({ peptideId }: PeptideInspectorProps) {
  const peptide = useDatasetStore((s) => s.getPeptideById(peptideId));

  const metricRows = useMemo(() => {
    if (!peptide) return [];
    return Object.values(METRIC_REGISTRY).map((m) => {
      const raw = m.getValue(peptide);
      const formatted =
        raw != null && Number.isFinite(raw) ? m.format(raw) : "N/A";
      return { id: m.id, name: m.name, unit: m.unit, formatted };
    });
  }, [peptide]);

  if (!peptide) {
    return (
      <div className="text-sm text-muted-foreground">
        Peptide not found: <code>{peptideId}</code>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---- Header: ID + sequence ---- */}
      <div>
        <h3 className="text-lg font-semibold">{peptide.id}</h3>
        {peptide.name && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {peptide.name}
          </p>
        )}
        <code className="block mt-2 text-xs font-mono break-all bg-muted/50 rounded px-2 py-1.5 leading-relaxed">
          {peptide.sequence}
        </code>
        {peptide.length != null && (
          <p className="text-xs text-muted-foreground mt-1">
            {peptide.length} residues
            {peptide.species ? ` | ${peptide.species}` : ""}
          </p>
        )}
      </div>

      {/* ---- Classification badges ---- */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Classification
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {peptide.ffHelixFlag != null && (
            <Badge variant={peptide.ffHelixFlag === 1 ? "default" : "secondary"}>
              FF-Helix: {peptide.ffHelixFlag === 1 ? "Candidate" : "Non-candidate"}
            </Badge>
          )}
          {peptide.ffSswFlag != null && (
            <Badge variant={peptide.ffSswFlag === 1 ? "default" : "secondary"}>
              FF-SSW: {peptide.ffSswFlag === 1 ? "Candidate" : "Non-candidate"}
            </Badge>
          )}
          {peptide.sswPrediction != null && (
            <Badge variant={peptide.sswPrediction === 1 ? "default" : "secondary"}>
              SSW: {peptide.sswPrediction === 1 ? "Positive" : peptide.sswPrediction === -1 ? "Negative" : "Uncertain"}
            </Badge>
          )}
        </div>
      </section>

      {/* ---- All metric values ---- */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Metric Values
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {metricRows.map((row) => (
            <div key={row.id} className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground truncate mr-2">
                {row.name}
              </span>
              <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                {row.formatted}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Navigation hint ---- */}
      <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
        Use the table or chart selection to navigate between peptides.
      </p>
    </div>
  );
}
