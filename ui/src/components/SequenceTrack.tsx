import { useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  buildFragmentClassification,
  classifyResidue,
  type SSClass,
} from "@/lib/fragmentClassification";
import type { Peptide } from "@/types/peptide";

interface SequenceTrackProps {
  peptide: Peptide;
}

const SS_COLORS: Record<SSClass, string> = {
  H: "hsl(var(--helix))",
  E: "hsl(var(--beta))",
  C: "hsl(var(--coil))",
};

const SS_BG: Record<SSClass, string> = {
  H: "hsl(var(--helix) / 0.15)",
  E: "hsl(var(--beta) / 0.15)",
  C: "transparent",
};

const SS_LABELS: Record<SSClass, string> = {
  H: "Helix",
  E: "Beta",
  C: "Coil",
};

/** Position markers for the ruler (every 10 residues) */
function useRulerMarks(len: number) {
  return useMemo(() => {
    const marks: number[] = [];
    for (let i = 10; i <= len; i += 10) marks.push(i);
    return marks;
  }, [len]);
}

export function SequenceTrack({ peptide }: SequenceTrackProps) {
  const { sequence, s4pred } = peptide;
  const len = sequence.length;
  const marks = useRulerMarks(len);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Peleg's gap-smoothed fragment columns (canonical source for residue colour).
  // When any fragment data is present we treat it as authoritative; raw per-residue
  // S4PRED data only fills gaps the fragment columns leave unowned.
  const fragmentLookup = useMemo(() => {
    const helixFrags = (s4pred?.helixSegments ?? null) as Array<[number, number]> | null;
    const betaFrags = (s4pred?.betaSegments ?? null) as Array<[number, number]> | null;
    const sswFrags = (peptide.s4predSswFragments ?? null) as Array<[number, number]> | null;
    if (!helixFrags?.length && !betaFrags?.length && !sswFrags?.length) return null;
    return buildFragmentClassification(len, helixFrags, betaFrags, sswFrags);
  }, [len, s4pred?.helixSegments, s4pred?.betaSegments, peptide.s4predSswFragments]);

  const hasS4pred = Boolean(s4pred?.ssPrediction?.length || s4pred?.pH?.length || fragmentLookup);

  // Pre-compute classification for every residue (used only for residue coloring).
  // Hierarchy: fragment ranges (Peleg-gap-smoothed) → raw per-residue label → argmax.
  const classifications = useMemo(() => {
    if (!hasS4pred) return null;
    return Array.from({ length: len }, (_, i) =>
      classifyResidue(i, fragmentLookup, s4pred?.ssPrediction, s4pred?.pH, s4pred?.pE, s4pred?.pC)
    );
  }, [hasS4pred, len, s4pred, fragmentLookup]);

  // Peleg HELIX_PERCENTAGE_AUDIT (fix #3): legend percentages must come from the
  // canonical fields (peptide.s4predHelixPercent / peptide.betaPercent), not from
  // re-counting ssPrediction labels — the latter collides with the canonical
  // helix % shown elsewhere on the same page. Hide the percentages entirely
  // when the canonical helix value is null (short peptide / missing data).
  const legendPercents = useMemo(() => {
    const helix = peptide.s4predHelixPercent;
    if (typeof helix !== "number" || !Number.isFinite(helix)) return null;
    const beta =
      typeof peptide.betaPercent === "number" && Number.isFinite(peptide.betaPercent)
        ? peptide.betaPercent
        : null;
    const coil = beta !== null ? Math.max(0, 100 - helix - beta) : null;
    return { H: helix, E: beta, C: coil };
  }, [peptide.s4predHelixPercent, peptide.betaPercent]);

  if (!hasS4pred) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Sequence</h4>
        <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm break-all leading-relaxed">
          {sequence}
        </div>
        <p className="text-xs text-muted-foreground">
          S4PRED data not available. Showing raw sequence.
        </p>
      </div>
    );
  }

  // Chunk residues into lines of CHARS_PER_LINE for readability
  const CHARS_PER_LINE = 60;
  const lines: number[][] = [];
  for (let i = 0; i < len; i += CHARS_PER_LINE) {
    const line: number[] = [];
    for (let j = i; j < Math.min(i + CHARS_PER_LINE, len); j++) {
      line.push(j);
    }
    lines.push(line);
  }

  return (
    <div className="space-y-3">
      {/* Header with legend.
          Peleg HELIX_PERCENTAGE_AUDIT (fix #3): percentages come from canonical
          peptide.s4predHelixPercent / peptide.betaPercent (not from counting
          ssPrediction labels). When the canonical helix value is null we hide
          the entire legend rather than rendering "(0%)". */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-medium text-sm">Predicted Secondary Structure</h4>
        <div className="flex items-center gap-3">
          {(["H", "E", "C"] as SSClass[]).map((cls) => {
            const pct = legendPercents ? legendPercents[cls] : null;
            return (
              <div key={cls} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: SS_COLORS[cls] }}
                />
                <span className="text-xs text-muted-foreground">
                  {SS_LABELS[cls]}
                  {legendPercents && pct !== null && (
                    <span className="ml-1 tabular-nums">({pct.toFixed(0)}%)</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sequence with colored residues */}
      <TooltipProvider delayDuration={100}>
        <div className="bg-muted/30 rounded-lg p-4 overflow-x-auto">
          <div className="font-mono text-xs leading-loose space-y-0.5 min-w-fit">
            {lines.map((line, lineIdx) => {
              const lineStart = lineIdx * CHARS_PER_LINE;
              return (
                <div key={lineIdx} className="flex items-baseline">
                  {/* Line number */}
                  <span className="text-muted-foreground text-[10px] w-8 shrink-0 text-right mr-3 select-none tabular-nums">
                    {lineStart + 1}
                  </span>
                  {/* Residues */}
                  <div className="flex flex-wrap">
                    {line.map((idx) => {
                      const cls = classifications![idx];
                      const aa = sequence[idx];
                      const isHovered = hoveredIdx === idx;
                      return (
                        <Tooltip key={idx}>
                          <TooltipTrigger asChild>
                            <span
                              className="cursor-default transition-all duration-75 rounded-[2px] px-[1px]"
                              style={{
                                color:
                                  cls === "C" ? "hsl(var(--muted-foreground))" : SS_COLORS[cls],
                                backgroundColor: isHovered ? SS_BG[cls] : undefined,
                                fontWeight: cls !== "C" ? 600 : 400,
                              }}
                              onMouseEnter={() => setHoveredIdx(idx)}
                              onMouseLeave={() => setHoveredIdx(null)}
                            >
                              {aa}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="p-2">
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm">{aa}</span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0"
                                  style={{
                                    color: SS_COLORS[cls],
                                    borderColor: SS_COLORS[cls],
                                  }}
                                >
                                  {SS_LABELS[cls]}
                                </Badge>
                                <span className="text-muted-foreground">pos {idx + 1}</span>
                              </div>
                              {s4pred?.pH && s4pred?.pE && s4pred?.pC && (
                                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
                                  <div>
                                    <span className="block" style={{ color: SS_COLORS.H }}>
                                      {(s4pred.pH[idx] ?? 0).toFixed(3)}
                                    </span>
                                    <span className="text-muted-foreground">P(H)</span>
                                  </div>
                                  <div>
                                    <span className="block" style={{ color: SS_COLORS.E }}>
                                      {(s4pred.pE[idx] ?? 0).toFixed(3)}
                                    </span>
                                    <span className="text-muted-foreground">P(E)</span>
                                  </div>
                                  <div>
                                    <span className="block" style={{ color: SS_COLORS.C }}>
                                      {(s4pred.pC[idx] ?? 0).toFixed(3)}
                                    </span>
                                    <span className="text-muted-foreground">P(C)</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  {/* End position */}
                  <span className="text-muted-foreground text-[10px] ml-3 select-none tabular-nums">
                    {Math.min(lineStart + CHARS_PER_LINE, len)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </TooltipProvider>

      {/* Ruler marks annotation */}
      {marks.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Residue numbering starts at 1. Hover any residue for per-residue S4PRED probabilities.
        </p>
      )}
    </div>
  );
}
