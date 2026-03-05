/**
 * Centralized chart configuration.
 *
 * Single source of truth for colors, axis settings, grid density, and
 * threshold line styles. All chart components import from here.
 *
 * Palette: Okabe-Ito (Wong, Nature Methods 2011) — colorblind-safe.
 * Axis guidelines: Krzywinski (Nature Methods 2013), Rougier (PLOS 2014).
 *
 * DESIGNED TO BE EASILY SWAPPABLE for the upcoming UI redesign.
 * Change the palette object below and every chart updates.
 */

// ─── Okabe-Ito Colorblind-Safe Palette ──────────────────────────────

export const PALETTE = {
  /** Aggregation hot / danger / Tier 1 */
  vermillion: "#D55E00",
  /** Helix / primary emphasis / Tier 3-beta */
  blue: "#0072B2",
  /** Category 1 / beta-strand / Tier 2-amber fallback */
  orange: "#E69F00",
  /** Safe / Tier 4 / coil */
  bluishGreen: "#009E73",
  /** Category 2 / sky / informational */
  skyBlue: "#56B4E9",
  /** Warning / uncertain */
  reddishPurple: "#CC79A7",
  /** Caution / amber zone */
  yellow: "#F0E442",
  /** Neutral / no data / Tier 5 */
  grey: "#999999",
  /** Text / axes */
  black: "#000000",
} as const;

// ─── Semantic Color Roles ────────────────────────────────────────────
// Map semantic meanings to palette colors. Change HERE to retheme.

export const CHART_COLORS = {
  // SSW prediction
  sswPositive: PALETTE.vermillion,
  sswNegative: PALETTE.bluishGreen,
  sswUncertain: PALETTE.grey,

  // Secondary structure
  helix: PALETTE.blue,
  beta: PALETTE.orange,
  coil: PALETTE.grey,

  // Aggregation
  aggHot: PALETTE.vermillion,
  aggModerate: PALETTE.orange,
  aggLow: PALETTE.bluishGreen,

  // Scatter chart groups
  scatterPrimary: PALETTE.blue,
  scatterSecondary: PALETTE.orange,
  scatterTertiary: PALETTE.bluishGreen,

  // Consensus tiers (for data point coloring)
  tier1: PALETTE.vermillion,
  tier2: PALETTE.orange,
  tier3: PALETTE.blue,
  tier4: PALETTE.bluishGreen,
  tier5: PALETTE.grey,

  // Cohort comparison
  cohortA: PALETTE.blue,
  cohortB: PALETTE.orange,

  // Reference lines
  threshold: PALETTE.reddishPurple,
  amphipathic: PALETTE.skyBlue,

  // Amino acid categories (HeliQuest scheme — kept for consistency)
  aaHydrophobic: "#F4C430",
  aaAromatic: "#F79318",
  aaBasic: PALETTE.blue,
  aaAcidic: PALETTE.vermillion,
  aaPolar: PALETTE.reddishPurple,
  aaSmall: "#C8C8C8",
  aaHelixBreaker: PALETTE.bluishGreen,
} as const;

// ─── Consensus tier color lookup ─────────────────────────────────────

export const TIER_POINT_COLORS: Record<number, string> = {
  1: CHART_COLORS.tier1,
  2: CHART_COLORS.tier2,
  3: CHART_COLORS.tier3,
  4: CHART_COLORS.tier4,
  5: CHART_COLORS.tier5,
};

// ─── Axis & Grid Configuration ──────────────────────────────────────

export const AXIS = {
  /** Gutter padding (% of domain range added to each side) */
  gutterPercent: 0.15,
  /** Tick color */
  tickColor: "#666666",
  /** Tick size (points outward from data area) */
  tickSize: 4,
  /** Axis line color */
  lineColor: "#CCCCCC",
  /** Label font size */
  labelFontSize: 11,
  /** Tick font size */
  tickFontSize: 10,
} as const;

export const GRID = {
  /** Grid line color (subtle, per Krzywinski 2013) */
  color: "#E5E5E5",
  /** Grid dash pattern */
  dashArray: "3 3",
  /** Grid opacity (10-15% per best practices) */
  opacity: 0.6,
} as const;

// ─── Threshold Line Styles ──────────────────────────────────────────

export const THRESHOLD_LINE = {
  color: CHART_COLORS.threshold,
  strokeWidth: 1.5,
  strokeDasharray: "6 3",
  opacity: 0.8,
} as const;

// ─── Chart Dimensions ───────────────────────────────────────────────

export const CHART_DIMS = {
  /** Default chart height in card view (px) */
  cardHeight: 300,
  /** Margin with gutters (15-20% breathing room) */
  margin: { top: 20, right: 30, bottom: 25, left: 30 },
  /** Expanded modal margin (more room for labels) */
  expandedMargin: { top: 25, right: 40, bottom: 35, left: 50 },
} as const;

// ─── Tooltip Styling ────────────────────────────────────────────────

export const TOOLTIP = {
  /** Background */
  bg: "hsl(var(--background))",
  /** Border */
  border: "1px solid hsl(var(--border))",
  /** Border radius */
  radius: 6,
  /** Font size */
  fontSize: 12,
} as const;

// ─── Utility: compute axis domain with gutter ───────────────────────

/**
 * Add gutter padding to a numeric domain so data doesn't touch axes.
 * Returns [min - gutter, max + gutter].
 */
export function withGutter(
  min: number,
  max: number,
  gutterPct = AXIS.gutterPercent,
): [number, number] {
  const span = Math.max(1e-6, max - min);
  const pad = span * gutterPct;
  return [min - pad, max + pad];
}
