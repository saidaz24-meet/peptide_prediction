import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Segment {
  start: number;
  end: number;
  score?: number;
}

// P8 (2026-05-07): SegmentTrack now accepts a `kind` discriminator so it can
// render either the helix or SSW (structural-switch) up/down diagram. The
// historical `helixFragments` prop is kept for backwards compatibility — if
// `fragments` is omitted it falls back to that.
type SegmentKind = "helix" | "ssw";

interface SegmentTrackProps {
  sequence: string;
  /** Generic input — preferred. */
  fragments?: Array<[number, number]> | Segment[];
  /** Legacy helix-only input. Used only when `fragments` is undefined. */
  helixFragments?: Array<[number, number]> | Segment[];
  /** Which structural feature this track represents. Defaults to "helix". */
  kind?: SegmentKind;
}

const KIND_PRESETS: Record<
  SegmentKind,
  { title: string; segmentLabel: string; legendLabel: string; barClass: string; swatchClass: string }
> = {
  helix: {
    title: "Secondary Structure Track",
    segmentLabel: "Helix Segment",
    legendLabel: "Helix",
    barClass: "bg-helix hover:bg-helix/80",
    swatchClass: "bg-helix",
  },
  ssw: {
    title: "Structural Switch (SSW) Track",
    segmentLabel: "SSW Segment",
    legendLabel: "SSW",
    barClass: "bg-[#0072B2] hover:bg-[#0072B2]/80",
    swatchClass: "bg-[#0072B2]",
  },
};

export function SegmentTrack({
  sequence,
  fragments,
  helixFragments,
  kind = "helix",
}: SegmentTrackProps) {
  const sequenceLength = sequence.length;
  const preset = KIND_PRESETS[kind];

  // Normalize fragments to consistent format. Prefer the generic prop;
  // fall back to the legacy `helixFragments` (only meaningful for kind="helix").
  const source = fragments ?? helixFragments;
  const normalizedFragments: Segment[] = source?.map(fragment => {
    if (Array.isArray(fragment)) {
      return { start: fragment[0], end: fragment[1] };
    }
    return fragment;
  }) || [];

  // Create position markers every 10 amino acids
  const markers = [];
  for (let i = 10; i <= sequenceLength; i += 10) {
    markers.push(i);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{preset.title}</h4>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded ${preset.swatchClass}`}></div>
            <span className="text-sm text-muted-foreground">{preset.legendLabel}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {normalizedFragments.length} segments
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <TooltipProvider>
            <div className="space-y-3">
              {/* Position markers */}
              <div className="relative h-4">
                <div className="absolute inset-0 flex justify-between items-end text-xs text-muted-foreground">
                  <span>1</span>
                  {markers.map(pos => (
                    <span key={pos}>{pos}</span>
                  ))}
                  <span>{sequenceLength}</span>
                </div>
              </div>

              {/* Track */}
              <div className="relative">
                {/* Background track */}
                <div className="h-8 bg-muted/30 rounded-md relative overflow-hidden">
                  {/* Helix segments */}
                  {normalizedFragments.map((fragment, index) => {
                    const startPercent = (fragment.start / sequenceLength) * 100;
                    const widthPercent = ((fragment.end - fragment.start + 1) / sequenceLength) * 100;
                    
                    return (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className={`absolute h-full transition-colors cursor-pointer ${preset.barClass}`}
                            style={{
                              left: `${startPercent}%`,
                              width: `${widthPercent}%`,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-center">
                            <p className="font-medium">{preset.segmentLabel}</p>
                            <p className="text-sm">
                              Positions {fragment.start}-{fragment.end}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Length: {fragment.end - fragment.start + 1} aa
                            </p>
                            {fragment.score && (
                              <p className="text-xs text-muted-foreground">
                                Score: {fragment.score.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Position scale */}
                <div className="mt-2 relative">
                  <div className="h-px bg-border"></div>
                  {markers.map(pos => {
                    const leftPercent = (pos / sequenceLength) * 100;
                    return (
                      <div
                        key={pos}
                        className="absolute w-px h-2 bg-border"
                        style={{ left: `${leftPercent}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              {normalizedFragments.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <p>
                    Total {preset.legendLabel.toLowerCase()} coverage: {' '}
                    {normalizedFragments
                      .reduce((sum, frag) => sum + (frag.end - frag.start + 1), 0)} aa
                    {' '}
                    ({((normalizedFragments
                      .reduce((sum, frag) => sum + (frag.end - frag.start + 1), 0) / sequenceLength) * 100
                    ).toFixed(1)}%)
                  </p>
                </div>
              )}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}