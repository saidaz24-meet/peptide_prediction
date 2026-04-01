/**
 * Number that counts up from 0 to target value when scrolled into view.
 * Uses IntersectionObserver + requestAnimationFrame for smooth 60fps.
 *
 * @example
 * <AnimatedCounter value={342} suffix=" peptides" className="text-3xl font-mono font-semibold" />
 * <AnimatedCounter value={67.8} suffix="%" decimals={1} />
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  /** Target value to count to */
  value: number;
  /** Text after the number, e.g., " peptides", "%", "ms" */
  suffix?: string;
  /** Text before the number, e.g., "$", "#" */
  prefix?: string;
  /** Duration in ms. Default: 1500 */
  duration?: number;
  /** Decimal places. Default: 0 */
  decimals?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  duration = 1500,
  decimals = 0,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState("0");
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(
        value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      );
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          observer.disconnect();

          let start: number | null = null;

          const step = (ts: number) => {
            if (!start) start = ts;
            const elapsed = ts - start;
            const t = Math.min(elapsed / duration, 1);
            // Cubic ease-out: fast start, slow finish
            const eased = 1 - Math.pow(1 - t, 3);
            const current = eased * value;

            setDisplay(
              current.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })
            );

            if (t < 1) {
              requestAnimationFrame(step);
            }
          };

          requestAnimationFrame(step);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration, decimals]);

  return (
    <span
      ref={ref}
      className={cn("tabular-nums", className)}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {prefix && <span>{prefix}</span>}
      {display}
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </span>
  );
}
