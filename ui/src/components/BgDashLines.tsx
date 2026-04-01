/**
 * CSS-only horizontal dashed lines background pattern.
 * Gives a lined-notebook / form feel. Great for upload pages.
 *
 * @example
 * <div className="relative min-h-screen">
 *   <BgDashLines />
 *   <div className="relative z-10">Content</div>
 * </div>
 */

import { cn } from "@/lib/utils";

interface BgDashLinesProps {
  /** Override opacity (0-1). Auto: dark 0.3, light 0.4 */
  opacity?: number;
  /** Vertical spacing between lines in px. Default: 32 */
  spacing?: number;
  className?: string;
}

export function BgDashLines({ opacity, spacing = 32, className }: BgDashLinesProps) {
  // Simulate dashes via repeating-linear-gradient:
  // 8px colored, then 8px transparent, repeating horizontally
  // plus a vertical repeat for each line
  return (
    <div
      className={cn(
        "absolute inset-0 z-0 pointer-events-none overflow-hidden",
        !opacity && "opacity-[0.4] dark:opacity-[0.3]",
        className
      )}
      style={{
        ...(opacity != null ? { opacity } : {}),
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent ${spacing - 1}px,
          hsl(var(--border)) ${spacing - 1}px,
          hsl(var(--border)) ${spacing}px
        )`,
        // Overlay a horizontal dash mask
        WebkitMaskImage: `repeating-linear-gradient(
          90deg,
          black 0px,
          black 8px,
          transparent 8px,
          transparent 16px
        )`,
        maskImage: `repeating-linear-gradient(
          90deg,
          black 0px,
          black 8px,
          transparent 8px,
          transparent 16px
        )`,
      }}
      aria-hidden="true"
    />
  );
}
