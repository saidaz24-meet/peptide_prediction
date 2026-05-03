/**
 * ResidueHover — per-residue hover card for sequence track displays.
 *
 * Wraps an individual amino acid character and reveals a rich tooltip with:
 *   1. Position (1-indexed) and residue identity
 *   2. Biochemical classification (hydrophobic, charged, polar, special)
 *   3. S4PRED per-residue probabilities (P(H), P(E), P(C))
 *   4. TANGO aggregation propensity at this position
 *   5. Segment membership flags (helix, SSW switch zone)
 *
 * Per-residue data is read from the Peptide object. All fields are
 * null-guarded — missing data renders as "N/A" in the hover card.
 */

import { useMemo } from "react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { getResidueInfo, categoryLabel } from "@/lib/aminoAcids";
import type { Peptide } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a 0-indexed position falls within any segment tuple [start, end). */
function isInSegments(
  position: number,
  segments: Array<[number, number]> | null | undefined,
): boolean {
  if (!segments) return false;
  return segments.some(([s, e]) => position >= s && position < e);
}

/** Format a probability value (0-1) to 2 decimal places. */
function fmtProb(v: number | undefined | null): string {
  if (v === null || v === undefined) return "N/A";
  return v.toFixed(2);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResidueHoverProps {
  /** The amino acid single-letter code */
  aa: string;
  /** 0-indexed position in the sequence */
  position: number;
  /** The full peptide (for accessing per-residue arrays) */
  peptide: Peptide;
  /** Children (the rendered residue character) */
  children: React.ReactNode;
  /** Side for hover card placement */
  side?: "top" | "bottom" | "left" | "right";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResidueHover({
  aa,
  position,
  peptide,
  children,
  side = "top",
}: ResidueHoverProps) {
  const info = useMemo(() => getResidueInfo(aa), [aa]);

  // Per-residue S4PRED probabilities
  const pH = peptide.s4pred?.pH?.[position] ?? null;
  const pE = peptide.s4pred?.pE?.[position] ?? null;
  const pC = peptide.s4pred?.pC?.[position] ?? null;
  const ssPred = peptide.s4pred?.ssPrediction?.[position] ?? null;

  // Per-residue TANGO aggregation
  const tangoAgg = peptide.tango?.agg?.[position] ?? null;

  // Segment flags
  const inHelixSegment = isInSegments(
    position,
    peptide.s4pred?.helixSegments ?? null,
  );
  const inSswZone = isInSegments(
    position,
    peptide.s4pred?.betaSegments ?? null,
  );

  return (
    <HoverCard openDelay={200} closeDelay={0}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side={side} className="w-64 space-y-2">
        {/* 1. Position */}
        <div className="text-xs font-medium text-muted-foreground">
          Position {position + 1}
        </div>

        {/* 2. AA identity */}
        <h4 className="text-sm font-semibold leading-tight">
          {info
            ? `${info.letter} — ${info.threeLetterCode} (${info.fullName})`
            : `${aa.toUpperCase()} — Unknown residue`}
        </h4>

        {/* 3. Biochem class */}
        {info && (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {categoryLabel(info.category)}
          </span>
        )}

        {/* 4. S4PRED probabilities */}
        {(pH !== null || pE !== null || pC !== null) && (
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground">
              S4PRED
              {ssPred && (
                <span className="ml-1 font-mono">
                  [{ssPred}]
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span>
                P(H) <strong>{fmtProb(pH)}</strong>
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span>
                P(E) <strong>{fmtProb(pE)}</strong>
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span>
                P(C) <strong>{fmtProb(pC)}</strong>
              </span>
            </div>
          </div>
        )}

        {/* 5. TANGO aggregation */}
        {tangoAgg !== null && (
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground">
              TANGO Aggregation
            </div>
            <div className="text-sm font-mono font-bold">
              {tangoAgg.toFixed(1)}
            </div>
          </div>
        )}

        {/* 6. Segment flags */}
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span>
            In helix segment?{" "}
            <span className={inHelixSegment ? "text-green-500" : "text-muted-foreground/50"}>
              {inHelixSegment ? "✓" : "✗"}
            </span>
          </span>
          <span>
            In SSW switch zone?{" "}
            <span className={inSswZone ? "text-green-500" : "text-muted-foreground/50"}>
              {inSswZone ? "✓" : "✗"}
            </span>
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
