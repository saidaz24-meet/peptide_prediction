/**
 * Precognition-style data table wrapper and CSS utility classes.
 *
 * Wraps any table (TanStack, plain HTML) with:
 * - Sticky header with frosted glass blur
 * - Striped rows (subtle, dark-mode optimized)
 * - Row hover with surface-2 tint
 * - Monospace numbers for alignment
 * - Score bar cells
 * - Responsive horizontal scroll
 *
 * Also exports `dataTableClasses` for applying directly to existing tables
 * without the wrapper component.
 *
 * @example
 * <DataTableWrapper>
 *   <PeptideTable data={peptides} />
 * </DataTableWrapper>
 *
 * @example
 * // Or use classes directly:
 * <table className={dataTableClasses.table}>
 *   <thead className={dataTableClasses.thead}>...</thead>
 *   <tbody className={dataTableClasses.tbody}>...</tbody>
 * </table>
 */

import { cn } from '@/lib/utils';

/* ── Exported class maps for direct usage ── */

export const dataTableClasses = {
  /** Outer scrollable wrapper */
  wrapper: cn(
    'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden',
  ),

  /** Scroll container */
  scroll: cn(
    'overflow-x-auto',
  ),

  /** The <table> element */
  table: cn(
    'w-full text-sm border-collapse',
  ),

  /** <thead> — sticky, frosted glass */
  thead: cn(
    'sticky top-0 z-20',
    'bg-[hsl(var(--surface-1)/0.85)] backdrop-blur-sm',
    'border-b border-[hsl(var(--border))]',
  ),

  /** <th> cells */
  th: cn(
    'px-4 py-3 text-left',
    'text-caption text-[hsl(var(--muted-foreground))] tracking-wider',
    'font-medium select-none',
    'border-b border-[hsl(var(--border))]',
  ),

  /** Sortable <th> — adds hover + cursor */
  thSortable: cn(
    'cursor-pointer',
    'hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-2)/0.5)]',
    'transition-colors duration-150',
  ),

  /** <tbody> */
  tbody: cn(''),

  /** <tr> in tbody — striped + hover */
  tr: cn(
    'border-b border-[hsl(var(--border)/0.5)]',
    'transition-colors duration-100',
    'hover:bg-[hsl(var(--surface-2)/0.6)]',
    /* Zebra striping (very subtle) */
    'even:bg-[hsl(var(--surface-1)/0.3)]',
  ),

  /** Clickable row variant */
  trClickable: cn(
    'cursor-pointer',
    'active:bg-[hsl(var(--surface-2))]',
  ),

  /** Selected row */
  trSelected: cn(
    'bg-[hsl(var(--primary)/0.08)]',
    'hover:bg-[hsl(var(--primary)/0.12)]',
    'ring-1 ring-inset ring-[hsl(var(--primary)/0.3)]',
  ),

  /** <td> cells */
  td: cn(
    'px-4 py-2.5',
  ),

  /** Numeric <td> — monospace + right-aligned */
  tdNumeric: cn(
    'px-4 py-2.5',
    'text-right font-mono tabular-nums text-[hsl(var(--foreground))]',
  ),

  /** ID/name <td> — monospace, truncated */
  tdId: cn(
    'px-4 py-2.5',
    'font-mono text-[hsl(var(--primary))] truncate max-w-[180px]',
  ),

  /** Muted <td> for N/A values */
  tdMuted: cn(
    'px-4 py-2.5',
    'text-[hsl(var(--faint))] italic',
  ),

  /** Empty state */
  empty: cn(
    'px-4 py-12 text-center text-[hsl(var(--muted-foreground))]',
  ),
} as const;

/* ── Wrapper Component ── */

export interface DataTableWrapperProps {
  children: React.ReactNode;
  /** Optional toolbar/search above the table */
  toolbar?: React.ReactNode;
  /** Optional footer (pagination, export buttons) */
  footer?: React.ReactNode;
  /** Max height for scrollable area. Omit for auto height. */
  maxHeight?: string;
  className?: string;
}

export function DataTableWrapper({
  children,
  toolbar,
  footer,
  maxHeight,
  className,
}: DataTableWrapperProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden',
        'transition-colors duration-200',
        className,
      )}
    >
      {/* Toolbar */}
      {toolbar && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
          {toolbar}
        </div>
      )}

      {/* Scrollable table area */}
      <div
        className="overflow-auto"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[hsl(var(--border))]">
          {footer}
        </div>
      )}
    </div>
  );
}

/* ── Inline Score Bar (for table cells) ── */

export interface InlineScoreBarProps {
  /** Score 0-100 */
  score: number;
  /** Show numeric label. Default: true */
  showLabel?: boolean;
  /** Bar height. Default: 'sm' */
  size?: 'sm' | 'md';
}

/**
 * Compact score bar designed for table cells.
 * Green >= 66, amber >= 33, red < 33.
 * Uses CSS variables for theme consistency.
 */
export function InlineScoreBar({
  score,
  showLabel = true,
  size = 'sm',
}: InlineScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const h = size === 'md' ? 'h-2' : 'h-1.5';

  // Color using design tokens
  const color =
    clamped >= 66
      ? 'bg-[hsl(var(--success))]'
      : clamped >= 33
        ? 'bg-[hsl(var(--warning))]'
        : 'bg-[hsl(var(--destructive))]';

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className={cn('flex-1 rounded-full bg-[hsl(var(--muted))] overflow-hidden', h)}>
        <div
          className={cn('rounded-full transition-all duration-300', h, color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono tabular-nums text-[hsl(var(--muted-foreground))] w-7 text-right">
          {Math.round(clamped)}
        </span>
      )}
    </div>
  );
}
