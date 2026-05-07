/**
 * ResidueCategoryLegend — small chip row showing each amino-acid category
 * with its color swatch and constituent residues.
 *
 * Mounted next to the sequence display on PeptideDetail (FIX-010, 2026-05-07)
 * so users can decode the residue-level coloring at a glance. Reads from
 * `lib/aminoAcids.ts` so the legend stays in sync with the canonical map.
 */

import {
  CATEGORY_COLORS,
  CATEGORY_MEMBERS,
  categoryLabel,
  type AminoAcidCategory,
} from "@/lib/aminoAcids";

const CATEGORY_ORDER: AminoAcidCategory[] = [
  "hydrophobic",
  "polar",
  "charged+",
  "charged-",
  "special",
];

interface ResidueCategoryLegendProps {
  className?: string;
}

export function ResidueCategoryLegend({ className }: ResidueCategoryLegendProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] ${className ?? ""}`}
      data-testid="residue-category-legend"
      aria-label="Amino acid category legend"
    >
      <span className="text-muted-foreground">Residue categories:</span>
      {CATEGORY_ORDER.map((cat) => (
        <span key={cat} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm border border-border/60"
            style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            aria-hidden="true"
          />
          <span className="text-foreground/85">{categoryLabel(cat)}</span>
          <span className="font-mono text-muted-foreground/80">
            ({CATEGORY_MEMBERS[cat].join(", ")})
          </span>
        </span>
      ))}
    </div>
  );
}
