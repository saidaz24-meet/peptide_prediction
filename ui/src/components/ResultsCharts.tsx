import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { ExpandableChart } from "@/components/ExpandableChart";
import { Peptide } from "@/types/peptide";
import type { ResolvedThresholds } from "@/lib/thresholds";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { useThresholdStore } from "@/stores/thresholdStore";
import { EulerDiagram } from "@/components/charts/EulerDiagram";
import { UpsetMatrix } from "@/components/charts/UpsetMatrix";
import { AACompositionGrouped } from "@/components/charts/AACompositionGrouped";
import {
  DistributionChart,
  type DistributionThreshold,
} from "@/components/charts/DistributionChart";
import {
  ClassificationComparison,
  SSW_CLASSIFICATION,
  HELIX_CLASSIFICATION,
  type ComparisonMetric,
} from "@/components/charts/ClassificationComparison";

interface ResultsChartsProps {
  peptides: Peptide[];
  providerStatus?: {
    tango?: {
      status: string;
      reason?: string | null;
      stats?: { requested: number; parsed_ok: number; parsed_bad: number };
    };
    s4pred?: {
      status: string;
      reason?: string | null;
      stats?: { requested: number; parsed_ok: number; parsed_bad: number };
    };
  };
  thresholds?: ResolvedThresholds;
}

/** Map peptides → { id, value } pairs for DistributionChart click-to-filter. */
function pickValues<T extends number | null | undefined>(
  peptides: Peptide[],
  getValue: (p: Peptide) => T
): { peptideValues: { id: string; value: number }[]; values: number[] } {
  const peptideValues: { id: string; value: number }[] = [];
  const values: number[] = [];
  for (const p of peptides) {
    const v = getValue(p);
    if (typeof v === "number" && Number.isFinite(v)) {
      peptideValues.push({ id: p.id, value: v });
      values.push(v);
    }
  }
  return { peptideValues, values };
}

const COMPARISON_METRICS: ComparisonMetric[] = [
  { id: "hydrophobicity", label: "Hydrophobicity", getValue: (p) => p.hydrophobicity },
  // PELEG-Q-FIX-022: |charge| loses sign — discussion pending.
  {
    id: "absCharge",
    label: "|Charge|",
    getValue: (p) => (p.charge != null ? Math.abs(p.charge) : null),
  },
  { id: "length", label: "Length", unit: "aa", getValue: (p) => p.length },
  { id: "muH", label: "uH", getValue: (p) => p.muH },
  {
    id: "ffHelixPercent",
    label: "FF-Helix %",
    unit: "%",
    getValue: (p) => p.ffHelixPercent,
  },
];

export function ResultsCharts({ peptides, providerStatus }: ResultsChartsProps) {
  // Live thresholds from the store — no more hardcoded 0.5.
  const active = useThresholdStore((s) => s.active);
  const muHThreshold: DistributionThreshold = {
    value: active.muHCutoff,
    label: `uH ≥ ${active.muHCutoff.toFixed(2)}`,
  };
  const hydroThreshold: DistributionThreshold = {
    value: active.hydroCutoff,
    label: `H ≥ ${active.hydroCutoff.toFixed(2)}`,
  };

  const hydroData = pickValues(peptides, (p) => p.hydrophobicity);
  const muHData = pickValues(peptides, (p) => p.muH);
  const lengthData = pickValues(peptides, (p) => p.length);
  const aggData = pickValues(peptides, (p) => p.tangoAggMax);

  const { selectBin } = useChartSelection();

  // ── Provider status ──
  const providers = [
    {
      name: "TANGO",
      status: providerStatus?.tango?.status || "OFF",
      reason: providerStatus?.tango?.reason,
      stats: providerStatus?.tango?.stats,
    },
    {
      name: "S4PRED",
      status: providerStatus?.s4pred?.status || "OFF",
      reason: providerStatus?.s4pred?.reason,
      stats: providerStatus?.s4pred?.stats,
    },
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* ═══ Row 1: Euler Diagram + UpSet Matrix ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <EulerDiagram peptides={peptides} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <UpsetMatrix peptides={peptides} />
      </motion.div>

      {/* ═══ Row 2: Hydrophobicity + uH + Sequence Length (3-col, full width) ═══
          Peleg FIX-019 / FIX-021 / FIX-032: thresholds read live from useThresholdStore. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="lg:col-span-2"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ExpandableChart
            title="Hydrophobicity Distribution"
            description="Frequency of hydrophobicity values across the database"
            peptides={peptides}
          >
            <DistributionChart
              data={hydroData.values}
              peptideValues={hydroData.peptideValues}
              metric={{
                id: "hydrophobicity",
                label: "Hydrophobicity",
                axisX: "Hydrophobicity (Fauchere-Pliska)",
                axisY: "Count",
              }}
              threshold={hydroThreshold}
              summary="count-above"
              onBinClick={(ids, label) =>
                selectBin({ ids, binLabel: label, source: "Hydrophobicity Distribution" })
              }
            />
          </ExpandableChart>

          <ExpandableChart
            title="Hydrophobic Moment (uH) Distribution"
            description="Frequency of amphipathic character"
            peptides={peptides}
          >
            <DistributionChart
              data={muHData.values}
              peptideValues={muHData.peptideValues}
              metric={{
                id: "muH",
                label: "uH",
                axisX: "Hydrophobic moment (uH)",
                axisY: "Count",
              }}
              threshold={muHThreshold}
              summary="count-above"
              onBinClick={(ids, label) =>
                selectBin({
                  ids,
                  binLabel: label,
                  source: "Hydrophobic Moment (uH) Distribution",
                })
              }
            />
          </ExpandableChart>

          <ExpandableChart
            title="Sequence Length Distribution"
            description="Distribution of peptide lengths"
            peptides={peptides}
          >
            <DistributionChart
              data={lengthData.values}
              peptideValues={lengthData.peptideValues}
              metric={{
                id: "length",
                label: "Length",
                unit: "aa",
                axisX: "Sequence length (amino acids)",
                axisY: "Count",
              }}
              onBinClick={(ids, label) =>
                selectBin({ ids, binLabel: label, source: "Sequence Length Distribution" })
              }
            />
          </ExpandableChart>
        </div>
      </motion.div>

      {/* ═══ Row 3: SSW classification + Helix classification (parallel) ═══
          Peleg FIX-022 / FIX-029: replaces the SSW-only "% diff from mean" chart with
          a generalized ClassificationComparison so we can show BOTH SSW and Helix
          classification groupings side-by-side. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <ExpandableChart
          title="SSW classification — biochemical comparison"
          description="Mean per-metric values across No SSW vs SSW vs FF-SSW"
          peptides={peptides}
        >
          <ClassificationComparison
            peptides={peptides}
            classification={SSW_CLASSIFICATION}
            metrics={COMPARISON_METRICS}
          />
        </ExpandableChart>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
      >
        <ExpandableChart
          title="Helix classification — biochemical comparison"
          description="Mean per-metric values across No Helix vs Helix vs FF-Helix"
          peptides={peptides}
        >
          <ClassificationComparison
            peptides={peptides}
            classification={HELIX_CLASSIFICATION}
            metrics={COMPARISON_METRICS}
          />
        </ExpandableChart>
      </motion.div>

      {/* ═══ Row 4: Aggregation Propensity Distribution + AA Composition ═══ */}
      {aggData.values.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ExpandableChart
            title="Aggregation Propensity Distribution"
            description="How peptides distribute across peak TANGO aggregation values"
            peptides={peptides}
          >
            <DistributionChart
              data={aggData.values}
              peptideValues={aggData.peptideValues}
              metric={{
                id: "tangoAggMax",
                label: "Peak TANGO aggregation",
                unit: "%",
                axisX: "Peak TANGO aggregation (%)",
                axisY: "Count",
              }}
              style="lollipop"
              onBinClick={(ids, label) =>
                selectBin({
                  ids,
                  binLabel: label,
                  source: "Aggregation Propensity Distribution",
                })
              }
            />
          </ExpandableChart>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <AACompositionGrouped peptides={peptides} />
      </motion.div>

      {/* ═══ Row 5: Correlation Heatmap — full width (rendered by parent) ═══ */}

      {/* ═══ Row 6: Provider Status (collapsed, full width) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="lg:col-span-2"
      >
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors py-2 select-none">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
            <span>Provider Status</span>
            <div className="flex gap-1.5">
              {providers.map((p) => (
                <span
                  key={p.name}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${
                    p.status === "AVAILABLE"
                      ? "bg-green-500"
                      : p.status === "PARTIAL"
                        ? "bg-yellow-500"
                        : p.status === "UNAVAILABLE"
                          ? "bg-red-500"
                          : "bg-gray-400"
                  }`}
                >
                  {p.name}
                </span>
              ))}
            </div>
          </summary>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {providers.map((provider) => (
              <div key={provider.name} className="border rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{provider.name}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${
                      provider.status === "AVAILABLE"
                        ? "bg-green-500"
                        : provider.status === "PARTIAL"
                          ? "bg-yellow-500"
                          : provider.status === "UNAVAILABLE"
                            ? "bg-red-500"
                            : "bg-gray-400"
                    }`}
                  >
                    {provider.status}
                  </span>
                </div>
                {provider.reason && (
                  <p className="text-xs text-muted-foreground">{provider.reason}</p>
                )}
                {provider.stats && (
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>Req: {provider.stats.requested}</span>
                    <span className="text-green-600">OK: {provider.stats.parsed_ok}</span>
                    {provider.stats.parsed_bad > 0 && (
                      <span className="text-red-600">Fail: {provider.stats.parsed_bad}</span>
                    )}
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
