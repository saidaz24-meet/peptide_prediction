/**
 * Reusable status badge for consensus labels, provider flags, and classification tags.
 * Stripe-style: subtle background tint + colored text, no harsh borders.
 *
 * Supports semantic variants (positive/negative/neutral/warning) and
 * PVL-specific scientific variants (candidate/non-candidate/helix/beta/coil).
 *
 * @example
 * <StatusBadge variant="positive">Candidate</StatusBadge>
 * <StatusBadge variant="negative">Not Candidate</StatusBadge>
 * <StatusBadge variant="warning" dot>Partial</StatusBadge>
 *
 * @example
 * <StatusBadge variant="helix" size="sm">Helix-Rich</StatusBadge>
 * <StatusBadge variant="beta" size="sm">Beta-Sheet</StatusBadge>
 * <StatusBadge variant="neutral" dot>TANGO OFF</StatusBadge>
 */

import { cn } from '@/lib/utils';

/* ── Types ── */

type BadgeVariant =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'warning'
  | 'info'
  | 'candidate'
  | 'non-candidate'
  | 'helix'
  | 'beta'
  | 'coil';

export interface StatusBadgeProps {
  variant?: BadgeVariant;
  /** Size. Default: 'md' */
  size?: 'sm' | 'md';
  /** Show a leading dot indicator */
  dot?: boolean;
  /** Make the badge fully rounded (pill). Default: true */
  pill?: boolean;
  children: React.ReactNode;
  className?: string;
}

/* ── Color maps ── */

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  positive: {
    bg: 'bg-[hsl(var(--success)/0.12)]',
    text: 'text-[hsl(var(--success))]',
    dot: 'bg-[hsl(var(--success))]',
  },
  negative: {
    bg: 'bg-[hsl(var(--destructive)/0.12)]',
    text: 'text-[hsl(var(--destructive))]',
    dot: 'bg-[hsl(var(--destructive))]',
  },
  neutral: {
    bg: 'bg-[hsl(var(--muted))]',
    text: 'text-[hsl(var(--muted-foreground))]',
    dot: 'bg-[hsl(var(--muted-foreground))]',
  },
  warning: {
    bg: 'bg-[hsl(var(--warning)/0.12)]',
    text: 'text-[hsl(var(--warning))]',
    dot: 'bg-[hsl(var(--warning))]',
  },
  info: {
    bg: 'bg-[hsl(var(--primary)/0.12)]',
    text: 'text-[hsl(var(--primary))]',
    dot: 'bg-[hsl(var(--primary))]',
  },
  candidate: {
    bg: 'bg-[hsl(var(--success)/0.12)]',
    text: 'text-[hsl(var(--success))]',
    dot: 'bg-[hsl(var(--success))]',
  },
  'non-candidate': {
    bg: 'bg-[hsl(var(--muted))]',
    text: 'text-[hsl(var(--muted-foreground))]',
    dot: 'bg-[hsl(var(--muted-foreground))]',
  },
  helix: {
    bg: 'bg-[hsl(var(--helix)/0.12)]',
    text: 'text-[hsl(var(--helix))]',
    dot: 'bg-[hsl(var(--helix))]',
  },
  beta: {
    bg: 'bg-[hsl(var(--beta)/0.12)]',
    text: 'text-[hsl(var(--beta))]',
    dot: 'bg-[hsl(var(--beta))]',
  },
  coil: {
    bg: 'bg-[hsl(var(--coil)/0.15)]',
    text: 'text-[hsl(var(--coil))]',
    dot: 'bg-[hsl(var(--coil))]',
  },
};

/* ── Component ── */

export function StatusBadge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  pill = true,
  children,
  className,
}: StatusBadgeProps) {
  const styles = variantStyles[variant];
  const isSm = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium whitespace-nowrap',
        styles.bg,
        styles.text,
        pill ? 'rounded-full' : 'rounded-md',
        isSm ? 'px-2 py-0.5 text-[0.625rem]' : 'px-2.5 py-0.5 text-xs',
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'shrink-0 rounded-full',
            styles.dot,
            isSm ? 'h-1.5 w-1.5' : 'h-2 w-2',
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
