/**
 * Browser chrome frame with perspective tilt for showcasing dashboard previews.
 * Includes macOS-style traffic light dots and a URL bar.
 *
 * @example
 * <FloatingMockup url="pvl.desy.de/results">
 *   <img src="/screenshot.png" alt="Dashboard" />
 * </FloatingMockup>
 *
 * <FloatingMockup tilt={3} chrome={false}>
 *   <ResultsPreview />
 * </FloatingMockup>
 */

import { cn } from "@/lib/utils";

interface FloatingMockupProps {
  children: React.ReactNode;
  className?: string;
  /** Tilt angle in degrees. Default: 2 */
  tilt?: number;
  /** Show browser chrome (dots + URL bar). Default: true */
  chrome?: boolean;
  /** URL to display in the bar. Default: 'pvl.desy.de' */
  url?: string;
}

export function FloatingMockup({
  children,
  className,
  tilt = 2,
  chrome = true,
  url = "pvl.desy.de",
}: FloatingMockupProps) {
  return (
    <div className={cn("group", className)} style={{ perspective: "1200px" }}>
      <div
        className="transition-transform duration-300 motion-reduce:transform-none"
        style={{
          transform: `rotateX(${tilt}deg)`,
        }}
        // Subtle lift on hover: reduce tilt
        onMouseEnter={(e) => {
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            e.currentTarget.style.transform = `rotateX(${Math.max(0, tilt - 1)}deg)`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = `rotateX(${tilt}deg)`;
        }}
      >
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden shadow-strong bg-background">
          {/* Browser chrome */}
          {chrome && (
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--border))] bg-surface-2">
              {/* Traffic lights */}
              <div className="flex gap-1.5">
                <div className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]" />
                <div className="w-[10px] h-[10px] rounded-full bg-[#febc2e]" />
                <div className="w-[10px] h-[10px] rounded-full bg-[#28c840]" />
              </div>
              {/* URL bar */}
              <div className="flex-1 mx-4">
                <div className="bg-surface-1 rounded-md px-3 py-1 text-center">
                  <span className="text-caption text-muted-foreground font-mono">{url}</span>
                </div>
              </div>
              {/* Spacer for symmetry */}
              <div className="w-[52px]" />
            </div>
          )}

          {/* Content area */}
          <div className="overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}
