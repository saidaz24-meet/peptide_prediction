/**
 * CSS-only graph paper / engineering notebook grid background.
 * Faint major gridlines with optional subdivisions.
 *
 * @example
 * <div className="relative min-h-screen">
 *   <BgNotebook />
 *   <div className="relative z-10">Content</div>
 * </div>
 */

import { cn } from "@/lib/utils";

interface BgNotebookProps {
  /** Override opacity (0-1). Auto: dark 0.2, light 0.3 */
  opacity?: number;
  /** Major grid spacing in px. Default: 32 */
  spacing?: number;
  /** Show 8px subdivision lines. Default: true */
  subdivisions?: boolean;
  className?: string;
}

export function BgNotebook({
  opacity,
  spacing = 32,
  subdivisions = true,
  className,
}: BgNotebookProps) {
  const subSpacing = spacing / 4; // 8px subdivisions for 32px major grid
  const majorColor = "hsl(var(--border))";

  // Build gradient layers
  const majorH = `repeating-linear-gradient(0deg, ${majorColor} 0px, ${majorColor} 1px, transparent 1px, transparent ${spacing}px)`;
  const majorV = `repeating-linear-gradient(90deg, ${majorColor} 0px, ${majorColor} 1px, transparent 1px, transparent ${spacing}px)`;

  let bgImage = `${majorH}, ${majorV}`;

  if (subdivisions) {
    // Subdivisions at half the opacity of major lines (handled by using same color but thinner visual)
    const subH = `repeating-linear-gradient(0deg, ${majorColor} 0px, ${majorColor} 0.5px, transparent 0.5px, transparent ${subSpacing}px)`;
    const subV = `repeating-linear-gradient(90deg, ${majorColor} 0px, ${majorColor} 0.5px, transparent 0.5px, transparent ${subSpacing}px)`;
    // Sub lines rendered behind major lines, at reduced opacity via a wrapper approach
    // Simplest: just overlay both. The 0.5px sub lines will naturally look lighter.
    bgImage = `${majorH}, ${majorV}, ${subH}, ${subV}`;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-0 pointer-events-none overflow-hidden",
        !opacity && "opacity-[0.3] dark:opacity-[0.2]",
        className
      )}
      style={{
        ...(opacity != null ? { opacity } : {}),
        backgroundImage: bgImage,
      }}
      aria-hidden="true"
    />
  );
}
