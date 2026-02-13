/**
 * ChartExportButtons — SVG/PNG export for any chart container.
 *
 * Place inside a parent element that contains an <svg>. The component
 * walks up to the closest `[data-chart-export]` wrapper (or the parent
 * element) and grabs the first SVG it finds.
 *
 * Usage:
 *   <div data-chart-export>
 *     <ResponsiveContainer><LineChart … /></ResponsiveContainer>
 *     <ChartExportButtons filename="hydrophobicity" />
 *   </div>
 */
import { useRef, useCallback } from 'react';
import { exportSVG, exportPNG } from '@/lib/svgExport';

interface Props {
  filename: string;
}

export function ChartExportButtons({ filename }: Props) {
  const btnRef = useRef<HTMLDivElement>(null);

  const findSVG = useCallback((): SVGSVGElement | null => {
    const el = btnRef.current;
    if (!el) return null;
    // Walk up to [data-chart-export] or use parentElement
    const container = el.closest('[data-chart-export]') ?? el.parentElement;
    return container?.querySelector('svg') ?? null;
  }, []);

  return (
    <div ref={btnRef} className="flex justify-end gap-2 mt-2">
      <button
        type="button"
        className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={() => {
          const svg = findSVG();
          if (svg) exportSVG(svg, `${filename}.svg`);
        }}
      >
        SVG
      </button>
      <button
        type="button"
        className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={() => {
          const svg = findSVG();
          if (svg) exportPNG(svg, `${filename}.png`);
        }}
      >
        PNG
      </button>
    </div>
  );
}
