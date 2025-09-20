import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Segment {
  start: number;
  end: number;
  score?: number;
}

interface SegmentTrackProps {
  sequence: string;
  helixFragments?: Array<[number, number]> | Segment[];
}

export function SegmentTrack({ sequence, helixFragments }: SegmentTrackProps) {
  const sequenceLength = sequence.length;
  
  // Normalize helix fragments to consistent format
  const normalizedFragments: Segment[] = helixFragments?.map(fragment => {
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
        <h4 className="font-medium">Secondary Structure Track</h4>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-helix"></div>
            <span className="text-sm text-muted-foreground">Helix</span>
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
                            className="absolute h-full bg-helix hover:bg-helix/80 transition-colors cursor-pointer"
                            style={{
                              left: `${startPercent}%`,
                              width: `${widthPercent}%`,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-center">
                            <p className="font-medium">Helix Segment</p>
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
                    Total helix coverage: {' '}
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