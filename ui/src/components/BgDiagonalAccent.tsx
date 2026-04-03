/**
 * Stripe-inspired thick diagonal accent line.
 * Renders in the bottom-right corner for a modern SaaS feel.
 */

import { cn } from "@/lib/utils";

interface BgDiagonalAccentProps {
  /** Override color. Default: primary green */
  color?: string;
  className?: string;
}

export function BgDiagonalAccent({ color, className }: BgDiagonalAccentProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-0 pointer-events-none overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {/* Primary thick diagonal */}
      <div
        className="absolute -bottom-20 -right-20 w-[600px] h-[600px]"
        style={{
          background: `linear-gradient(
            -35deg,
            ${color ?? "hsl(var(--primary))"} 0%,
            ${color ?? "hsl(var(--primary))"} 3.5%,
            transparent 3.5%
          )`,
          opacity: 0.08,
        }}
      />
      {/* Secondary thinner parallel line */}
      <div
        className="absolute -bottom-20 -right-20 w-[600px] h-[600px]"
        style={{
          background: `linear-gradient(
            -35deg,
            transparent 5%,
            ${color ?? "hsl(var(--primary))"} 5%,
            ${color ?? "hsl(var(--primary))"} 6%,
            transparent 6%
          )`,
          opacity: 0.04,
        }}
      />
    </div>
  );
}
