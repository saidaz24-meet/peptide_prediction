/**
 * PeptideIcons — Scientific icon library for PVL.
 *
 * Visual language conventions:
 * - Stroke: 1.5–2px, `currentColor` (driven by theme tokens)
 * - Default size: 24×24 with `size` prop for override
 * - Monochrome — color via className (e.g., `text-green-500`)
 * - All icons accept `className` for Tailwind integration
 *
 * Each icon represents a specific scientific concept:
 * - HelixIcon: α-helix coil (S4PRED prediction)
 * - BetaSheetIcon: β-strand arrows (future use)
 * - StructuralSwitchIcon: helix ↔ β transition (SSW)
 * - FibrilIcon: parallel fibril striations (amyloid/fibril packing)
 * - HelixToFibrilIcon: helix → fibril (FF-Helix)
 * - SwitchToFibrilIcon: switch + fibril (FF-SSW)
 * - PeptideChainIcon: amino acid chain (total peptides)
 *
 * @see docs/active/PELEG_FEEDBACK_INSTRUCTIONS.md FIX-004
 */

import { type SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  /** Icon size in pixels (square). Default 24. */
  size?: number;
}

// ── Individual Icons ──

/** α-helix coil — represents helical secondary structure */
export function HelixIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Helix spiral — sinusoidal front strand */}
      <path d="M6 4c3 0 4 3 4 4s-1 4-4 4 4 3 4 4-1 4-4 4" />
      {/* Back strand (dashed, suggesting 3D depth) */}
      <path
        d="M18 4c-3 0-4 3-4 4s1 4 4 4-4 3-4 4 1 4 4 4"
        strokeDasharray="2 2"
        opacity={0.5}
      />
    </svg>
  );
}

/** β-sheet — parallel arrows representing β-strands */
export function BetaSheetIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Three parallel arrows (β-strands) */}
      <line x1={5} y1={6} x2={19} y2={6} />
      <polyline points="16,3 19,6 16,9" />
      <line x1={19} y1={12} x2={5} y2={12} />
      <polyline points="8,9 5,12 8,15" />
      <line x1={5} y1={18} x2={19} y2={18} />
      <polyline points="16,15 19,18 16,21" />
    </svg>
  );
}

/** Random coil — zigzag line representing disordered structure */
export function CoilIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M3 12c2-4 4 4 6 0s4 4 6 0 4 4 6 0" />
    </svg>
  );
}

/** Structural switch — helix ↔ β transition with double-headed arrow */
export function StructuralSwitchIcon({
  size = 24,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Left: helix coil (compact) */}
      <path d="M3 7c1.5 0 2 1.5 2 2s-.5 2-2 2 2 1.5 2 2-.5 2-2 2" />
      {/* Double-headed arrow */}
      <line x1={9} y1={12} x2={15} y2={12} />
      <polyline points="10,10 9,12 10,14" />
      <polyline points="14,10 15,12 14,14" />
      {/* Right: beta arrows (compact) */}
      <line x1={18} y1={8} x2={22} y2={8} />
      <polyline points="20.5,6.5 22,8 20.5,9.5" />
      <line x1={22} y1={13} x2={18} y2={13} />
      <polyline points="19.5,11.5 18,13 19.5,14.5" />
      <line x1={18} y1={18} x2={22} y2={18} />
      <polyline points="20.5,16.5 22,18 20.5,19.5" />
    </svg>
  );
}

/** Fibril — parallel diagonal lines representing amyloid fibril packing */
export function FibrilIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className={className}
      {...props}
    >
      {/* Parallel striations at ~30° */}
      <line x1={4} y1={20} x2={12} y2={4} />
      <line x1={8} y1={20} x2={16} y2={4} />
      <line x1={12} y1={20} x2={20} y2={4} />
      {/* Cross-connections suggesting interdigitated packing */}
      <line x1={6} y1={14} x2={14} y2={14} opacity={0.4} />
      <line x1={8} y1={10} x2={18} y2={10} opacity={0.4} />
    </svg>
  );
}

/** Helix → Fibril transition — α-helix with fibril striations (FF-Helix) */
export function HelixToFibrilIcon({
  size = 24,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Left: compact helix */}
      <path d="M2 7c1.5 0 2 1.5 2 2.5s-.5 2.5-2 2.5 2 1.5 2 2.5-.5 2-2 2" />
      {/* Arrow */}
      <line x1={7} y1={12} x2={11} y2={12} />
      <polyline points="9.5,10 11,12 9.5,14" />
      {/* Right: fibril lines */}
      <line x1={14} y1={18} x2={18} y2={6} />
      <line x1={17} y1={18} x2={21} y2={6} />
      <line x1={15} y1={13} x2={20} y2={13} opacity={0.4} />
    </svg>
  );
}

/** Switch + Fibril combined — SSW transitioning to fibril (FF-SSW) */
export function SwitchToFibrilIcon({
  size = 24,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Left: double arrow (switch symbol) */}
      <line x1={3} y1={12} x2={8} y2={12} />
      <polyline points="4.5,10 3,12 4.5,14" />
      <polyline points="6.5,10 8,12 6.5,14" />
      {/* Middle: transition arrow */}
      <line x1={10} y1={12} x2={13} y2={12} />
      <polyline points="11.5,10.5 13,12 11.5,13.5" />
      {/* Right: fibril lines */}
      <line x1={15} y1={18} x2={19} y2={6} />
      <line x1={18} y1={18} x2={22} y2={6} />
      <line x1={16} y1={13} x2={21} y2={13} opacity={0.4} />
    </svg>
  );
}

/** Peptide chain — linked circles representing amino acids */
export function PeptideChainIcon({
  size = 24,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className={className}
      {...props}
    >
      {/* Chain of 4 linked circles (amino acid residues) */}
      <circle cx={4} cy={12} r={2.5} />
      <line x1={6.5} y1={12} x2={8.5} y2={12} />
      <circle cx={11} cy={12} r={2.5} />
      <line x1={13.5} y1={10} x2={15.5} y2={8} />
      <circle cx={18} cy={6} r={2.5} />
      <line x1={13.5} y1={14} x2={15.5} y2={16} />
      <circle cx={18} cy={18} r={2.5} />
    </svg>
  );
}

/** Aggregation — multiple chains clustering together */
export function AggregationIcon({
  size = 24,
  className,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className={className}
      {...props}
    >
      {/* Central cluster of overlapping circles */}
      <circle cx={10} cy={10} r={3} />
      <circle cx={14} cy={10} r={3} />
      <circle cx={12} cy={14} r={3} />
      {/* Incoming arrows suggesting self-assembly */}
      <line x1={3} y1={5} x2={7} y2={8} />
      <line x1={21} y1={5} x2={17} y2={8} />
      <line x1={12} y1={22} x2={12} y2={17} />
    </svg>
  );
}

/** UniProt database icon */
export function UniProtIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Database cylinder */}
      <ellipse cx={12} cy={6} rx={8} ry={3} />
      <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  );
}

// ── Classification convenience component ──

export type ClassificationType =
  | "helix"
  | "ff-helix"
  | "ssw"
  | "ff-ssw"
  | "none"
  | "total";

const CLASSIFICATION_ICON_MAP: Record<
  ClassificationType,
  React.ComponentType<IconProps>
> = {
  helix: HelixIcon,
  "ff-helix": HelixToFibrilIcon,
  ssw: StructuralSwitchIcon,
  "ff-ssw": SwitchToFibrilIcon,
  none: CoilIcon,
  total: PeptideChainIcon,
};

interface ClassificationIconProps extends IconProps {
  classification: ClassificationType;
}

/**
 * Maps PVL's 4-category classification to the correct scientific icon.
 * Usage: `<ClassificationIcon classification="ff-helix" className="text-green-500" />`
 */
export function ClassificationIcon({
  classification,
  ...props
}: ClassificationIconProps) {
  const Icon = CLASSIFICATION_ICON_MAP[classification] || PeptideChainIcon;
  return <Icon {...props} />;
}

// ── Icon registry for future extensibility ──

const registry = new Map<string, React.ComponentType<IconProps>>(
  Object.entries(CLASSIFICATION_ICON_MAP)
);

/** Register a new classification icon without touching call sites. */
export function registerIcon(
  key: string,
  component: React.ComponentType<IconProps>
) {
  registry.set(key, component);
}

/** Look up an icon from the registry. Falls back to PeptideChainIcon. */
export function getRegisteredIcon(key: string): React.ComponentType<IconProps> {
  return registry.get(key) || PeptideChainIcon;
}
