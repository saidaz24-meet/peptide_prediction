/**
 * Precognition-style chart wrapper card.
 * Dark-optimized frame with thin border, optional tab switcher,
 * time range pills, expand/export controls.
 *
 * Designed to wrap Recharts / any chart component.
 * The chart area uses a darker surface for contrast in dark mode
 * (Precognition uses pure black chart backgrounds).
 *
 * @example
 * <ChartCard
 *   title="Aggregation Risk Distribution"
 *   description="Score distribution across peptides"
 * >
 *   <BarChart data={data}>...</BarChart>
 * </ChartCard>
 *
 * @example
 * <ChartCard
 *   title="PROBABILITY OVER TIME"
 *   tabs={[
 *     { id: 'helix', label: 'PROBABILITY HELIX' },
 *     { id: 'lattice', label: '3D LATTICE' },
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   timeRanges={['1D', '1W', '1M', 'ALL']}
 *   activeRange={range}
 *   onRangeChange={setRange}
 *   onExpand={() => setExpandedChart('probability')}
 * >
 *   {activeTab === 'helix' ? <HelixChart /> : <LatticeChart />}
 * </ChartCard>
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

/* ── Types ── */

interface TabDef {
  id: string;
  label: string;
}

export interface ChartCardProps {
  /** Chart title (can be all-caps Precognition-style) */
  title: string;
  /** Optional subtitle / description */
  description?: string;
  /** Optional pill-style tab switcher */
  tabs?: TabDef[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Optional time range pills (e.g., ['1D', '1W', '1M']) */
  timeRanges?: string[];
  activeRange?: string;
  onRangeChange?: (range: string) => void;
  /** Header right slot (expand button, export, etc.) */
  headerRight?: React.ReactNode;
  /** Expand handler — shows expand icon when provided */
  onExpand?: () => void;
  /** Footer slot (legends, notes) */
  footer?: React.ReactNode;
  /** The chart content */
  children: React.ReactNode;
  /** Min-height for the chart area. Default: '280px' */
  chartMinHeight?: string;
  className?: string;
}

/* ── Expand icon (inline SVG) ── */

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 2H3a1 1 0 00-1 1v3m8-4h3a1 1 0 011 1v3m0 4v3a1 1 0 01-1 1h-3M2 10v3a1 1 0 001 1h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Component ── */

export function ChartCard({
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  timeRanges,
  activeRange,
  onRangeChange,
  headerRight,
  onExpand,
  footer,
  children,
  chartMinHeight = '280px',
  className,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden',
        'transition-all duration-200',
        'hover:border-[hsl(var(--border-hover))]',
        className,
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-caption text-[hsl(var(--muted-foreground))] tracking-wider">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-[hsl(var(--faint))] mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
          {onExpand && (
            <button
              onClick={onExpand}
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-md',
                'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                'hover:bg-[hsl(var(--surface-2))] transition-colors',
              )}
              title="Expand chart"
              aria-label="Expand chart"
            >
              <ExpandIcon />
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar + Time range row ── */}
      {(tabs || timeRanges) && (
        <div className="flex items-center justify-between gap-3 px-5 pb-3">
          {/* Tabs */}
          {tabs && tabs.length > 0 && (
            <div className="inline-flex items-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-0.5 gap-0">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange?.(tab.id)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium uppercase tracking-wider rounded-[5px] transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-[hsl(var(--surface-3))] text-[hsl(var(--foreground))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Time range pills */}
          {timeRanges && timeRanges.length > 0 && (
            <div className="inline-flex items-center gap-1 ml-auto">
              {timeRanges.map((range) => {
                const isActive = range === activeRange;
                return (
                  <button
                    key={range}
                    onClick={() => onRangeChange?.(range)}
                    className={cn(
                      'px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2))]',
                    )}
                  >
                    {range}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Chart area ── */}
      <div
        className={cn(
          'relative mx-3 mb-3 rounded-md overflow-hidden',
          /* Darker chart surface in dark mode for Precognition look */
          'bg-[hsl(var(--background))] dark:bg-[hsl(220_27%_4%)]',
          'border border-[hsl(var(--border)/0.5)]',
        )}
        style={{ minHeight: chartMinHeight }}
      >
        {children}
      </div>

      {/* ── Footer ── */}
      {footer && (
        <div className="px-5 pb-3 pt-1 border-t border-[hsl(var(--border)/0.5)]">
          {footer}
        </div>
      )}
    </div>
  );
}
