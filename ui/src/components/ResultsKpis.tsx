import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { DatasetStats, DatasetMetadata } from "@/types/peptide";
import { useNavigate } from "react-router-dom";
import { MetricId } from "@/types/metrics";
import { Abbr } from "@/components/Abbr";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { smoothEase } from "@/lib/animations";
import {
  PeptideChainIcon,
  HelixToFibrilIcon,
  StructuralSwitchIcon,
  SwitchToFibrilIcon,
} from "@/components/icons/PeptideIcons";

interface ResultsKpisProps {
  stats: DatasetStats | null;
  meta?: DatasetMetadata | null;
}

export function ResultsKpis({ stats, meta }: ResultsKpisProps) {
  const navigate = useNavigate();
  const { setTableFilter, setActiveTab } = useChartSelection();

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

  // FIX-004: Reorder per Peleg — Total → % FF-Helix → % SSW → % FF-SSW
  // Icons replaced with scientific PeptideIcons per PROMPT 2
  // Subtitles use Peleg's 4-category definitions with proper Greek μ
  const kpis = [
    {
      title: "Total Peptides",
      value: stats.totalPeptides.toLocaleString(),
      icon: PeptideChainIcon,
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
          % <Abbr title="Fibril-Forming Helix">FF-Helix</Abbr>
        </>
      ),
      titleKey: "ff-helix",
      value: formatPercent(stats.ffHelixCandidatePercent),
      icon: HelixToFibrilIcon,
      color: "text-[hsl(var(--ff-helix))]",
      bgColor: "bg-[hsl(var(--ff-helix))]/10",
      metricId: null as MetricId | null,
      onClick: () => {
        setTableFilter({ label: "FF-Helix Candidates", field: "ffHelixFlag", value: 1 });
        setActiveTab("data");
      },
      clickable: true,
      subtitle: "Helical + μH above threshold",
      tooltip:
        "Percentage of peptides predicted as fibril-forming α-helical (helix + μH above database threshold)",
    },
    {
      title: (
        <>
          % <Abbr title="Secondary Structure Switch">SSW</Abbr>
        </>
      ),
      titleKey: "ssw",
      value: tangoAvailable ? formatPercent(stats.sswPositivePercent) : "N/A",
      icon: StructuralSwitchIcon,
      color: "text-[hsl(var(--ssw))]",
      bgColor: "bg-[hsl(var(--ssw))]/10",
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
      title: (
        <>
          % <Abbr title="Fibril-Forming Secondary Structure Switch">FF-SSW</Abbr>
        </>
      ),
      titleKey: "ff-ssw",
      value: tangoAvailable ? formatPercent(stats.ffSswCandidatePercent) : "N/A",
      icon: SwitchToFibrilIcon,
      color: "text-[hsl(var(--ff-ssw))]",
      bgColor: "bg-[hsl(var(--ff-ssw))]/10",
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={"titleKey" in kpi ? kpi.titleKey : String(kpi.title)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.5, ease: smoothEase }}
          >
            <Card
              className="rounded-xl border-[hsl(var(--border))] shadow-soft cursor-pointer transition-all duration-300 hover:shadow-medium hover:-translate-y-1 hover:border-[hsl(var(--border-hover))] active:scale-[0.98] group"
              onClick={kpi.onClick}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-small text-muted-foreground">{kpi.title}</p>
                    <motion.p
                      className="text-3xl font-bold tracking-tight text-foreground"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.08 + 0.2, type: "spring", stiffness: 200 }}
                    >
                      {kpi.value}
                    </motion.p>
                    {"subtitle" in kpi && kpi.subtitle && (
                      <p className="text-caption text-[hsl(var(--faint))] mt-1">{kpi.subtitle}</p>
                    )}
                  </div>
                  <div
                    className={`w-11 h-11 rounded-xl ${kpi.bgColor} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className={`w-5 h-5 ${kpi.color}`} />
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
