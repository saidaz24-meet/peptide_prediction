/**
 * MiniDistribution — tiny SVG sparkline showing a 5-bin histogram.
 *
 * Used inside MetricHover to give immediate visual context for where a
 * peptide's metric value sits relative to the full database distribution.
 * The bin containing the highlighted value gets the accent color; the rest
 * are rendered in a muted tone.
 */

interface MiniDistributionProps {
  /** All numeric values in the database for this metric */
  values: number[];
  /** The specific value to highlight (null = no highlight) */
  highlight: number | null;
  /** Accent CSS color for the highlighted bin */
  color: string;
  /** SVG width in px */
  width?: number;
  /** SVG height in px */
  height?: number;
}

const BIN_COUNT = 5;
const GAP = 1;

export function MiniDistribution({
  values,
  highlight,
  color,
  width = 48,
  height = 20,
}: MiniDistributionProps): JSX.Element {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={2}
          fill="hsl(var(--muted) / 0.3)"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid division by zero for constant datasets

  // Build bins
  const bins = new Array<number>(BIN_COUNT).fill(0);
  for (const v of values) {
    let idx = Math.floor(((v - min) / range) * BIN_COUNT);
    if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
    bins[idx]++;
  }

  const maxBin = Math.max(...bins);
  const barWidth = (width - GAP * (BIN_COUNT - 1)) / BIN_COUNT;

  // Determine which bin the highlight value falls into
  let highlightIdx = -1;
  if (highlight !== null && highlight !== undefined) {
    highlightIdx = Math.floor(((highlight - min) / range) * BIN_COUNT);
    if (highlightIdx >= BIN_COUNT) highlightIdx = BIN_COUNT - 1;
    if (highlightIdx < 0) highlightIdx = 0;
  }

  return (
    <svg
      width={width}
      height={height}
      aria-hidden="true"
      role="img"
      aria-label="Distribution sparkline"
    >
      {bins.map((count, i) => {
        const barHeight = maxBin > 0 ? (count / maxBin) * height : 0;
        const x = i * (barWidth + GAP);
        const y = height - barHeight;
        const isHighlighted = i === highlightIdx;

        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(barHeight, 1)}
            rx={1}
            fill={isHighlighted ? color : "hsl(var(--muted-foreground) / 0.25)"}
          />
        );
      })}
    </svg>
  );
}
