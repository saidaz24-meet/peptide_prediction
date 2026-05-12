/**
 * WaveBackground — 3D wave-dots hero background.
 *
 * V10-1: Canvas 2D with manual 3D→2D perspective projection.
 * Zero external dependencies — all math is inline.
 *
 * A grid of particles lives in 3D space, displaced along Y by a
 * multi-component sine wave. Perspective projection gives depth cues:
 * closer dots appear larger, farther dots smaller and faded.
 *
 * Features:
 * - Respects prefers-reduced-motion (static snapshot, no animation)
 * - Pauses when off-screen (IntersectionObserver)
 * - Pauses when tab hidden (visibilitychange)
 * - Cleans up on unmount (cancelAnimationFrame, observer disconnect)
 * - Light/dark mode adaptive (reads --foreground CSS var)
 * - Reusable: Landing, About, Help can all mount this.
 */

import { useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WaveBackgroundProps {
  /** Override particle color (CSS color string). Defaults to hsl(var(--foreground)). */
  color?: string;
  /** Particle count. Default 8000 (desktop), 2500 (mobile, auto-detected via innerWidth < 640). */
  particleCount?: number;
  /** Animation speed multiplier. Default 1.0. Set to 0 for static. */
  speed?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Camera distance from origin (higher = less extreme perspective). */
const PERSPECTIVE = 800;

/** Grid extends from -GRID_HALF to +GRID_HALF on X and Z. */
const GRID_HALF = 12;

/** Camera rotation around X axis (radians). Tilts the view to show the wave surface. */
const CAMERA_TILT = 0.75; // ~43 degrees

/** Camera vertical offset (pushes the wave toward the bottom of the viewport). */
const CAMERA_Y = -3;

/** Wave parameters — 2 sine components for organic feel. */
const WAVE_A = { ampY: 1.6, freqX: 0.35, freqZ: 0.25, speed: 0.12 };
const WAVE_B = { ampY: 0.8, freqX: 0.55, freqZ: 0.45, speed: -0.08 };

/** Base dot radius range (px), scaled by depth. */
const DOT_MIN = 0.8;
const DOT_MAX = 2.8;

/** Alpha range (closer = more opaque). */
const ALPHA_MIN = 0.03;
const ALPHA_MAX = 0.18;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getResolvedColor(el: HTMLElement | null): string {
  if (!el) return "0,0,0";
  const style = getComputedStyle(el);
  const raw = style.getPropertyValue("--foreground").trim();
  if (!raw) return "0,0,0";
  // raw is typically "0 0% 0%" (HSL without function wrapper)
  // We need to convert to RGB for canvas fillStyle
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "0,0,0";
  ctx.fillStyle = `hsl(${raw})`;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `${r},${g},${b}`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WaveBackground({
  color,
  particleCount,
  speed = 1.0,
  className = "",
}: WaveBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const isVisibleRef = useRef(true);
  const isTabVisibleRef = useRef(true);

  // Resolve particle count based on viewport
  const getCount = useCallback(() => {
    if (particleCount != null) return particleCount;
    return typeof window !== "undefined" && window.innerWidth < 640 ? 2500 : 8000;
  }, [particleCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Build particle grid ──────────────────────────────────────
    const count = getCount();
    const gridSize = Math.ceil(Math.sqrt(count));
    const step = (GRID_HALF * 2) / gridSize;

    // Pre-compute grid positions (X, Z in world space)
    const particles: { x: number; z: number }[] = [];
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        particles.push({
          x: -GRID_HALF + i * step + (Math.random() - 0.5) * step * 0.3,
          z: -GRID_HALF + j * step + (Math.random() - 0.5) * step * 0.3,
        });
      }
    }

    // ── Resolve color ────────────────────────────────────────────
    let rgb = "0,0,0";
    if (color) {
      rgb = color;
    } else {
      rgb = getResolvedColor(container);
    }

    // Watch for theme changes (dark ↔ light toggle)
    const themeObserver = new MutationObserver(() => {
      if (!color) {
        rgb = getResolvedColor(container);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    // ── Resize handler ───────────────────────────────────────────
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // ── Pre-computed trig ────────────────────────────────────────
    const cosTilt = Math.cos(CAMERA_TILT);
    const sinTilt = Math.sin(CAMERA_TILT);

    // ── Render function ──────────────────────────────────────────
    function render(time: number) {
      if (!ctx) return;
      const t = time * 0.001 * speed;

      ctx.clearRect(0, 0, w, h);

      // Center of screen
      const cx = w / 2;
      const cy = h / 2;

      // Sort particles by depth (far to near) for correct overlap
      // We compute projected data inline and sort by Z'
      const projected: {
        sx: number;
        sy: number;
        size: number;
        alpha: number;
        depth: number;
      }[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Wave displacement along Y
        const yDisp =
          WAVE_A.ampY *
            Math.sin(p.x * WAVE_A.freqX + p.z * WAVE_A.freqZ + t * WAVE_A.speed) +
          WAVE_B.ampY *
            Math.sin(p.x * WAVE_B.freqX + p.z * WAVE_B.freqZ + t * WAVE_B.speed);

        // World position
        const wx = p.x;
        const wy = yDisp + CAMERA_Y;
        const wz = p.z;

        // Rotate around X axis (camera tilt)
        const ry = wy * cosTilt - wz * sinTilt;
        const rz = wy * sinTilt + wz * cosTilt;

        // Perspective projection
        const zDepth = rz + PERSPECTIVE;
        if (zDepth <= 0.1) continue; // behind camera

        const scale = PERSPECTIVE / zDepth;
        const sx = cx + wx * scale;
        const sy = cy + ry * scale;

        // Skip off-screen particles
        if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;

        // Depth-based size and alpha
        const depthNorm = Math.max(0, Math.min(1, (zDepth - 100) / (PERSPECTIVE * 2)));
        const size = DOT_MAX - depthNorm * (DOT_MAX - DOT_MIN);
        const alpha = ALPHA_MAX - depthNorm * (ALPHA_MAX - ALPHA_MIN);

        projected.push({ sx, sy, size, alpha, depth: zDepth });
      }

      // Sort back-to-front (larger zDepth = farther = drawn first)
      projected.sort((a, b) => b.depth - a.depth);

      // Draw dots
      for (let i = 0; i < projected.length; i++) {
        const d = projected[i];
        ctx.beginPath();
        ctx.arc(d.sx, d.sy, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${d.alpha})`;
        ctx.fill();
      }
    }

    // ── Animation loop ───────────────────────────────────────────
    const isReduced = prefersReducedMotion();

    if (isReduced || speed === 0) {
      // Render one static frame
      render(0);
      return () => {
        resizeObserver.disconnect();
        themeObserver.disconnect();
      };
    }

    let running = true;
    function loop(time: number) {
      if (!running) return;
      if (isVisibleRef.current && isTabVisibleRef.current) {
        render(time);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    // ── Visibility observers ─────────────────────────────────────
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(container);

    function handleVisibility() {
      isTabVisibleRef.current = !document.hidden;
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // ── Cleanup ──────────────────────────────────────────────────
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [color, getCount, speed]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      data-testid="wave-background"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
