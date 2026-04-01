/**
 * Small pulsing dot indicator for live/active status.
 * Pure CSS animation, inline-flex for text alignment.
 *
 * @example
 * <PulseBeacon /> Active
 * <PulseBeacon color="warning" size={6} /> Processing
 * <PulseBeacon color="destructive" active={false} /> Offline
 */

import { cn } from "@/lib/utils";

interface PulseBeaconProps {
  /** Color variant. Default: 'success' */
  color?: "success" | "warning" | "destructive" | "primary";
  /** Size in px. Default: 8 */
  size?: number;
  /** Whether to pulse. Default: true */
  active?: boolean;
  className?: string;
}

const colorMap = {
  success: "bg-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning))]",
  destructive: "bg-[hsl(var(--destructive))]",
  primary: "bg-[hsl(var(--primary))]",
} as const;

const ringColorMap = {
  success: "bg-[hsl(var(--success)/0.4)]",
  warning: "bg-[hsl(var(--warning)/0.4)]",
  destructive: "bg-[hsl(var(--destructive)/0.4)]",
  primary: "bg-[hsl(var(--primary)/0.4)]",
} as const;

export function PulseBeacon({
  color = "success",
  size = 8,
  active = true,
  className,
}: PulseBeaconProps) {
  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size * 2.5, height: size * 2.5 }}
      aria-hidden="true"
    >
      {/* Pulse ring */}
      {active && (
        <span
          className={cn(
            "absolute rounded-full motion-safe:animate-[pulse-ring_1.5s_ease-out_infinite] motion-reduce:hidden",
            ringColorMap[color]
          )}
          style={{ width: size, height: size }}
        />
      )}

      {/* Core dot */}
      <span
        className={cn("relative rounded-full", colorMap[color])}
        style={{ width: size, height: size }}
      />

      {/* Keyframes — injected once via CSS */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </span>
  );
}
