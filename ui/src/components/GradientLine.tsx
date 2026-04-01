/**
 * Animated horizontal separator with a traveling neon glow.
 * 2px core line + wide soft blur halo. Purple → blue → orange sweep.
 * CSS-only animation, no framer-motion.
 */

import { cn } from "@/lib/utils";

interface GradientLineProps {
  className?: string;
  /** Duration of one full sweep in seconds. Default: 6 */
  duration?: number;
  /** Whether to animate. Default: true (respects prefers-reduced-motion) */
  animate?: boolean;
}

export function GradientLine({ className, duration = 6, animate = true }: GradientLineProps) {
  return (
    <div className={cn("relative w-full h-8 flex items-center overflow-hidden", className)} aria-hidden="true">
      {/* Base line — subtle border underneath */}
      <div className="absolute left-0 right-0 h-px bg-[hsl(var(--border)/0.5)]" />

      {/* Core line — 2px, sharp color */}
      <div
        className={cn(
          "absolute left-0 right-0 h-[2px] rounded-full",
          animate &&
            "motion-safe:animate-[gradient-sweep_var(--sweep-duration)_ease-in-out_infinite]",
          !animate && "opacity-0"
        )}
        style={
          {
            "--sweep-duration": `${duration}s`,
            backgroundImage: `linear-gradient(
              90deg,
              transparent 0%,
              hsl(258 90% 66%) 25%,
              hsl(var(--helix)) 45%,
              hsl(258 90% 66%) 65%,
              hsl(var(--beta)) 80%,
              transparent 100%
            )`,
            backgroundSize: "300px 100%",
            backgroundRepeat: "no-repeat",
          } as React.CSSProperties
        }
      />

      {/* Glow halo — wide soft blur behind the core */}
      <div
        className={cn(
          "absolute left-0 right-0 h-[2px] rounded-full",
          animate &&
            "motion-safe:animate-[gradient-sweep_var(--sweep-duration)_ease-in-out_infinite]",
          !animate && "opacity-0"
        )}
        style={
          {
            "--sweep-duration": `${duration}s`,
            backgroundImage: `linear-gradient(
              90deg,
              transparent 0%,
              hsl(258 90% 66%) 25%,
              hsl(var(--helix)) 45%,
              hsl(258 90% 66%) 65%,
              hsl(var(--beta)) 80%,
              transparent 100%
            )`,
            backgroundSize: "300px 100%",
            backgroundRepeat: "no-repeat",
            filter: "blur(8px)",
            opacity: 0.7,
          } as React.CSSProperties
        }
      />

      {/* Extra wide ambient glow */}
      <div
        className={cn(
          "absolute left-0 right-0 h-[2px] rounded-full",
          animate &&
            "motion-safe:animate-[gradient-sweep_var(--sweep-duration)_ease-in-out_infinite]",
          !animate && "opacity-0"
        )}
        style={
          {
            "--sweep-duration": `${duration}s`,
            backgroundImage: `linear-gradient(
              90deg,
              transparent 0%,
              hsl(258 90% 66%) 25%,
              hsl(var(--helix)) 45%,
              hsl(258 90% 66%) 65%,
              hsl(var(--beta)) 80%,
              transparent 100%
            )`,
            backgroundSize: "300px 100%",
            backgroundRepeat: "no-repeat",
            filter: "blur(20px)",
            opacity: 0.4,
          } as React.CSSProperties
        }
      />

      {/* Inline keyframes */}
      <style>{`
        @keyframes gradient-sweep {
          0%   { background-position: -300px 0; }
          100% { background-position: calc(100% + 300px) 0; }
        }
      `}</style>
    </div>
  );
}
