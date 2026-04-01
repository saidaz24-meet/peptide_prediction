/**
 * Precognition-style segmented tab bar with sliding active indicator.
 * Two visual variants: 'underline' (classic tab bar) and 'pill' (Precognition toggle).
 *
 * Uses framer-motion layoutId for the sliding indicator animation.
 * Falls back to instant switch when prefers-reduced-motion is set.
 *
 * @example
 * const [tab, setTab] = useState('data');
 * <SegmentTabs
 *   items={[
 *     { id: 'data', label: 'Data Table' },
 *     { id: 'ranking', label: 'Candidate Ranking' },
 *     { id: 'charts', label: 'Charts & Analysis' },
 *   ]}
 *   activeId={tab}
 *   onChange={setTab}
 * />
 *
 * @example
 * <SegmentTabs
 *   variant="pill"
 *   size="sm"
 *   items={[
 *     { id: 'probability', label: 'PROBABILITY HELIX' },
 *     { id: 'lattice', label: '3D LATTICE' },
 *   ]}
 *   activeId={activeChart}
 *   onChange={setActiveChart}
 * />
 */

import { useId, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Types ── */

export interface TabItem {
  id: string;
  label: string;
  /** Optional icon (ReactNode) rendered before label */
  icon?: React.ReactNode;
  /** Disable this tab */
  disabled?: boolean;
}

export interface SegmentTabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Visual variant. Default: 'underline' */
  variant?: 'underline' | 'pill';
  /** Size. Default: 'md' */
  size?: 'sm' | 'md';
  /** Additional className for the container */
  className?: string;
}

/* ── Motion config ── */

const SPRING = { type: 'spring', stiffness: 500, damping: 35, mass: 0.8 } as const;

/* ── Component ── */

export function SegmentTabs({
  items,
  activeId,
  onChange,
  variant = 'underline',
  size = 'md',
  className,
}: SegmentTabsProps) {
  const layoutId = useId();
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    setPrefersReduced(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  const isPill = variant === 'pill';
  const isSm = size === 'sm';

  return (
    <div
      role="tablist"
      className={cn(
        'relative inline-flex items-center',
        isPill
          ? cn(
              'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-0.5',
              isSm ? 'gap-0' : 'gap-0.5',
            )
          : cn(
              'border-b border-[hsl(var(--border))]',
              isSm ? 'gap-4' : 'gap-6',
            ),
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;

        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            aria-disabled={item.disabled}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) onChange(item.id);
            }}
            className={cn(
              'relative z-10 inline-flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap select-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 rounded-md',
              item.disabled && 'opacity-40 cursor-not-allowed',

              /* ── Underline variant ── */
              !isPill && cn(
                'pb-2.5 -mb-px',
                isSm ? 'text-xs' : 'text-sm',
                isActive
                  ? 'text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              ),

              /* ── Pill variant ── */
              isPill && cn(
                'rounded-md',
                isSm ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
                isActive
                  ? 'text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              ),
            )}
          >
            {item.icon}
            <span className={cn(isPill && 'uppercase tracking-wider text-caption font-medium')}>
              {item.label}
            </span>

            {/* ── Underline indicator ── */}
            {!isPill && isActive && (
              <motion.div
                layoutId={`${layoutId}-underline`}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--primary))] rounded-full"
                transition={prefersReduced ? { duration: 0 } : SPRING}
              />
            )}

            {/* ── Pill indicator (behind text) ── */}
            {isPill && isActive && (
              <motion.div
                layoutId={`${layoutId}-pill`}
                className="absolute inset-0 rounded-md bg-[hsl(var(--surface-3))] -z-10"
                transition={prefersReduced ? { duration: 0 } : SPRING}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
