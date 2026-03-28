/**
 * Proportional weight bar with draggable segment handles.
 *
 * One horizontal bar where segments sum to 100%. Drag handles between
 * segments to redistribute weight. Min segment: 5%.
 */
import { useCallback, useRef, useState } from "react";
import {
  METRIC_LABELS,
  METRIC_COLORS,
  type RankingMetric,
  type ProportionalWeights,
} from "@/lib/ranking";

const MIN_WEIGHT = 5;

interface WeightBarProps {
  weights: ProportionalWeights;
  activeMetrics: RankingMetric[];
  onChange: (weights: ProportionalWeights) => void;
  disabled?: boolean;
}

export function WeightBar({ weights, activeMetrics, onChange, disabled }: WeightBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  // Build ordered list of segments with their cumulative positions
  const segments = activeMetrics.map((m) => ({
    metric: m,
    weight: weights[m] ?? 0,
    label: METRIC_LABELS[m],
    color: METRIC_COLORS[m],
  }));

  const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);

  const handleDrag = useCallback(
    (handleIndex: number, clientX: number) => {
      if (!barRef.current || disabled) return;

      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

      // handleIndex is between segment[handleIndex] and segment[handleIndex+1]
      // Calculate cumulative weight before and after the handle
      const newWeights = { ...weights };
      const before = activeMetrics.slice(0, handleIndex + 1);
      const after = activeMetrics.slice(handleIndex + 1);

      if (before.length === 0 || after.length === 0) return;

      // Total weight of segments before and after
      const totalBefore = before.reduce((s, m) => s + (weights[m] ?? 0), 0);
      const totalAfter = after.reduce((s, m) => s + (weights[m] ?? 0), 0);
      const combinedTotal = totalBefore + totalAfter;

      // Target: segments before handle should sum to `pct` (proportional to combinedTotal)
      const targetBefore = (pct / 100) * combinedTotal;
      const targetAfter = combinedTotal - targetBefore;

      // Enforce minimum per segment
      const minBefore = before.length * MIN_WEIGHT;
      const minAfter = after.length * MIN_WEIGHT;

      const clampedBefore = Math.max(minBefore, Math.min(combinedTotal - minAfter, targetBefore));
      const clampedAfter = combinedTotal - clampedBefore;

      // Distribute proportionally within each group
      const distributeProp = (metrics: RankingMetric[], oldTotal: number, newTotal: number) => {
        if (metrics.length === 0) return;
        if (oldTotal <= 0) {
          const each = newTotal / metrics.length;
          for (const m of metrics) newWeights[m] = Math.max(MIN_WEIGHT, each);
          return;
        }
        const scale = newTotal / oldTotal;
        let remaining = newTotal;
        for (let i = 0; i < metrics.length; i++) {
          if (i === metrics.length - 1) {
            newWeights[metrics[i]] = Math.max(MIN_WEIGHT, remaining);
          } else {
            const v = Math.max(MIN_WEIGHT, (weights[metrics[i]] ?? 0) * scale);
            newWeights[metrics[i]] = v;
            remaining -= v;
          }
        }
      };

      distributeProp(before, totalBefore, clampedBefore);
      distributeProp(after, totalAfter, clampedAfter);

      // Round to 1 decimal, ensure sum = 100
      let roundSum = 0;
      for (const m of activeMetrics) {
        newWeights[m] = Math.round((newWeights[m] ?? 0) * 10) / 10;
        roundSum += newWeights[m]!;
      }
      // Fix rounding drift on last metric
      if (activeMetrics.length > 0) {
        const last = activeMetrics[activeMetrics.length - 1];
        newWeights[last] =
          Math.round(((newWeights[last] ?? 0) + (totalWeight - roundSum)) * 10) / 10;
      }

      onChange(newWeights);
    },
    [weights, activeMetrics, onChange, disabled, totalWeight]
  );

  const handlePointerDown = useCallback(
    (handleIndex: number) => (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(handleIndex);
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging == null) return;
      handleDrag(dragging, e.clientX);
    },
    [dragging, handleDrag]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleKeyDown = useCallback(
    (handleIndex: number) => (e: React.KeyboardEvent) => {
      if (disabled) return;
      const left = activeMetrics[handleIndex];
      const right = activeMetrics[handleIndex + 1];
      if (!left || !right) return;

      const delta = e.shiftKey ? 5 : 1;
      const newWeights = { ...weights };

      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        const move = Math.min(delta, (newWeights[left] ?? 0) - MIN_WEIGHT);
        if (move > 0) {
          newWeights[left] = (newWeights[left] ?? 0) - move;
          newWeights[right] = (newWeights[right] ?? 0) + move;
          onChange(newWeights);
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        const move = Math.min(delta, (newWeights[right] ?? 0) - MIN_WEIGHT);
        if (move > 0) {
          newWeights[left] = (newWeights[left] ?? 0) + move;
          newWeights[right] = (newWeights[right] ?? 0) - move;
          onChange(newWeights);
        }
      }
    },
    [weights, activeMetrics, onChange, disabled]
  );

  if (segments.length === 0) return null;

  // Build cumulative offsets
  let cumulative = 0;
  const positions = segments.map((seg) => {
    const start = cumulative;
    const width = totalWeight > 0 ? (seg.weight / totalWeight) * 100 : 100 / segments.length;
    cumulative += width;
    return { ...seg, start, width };
  });

  return (
    <div className={`space-y-1 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div
        ref={barRef}
        className="relative h-10 rounded-lg overflow-hidden flex select-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {positions.map((seg, i) => (
          <div
            key={seg.metric}
            className={`relative flex items-center justify-center overflow-hidden transition-opacity ${seg.color} ${dragging != null ? "" : "hover:opacity-90"}`}
            style={{ width: `${seg.width}%` }}
          >
            {seg.width > 8 && (
              <div className="flex flex-col items-center text-white text-[10px] leading-tight font-medium pointer-events-none">
                <span className="truncate max-w-full px-1">{seg.label}</span>
                <span className="font-bold">{Math.round(seg.weight)}%</span>
              </div>
            )}
            {/* Drag handle between this segment and the next */}
            {i < positions.length - 1 && (
              <div
                className="absolute right-0 top-0 h-full w-3 cursor-col-resize z-10 flex items-center justify-center group"
                onPointerDown={handlePointerDown(i)}
                onKeyDown={handleKeyDown(i)}
                tabIndex={0}
                role="slider"
                aria-label={`Adjust weight between ${seg.label} and ${positions[i + 1]?.label}`}
                aria-valuenow={Math.round(seg.weight)}
                aria-valuemin={MIN_WEIGHT}
                aria-valuemax={100 - MIN_WEIGHT * (segments.length - 1)}
              >
                <div className="w-0.5 h-5 bg-white/60 rounded-full group-hover:bg-white group-focus:bg-white group-hover:h-7 group-focus:h-7 transition-all" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
