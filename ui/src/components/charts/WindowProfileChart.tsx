/**
 * WindowProfileChart — Declarative multi-channel sliding-window profile.
 *
 * Replaces the monochromatic dual-chart layout (hydrophobicity + μH) with a
 * single, rich, multi-channel visualization inspired by SignalP/DeepTMHMM.
 *
 * Channel-declarative model:
 * ─────────────────────────────────────────────────────────────────────────
 * Instead of hardcoding which lines/bands to render, consumers declare an
 * array of `WindowChannel` objects. Each channel type renders differently:
 *
 *   - `line`          → Recharts <Line> with specified color, axis binding
 *   - `segment-band`  → Recharts <ReferenceArea> shaded bands (helix, SSW, etc.)
 *   - `point-markers`  → Recharts <Scatter> dots at residue positions > threshold
 *
 * This enables future Phase I multi-predictor channels to plug in with zero
 * component changes — just add entries to the channels array.
 *
 * Visual encoding:
 *   Hydrophobicity: solid purple line (--helix)
 *   μH:             solid green line (--ff-helix)
 *   TANGO:          dashed red-orange line (--ff-ssw), right y-axis
 *   S4PRED helix:   purple band, 25% opacity
 *   FF-Helix:       green band, 35% opacity
 *   SSW zones:      amber band, 30% opacity
 *   TANGO peaks:    red dots at positions > threshold
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildProfilePoints, helixRanges } from "@/lib/profile";
import { useThresholdStore } from "@/stores/thresholdStore";
import type { Peptide } from "@/types/peptide";

// ── Types ──────────────────────────────────────────────────────────────────

export type WindowChannel =
  | {
      type: "line";
      id: string;
      label: string;
      metric: "hydrophobicity" | "muH" | "tango";
      color: string;
      yAxis: "left" | "right";
      strokeDash?: string;
      strokeWidth?: number;
    }
  | {
      type: "segment-band";
      id: string;
      label: string;
      source: "s4predHelix" | "ffHelix" | "sswZone";
      color: string;
      opacity: number;
    }
  | {
      type: "point-markers";
      id: string;
      label: string;
      metric: "aggregationPeaks";
      threshold: number;
      color: string;
    };

export interface WindowProfileChartProps {
  /** The peptide to plot */
  peptide: Peptide;
  /** Declarative channel list */
  channels: WindowChannel[];
  /** Sliding window size (odd) */
  windowSize?: number;
  /** Chart height in pixels */
  height?: number;
  /** Reference lines: array of {yAxis, value, label, color, dash?} */
  referenceLines?: {
    yAxis: "left" | "right";
    value: number;
    label: string;
    color: string;
    dash?: string;
  }[];
}

// ── Default PVL channel config ─────────────────────────────────────────────

export const DEFAULT_PVL_CHANNELS: WindowChannel[] = [
  {
    type: "line",
    id: "hydrophobicity",
    label: "Hydrophobicity (FP)",
    metric: "hydrophobicity",
    color: "hsl(var(--helix, 262 83% 58%))",
    yAxis: "left",
    strokeWidth: 2,
  },
  {
    type: "line",
    id: "muH",
    label: "μH",
    metric: "muH",
    color: "hsl(var(--ff-helix, 142 71% 45%))",
    yAxis: "left",
    strokeWidth: 2,
  },
  {
    type: "line",
    id: "tango",
    label: "TANGO Agg %",
    metric: "tango",
    color: "hsl(var(--ff-ssw, 0 84% 60%))",
    yAxis: "right",
    strokeDash: "6 3",
    strokeWidth: 1.5,
  },
  {
    type: "segment-band",
    id: "s4predHelix",
    label: "S4PRED helix",
    source: "s4predHelix",
    color: "hsl(var(--helix, 262 83% 58%))",
    opacity: 0.15,
  },
  {
    type: "segment-band",
    id: "ffHelix",
    label: "FF-Helix candidate",
    source: "ffHelix",
    color: "hsl(var(--ff-helix, 142 71% 45%))",
    opacity: 0.2,
  },
  {
    type: "point-markers",
    id: "aggPeaks",
    label: "Agg peaks (>5%)",
    metric: "aggregationPeaks",
    threshold: 5,
    color: "hsl(var(--ff-ssw, 0 84% 60%))",
  },
];

export const DEFAULT_REFERENCE_LINES = [
  { yAxis: "left" as const, value: 0, label: "Neutral", color: "hsl(var(--muted-foreground))", dash: "4 2" },
  { yAxis: "right" as const, value: 5, label: "Agg prone", color: "hsl(var(--ff-ssw, 0 84% 60%))", dash: "4 2" },
];

// ── Component ──────────────────────────────────────────────────────────────

export function WindowProfileChart({
  peptide,
  channels,
  windowSize = 11,
  height = 320,
  referenceLines = DEFAULT_REFERENCE_LINES,
}: WindowProfileChartProps) {
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());

  // Live aggregation threshold from the threshold store. Drives both the
  // reference line position and the agg-peak scatter cutoff so the chart
  // stays in sync with whatever preset / custom value the user picks.
  const tangoAggregationThreshold = useThresholdStore(
    (s) => s.active.tangoAggregationThreshold,
  );

  // Discrete zoom: domain on the residue axis. Default = full sequence.
  // (B.1: drag-to-zoom was removed per Said's request — discrete in/out/reset
  // buttons replace it. The "Drag to zoom a region" copy and ReferenceArea
  // selection rectangle no longer exist.)
  const seqMin = 1;
  const seqMax = Math.max(peptide.length, 1);
  const [xDomain, setXDomain] = useState<[number, number]>(() => [seqMin, seqMax]);

  // Reset zoom whenever the peptide changes (sequence length differs).
  useEffect(() => {
    setXDomain([seqMin, seqMax]);
  }, [seqMin, seqMax]);

  // Build profile data
  const profilePoints = useMemo(
    () => buildProfilePoints(peptide.sequence, windowSize),
    [peptide.sequence, windowSize],
  );

  // Enrich with TANGO agg per-residue
  const tangoAgg = peptide.tango?.agg;
  const enrichedData = useMemo(() => {
    if (!tangoAgg || tangoAgg.length === 0) return profilePoints;
    const half = Math.floor(windowSize / 2);
    return profilePoints.map((pt) => {
      const residueIdx = pt.x - 1 + half;
      const aggVal = residueIdx < tangoAgg.length ? tangoAgg[residueIdx] : undefined;
      return {
        ...pt,
        agg: aggVal,
        aggPeak:
          aggVal !== undefined && aggVal > tangoAggregationThreshold ? aggVal : undefined,
      };
    });
  }, [profilePoints, tangoAgg, windowSize, tangoAggregationThreshold]);

  // Segment bands
  const segmentBands = useMemo(() => {
    const bands: Record<string, Array<{ x1: number; x2: number }>> = {};
    for (const ch of channels) {
      if (ch.type !== "segment-band" || hiddenChannels.has(ch.id)) continue;
      if (ch.source === "s4predHelix") {
        bands[ch.id] = helixRanges(
          peptide.s4pred?.helixSegments as [number, number][] | undefined,
          windowSize,
        );
      } else if (ch.source === "ffHelix") {
        bands[ch.id] = helixRanges(
          peptide.ffHelixFragments as [number, number][] | undefined,
          windowSize,
        );
      } else if (ch.source === "sswZone") {
        bands[ch.id] = helixRanges(
          peptide.s4pred?.betaSegments as [number, number][] | undefined,
          windowSize,
        );
      }
    }
    return bands;
  }, [channels, peptide, windowSize, hiddenChannels]);

  // Check which axes are needed
  const hasRightAxis = channels.some(
    (ch) => ch.type === "line" && ch.yAxis === "right" && !hiddenChannels.has(ch.id),
  );
  const hasTangoData = tangoAgg && tangoAgg.length > 0;

  // Toggle channel visibility
  const toggleChannel = useCallback((id: string) => {
    setHiddenChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Discrete zoom: 25% step in/out around the current center, reset to full.
  // Min span is 5 residues so we never zoom past readability.
  const ZOOM_STEP = 0.25;
  const MIN_SPAN = 5;

  const zoomIn = useCallback(() => {
    setXDomain(([lo, hi]) => {
      const span = hi - lo;
      const newSpan = Math.max(MIN_SPAN, Math.round(span * (1 - ZOOM_STEP)));
      if (newSpan === span) return [lo, hi];
      const center = (lo + hi) / 2;
      const half = newSpan / 2;
      const newLo = Math.max(seqMin, Math.round(center - half));
      const newHi = Math.min(seqMax, newLo + newSpan);
      return [newLo, newHi];
    });
  }, [seqMin, seqMax]);

  const zoomOut = useCallback(() => {
    setXDomain(([lo, hi]) => {
      const span = hi - lo;
      const fullSpan = seqMax - seqMin;
      const newSpan = Math.min(fullSpan, Math.round(span * (1 + ZOOM_STEP)));
      if (newSpan === span) return [lo, hi];
      const center = (lo + hi) / 2;
      const half = newSpan / 2;
      let newLo = Math.round(center - half);
      let newHi = newLo + newSpan;
      if (newLo < seqMin) {
        newLo = seqMin;
        newHi = newLo + newSpan;
      }
      if (newHi > seqMax) {
        newHi = seqMax;
        newLo = Math.max(seqMin, newHi - newSpan);
      }
      return [newLo, newHi];
    });
  }, [seqMin, seqMax]);

  const resetZoom = useCallback(() => {
    setXDomain([seqMin, seqMax]);
  }, [seqMin, seqMax]);

  const isZoomed = xDomain[0] !== seqMin || xDomain[1] !== seqMax;
  const canZoomIn = xDomain[1] - xDomain[0] > MIN_SPAN;
  const canZoomOut = isZoomed;

  // Map metric → dataKey
  const metricToDataKey = (metric: string) => {
    switch (metric) {
      case "hydrophobicity": return "H";
      case "muH": return "muH";
      case "tango": return "agg";
      default: return metric;
    }
  };

  return (
    <div className="space-y-3" data-testid="window-profile-chart">
      {/* Legend with toggles */}
      <div
        className="flex flex-wrap gap-2"
        data-testid="channel-legend"
      >
        {channels.map((ch) => {
          const isHidden = hiddenChannels.has(ch.id);
          // Skip TANGO-dependent channels when no data
          if (
            (ch.type === "line" && ch.metric === "tango" && !hasTangoData) ||
            (ch.type === "point-markers" && !hasTangoData)
          ) {
            return null;
          }
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => toggleChannel(ch.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] transition-all border ${
                isHidden
                  ? "bg-transparent text-muted-foreground/50 border-transparent"
                  : "bg-muted/60 text-foreground border-[hsl(var(--border))]"
              }`}
              aria-label={`Toggle ${ch.label}`}
            >
              {ch.type === "line" && (
                <span
                  className="inline-block w-4 h-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: ch.color,
                    opacity: isHidden ? 0.3 : 1,
                    ...(ch.strokeDash ? { borderTop: `2px dashed ${ch.color}`, height: 0, backgroundColor: "transparent" } : {}),
                  }}
                />
              )}
              {ch.type === "segment-band" && (
                <span
                  className="inline-block w-3 h-2.5 rounded-sm shrink-0"
                  style={{
                    backgroundColor: ch.color,
                    opacity: isHidden ? 0.15 : ch.opacity,
                  }}
                />
              )}
              {ch.type === "point-markers" && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: ch.color,
                    opacity: isHidden ? 0.3 : 1,
                  }}
                />
              )}
              <span className={isHidden ? "line-through" : ""}>{ch.label}</span>
            </button>
          );
        })}

        {/* Zoom controls — three icon-only buttons (B.1: drag-to-zoom removed) */}
        <div className="ml-auto flex items-center gap-1" data-testid="zoom-controls">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={zoomOut}
            disabled={!canZoomOut}
            aria-label="Zoom out"
            data-testid="zoom-out"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={zoomIn}
            disabled={!canZoomIn}
            aria-label="Zoom in"
            data-testid="zoom-in"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={resetZoom}
            disabled={!isZoomed}
            aria-label="Reset zoom"
            data-testid="reset-zoom"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }} data-testid="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={enrichedData}
            margin={{ top: 5, right: hasRightAxis ? 50 : 15, bottom: 5, left: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />

            <XAxis
              dataKey="x"
              type="number"
              domain={xDomain}
              allowDataOverflow
              tickCount={10}
              tick={{ fontSize: 10 }}
              label={{
                value: "Residue position",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
              }}
            />

            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10 }}
              label={{
                value: "H / μH",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
              }}
            />

            {hasRightAxis && hasTangoData && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                label={{
                  value: "TANGO %",
                  angle: 90,
                  position: "insideRight",
                  style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                }}
              />
            )}

            <RechartsTooltip
              contentStyle={{
                fontSize: 11,
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
              }}
              formatter={(v: number, name: string) => [v.toFixed(3), name]}
              labelFormatter={(label: number) => `Position ${label}`}
            />

            {/* Segment bands — B.2: skip empty/zero-width ranges so we never
                render an invisible band that confuses the legend toggle. */}
            {channels.map((ch) => {
              if (ch.type !== "segment-band" || hiddenChannels.has(ch.id)) return null;
              const ranges = segmentBands[ch.id] ?? [];
              return ranges
                .filter((r) => Number.isFinite(r.x1) && Number.isFinite(r.x2) && r.x2 > r.x1)
                .map((r, i) => (
                  <ReferenceArea
                    key={`${ch.id}-${i}`}
                    x1={r.x1}
                    x2={r.x2}
                    fill={ch.color}
                    fillOpacity={ch.opacity}
                    yAxisId="left"
                    ifOverflow="extendDomain"
                  />
                ));
            })}

            {/* Reference lines — B.2: bumped strokeWidth + opacity so the
                TANGO threshold line is actually readable; the threshold value
                comes live from the threshold store (so it follows preset). */}
            {referenceLines.map((rl, i) => {
              if (rl.yAxis === "right" && (!hasRightAxis || !hasTangoData)) return null;
              const isAggLine = rl.yAxis === "right";
              const value = isAggLine ? tangoAggregationThreshold : rl.value;
              return (
                <ReferenceLine
                  key={i}
                  y={value}
                  yAxisId={rl.yAxis}
                  stroke={rl.color}
                  strokeDasharray={rl.dash ?? "4 2"}
                  strokeWidth={isAggLine ? 2 : 1}
                  strokeOpacity={isAggLine ? 0.6 : 0.5}
                  label={{
                    value: isAggLine ? `${value}%` : rl.label,
                    position: "right",
                    style: { fontSize: 10, fill: rl.color, opacity: 0.85, fontWeight: 500 },
                  }}
                />
              );
            })}

            {/* Line channels */}
            {channels.map((ch) => {
              if (ch.type !== "line" || hiddenChannels.has(ch.id)) return null;
              if (ch.metric === "tango" && !hasTangoData) return null;
              return (
                <Line
                  key={ch.id}
                  type="monotone"
                  dataKey={metricToDataKey(ch.metric)}
                  name={ch.label}
                  stroke={ch.color}
                  strokeWidth={ch.strokeWidth ?? 2}
                  strokeDasharray={ch.strokeDash}
                  dot={false}
                  yAxisId={ch.yAxis}
                  connectNulls
                />
              );
            })}

            {/* Point markers (scatter) */}
            {channels.map((ch) => {
              if (ch.type !== "point-markers" || hiddenChannels.has(ch.id)) return null;
              if (!hasTangoData) return null;
              return (
                <Scatter
                  key={ch.id}
                  dataKey="aggPeak"
                  name={ch.label}
                  fill={ch.color}
                  yAxisId="right"
                  shape="circle"
                />
              );
            })}

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
