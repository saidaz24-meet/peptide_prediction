/**
 * SVG-based wavy dot contour lines background.
 * Light mode alternative to ConstellationBackground for the hero.
 * Renders 3-4 horizontal sine waves made of small dots.
 *
 * @example
 * <div className="relative min-h-[60vh]">
 *   <BgWave />
 *   <div className="relative z-10">Content</div>
 * </div>
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface BgWaveProps {
  /** Overall opacity. Default: 0.08 */
  opacity?: number;
  /** Number of wave lines. Default: 4 */
  waveCount?: number;
  className?: string;
}

export function BgWave({ opacity = 0.08, waveCount = 4, className }: BgWaveProps) {
  const waves = useMemo(() => {
    const result: Array<{ cy: number; phase: number; amplitude: number }> = [];
    for (let i = 0; i < waveCount; i++) {
      result.push({
        cy: 120 + i * 80, // vertical offset
        phase: i * 0.8, // phase offset
        amplitude: 22 + (i % 2) * 8, // wave height
      });
    }
    return result;
  }, [waveCount]);

  const svgWidth = 1200;
  const svgHeight = 120 + waveCount * 80 + 60;
  const dotSpacing = 14;
  const wavelength = 200;

  return (
    <div
      className={cn("absolute inset-0 z-0 pointer-events-none overflow-hidden", className)}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full motion-safe:animate-[wave-drift_20s_linear_infinite] motion-reduce:animate-none"
        style={{ opacity }}
      >
        {waves.map((wave, wi) =>
          Array.from({ length: Math.ceil(svgWidth / dotSpacing) + 10 }, (_, di) => {
            const x = di * dotSpacing;
            const y =
              wave.cy + wave.amplitude * Math.sin((x / wavelength) * Math.PI * 2 + wave.phase);
            return <circle key={`${wi}-${di}`} cx={x} cy={y} r={1.5} fill="hsl(var(--primary))" />;
          })
        )}
      </svg>

      <style>{`
        @keyframes wave-drift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-${wavelength}px); }
        }
      `}</style>
    </div>
  );
}
