/**
 * DualStructureTrack — Two-row bar visualization showing Helix and SSW regions
 * as colored segments on the sequence (same visual style as SegmentTrack).
 *
 * Row 1 (Helix): S4PRED helix segments in purple — same as existing SegmentTrack
 * Row 2 (SSW):   Structural switching windows in blue/teal
 *
 * P1+P2 from Alex/Peleg backlog: unified bar visualization, not AA-letter tracks.
 * Removed FF-Helix track since it's a pure Python calculation.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { Peptide } from "@/types/peptide";

interface DualStructureTrackProps {
  peptide: Peptide;
}

type SegmentInfo = { start: number; end: number };

function normalizeSegments(
  raw?: Array<[number, number]> | Array<{ start: number; end: number }> | null
): SegmentInfo[] {
  if (!raw) return [];
  return raw.map((s) => (Array.isArray(s) ? { start: s[0], end: s[1] } : s));
}

function SegmentBar({
  label,
  color,
  segments,
  seqLength,
  markers,
}: {
  label: string;
  color: string;
  segments: SegmentInfo[];
  seqLength: number;
  markers: number[];
}) {
  const coverage = segments.reduce((s, f) => s + (f.end - f.start + 1), 0);
  const pct = seqLength > 0 ? ((coverage / seqLength) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
          {segments.length} segment{segments.length !== 1 ? "s" : ""} &middot; {pct}%
        </Badge>
      </div>

      {/* Bar */}
      <div className="relative">
        {/* Position markers above */}
        <div className="relative h-3 mb-0.5">
          <div className="absolute inset-0 flex justify-between items-end text-[9px] text-muted-foreground/60">
            <span>1</span>
            {markers.map((pos) => (
              <span key={pos}>{pos}</span>
            ))}
            <span>{seqLength}</span>
          </div>
        </div>

        {/* Track bar */}
        <TooltipProvider>
          <div className="h-7 bg-muted/30 rounded-md relative overflow-hidden">
            {segments.map((seg, i) => {
              const startPct = (seg.start / seqLength) * 100;
              const widthPct = ((seg.end - seg.start + 1) / seqLength) * 100;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: i * 0.08 }}
                      className="absolute h-full cursor-pointer hover:brightness-110 transition-all"
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: color,
                        opacity: 0.7,
                        transformOrigin: "left",
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{label} Segment</p>
                    <p className="text-sm">
                      Positions {seg.start}&ndash;{seg.end}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Length: {seg.end - seg.start + 1} aa
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

export function DualStructureTrack({ peptide }: DualStructureTrackProps) {
  const seqLen = peptide.sequence.length;

  const markers = useMemo(() => {
    const m: number[] = [];
    for (let i = 10; i <= seqLen; i += 10) m.push(i);
    return m;
  }, [seqLen]);

  const helixSegments = useMemo(
    () => normalizeSegments(peptide.s4pred?.helixSegments),
    [peptide.s4pred?.helixSegments]
  );

  // SSW segments: prefer S4PRED SSW, fallback to TANGO beta segments
  const s4predSswFragments = peptide.s4predSswFragments as
    | Array<[number, number]>
    | null
    | undefined;
  const sswSegments = useMemo(() => {
    if (s4predSswFragments?.length) return normalizeSegments(s4predSswFragments);
    if (peptide.s4pred?.betaSegments?.length) return normalizeSegments(peptide.s4pred.betaSegments);
    return [];
  }, [s4predSswFragments, peptide.s4pred?.betaSegments]);

  const sswLabel = s4predSswFragments?.length ? "SSW (S4PRED)" : "SSW (TANGO)";

  const hasHelix = helixSegments.length > 0;
  const hasSsw = sswSegments.length > 0;

  if (!hasHelix && !hasSsw) return null;

  return (
    <div className="space-y-3">
      {hasHelix && (
        <SegmentBar
          label="S4PRED Helix"
          color="hsl(var(--helix))"
          segments={helixSegments}
          seqLength={seqLen}
          markers={markers}
        />
      )}
      {hasSsw && (
        <SegmentBar
          label={sswLabel}
          color="#0072B2"
          segments={sswSegments}
          seqLength={seqLen}
          markers={markers}
        />
      )}
    </div>
  );
}
