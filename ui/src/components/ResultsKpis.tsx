import { motion } from "framer-motion";
import { TrendingUp, Users, Heater, FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DatasetStats, DatasetMetadata } from "@/types/peptide";
import { useNavigate } from "react-router-dom";
import { MetricId } from "@/types/metrics";
import { Abbr } from "@/components/Abbr";
import { useChartSelection } from "@/stores/chartSelectionStore";

interface ResultsKpisProps {
  stats: DatasetStats | null;
  meta?: DatasetMetadata | null;
}

export function ResultsKpis({ stats, meta }: ResultsKpisProps) {
  const navigate = useNavigate();
  const { setTableFilter, setActiveTab } = useChartSelection();

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-soft">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Determine availability for each KPI based on provider status
  // NO LYING UI rule: If TANGO is OFF or UNAVAILABLE, show N/A
  // AVAILABLE or PARTIAL means TANGO ran and produced output
  // Note: We don't check 'ran' field - 'status' is authoritative
  const tangoStatus = meta?.provider_status?.tango?.status;
  const tangoAvailable = tangoStatus === "AVAILABLE" || tangoStatus === "PARTIAL";

  const s4predStatus = meta?.provider_status?.s4pred?.status;
  const s4predAvailable = s4predStatus === "AVAILABLE" || s4predStatus === "PARTIAL";

  const ffAvailable = (stats.ffHelixAvailable ?? 0) > 0;
  const sswAvailable = (stats.sswAvailable ?? 0) > 0;

  // Helper to format percentage or show N/A
  const formatPercent = (value: number | null | undefined, decimals: number = 1): string => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "N/A";
    }
    return `${value.toFixed(decimals)}%`;
  };

  const kpis = [
    {
      title: "Total Peptides",
      value: stats.totalPeptides.toLocaleString(),
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      metricId: null as MetricId | null,
      onClick: () => {
        setTableFilter(null);
        setActiveTab("data");
      },
      clickable: true,
    },
    {
      title: (
        <>
          % <Abbr title="Fibril-Forming Helix">FF Helix</Abbr>
        </>
      ),
      titleKey: "ff-helix",
      value: formatPercent(stats.ffHelixCandidatePercent),
      icon: Heater,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
      metricId: null as MetricId | null,
      onClick: () => {
        setTableFilter({ label: "FF-Helix Candidates", field: "ffHelixFlag", value: 1 });
        setActiveTab("data");
      },
      clickable: true,
      subtitle: (
        <>
          <Abbr title="Secondary Structure Prediction">S4PRED</Abbr> helix +{" "}
          <Abbr title="Hydrophobic moment">uH</Abbr> {">"} avg
        </>
      ),
      tooltip:
        "Percentage of peptides classified as FF-Helix candidates (helix uH above cohort average)",
    },
    {
      title: (
        <>
          {" "}
          % <Abbr title="Fibril-Forming Structural Switching">FF SSW</Abbr>
        </>
      ),
      titleKey: "ff-ssw",
      value: tangoAvailable ? formatPercent(stats.ffSswCandidatePercent) : "N/A",
      icon: FlaskConical,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
      metricId: null as MetricId | null,
      onClick: () => {
        setTableFilter({ label: "FF-SSW Candidates", field: "ffSswFlag", value: 1 });
        setActiveTab("data");
      },
      clickable: true,
      subtitle: (
        <>
          <Abbr title="Structural Switching (TANGO)">SSW</Abbr> and H {">"}= avg
        </>
      ),
      tooltip: !tangoAvailable
        ? "TANGO did not run or is unavailable"
        : "Percentage of peptides classified as FF-SSW candidates (SSW + hydrophobicity above cohort average)",
    },
    {
      title: (
        <>
          {" "}
          % <Abbr title="Structural Switching (TANGO)">SSW</Abbr>
        </>
      ),
      titleKey: "ssw",
      value: tangoAvailable ? formatPercent(stats.sswPositivePercent) : "N/A",
      icon: TrendingUp,
      color: "text-chameleon-positive",
      bgColor: "bg-chameleon-positive/10",
      metricId: "ssw-positive" as MetricId,
      onClick: () => {
        setTableFilter({ label: "SSW Positive", field: "sswPrediction", value: 1 });
        setActiveTab("data");
      },
      clickable: true,
      tooltip: !tangoAvailable
        ? "TANGO did not run or is unavailable"
        : "Percentage of peptides with TANGO SSW prediction",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={"titleKey" in kpi ? kpi.titleKey : String(kpi.title)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={`shadow-soft transition-all cursor-pointer hover:shadow-medium hover:-translate-y-0.5 active:scale-[0.98]`}
              onClick={kpi.onClick}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{kpi.title}</p>
                    <motion.p
                      className="text-3xl font-bold"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1 + 0.2, type: "spring" }}
                    >
                      {kpi.value}
                    </motion.p>
                    {"subtitle" in kpi && kpi.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{kpi.subtitle}</p>
                    )}
                  </div>
                  <div
                    className={`w-12 h-12 rounded-lg ${kpi.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`w-6 h-6 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
