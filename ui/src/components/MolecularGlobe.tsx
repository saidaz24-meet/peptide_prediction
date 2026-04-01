/**
 * MolecularGlobe — 3D globe with colored arcs and markers.
 * Uses COBE (5KB WebGL). Single instance, no destroy on theme change.
 */
import { useEffect, useRef, useCallback } from "react";
import createGlobe from "cobe";
import type { Marker, Arc } from "cobe";
import { cn } from "@/lib/utils";

interface MolecularGlobeProps {
  size?: number;
  className?: string;
}

const MARKERS: Marker[] = [
  // Primary locations — larger dots
  { location: [32.08, 34.78], size: 0.09, color: [0.3, 0.7, 1.0] },   // Israel — blue
  { location: [53.58, 10.02], size: 0.09, color: [0.3, 0.7, 1.0] },   // DESY — blue
  { location: [51.51, -0.13], size: 0.08, color: [0.96, 0.45, 0.71] }, // London — pink
  { location: [40.71, -74.01], size: 0.08, color: [0.98, 0.75, 0.14] },// NYC — yellow
  { location: [35.68, 139.65], size: 0.07, color: [0.98, 0.57, 0.24] },// Tokyo — orange
  { location: [37.77, -122.42], size: 0.07, color: [0.98, 0.57, 0.24] },// SF — orange
  { location: [48.86, 2.35], size: 0.08, color: [0.98, 0.75, 0.14] }, // Paris — yellow
  { location: [-23.55, -46.63], size: 0.06, color: [0.65, 0.55, 0.98] },// São Paulo — purple
  { location: [1.35, 103.82], size: 0.06, color: [0.65, 0.55, 0.98] }, // Singapore — purple
  // Additional colorful dots for visual richness
  { location: [55.75, 37.62], size: 0.05, color: [0.96, 0.45, 0.71] }, // Moscow — pink
  { location: [39.90, 116.40], size: 0.06, color: [0.98, 0.57, 0.24] },// Beijing — orange
  { location: [-33.87, 151.21], size: 0.05, color: [0.3, 0.7, 1.0] }, // Sydney — blue
  { location: [19.43, -99.13], size: 0.05, color: [0.98, 0.75, 0.14] },// Mexico City — yellow
  { location: [28.61, 77.21], size: 0.06, color: [0.65, 0.55, 0.98] }, // Delhi — purple
  { location: [-33.45, -70.67], size: 0.04, color: [0.96, 0.45, 0.71] },// Santiago — pink
  { location: [59.33, 18.07], size: 0.05, color: [0.3, 0.7, 1.0] },   // Stockholm — blue
  { location: [41.01, 28.98], size: 0.05, color: [0.98, 0.57, 0.24] }, // Istanbul — orange
  { location: [-1.29, 36.82], size: 0.04, color: [0.98, 0.75, 0.14] }, // Nairobi — yellow
  { location: [25.20, 55.27], size: 0.05, color: [0.65, 0.55, 0.98] }, // Dubai — purple
];

const ARCS: Arc[] = [
  { from: [32.08, 34.78], to: [53.58, 10.02], color: [0.3, 0.7, 1.0] },
  { from: [53.58, 10.02], to: [51.51, -0.13], color: [0.96, 0.45, 0.71] },
  { from: [35.68, 139.65], to: [37.77, -122.42], color: [0.98, 0.57, 0.24] },
  { from: [48.86, 2.35], to: [40.71, -74.01], color: [0.98, 0.75, 0.14] },
  { from: [-23.55, -46.63], to: [1.35, 103.82], color: [0.65, 0.55, 0.98] },
  { from: [51.51, -0.13], to: [40.71, -74.01], color: [0.3, 0.7, 1.0] },
];

export function MolecularGlobe({ size = 400, className }: MolecularGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const pointerDown = useRef(false);
  const pointerX = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: dpr,
      width: size * 2,
      height: size * 2,
      phi: 0,
      theta: 0.25,
      dark: 0,
      diffuse: 1.4,
      mapSamples: 40000,
      mapBrightness: 2,
      mapBaseBrightness: 0.05,
      baseColor: [0.88, 0.87, 0.92],
      markerColor: [0.4, 0.3, 0.8],
      glowColor: [0.90, 0.88, 0.95],
      markers: MARKERS,
      arcs: ARCS,
      arcHeight: 0.12,
      arcWidth: 0.4,
      scale: 1,
      offset: [0, 0],
      onRender: (state: Record<string, unknown>) => {
        if (!prefersReduced && !pointerDown.current) {
          phiRef.current += 0.003;
        }
        (state as { phi: number }).phi = phiRef.current;
      },
    } as Parameters<typeof createGlobe>[1]);

    return () => globe.destroy();
  }, [size]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDown.current = true;
    pointerX.current = e.clientX;
  }, []);

  const handlePointerUp = useCallback(() => {
    pointerDown.current = false;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerDown.current) {
      const delta = e.clientX - pointerX.current;
      pointerX.current = e.clientX;
      phiRef.current += delta * 0.005;
    }
  }, []);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
        onPointerMove={handlePointerMove}
        style={{
          width: size,
          height: size,
          maxWidth: "100%",
          aspectRatio: "1",
          contain: "layout paint",
        }}
        className="cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}
