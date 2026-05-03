/**
 * ExportFigurePackButton — One-click generation of a multi-panel figure set
 * ready for Nature/Science publication supplements.
 *
 * Generates SVG panels for classification, radar overlay, aggregation profile,
 * and methods text, then bundles them into a downloadable HTML file.
 */
import { useState, useCallback } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { Peptide } from "@/types/peptide";
import { useThresholdStore } from "@/stores/thresholdStore";
import { useDatasetStore } from "@/stores/datasetStore";
import {
  generateFigurePack,
  generateCoverPage,
  downloadFigurePackAsHTML,
  type FigurePackOptions,
} from "@/lib/figurePack";

interface ExportFigurePackButtonProps {
  selectedPeptides: Peptide[];
  allPeptides: Peptide[];
  disabled?: boolean;
}

export function ExportFigurePackButton({
  selectedPeptides,
  allPeptides,
  disabled,
}: ExportFigurePackButtonProps) {
  const [loading, setLoading] = useState(false);
  const thresholds = useThresholdStore((s) => s.active);
  const stats = useDatasetStore((s) => s.stats);

  const handleExport = useCallback(async () => {
    if (!stats || selectedPeptides.length === 0) return;

    setLoading(true);
    try {
      const options: FigurePackOptions = {
        peptides: selectedPeptides,
        allPeptides,
        thresholds,
        stats,
        title: "PVL Figure Pack",
      };

      const [panels, coverSvg] = await Promise.all([
        generateFigurePack(options),
        Promise.resolve(generateCoverPage(options)),
      ]);

      downloadFigurePackAsHTML(panels, coverSvg, "PVL_Figure_Pack");
    } catch (err) {
      console.error("[FigurePack] Export failed:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeptides, allPeptides, thresholds, stats]);

  const isDisabled = disabled || selectedPeptides.length === 0 || loading;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
      title={
        selectedPeptides.length === 0
          ? "Select peptides to export figure pack"
          : "Export publication-ready figure pack"
      }
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileDown className="w-3.5 h-3.5" />
      )}
      Figure Pack
    </button>
  );
}
