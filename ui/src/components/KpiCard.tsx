/**
 * Precognition × Stripe KPI card.
 * Top accent bar, large monospace value, animated count-up,
 * optional trend indicator and subtitle.
 *
 * Uses PVL design tokens (CSS variables). Works in dark + light mode.
 * prefers-reduced-motion: skips count-up animation.
 *
 * @example
 * <KpiCard
 *   label="Total Peptides"
 *   value={142}
 *   icon={<Users className="h-4 w-4" />}
 *   accentColor="primary"
 * />
 *
 * @example
 * <KpiCard
 *   label="FF-Helix %"
 *   value={25.3}
 *   format="percent"
 *   trend={{ direction: "up", label: "+4.2%" }}
 *   subtitle="Helix + μH > avg"
 *   accentColor="success"
 * />
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

/* ── Types ── */

type AccentColor = 'primary' | 'success' | 'warning' | 'destructive' | 'helix' | 'beta';

interface TrendIndicator {
  direction: 'up' | 'down' | 'neutral';
  label: string;
}

export interface KpiCardProps {
  /** Small muted label above the value */
  label: string;
  /** Numeric value to display (animates on mount). Pass string for pre-formatted. */
  value: number | string;
  /** Number format: 'integer' (default), 'decimal', 'percent' */
  format?: 'integer' | 'decimal' | 'percent';
  /** Decimal places for 'decimal' and 'percent' formats. Default: 1 */
  decimals?: number;
  /** Optional icon (ReactNode) shown top-right */
  icon?: React.ReactNode;
  /** Accent color for the top bar. Default: 'primary' */
  accentColor?: AccentColor;
  /** Optional trend badge below the value */
  trend?: TrendIndicator;
  /** Optional small subtitle below value/trend */
  subtitle?: string;
  /** Click handler */
  onClick?: () => void;
  /** Tooltip text */
  tooltip?: string;
  /** Show skeleton loading state */
  loading?: boolean;
  className?: string;
}

/* ── Accent color map (top bar + icon bg) ── */

const accentBarColor: Record<AccentColor, string> = {
  primary: 'bg-[hsl(var(--primary))]',
  success: 'bg-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning))]',
  destructive: 'bg-[hsl(var(--destructive))]',
  helix: 'bg-[hsl(var(--helix))]',
  beta: 'bg-[hsl(var(--beta))]',
};

const accentIconBg: Record<AccentColor, string> = {
  primary: 'bg-[hsl(var(--primary)/0.12)]',
  success: 'bg-[hsl(var(--success)/0.12)]',
  warning: 'bg-[hsl(var(--warning)/0.12)]',
  destructive: 'bg-[hsl(var(--destructive)/0.12)]',
  helix: 'bg-[hsl(var(--helix)/0.12)]',
  beta: 'bg-[hsl(var(--beta)/0.12)]',
};

const accentIconText: Record<AccentColor, string> = {
  primary: 'text-[hsl(var(--primary))]',
  success: 'text-[hsl(var(--success))]',
  warning: 'text-[hsl(var(--warning))]',
  destructive: 'text-[hsl(var(--destructive))]',
  helix: 'text-[hsl(var(--helix))]',
  beta: 'text-[hsl(var(--beta))]',
};

/* ── Trend arrow SVGs (inline, no extra deps) ── */

function TrendArrow({ direction }: { direction: 'up' | 'down' | 'neutral' }) {
  if (direction === 'neutral') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  const d = direction === 'up' ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4';
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const trendColors: Record<string, string> = {
  up: 'text-[hsl(var(--success))]',
  down: 'text-[hsl(var(--destructive))]',
  neutral: 'text-[hsl(var(--muted-foreground))]',
};

/* ── Count-up hook ── */

function useCountUp(
  target: number,
  duration: number = 600,
  format: 'integer' | 'decimal' | 'percent' = 'integer',
  decimals: number = 1,
): string {
  const [display, setDisplay] = useState('0');
  const rafRef = useRef<number>(0);
  const prefersReduced = useRef(false);

  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (prefersReduced.current) {
      setDisplay(formatValue(target, format, decimals));
      return;
    }

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setDisplay(formatValue(current, format, decimals));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, format, decimals]);

  return display;
}

function formatValue(
  value: number,
  format: 'integer' | 'decimal' | 'percent',
  decimals: number,
): string {
  switch (format) {
    case 'percent':
      return `${value.toFixed(decimals)}%`;
    case 'decimal':
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    case 'integer':
    default:
      return Math.round(value).toLocaleString();
  }
}

/* ── Skeleton ── */

function KpiSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden',
        className,
      )}
    >
      {/* Accent bar skeleton */}
      <div className="h-1 w-full skeleton" />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3.5 w-20 skeleton rounded" />
            <div className="h-8 w-28 skeleton rounded" />
            <div className="h-3 w-16 skeleton rounded" />
          </div>
          <div className="h-9 w-9 skeleton rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ── */

export function KpiCard({
  label,
  value,
  format = 'integer',
  decimals = 1,
  icon,
  accentColor = 'primary',
  trend,
  subtitle,
  onClick,
  tooltip,
  loading = false,
  className,
}: KpiCardProps) {
  const isNumeric = typeof value === 'number';
  const displayValue = useCountUp(
    isNumeric ? value : 0,
    600,
    format,
    decimals,
  );

  const finalValue = isNumeric ? displayValue : value;

  if (loading) {
    return <KpiSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden',
        'transition-all duration-200 ease-out',
        'hover:border-[hsl(var(--border-hover))] hover:-translate-y-0.5',
        'hover:shadow-[var(--shadow-medium)]',
        onClick && 'cursor-pointer active:scale-[0.98]',
        className,
      )}
      onClick={onClick}
      title={tooltip}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* Top accent bar */}
      <div className={cn('h-1 w-full', accentBarColor[accentColor])} />

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Text column */}
          <div className="min-w-0 flex-1">
            {/* Label */}
            <p className="text-caption text-[hsl(var(--muted-foreground))] mb-1.5 truncate">
              {label}
            </p>

            {/* Value */}
            <p
              className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))] font-mono tabular-nums leading-none"
              aria-label={`${label}: ${finalValue}`}
            >
              {finalValue}
            </p>

            {/* Trend + Subtitle row */}
            <div className="mt-2 flex items-center gap-2 min-h-[1.125rem]">
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-medium',
                    trendColors[trend.direction],
                  )}
                >
                  <TrendArrow direction={trend.direction} />
                  {trend.label}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          {/* Icon */}
          {icon && (
            <div
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg shrink-0',
                accentIconBg[accentColor],
                accentIconText[accentColor],
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
