/**
 * Glassmorphism card variant for hero sections and feature showcases.
 * Semi-transparent background with backdrop blur and optional hover glow.
 *
 * @example
 * <GlassCard>
 *   <h3>Feature Title</h3>
 *   <p>Description here</p>
 * </GlassCard>
 *
 * <GlassCard blur="lg" glow={false}>
 *   <p>No hover glow variant</p>
 * </GlassCard>
 */

import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  /** Intensity of the blur effect. Default: 'md' */
  blur?: "sm" | "md" | "lg" | "xl";
  /** Show subtle border glow on hover. Default: true */
  glow?: boolean;
}

const blurMap = {
  sm: "backdrop-blur-sm", // 4px
  md: "backdrop-blur-md", // 12px
  lg: "backdrop-blur-lg", // 24px
  xl: "backdrop-blur-xl", // 40px
} as const;

export function GlassCard({ children, className, blur = "md", glow = true }: GlassCardProps) {
  return (
    <div
      className={cn(
        // Layout
        "rounded-xl p-6",
        // Blur
        blurMap[blur],
        // Background: semi-transparent, adapts to theme
        "bg-white/5 dark:bg-white/5",
        "bg-white/60 [:not(.dark)>&]:bg-white/60",
        // Border
        "border",
        "dark:border-white/[0.05]",
        "border-black/[0.05] [:not(.dark)>&]:border-black/[0.05]",
        // Inset highlight
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        // Hover glow
        glow && [
          "transition-all duration-200",
          "hover:border-primary/20",
          "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_20px_hsl(var(--primary)/0.1)]",
        ],
        className
      )}
    >
      {children}
    </div>
  );
}
