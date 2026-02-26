import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Info, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend as RechartsLegend,
  ReferenceLine, ReferenceArea, LabelList,
} from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { ExpandableChart } from '@/components/ExpandableChart';
import { Button } from '@/components/ui/button';
import { useChartZoom, zoomDomain } from '@/components/ZoomableChart';
import { Peptide } from '@/types/peptide';
import type { ResolvedThresholds } from '@/lib/thresholds';
import { CHART_COLORS, TIER_POINT_COLORS } from '@/lib/chartConfig';
import { useChartSelection } from '@/stores/chartSelectionStore';
import { getConsensusSS } from '@/lib/consensus';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ResultsChartsProps {
  peptides: Peptide[];
  providerStatus?: {
    tango?: { status: string; reason?: string | null; stats?: { requested: number; parsed_ok: number; parsed_bad: number } };
    s4pred?: { status: string; reason?: string | null; stats?: { requested: number; parsed_ok: number; parsed_bad: number } };
  };
  thresholds?: ResolvedThresholds;
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-center text-sm text-muted-foreground">
      <div>
        <div className="font-medium">{title}</div>
        {subtitle && <div className="mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}

export function ResultsCharts({ peptides, providerStatus, thresholds }: ResultsChartsProps) {
  // Scatter data: require μH — colored by consensus tier
  const scatterData = peptides
    .filter(p => typeof p.muH === 'number' && Number.isFinite(p.muH))
    .map(p => {
      const c = getConsensusSS(p);
      return {
        hydrophobicity: p.hydrophobicity,
        muH: p.muH as number,
        ssw: p.sswPrediction,
        id: p.id,
        tier: c.tier,
        tierLabel: c.label,
      };
    });

  // Charge vs Length scatter data — colored by consensus tier
  const chargeLengthData = peptides
    .filter(p => typeof p.charge === 'number' && typeof p.length === 'number')
    .map(p => {
      const c = getConsensusSS(p);
      return {
        charge: p.charge as number,
        length: p.length as number,
        ssw: p.sswPrediction,
        id: p.id,
        tier: c.tier,
        tierLabel: c.label,
      };
    });

  // Hydrophobicity distribution (safe when all equal)
  const H = peptides.map(p => p.hydrophobicity).filter(v => Number.isFinite(v));
  const minH = H.length ? Math.min(...H) : 0;
  const maxH = H.length ? Math.max(...H) : 0;
  const span = Math.max(1e-6, maxH - minH);
  const binSize = span / 10;
  const hydrophobicityBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minH + i * binSize;
    const binEnd = binStart + binSize;
    const matching = peptides.filter(p => {
      const v = p.hydrophobicity;
      return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
    });
    return {
      range: `${binStart.toFixed(2)}–${binEnd.toFixed(2)}`,
      count: matching.length,
      ids: matching.map(p => p.id),
      binStart,
    };
  }).sort((a, b) => a.binStart - b.binStart);

  // μH distribution histogram (same pattern as hydrophobicity)
  const muHValues = peptides.map(p => p.muH).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const minMuH = muHValues.length ? Math.min(...muHValues) : 0;
  const maxMuH = muHValues.length ? Math.max(...muHValues) : 1;
  const muHSpan = Math.max(1e-6, maxMuH - minMuH);
  const muHBinSize = muHSpan / 10;
  const muHBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minMuH + i * muHBinSize;
    const binEnd = binStart + muHBinSize;
    const matching = peptides.filter(p => {
      const v = p.muH;
      if (typeof v !== 'number' || !Number.isFinite(v)) return false;
      return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
    });
    return { range: `${binStart.toFixed(2)}–${binEnd.toFixed(2)}`, count: matching.length, ids: matching.map(p => p.id), binStart };
  }).sort((a, b) => a.binStart - b.binStart);

  // SSW distribution (null rows excluded — they have no prediction)
  const pos = peptides.filter(p => p.sswPrediction === 1).length;
  const neg = peptides.filter(p => p.sswPrediction === -1).length;
  const unc = peptides.filter(p => p.sswPrediction === 0).length;
  const sswDistribution = [
    { name: 'SSW Positive', value: pos, color: CHART_COLORS.sswPositive },
    { name: 'SSW Negative', value: neg, color: CHART_COLORS.sswNegative },
    { name: 'Uncertain', value: unc, color: CHART_COLORS.sswUncertain },
  ].filter(d => d.value > 0);

  // SSW predictor agreement stats (TANGO vs S4PRED)
  const bothSSW = peptides.filter(p =>
    p.sswPrediction != null && p.sswPrediction !== 0 &&
    p.s4predSswPrediction != null && p.s4predSswPrediction !== 0
  );
  const sswAgree = bothSSW.filter(p => p.sswPrediction === p.s4predSswPrediction).length;
  const sswDisagree = bothSSW.length - sswAgree;
  const sswAgreePct = bothSSW.length > 0 ? ((sswAgree / bothSSW.length) * 100).toFixed(0) : null;
  // Breakdown of excluded peptides
  const noTangoSSW = peptides.filter(p => p.sswPrediction == null || p.sswPrediction === 0).length;
  const noS4predSSW = peptides.filter(p =>
    p.sswPrediction != null && p.sswPrediction !== 0 &&
    (p.s4predSswPrediction == null || p.s4predSswPrediction === 0)
  ).length;
  const sswExcluded = peptides.length - bothSSW.length;

  // SSW+ vs SSW- group comparison (grouped bar chart — % diff from overall mean)
  const positiveGroup = peptides.filter(p => p.sswPrediction === 1);
  const negativeGroup = peptides.filter(p => p.sswPrediction === -1);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const groupedBarMetrics = (() => {
    if (positiveGroup.length === 0 && negativeGroup.length === 0) return [];
    type G = typeof peptides;
    const raw = [
      { metric: 'Hydrophobicity', pos: mean(positiveGroup.map(p => p.hydrophobicity)), neg: mean(negativeGroup.map(p => p.hydrophobicity)), all: mean(peptides.map(p => p.hydrophobicity)) },
      { metric: '|Charge|', pos: mean(positiveGroup.map(p => Math.abs(p.charge ?? 0))), neg: mean(negativeGroup.map(p => Math.abs(p.charge ?? 0))), all: mean(peptides.map(p => Math.abs(p.charge ?? 0))) },
      { metric: 'Length', pos: mean((positiveGroup as G).map(p => p.length).filter((v): v is number => typeof v === 'number')), neg: mean((negativeGroup as G).map(p => p.length).filter((v): v is number => typeof v === 'number')), all: mean((peptides as G).map(p => p.length).filter((v): v is number => typeof v === 'number')) },
      { metric: 'μH', pos: mean(positiveGroup.map(p => typeof p.muH === 'number' ? p.muH : 0)), neg: mean(negativeGroup.map(p => typeof p.muH === 'number' ? p.muH : 0)), all: mean(peptides.map(p => typeof p.muH === 'number' ? p.muH : 0)) },
      { metric: 'FF-Helix %', pos: mean(positiveGroup.map(p => typeof p.ffHelixPercent === 'number' ? p.ffHelixPercent : 0)), neg: mean(negativeGroup.map(p => typeof p.ffHelixPercent === 'number' ? p.ffHelixPercent : 0)), all: mean(peptides.map(p => typeof p.ffHelixPercent === 'number' ? p.ffHelixPercent : 0)) },
    ];
    return raw.map(r => {
      const denom = Math.abs(r.all) || 1;
      return {
        metric: r.metric,
        posPctDiff: ((r.pos - r.all) / denom) * 100,
        negPctDiff: ((r.neg - r.all) / denom) * 100,
        posRaw: r.pos,
        negRaw: r.neg,
        allRaw: r.all,
      };
    });
  })();

  // FF-Helix % vs TANGO Aggregation Max scatter data — colored by consensus tier
  const helixAggData = peptides
    .filter(p => typeof p.ffHelixPercent === 'number' && typeof p.tangoAggMax === 'number')
    .map(p => {
      const c = getConsensusSS(p);
      return {
        ffHelix: p.ffHelixPercent as number,
        aggMax: p.tangoAggMax as number,
        ssw: p.sswPrediction,
        id: p.id,
        tier: c.tier,
        tierLabel: c.label,
      };
    });

  // (Aggregation risk data is now computed in the hooks section above the return)

  // Amino acid composition — HeliQuest-standard categories
  // (colors match HelicalWheel.tsx HeliQuest scheme)
  const AA_CATEGORIES: Record<string, { category: string; color: string }> = {
    I: { category: 'Hydrophobic', color: '#F4C430' },
    V: { category: 'Hydrophobic', color: '#F4C430' },
    L: { category: 'Hydrophobic', color: '#F4C430' },
    M: { category: 'Hydrophobic', color: '#F4C430' },
    C: { category: 'Hydrophobic', color: '#F4C430' },
    F: { category: 'Aromatic', color: '#F79318' },
    W: { category: 'Aromatic', color: '#F79318' },
    Y: { category: 'Aromatic', color: '#F79318' },
    K: { category: 'Basic (+)', color: '#4169E1' },
    R: { category: 'Basic (+)', color: '#4169E1' },
    H: { category: 'Basic (+)', color: '#4169E1' },
    D: { category: 'Acidic (−)', color: '#DC143C' },
    E: { category: 'Acidic (−)', color: '#DC143C' },
    N: { category: 'Polar', color: '#9370DB' },
    Q: { category: 'Polar', color: '#9370DB' },
    S: { category: 'Polar', color: '#9370DB' },
    T: { category: 'Polar', color: '#9370DB' },
    A: { category: 'Small', color: '#C8C8C8' },
    G: { category: 'Small', color: '#C8C8C8' },
    P: { category: 'Helix breaker', color: '#32CD32' },
  };
  const aaCompositionData = (() => {
    const allResidues = peptides.map(p => p.sequence).join('').toUpperCase();
    if (allResidues.length === 0) return [];
    const counts: Record<string, { count: number; color: string }> = {};
    for (const ch of allResidues) {
      const cat = AA_CATEGORIES[ch];
      if (!cat) continue;
      if (!counts[cat.category]) counts[cat.category] = { count: 0, color: cat.color };
      counts[cat.category].count++;
    }
    const total = allResidues.length;
    return Object.entries(counts)
      .map(([category, { count, color }]) => ({ category, count, pct: (count / total) * 100, color }))
      .sort((a, b) => b.count - a.count);
  })();

  // Sequence Length Distribution (histogram)
  const lengths = peptides.map(p => p.length).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const minLen = lengths.length ? Math.min(...lengths) : 0;
  const maxLen = lengths.length ? Math.max(...lengths) : 100;
  const lenSpan = Math.max(1, maxLen - minLen);
  const lenBinSize = Math.max(1, Math.ceil(lenSpan / 10));
  const lengthBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minLen + i * lenBinSize;
    const binEnd = binStart + lenBinSize;
    const matching = peptides.filter(p => {
      const v = p.length;
      if (typeof v !== 'number') return false;
      return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
    });
    return {
      range: `${binStart}–${binEnd}`,
      count: matching.length,
      ids: matching.map(p => p.id),
      binStart,
    };
  }).filter(bin => bin.count > 0 || bin.binStart <= maxLen);

  // Provider status summary for dashboard
  const providers = [
    {
      name: 'TANGO',
      status: providerStatus?.tango?.status || 'OFF',
      reason: providerStatus?.tango?.reason,
      stats: providerStatus?.tango?.stats,
    },
    {
      name: 'S4PRED',
      status: providerStatus?.s4pred?.status || 'OFF',
      reason: providerStatus?.s4pred?.reason,
      stats: providerStatus?.s4pred?.stats,
    },
  ];

  const chartConfig = {
    hydrophobicity: { label: 'Hydrophobicity', color: CHART_COLORS.scatterPrimary },
  };

  // Compute data ranges for scroll-zoom from initial state
  const hMuHRange = useMemo(() => {
    if (scatterData.length === 0) return { x: undefined as [number, number] | undefined, y: undefined as [number, number] | undefined };
    const xs = scatterData.map(d => d.hydrophobicity);
    const ys = scatterData.map(d => d.muH);
    const pad = 0.1;
    return {
      x: [Math.min(...xs) - pad, Math.max(...xs) + pad] as [number, number],
      y: [Math.min(...ys) - pad, Math.max(...ys) + pad] as [number, number],
    };
  }, [scatterData]);

  const chargeLenRange = useMemo(() => {
    if (chargeLengthData.length === 0) return { x: undefined as [number, number] | undefined, y: undefined as [number, number] | undefined };
    const xs = chargeLengthData.map(d => d.length);
    const ys = chargeLengthData.map(d => d.charge);
    return {
      x: [Math.min(...xs) - 1, Math.max(...xs) + 1] as [number, number],
      y: [Math.min(...ys) - 1, Math.max(...ys) + 1] as [number, number],
    };
  }, [chargeLengthData]);

  const helixAggRange = useMemo(() => {
    if (helixAggData.length === 0) return { x: undefined as [number, number] | undefined, y: undefined as [number, number] | undefined };
    const ys = helixAggData.map(d => d.aggMax);
    return {
      x: [0, 100] as [number, number],
      y: [Math.min(0, Math.min(...ys) - 1), Math.max(...ys) + 1] as [number, number],
    };
  }, [helixAggData]);

  // Zoom hooks for scatter charts (with data ranges for scroll-zoom from initial state)
  const hMuHZoom = useChartZoom({ minSpanX: 0.05, minSpanY: 0.05, dataRangeX: hMuHRange.x, dataRangeY: hMuHRange.y });
  const chargeLenZoom = useChartZoom({ minSpanX: 1, minSpanY: 0.5, dataRangeX: chargeLenRange.x, dataRangeY: chargeLenRange.y });
  const helixAggZoom = useChartZoom({ minSpanX: 1, minSpanY: 0.5, dataRangeX: helixAggRange.x, dataRangeY: helixAggRange.y });

  // Chart selection (linked views)
  const { select, selectBin } = useChartSelection();

  // Zoomed peptide IDs for ExpandableChart detail tables
  const hMuHZoomedIds = useMemo(() => {
    const z = hMuHZoom.zoom;
    if (!z.x && !z.y) return undefined;
    const ids = new Set<string>();
    for (const d of scatterData) {
      const inX = !z.x || (d.hydrophobicity >= z.x[0] && d.hydrophobicity <= z.x[1]);
      const inY = !z.y || (d.muH >= z.y[0] && d.muH <= z.y[1]);
      if (inX && inY) ids.add(d.id);
    }
    return ids.size > 0 ? ids : undefined;
  }, [scatterData, hMuHZoom.zoom]);

  const chargeLenZoomedIds = useMemo(() => {
    const z = chargeLenZoom.zoom;
    if (!z.x && !z.y) return undefined;
    const ids = new Set<string>();
    for (const d of chargeLengthData) {
      const inX = !z.x || (d.length >= z.x[0] && d.length <= z.x[1]);
      const inY = !z.y || (d.charge >= z.y[0] && d.charge <= z.y[1]);
      if (inX && inY) ids.add(d.id);
    }
    return ids.size > 0 ? ids : undefined;
  }, [chargeLengthData, chargeLenZoom.zoom]);

  const helixAggZoomedIds = useMemo(() => {
    const z = helixAggZoom.zoom;
    if (!z.x && !z.y) return undefined;
    const ids = new Set<string>();
    for (const d of helixAggData) {
      const inX = !z.x || (d.ffHelix >= z.x[0] && d.ffHelix <= z.x[1]);
      const inY = !z.y || (d.aggMax >= z.y[0] && d.aggMax <= z.y[1]);
      if (inX && inY) ids.add(d.id);
    }
    return ids.size > 0 ? ids : undefined;
  }, [helixAggData, helixAggZoom.zoom]);

  // Tier legend shared by all scatter charts
  const tierLegend = (
    <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-muted-foreground">
      {[1, 2, 3, 4, 5].map(t => (
        <span key={t} className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_POINT_COLORS[t] }} />
          T{t}
        </span>
      ))}
    </div>
  );

  // Aggregation risk: distribution histogram instead of top-N bar chart
  const AGG_BINS = 20;
  const aggHistogram = useMemo(() => {
    const withAgg = peptides.filter(p => typeof p.tangoAggMax === 'number' && Number.isFinite(p.tangoAggMax));
    if (withAgg.length === 0) return [];
    const binSize = 100 / AGG_BINS; // 5% per bin
    const bins = Array.from({ length: AGG_BINS }, (_, i) => ({
      range: `${(i * binSize).toFixed(0)}-${((i + 1) * binSize).toFixed(0)}%`,
      binStart: i * binSize,
      count: 0,
      ids: [] as string[],
    }));
    for (const p of withAgg) {
      const idx = Math.min(Math.floor((p.tangoAggMax as number) / binSize), AGG_BINS - 1);
      bins[idx].count++;
      bins[idx].ids.push(p.id);
    }
    return bins;
  }, [peptides]);

  // Aggregation risk: paginated bar chart for individual peptides
  const AGG_PAGE_SIZE = 30;
  const [aggPage, setAggPage] = useState(0);
  const [aggSortDir, setAggSortDir] = useState<'desc' | 'asc'>('desc');
  const aggAllSorted = useMemo(() => {
    return peptides
      .filter(p => typeof p.tangoAggMax === 'number' && Number.isFinite(p.tangoAggMax))
      .map(p => ({
        id: p.id.length > 20 ? p.id.slice(0, 18) + '…' : p.id,
        fullId: p.id,
        aggMax: p.tangoAggMax as number,
        fill: (p.tangoAggMax as number) > 20 ? CHART_COLORS.aggHot : (p.tangoAggMax as number) > 5 ? CHART_COLORS.aggModerate : CHART_COLORS.aggLow,
      }))
      .sort((a, b) => aggSortDir === 'desc' ? b.aggMax - a.aggMax : a.aggMax - b.aggMax);
  }, [peptides, aggSortDir]);
  const aggTotalPages = Math.ceil(aggAllSorted.length / AGG_PAGE_SIZE);
  const aggPageData = aggAllSorted.slice(aggPage * AGG_PAGE_SIZE, (aggPage + 1) * AGG_PAGE_SIZE);
  const aggPageBarHeight = Math.min(500, Math.max(300, aggPageData.length * 20 + 40));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Scatter: Hydrophobicity vs μH */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <ExpandableChart
          title="Hydrophobicity vs Hydrophobic Moment"
          description="Correlation between hydrophobicity and amphipathic character"
          peptides={peptides}
          zoomedIds={hMuHZoomedIds}
          sortKey="muH"
          footer={tierLegend}
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Each point colored by consensus tier. X: mean hydrophobicity. Y: hydrophobic moment (µH). Click a point for details.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {scatterData.length === 0 ? (
            <EmptyState title="μH not available" subtitle="Upload a dataset or enable TANGO/S4PRED so μH can be computed." />
          ) : (
            <>
              <div className="flex justify-end mb-1">{hMuHZoom.ZoomControls}</div>
              <div onWheel={hMuHZoom.handleWheel} style={{ cursor: 'crosshair' }}>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 40 }}>
                      <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                      <XAxis
                        type="number"
                        dataKey="hydrophobicity"
                        name="Hydrophobicity"
                        tickFormatter={(v) => parseFloat(v).toFixed(2)}
                        domain={zoomDomain(hMuHZoom.zoom.x) ?? ['auto', 'auto']}
                        allowDataOverflow
                      />
                      <YAxis
                        type="number"
                        dataKey="muH"
                        name="μH"
                        tickFormatter={(v) => parseFloat(v).toFixed(2)}
                        domain={zoomDomain(hMuHZoom.zoom.y) ?? ['auto', 'auto']}
                        allowDataOverflow
                      />
                      <ReferenceLine y={0.5} stroke={CHART_COLORS.amphipathic} strokeDasharray="6 3" label={{ value: 'Amphipathic', position: 'right', fontSize: 10, fill: CHART_COLORS.amphipathic }} />
                      <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="6 3" />
                      {thresholds && thresholds.hydroCutoff !== 0 && (
                        <ReferenceLine x={thresholds.hydroCutoff} stroke={CHART_COLORS.threshold} strokeDasharray="4 4" label={{ value: `H=${thresholds.hydroCutoff.toFixed(2)}`, position: 'top', fontSize: 9, fill: CHART_COLORS.threshold }} />
                      )}
                      {thresholds && thresholds.muHCutoff !== 0 && (
                        <ReferenceLine y={thresholds.muHCutoff} stroke={CHART_COLORS.threshold} strokeDasharray="4 4" label={{ value: `μH=${thresholds.muHCutoff.toFixed(2)}`, position: 'left', fontSize: 9, fill: CHART_COLORS.threshold }} />
                      )}
                      <ChartTooltip
                        content={({ payload }) => {
                          const item = payload?.[0]?.payload;
                          if (!item) return null;
                          return (
                            <div className="bg-background border border-border rounded p-2 text-xs">
                              <p className="font-medium">{item.id}</p>
                              <p>H: {parseFloat(item.hydrophobicity).toFixed(3)}</p>
                              <p>μH: {parseFloat(item.muH).toFixed(3)}</p>
                              <div className="flex items-center gap-1 mt-1 pt-1 border-t">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: TIER_POINT_COLORS[item.tier] }} />
                                <span>T{item.tier}: {item.tierLabel}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={scatterData}
                        cursor="pointer"
                        onClick={(data: any) => { if (data?.id) select(data.id, 'Hydrophobicity vs Hydrophobic Moment'); }}
                      >
                        {scatterData.map((d, i) => (
                          <Cell key={i} fill={TIER_POINT_COLORS[d.tier] ?? CHART_COLORS.tier5} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </>
          )}
        </ExpandableChart>
      </motion.div>

      {/* Hydrophobicity Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <ExpandableChart
          title="Hydrophobicity Distribution"
          description="Frequency distribution of hydrophobicity values"
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Histogram of mean hydrophobicity across all peptides. Negative values correspond to more hydrophilic peptides; positive values are more hydrophobic.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {peptides.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hydrophobicityBins} margin={{ top: 20, right: 30, bottom: 25, left: 30 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => v.split('–')[0]}
                  />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip
                    content={({ payload }) => {
                      if (payload && payload.length > 0) {
                        const { range, count } = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p>Range: {range}</p>
                            <p>Count: {count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.scatterPrimary}
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = hydrophobicityBins[idx];
                      if (bin?.ids?.length) selectBin({ ids: bin.ids, binLabel: bin.range, source: 'Hydrophobicity Distribution' });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      {/* μH Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <ExpandableChart
          title="Hydrophobic Moment (μH) Distribution"
          description="Frequency distribution of amphipathic character"
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Distribution of hydrophobic moment (μH). Values above 0.5 indicate amphipathic character — the peptide has distinct hydrophobic and hydrophilic faces.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
          footer={muHValues.length > 0 ? (
            <div className="mt-2 text-xs text-muted-foreground text-center">
              {muHValues.filter(v => v > 0.5).length} of {muHValues.length} peptides ({((muHValues.filter(v => v > 0.5).length / muHValues.length) * 100).toFixed(0)}%) above amphipathic threshold (μH &gt; 0.5)
            </div>
          ) : undefined}
        >
          {muHValues.length === 0 ? (
            <EmptyState title="No μH data" subtitle="μH requires sequence data to compute." />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={muHBins} margin={{ top: 20, right: 30, bottom: 25, left: 30 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => v.split('–')[0]}
                  />
                  <YAxis allowDecimals={false} />
                  <ReferenceLine x={muHBins.findIndex(b => b.binStart <= 0.5 && b.binStart + muHBinSize > 0.5)} stroke="#eab308" strokeDasharray="6 3" />
                  <ChartTooltip
                    content={({ payload }) => {
                      if (payload && payload.length > 0) {
                        const { range, count } = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p>μH: {range}</p>
                            <p>Count: {count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.amphipathic}
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = muHBins[idx];
                      if (bin?.ids?.length) selectBin({ ids: bin.ids, binLabel: bin.range, source: 'Hydrophobic Moment (μH) Distribution' });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      {/* SSW Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <ExpandableChart
          title="TANGO SSW Distribution"
          description="Structural switch predictions from TANGO aggregation analysis"
          footer={bothSSW.length > 0 ? (
            <div className="mt-3 p-3 rounded-md bg-muted/30 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">TANGO vs S4PRED agreement: {sswAgreePct}% ({sswAgree}/{bothSSW.length} definitive pairs)</span>
              </div>
              {sswExcluded > 0 && (
                <p className="ml-5 text-muted-foreground/70">
                  {sswExcluded} excluded: {noTangoSSW > 0 ? `${noTangoSSW} no TANGO SSW call` : ''}{noTangoSSW > 0 && noS4predSSW > 0 ? ', ' : ''}{noS4predSSW > 0 ? `${noS4predSSW} no S4PRED SSW call` : ''}
                </p>
              )}
              {sswDisagree > 0 && (
                <p className="ml-5">
                  {sswDisagree} peptide{sswDisagree > 1 ? 's' : ''} show different SSW calls.
                  TANGO SSW reflects aggregation-correlated switching (primary for fibril research);
                  S4PRED SSW reflects pure secondary structure switching.
                </p>
              )}
            </div>
          ) : undefined}
        >
          {sswDistribution.length === 0 ? (
            <EmptyState title="No SSW predictions" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sswDistribution} cx="50%" cy="50%" outerRadius={82} dataKey="value"
                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}>
                    {sswDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      {/* Cohort Comparison — SSW+ vs SSW- */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <ExpandableChart
          title="Cohort Comparison"
          description="SSW+ vs SSW− group means (% difference from overall mean)"
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Bars show % difference from overall mean for SSW+ and SSW- groups. Positive = above average. Hover for raw values.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {groupedBarMetrics.length === 0 ? (
            <EmptyState title="Not enough data to compare groups" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupedBarMetrics} margin={{ top: 20, right: 30, bottom: 30, left: 30 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <ChartTooltip
                    content={({ payload }) => {
                      const item = payload?.[0]?.payload;
                      if (!item) return null;
                      return (
                        <div className="bg-background border border-border rounded p-2 text-xs space-y-1">
                          <p className="font-medium">{item.metric}</p>
                          <p className="text-green-600">SSW +: {Number(item.posRaw).toFixed(3)} ({item.posPctDiff > 0 ? '+' : ''}{Number(item.posPctDiff).toFixed(1)}%)</p>
                          <p className="text-red-600">SSW −: {Number(item.negRaw).toFixed(3)} ({item.negPctDiff > 0 ? '+' : ''}{Number(item.negPctDiff).toFixed(1)}%)</p>
                          <p className="text-muted-foreground">Mean: {Number(item.allRaw).toFixed(3)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="posPctDiff" name="SSW +" fill={CHART_COLORS.sswPositive} />
                  <Bar dataKey="negPctDiff" name="SSW −" fill={CHART_COLORS.sswNegative} />
                  <RechartsLegend />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      {/* Charge vs Length */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <ExpandableChart
          title="Net Charge vs Sequence Length"
          description="Charge landscape of the peptide cohort"
          peptides={peptides}
          zoomedIds={chargeLenZoomedIds}
          sortKey="charge"
          footer={tierLegend}
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Net charge vs sequence length, colored by consensus tier. Click a point for details.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {chargeLengthData.length === 0 ? (
            <EmptyState title="No charge/length data" />
          ) : (
            <>
              <div className="flex justify-end mb-1">{chargeLenZoom.ZoomControls}</div>
              <div onWheel={chargeLenZoom.handleWheel} style={{ cursor: 'crosshair' }}>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 40 }}>
                      <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                      <XAxis type="number" dataKey="length" name="Length (aa)" domain={zoomDomain(chargeLenZoom.zoom.x) ?? ['auto', 'auto']} allowDataOverflow />
                      <YAxis type="number" dataKey="charge" name="Net Charge" domain={zoomDomain(chargeLenZoom.zoom.y) ?? ['auto', 'auto']} allowDataOverflow />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="6 3" label={{ value: 'Neutral', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
                      <ChartTooltip
                        content={({ payload }) => {
                          const item = payload?.[0]?.payload;
                          if (!item) return null;
                          return (
                            <div className="bg-background border border-border rounded p-2 text-xs">
                              <p className="font-medium">{item.id}</p>
                              <p>Length: {item.length} aa</p>
                              <p>Charge: {item.charge > 0 ? '+' : ''}{item.charge.toFixed(1)}</p>
                              <div className="flex items-center gap-1 mt-1 pt-1 border-t">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: TIER_POINT_COLORS[item.tier] }} />
                                <span>T{item.tier}: {item.tierLabel}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={chargeLengthData}
                        cursor="pointer"
                        onClick={(data: any) => { if (data?.id) select(data.id, 'Net Charge vs Sequence Length'); }}
                      >
                        {chargeLengthData.map((d, i) => (
                          <Cell key={i} fill={TIER_POINT_COLORS[d.tier] ?? CHART_COLORS.tier5} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </>
          )}
        </ExpandableChart>
      </motion.div>

      {/* FF-Helix % vs TANGO Aggregation Max */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <ExpandableChart
          title="FF-Helix % vs Aggregation Max"
          description="Helix propensity vs peak TANGO aggregation score"
          peptides={peptides}
          zoomedIds={helixAggZoomedIds}
          sortKey="tangoAggMax"
          footer={tierLegend}
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  X: FF-Helix propensity %. Y: Peak TANGO aggregation score. Colored by consensus tier. Click a point for details.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {helixAggData.length === 0 ? (
            <EmptyState title="Insufficient data" subtitle="Requires FF-Helix % and TANGO aggregation data." />
          ) : (
            <>
              <div className="flex justify-end mb-1">{helixAggZoom.ZoomControls}</div>
              <div onWheel={helixAggZoom.handleWheel} style={{ cursor: 'crosshair' }}>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 40 }}>
                      <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                      <XAxis type="number" dataKey="ffHelix" name="FF-Helix %" domain={zoomDomain(helixAggZoom.zoom.x) ?? [0, 100]} tickFormatter={(v) => `${v}%`} allowDataOverflow />
                      <YAxis type="number" dataKey="aggMax" name="Agg Max" domain={zoomDomain(helixAggZoom.zoom.y) ?? ['auto', 'auto']} allowDataOverflow />
                      <ReferenceLine y={thresholds?.aggThreshold ?? 5} stroke={CHART_COLORS.aggModerate} strokeDasharray="6 3" label={{ value: `Agg ${(thresholds?.aggThreshold ?? 5).toFixed(0)}%`, position: 'right', fontSize: 10, fill: CHART_COLORS.aggModerate }} />
                      {/* FF-Helix reference line removed per Peleg review */}
                      <ChartTooltip
                        content={({ payload }) => {
                          const item = payload?.[0]?.payload;
                          if (!item) return null;
                          return (
                            <div className="bg-background border border-border rounded p-2 text-xs">
                              <p className="font-medium">{item.id}</p>
                              <p>FF-Helix: {item.ffHelix.toFixed(1)}%</p>
                              <p>Agg Max: {item.aggMax.toFixed(1)}%</p>
                              <div className="flex items-center gap-1 mt-1 pt-1 border-t">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: TIER_POINT_COLORS[item.tier] }} />
                                <span>T{item.tier}: {item.tierLabel}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={helixAggData}
                        cursor="pointer"
                        onClick={(data: any) => { if (data?.id) select(data.id, 'FF-Helix % vs Aggregation Max'); }}
                      >
                        {helixAggData.map((d, i) => (
                          <Cell key={i} fill={TIER_POINT_COLORS[d.tier] ?? CHART_COLORS.tier5} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </>
          )}
        </ExpandableChart>
      </motion.div>

      {/* Sequence Length Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <ExpandableChart
          title="Sequence Length Distribution"
          description="Distribution of peptide lengths in amino acids"
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Histogram showing the distribution of peptide sequence lengths. Useful for understanding the dataset composition and identifying outliers.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {lengths.length === 0 ? (
            <EmptyState title="No length data" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lengthBins} margin={{ top: 20, right: 30, bottom: 25, left: 30 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => v.split('–')[0]}
                  />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip
                    content={({ payload }) => {
                      if (payload && payload.length > 0) {
                        const { range, count } = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p>Length: {range} aa</p>
                            <p>Count: {count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.scatterTertiary}
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = lengthBins[idx];
                      if (bin?.ids?.length) selectBin({ ids: bin.ids, binLabel: bin.range, source: 'Sequence Length Distribution' });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      {/* Amino Acid Composition */}
      {aaCompositionData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <ExpandableChart
            title="Amino Acid Composition"
            description="Residue categories across all peptides (HeliQuest classification)"
            headerRight={
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Amino acid composition grouped by HeliQuest standard categories. High hydrophobic fraction suggests membrane affinity; high charged fraction suggests solubility.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            }
          >
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aaCompositionData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 90 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={85} />
                  <ChartTooltip
                    content={({ payload }) => {
                      const item = payload?.[0]?.payload;
                      if (!item) return null;
                      return (
                        <div className="bg-background border border-border rounded p-2 text-xs">
                          <p className="font-medium">{item.category}</p>
                          <p>{item.count} residues ({item.pct.toFixed(1)}%)</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="pct" name="Percentage">
                    {aaCompositionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </ExpandableChart>
        </motion.div>
      )}

      {/* Aggregation Risk: Distribution Histogram */}
      {aggHistogram.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <ExpandableChart
            title="Aggregation Risk Distribution"
            description={`Peak TANGO aggregation across ${aggAllSorted.length} peptides`}
            headerRight={
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Distribution of maximum TANGO aggregation propensity. Green: low (&lt;5%), Yellow: moderate (5-20%), Red: high (&gt;20%).
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            }
            footer={
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CHART_COLORS.aggLow }} /> Low (&lt;5%)</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CHART_COLORS.aggModerate }} /> Moderate (5-20%)</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: CHART_COLORS.aggHot }} /> High (&gt;20%)</span>
              </div>
            }
          >
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggHistogram} margin={{ top: 20, right: 30, bottom: 30, left: 30 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} label={{ value: 'Peptides', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#666' }} />
                  <ChartTooltip
                    content={({ payload }) => {
                      const item = payload?.[0]?.payload;
                      if (!item) return null;
                      return (
                        <div className="bg-background border border-border rounded p-2 text-xs">
                          <p className="font-medium">Agg Max: {item.range}</p>
                          <p>{item.count} peptide{item.count !== 1 ? 's' : ''}</p>
                          {item.ids.length > 0 && <p className="text-muted-foreground mt-1">e.g. {item.ids.slice(0, 5).join(', ')}{item.ids.length > 5 ? '...' : ''}</p>}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Peptides"
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = aggHistogram[idx];
                      if (bin?.ids?.length) selectBin({ ids: bin.ids, binLabel: bin.range, source: 'Aggregation Risk Distribution' });
                    }}
                  >
                    <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: '#666' }} formatter={(v: number) => v > 0 ? v : ''} />
                    {aggHistogram.map((d, i) => (
                      <Cell key={i} fill={d.binStart >= 20 ? CHART_COLORS.aggHot : d.binStart >= 5 ? CHART_COLORS.aggModerate : CHART_COLORS.aggLow} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </ExpandableChart>
        </motion.div>
      )}

      {/* Aggregation Risk: Per-Peptide (Paginated) */}
      {aggAllSorted.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
          <ExpandableChart
            title="Aggregation Risk by Peptide"
            description={`Sorted by Agg Max (${aggSortDir === 'desc' ? 'highest' : 'lowest'} first) — Page ${aggPage + 1}/${aggTotalPages}`}
            headerRight={
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAggSortDir(d => d === 'desc' ? 'asc' : 'desc')} title="Toggle sort">
                  {aggSortDir === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
            }
            footer={
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  Showing {aggPage * AGG_PAGE_SIZE + 1}-{Math.min((aggPage + 1) * AGG_PAGE_SIZE, aggAllSorted.length)} of {aggAllSorted.length}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7" disabled={aggPage === 0} onClick={() => setAggPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" className="h-7" disabled={aggPage >= aggTotalPages - 1} onClick={() => setAggPage(p => p + 1)}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            }
          >
            <ChartContainer config={chartConfig} style={{ height: `${aggPageBarHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggPageData} layout="vertical" margin={{ top: 10, right: 50, bottom: 10, left: 120 }} barCategoryGap="20%">
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                  <YAxis type="category" dataKey="id" tick={{ fontSize: 11 }} width={110} />
                  <ReferenceArea x1={0} x2={5} fill={CHART_COLORS.aggLow} fillOpacity={0.05} />
                  <ReferenceArea x1={5} x2={20} fill={CHART_COLORS.aggModerate} fillOpacity={0.05} />
                  <ReferenceArea x1={20} x2={100} fill={CHART_COLORS.aggHot} fillOpacity={0.05} />
                  <ReferenceLine x={thresholds?.aggThreshold ?? 5} stroke={CHART_COLORS.aggModerate} strokeDasharray="6 3" />
                  <ChartTooltip
                    content={({ payload }) => {
                      const item = payload?.[0]?.payload;
                      if (!item) return null;
                      return (
                        <div className="bg-background border border-border rounded p-2 text-xs">
                          <p className="font-medium">{item.fullId}</p>
                          <p>Agg Max: {item.aggMax.toFixed(1)}%</p>
                          <p>{item.aggMax > 20 ? 'HIGH risk' : item.aggMax > 5 ? 'MODERATE risk' : 'LOW risk'}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="aggMax" name="Agg Max %" barSize={16}>
                    <LabelList dataKey="aggMax" position="right"
                      formatter={(v: number) => `${v.toFixed(1)}%`}
                      style={{ fontSize: 10, fill: '#666' }} />
                    {aggPageData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </ExpandableChart>
        </motion.div>
      )}

      {/* Provider Status (collapsed by default) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="lg:col-span-2">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors py-2 select-none">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
            <span>Provider Status</span>
            <div className="flex gap-1.5">
              {providers.map(p => (
                <span key={p.name} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${
                  p.status === 'AVAILABLE' ? 'bg-green-500' :
                  p.status === 'PARTIAL' ? 'bg-yellow-500' :
                  p.status === 'UNAVAILABLE' ? 'bg-red-500' : 'bg-gray-400'
                }`}>
                  {p.name}
                </span>
              ))}
            </div>
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {providers.map((provider) => (
              <div key={provider.name} className="border rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{provider.name}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${
                    provider.status === 'AVAILABLE' ? 'bg-green-500' :
                    provider.status === 'PARTIAL' ? 'bg-yellow-500' :
                    provider.status === 'UNAVAILABLE' ? 'bg-red-500' : 'bg-gray-400'
                  }`}>
                    {provider.status}
                  </span>
                </div>
                {provider.reason && <p className="text-xs text-muted-foreground">{provider.reason}</p>}
                {provider.stats && (
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>Req: {provider.stats.requested}</span>
                    <span className="text-green-600">OK: {provider.stats.parsed_ok}</span>
                    {provider.stats.parsed_bad > 0 && <span className="text-red-600">Fail: {provider.stats.parsed_bad}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      </motion.div>
    </div>
  );
}
