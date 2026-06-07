/**
 * ResultsKpis — Premium KPI cards for the Results dashboard.
 *
 * Design decisions (V2-2, Bloomberg/Stripe/Linear quality):
 * - Each card has a distinct visual personality via left accent borders and animated icons
 * - Mini sparkline (5-bin histogram) below each number adds data density
 * - Icons animate subtly (pulse for fibril cards, sway for SSW) — respects prefers-reduced-motion
 * - Click behavior preserved: each card filters the data table via chartSelectionStore
 * - Total Peptides card uses a density bar instead of accent border
 *
 * @see docs/active/PELEG_REVIEW_TASKS.md — KPI card redesign
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { DatasetStats, DatasetMetadata, Peptide } from "@/types/peptide";
import { MetricId } from "@/types/metrics";
import { Abbr } from "@/components/Abbr";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { smoothEase } from "@/lib/animations";
import {
  HelixIcon,
  HelixToFibrilIcon,
  StructuralSwitchIcon,
  SwitchToFibrilIcon,
} from "@/components/icons/PeptideIcons";

// ── Mini Sparkline ──────────────────────────────────────────────────────────

function MiniSparkline({
  values,
  color,
  width = 60,
  height = 16,
  bins = 5,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  bins?: number;
}) {
  const barData = useMemo(() => {
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const buckets = new Array(bins).fill(0);
    for (const v of values) {
      const idx = Math.min(Math.floor(((v - min) / range) * bins), bins - 1);
      buckets[idx]++;
    }
    const maxCount = Math.max(...buckets, 1);
    return buckets.map((count) => count / maxCount);
  }, [values, bins]);

  if (!barData.length) return null;

  const gap = 2;
  const barWidth = (width - gap * (bins - 1)) / bins;

  return (
    <svg width={width} height={height} className="mt-1.5 block">
      {barData.map((ratio, i) => {
        const barHeight = Math.max(ratio * height, 1.5);
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1}
            fill={color}
            opacity={0.4}
          />
        );
      })}
    </svg>
  );
}

// ── Animated Icon Wrappers ──────────────────────────────────────────────────

function PulseIcon({
  icon: Icon,
  className,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  className: string;
  disabled?: boolean;
}) {
  if (disabled) return <Icon className={className} size={20} />;
  return (
    <motion.div
      animate={{ scale: [1, 1.03, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <Icon className={className} size={20} />
    </motion.div>
  );
}

function SwayIcon({
  icon: Icon,
  className,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  className: string;
  disabled?: boolean;
}) {
  if (disabled) return <Icon className={className} size={20} />;
  return (
    <motion.div
      animate={{ x: [-2, 2, -2] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <Icon className={className} size={20} />
    </motion.div>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────

interface ResultsKpisProps {
  stats: DatasetStats | null;
  meta?: DatasetMetadata | null;
  allPeptides?: Peptide[];
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ResultsKpis({ stats, meta, allPeptides }: ResultsKpisProps) {
  const { setTableFilter, setActiveTab } = useChartSelection();
  const shouldReduceMotion = useReducedMotion();

  // Pre-compute sparkline distributions
  const distributions = useMemo(() => {
    if (!allPeptides?.length) return { lengths: [], muH: [], s4predHelix: [], hydro: [] };
    return {
      lengths: allPeptides.map((p) => p.length ?? 0).filter((v) => v > 0),
      muH: allPeptides.map((p) => p.muH ?? 0).filter((v) => v !== 0),
      s4predHelix: allPeptides.map((p) => p.s4predHelixPercent ?? 0).filter((v) => v !== 0),
      hydro: allPeptides.map((p) => p.hydrophobicity ?? 0).filter((v) => v !== 0),
    };
  }, [allPeptides]);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="rounded-xl border-[hsl(var(--border))]">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-3 bg-muted rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const tangoStatus = meta?.provider_status?.tango?.status;
  const tangoAvailable = tangoStatus === "AVAILABLE" || tangoStatus === "PARTIAL";

  const formatPercent = (value: number | null | undefined, decimals: number = 1): string => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "N/A";
    }
    return `${value.toFixed(decimals)}%`;
  };

  // Peleg 2026-06-07 — symmetry of treatment: every place SSW appears, Helix
  // appears too. Order: % Helix → % FF-Helix → % SSW → % FF-SSW.
  // Total Peptides is lifted out of the card row into a sub-header line below.
  const kpis = [
    {
      titleKey: "helix",
      title: <>% Helix</>,
      value: formatPercent(stats.helixPositivePercent),
      icon: HelixIcon,
      color: "text-[hsl(var(--helix))]",
      bgColor: "bg-[hsl(var(--helix))]/10",
      accentColor: "hsl(var(--helix))",
      sparklineValues: distributions.s4predHelix,
      sparklineColor: "hsl(var(--helix))",
      animationType: "pulse" as const,
      metricId: null as MetricId | null,
      onClick: () => {
        setTableFilter({ label: "Helix Positive", field: "s4predHelixPrediction", value: 1 });
        setActiveTab("data");
      },
      clickable: true,
      subtitle: "Peptides predicted as α-helical",
      tooltip: "Percentage of peptides predicted helix by S4PRED",
    },
    {
      titleKey: "ff-helix",
      title: (
        <>
          % <Abbr title="Fibril-Forming Helix">FF-Helix</Abbr>
        </>
      ),
      value: formatPercent(stats.ffHelixCandidatePercent),
      icon: HelixToFibrilIcon,
      color: "text-[hsl(var(--ff-helix))]",
      bgColor: "bg-[hsl(var(--ff-helix))]/10",
      accentColor: "hsl(var(--ff-helix))",
      sparklineValues: distributions.muH,
      sparklineColor: "hsl(var(--ff-helix))",
      animationType: "pulse" as const,
      metricId: null as MetricId | null,
      onClick: () => {
        setTableFilter({ label: "FF-Helix Candidates", field: "ffHelixFlag", value: 1 });
        setActiveTab("data");
      },
      clickable: true,
      subtitle: "Helix + μH above threshold",
      tooltip: "Percentage of peptides predicted as fibril-forming α-helical",
    },
    {
      titleKey: "ssw",
      title: (
        <>
          % <Abbr title="Secondary Structure Switch">SSW</Abbr>
        </>
      ),
      value: tangoAvailable ? formatPercent(stats.sswPositivePercent) : "N/A",
      icon: StructuralSwitchIcon,
      color: "text-[hsl(var(--ssw))]",
      bgColor: "bg-[hsl(var(--ssw))]/10",
      accentColor: "hsl(var(--ssw))",
      sparklineValues: distributions.s4predHelix,
      sparklineColor: "hsl(var(--ssw))",
      animationType: "sway" as const,
      metricId: "ssw-positive" as MetricId,
      onClick: () => {
        setTableFilter({ label: "SSW Positive", field: "sswPrediction", value: 1 });
        setActiveTab("data");
      },
      clickable: true,
      subtitle: "Helix ↔ β scores within gap threshold",
      tooltip: !tangoAvailable
        ? "TANGO did not run or is unavailable"
        : "Percentage of peptides with secondary structure switch prediction (helix-beta score difference below threshold)",
    },
    {
      titleKey: "ff-ssw",
      title: (
        <>
          % <Abbr title="Fibril-Forming Secondary Structure Switch">FF-SSW</Abbr>
        </>
      ),
      value: tangoAvailable ? formatPercent(stats.ffSswCandidatePercent) : "N/A",
      icon: SwitchToFibrilIcon,
      color: "text-[hsl(var(--ff-ssw))]",
      bgColor: "bg-[hsl(var(--ff-ssw))]/10",
      accentColor: "hsl(var(--ff-ssw))",
      sparklineValues: distributions.hydro,
      sparklineColor: "hsl(var(--ff-ssw))",
      animationType: "pulse" as const,
      metricId: null as MetricId | null,
      onClick: () => {
        setTableFilter({ label: "FF-SSW Candidates", field: "ffSswFlag", value: 1 });
        setActiveTab("data");
      },
      clickable: true,
      subtitle: "SSW + hydrophobicity above threshold",
      tooltip: !tangoAvailable
        ? "TANGO did not run or is unavailable"
        : "Percentage of peptides predicted as fibril-forming SSW (SSW + hydrophobicity above database threshold)",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Total Peptides — sub-header, NOT a card (Peleg 2026-06-07: KPI row is
          for class-positive percentages; total count is context, not a metric). */}
      <p className="text-xs text-muted-foreground" data-testid="kpi-total-subheader">
        {stats.totalPeptides.toLocaleString()} peptide
        {stats.totalPeptides === 1 ? "" : "s"} analysed
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const hasAccent = !!kpi.accentColor;

          // Determine animated icon wrapper
          const renderIcon = () => {
            const iconClass = `${kpi.color}`;
            if (kpi.animationType === "pulse") {
              return (
                <PulseIcon icon={Icon} className={iconClass} disabled={!!shouldReduceMotion} />
              );
            }
            if (kpi.animationType === "sway") {
              return <SwayIcon icon={Icon} className={iconClass} disabled={!!shouldReduceMotion} />;
            }
            return <Icon className={iconClass} size={20} />;
          };

          return (
            <motion.div
              key={kpi.titleKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.5, ease: smoothEase }}
            >
              <Card
                className="rounded-xl border-[hsl(var(--border))] shadow-soft cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-[hsl(var(--border-hover))] active:scale-[0.98] group overflow-hidden"
                onClick={kpi.onClick}
              >
                <CardContent className="p-0">
                  <div
                    className="flex h-full"
                    style={hasAccent ? { borderLeft: `3px solid ${kpi.accentColor}` } : undefined}
                  >
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between">
                        {/* Left: metric content */}
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium text-foreground">{kpi.title}</p>
                          <motion.p
                            className="text-3xl font-bold tracking-tight text-foreground"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              delay: index * 0.08 + 0.2,
                              type: "spring",
                              stiffness: 200,
                            }}
                          >
                            {kpi.value}
                          </motion.p>

                          {/* Mini sparkline */}
                          {kpi.sparklineValues.length > 0 && (
                            <MiniSparkline
                              values={kpi.sparklineValues}
                              color={kpi.sparklineColor}
                            />
                          )}

                          {kpi.subtitle && (
                            <p className="text-xs text-muted-foreground mt-1.5">{kpi.subtitle}</p>
                          )}
                        </div>

                        {/* Right: icon container */}
                        <div
                          className={`w-11 h-11 rounded-xl ${kpi.bgColor} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ml-3`}
                        >
                          {renderIcon()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
