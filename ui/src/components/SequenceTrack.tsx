/**
 * SequenceTrack — Per-residue colored sequence display.
 *
 * Q7 (Peleg 2026-06-18 PDF1 p19, confirmed 2026-06-23): residues colored by
 * the PIPELINE-DERIVED 3-class scheme (Helix · SSW · Coiled-coil), NOT the
 * raw S4PRED H/E/C labels.
 *
 * Three classes:
 *   Helix       — residue inside an S4PRED helix segment (helixSegments)
 *   SSW         — residue in an SSW position (s4predSswFragments → betaSegments)
 *   Coiled-coil — everything else
 *
 * Precedence: SSW wins when a residue is in both helix and SSW segments.
 */
import { useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { isPositionInFragments, type SSClass } from "@/lib/fragmentClassification";
import type { Peptide } from "@/types/peptide";

interface SequenceTrackProps {
  peptide: Peptide;
  /**
   * Hide the small "Predicted Secondary Structure" h4 — for hosts that
   * already render the same title at card-header level (PeptideDetail).
   * Quick Analyze keeps the inline title because its card header is the
   * peptide ID.
   */
  hideTitle?: boolean;
}

type PipelineClass = "helix" | "ssw" | "coiled-coil";

const PIPELINE_COLORS: Record<PipelineClass, string> = {
  helix: "hsl(var(--helix))",
  ssw: "#E040FB",
  "coiled-coil": "hsl(var(--muted-foreground))",
};

const PIPELINE_BG: Record<PipelineClass, string> = {
  helix: "hsl(var(--helix) / 0.15)",
  ssw: "rgba(224, 64, 251, 0.15)",
  "coiled-coil": "transparent",
};

const PIPELINE_LABELS: Record<PipelineClass, string> = {
  helix: "Helix",
  ssw: "SSW",
  "coiled-coil": "Coiled-coil",
};

const SS_COLORS: Record<SSClass, string> = {
  H: "hsl(var(--helix))",
  E: "hsl(var(--beta))",
  C: "hsl(var(--coil))",
};

function useRulerMarks(len: number) {
  return useMemo(() => {
    const marks: number[] = [];
    for (let i = 10; i <= len; i += 10) marks.push(i);
    return marks;
  }, [len]);
}

export function SequenceTrack({ peptide, hideTitle = false }: SequenceTrackProps) {
  const { sequence, s4pred, tango } = peptide;
  const len = sequence.length;
  const marks = useRulerMarks(len);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasS4pred = Boolean(
    s4pred?.ssPrediction?.length ||
    s4pred?.pH?.length ||
    s4pred?.helixSegments?.length ||
    s4pred?.betaSegments?.length ||
    peptide.s4predSswFragments?.length
  );

  // Pipeline 3-class classification: Helix / SSW / Coiled-coil.
  // SSW source priority: s4predSswFragments → betaSegments (same as
  // WindowProfileChart's magenta SSW band).
  // Precedence: SSW wins when a residue is in both helix AND SSW.
  const pipelineClasses = useMemo((): PipelineClass[] | null => {
    if (!hasS4pred) return null;

    // 2026-06-23 regression fix: SSW MUST come from peptide.s4predSswFragments
    // only. A prior version fell back to s4pred.betaSegments when sswFragments
    // was empty — but raw S4PRED β predictions are not SSW positions. The
    // fallback mis-classified 100%-helix peptides as 93% SSW (LKLLKLLLKLLLKLL:
    // KPI said helix coverage 100% + SSW ✗, but legend showed SSW 93%).
    // Without sswFragments, no residue may be SSW.
    const helixSegs = (s4pred?.helixSegments ?? null) as Array<[number, number]> | null;
    const sswFrags = (peptide.s4predSswFragments ?? null) as Array<[number, number]> | null;

    return Array.from({ length: len }, (_, i): PipelineClass => {
      if (isPositionInFragments(i, sswFrags)) return "ssw";
      if (isPositionInFragments(i, helixSegs)) return "helix";
      return "coiled-coil";
    });
  }, [hasS4pred, len, s4pred?.helixSegments, peptide.s4predSswFragments]);

  // Legend % computed from pipeline classification (not canonical s4predHelixPercent,
  // which is raw S4PRED — the legend must match what the colors actually show).
  const legendPercents = useMemo(() => {
    if (!pipelineClasses || len === 0) return null;
    const counts: Record<PipelineClass, number> = { helix: 0, ssw: 0, "coiled-coil": 0 };
    for (const cls of pipelineClasses) counts[cls]++;
    return {
      helix: (counts.helix / len) * 100,
      ssw: (counts.ssw / len) * 100,
      "coiled-coil": (counts["coiled-coil"] / len) * 100,
    };
  }, [pipelineClasses, len]);

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        {hideTitle ? (
          <span />
        ) : (
          <h4 className="font-medium text-sm">Predicted Secondary Structure</h4>
        )}
        <div className="flex items-center gap-3">
          {(["helix", "ssw", "coiled-coil"] as PipelineClass[]).map((cls) => {
            const pct = legendPercents ? legendPercents[cls] : null;
            return (
              <div key={cls} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: PIPELINE_COLORS[cls] }}
                />
                <span className="text-xs text-muted-foreground">
                  {PIPELINE_LABELS[cls]}
                  {pct !== null && <span className="ml-1 tabular-nums">({pct.toFixed(0)}%)</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="bg-muted/30 rounded-lg p-4 overflow-x-auto">
          <div className="font-mono text-xs leading-loose space-y-0.5 min-w-fit">
            {lines.map((line, lineIdx) => {
              const lineStart = lineIdx * CHARS_PER_LINE;
              return (
                <div key={lineIdx} className="flex items-baseline">
                  <span className="text-muted-foreground text-[10px] w-8 shrink-0 text-right mr-3 select-none tabular-nums">
                    {lineStart + 1}
                  </span>
                  <div className="flex flex-wrap">
                    {line.map((idx) => {
                      const cls = pipelineClasses![idx];
                      const aa = sequence[idx];
                      const isHovered = hoveredIdx === idx;
                      return (
                        <Tooltip key={idx}>
                          <TooltipTrigger asChild>
                            <span
                              className="cursor-default transition-all duration-75 rounded-[2px] px-[1px]"
                              style={{
                                color: PIPELINE_COLORS[cls],
                                backgroundColor: isHovered ? PIPELINE_BG[cls] : undefined,
                                fontWeight: cls !== "coiled-coil" ? 600 : 400,
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
                                    color: PIPELINE_COLORS[cls],
                                    borderColor: PIPELINE_COLORS[cls],
                                  }}
                                >
                                  {PIPELINE_LABELS[cls]}
                                </Badge>
                                <span className="text-muted-foreground">pos {idx + 1}</span>
                              </div>
                              {s4pred?.pH && s4pred?.pE && s4pred?.pC && (
                                <div className="space-y-1 pt-1 border-t border-border/50">
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    S4PRED
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
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
                                </div>
                              )}
                              {tango?.helix?.length || tango?.beta?.length || tango?.agg?.length ? (
                                <div className="space-y-1 pt-1 border-t border-border/50">
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Tango
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <span className="block" style={{ color: SS_COLORS.H }}>
                                        {tango.helix?.[idx] != null
                                          ? (tango.helix[idx] as number).toFixed(2)
                                          : "—"}
                                      </span>
                                      <span className="text-muted-foreground">Helix</span>
                                    </div>
                                    <div>
                                      <span className="block" style={{ color: SS_COLORS.E }}>
                                        {tango.beta?.[idx] != null
                                          ? (tango.beta[idx] as number).toFixed(2)
                                          : "—"}
                                      </span>
                                      <span className="text-muted-foreground">β</span>
                                    </div>
                                    <div>
                                      <span
                                        className="block"
                                        style={{ color: "hsl(var(--ff-ssw))" }}
                                      >
                                        {tango.agg?.[idx] != null
                                          ? (tango.agg[idx] as number).toFixed(2)
                                          : "—"}
                                      </span>
                                      <span className="text-muted-foreground">Agg</span>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  <span className="text-muted-foreground text-[10px] ml-3 select-none tabular-nums">
                    {Math.min(lineStart + CHARS_PER_LINE, len)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </TooltipProvider>

      {marks.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Residue numbering starts at 1. Hover any residue for per-residue S4PRED + Tango
          propensities.
        </p>
      )}
    </div>
  );
}
