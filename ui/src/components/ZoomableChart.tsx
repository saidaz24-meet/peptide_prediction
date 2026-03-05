import { useCallback, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReferenceArea } from 'recharts';

/**
 * Brush-select zoom hook for Recharts charts.
 *
 * Usage:
 *   const { zoomDomain, brushProps, chartHandlers, ZoomControls, zoomHint } = useBrushZoom();
 *
 *   <LineChart {...chartHandlers}>
 *     ...
 *     <XAxis domain={zoomDomain ?? ['auto', 'auto']} />
 *     {brushProps && <ReferenceArea {...brushProps} />}
 *   </LineChart>
 *   {ZoomControls}
 *   {zoomHint}
 */
export function useBrushZoom(opts?: { minSpan?: number }) {
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const isDragging = useRef(false);

  const minSpan = opts?.minSpan ?? 1;

  const onMouseDown = useCallback((e: any) => {
    if (e?.activeLabel != null) {
      setRefAreaLeft(Number(e.activeLabel));
      setRefAreaRight(null);
      isDragging.current = true;
    }
  }, []);

  const onMouseMove = useCallback((e: any) => {
    if (isDragging.current && e?.activeLabel != null) {
      setRefAreaRight(Number(e.activeLabel));
    }
  }, []);

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (refAreaLeft != null && refAreaRight != null) {
      const left = Math.min(refAreaLeft, refAreaRight);
      const right = Math.max(refAreaLeft, refAreaRight);
      if (right - left >= minSpan) {
        setZoomDomain([left, right]);
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, minSpan]);

  const resetZoom = useCallback(() => {
    setZoomDomain(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
    isDragging.current = false;
  }, []);

  const isZoomed = zoomDomain !== null;

  // Chart event handlers — spread onto the Recharts chart component
  const chartHandlers = {
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };

  // ReferenceArea props for the blue selection overlay during drag
  const brushProps = refAreaLeft != null && refAreaRight != null
    ? {
        x1: refAreaLeft,
        x2: refAreaRight,
        fill: '#3b82f6',
        fillOpacity: 0.15,
        stroke: '#3b82f6',
        strokeOpacity: 0.4,
      }
    : null;

  // Reset button — only show when zoomed
  const ZoomControls = isZoomed ? (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" onClick={resetZoom} className="h-7 px-2 text-xs">
        <RotateCcw className="h-3.5 w-3.5 mr-1" />
        Reset Zoom
      </Button>
    </div>
  ) : null;

  // Zoom hint — show only when NOT zoomed (hints user how to zoom)
  const zoomHint = !isZoomed ? (
    <p className="text-[10px] text-muted-foreground mt-1">
      Drag to zoom a region. Click &quot;Reset Zoom&quot; to restore.
    </p>
  ) : null;

  return {
    zoomDomain,
    isZoomed,
    resetZoom,
    chartHandlers,
    brushProps,
    ZoomControls,
    zoomHint,
  };
}

/**
 * Utility: convert zoom domain to Recharts XAxis domain prop.
 * Returns undefined when not zoomed (Recharts auto-calculates).
 */
export function zoomDomain(zoom: [number, number] | null): [number, number] | undefined {
  return zoom ?? undefined;
}
