/**
 * Dialog listing peptides in a clicked histogram bin.
 *
 * Triggered by histogram bar click → `selectBin()` in chartSelectionStore.
 * Row click → clears bin selection and opens PeptidePreviewSheet.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { getConsensusSS } from "@/lib/consensus";
import { CHART_COLORS } from "@/lib/chartConfig";
import type { Peptide } from "@/types/peptide";

interface BinPeptideDialogProps {
  peptides: Peptide[];
}

export function BinPeptideDialog({ peptides }: BinPeptideDialogProps) {
  const { binSelection, clearBinSelection, select } = useChartSelection();

  if (!binSelection) return null;

  const binPeptides = peptides.filter((p) => binSelection.ids.includes(p.id));

  return (
    <Dialog open={!!binSelection} onOpenChange={() => clearBinSelection()}>
      <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{binSelection.source}</DialogTitle>
          <DialogDescription>
            {binPeptides.length} peptide{binPeptides.length !== 1 ? "s" : ""} in range{" "}
            {binSelection.binLabel}. Click to preview.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-2">
          <div className="divide-y">
            {binPeptides.map((p) => {
              const c = getConsensusSS(p);
              const tierColor = CHART_COLORS[`tier${c.tier}` as keyof typeof CHART_COLORS];
              return (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    clearBinSelection();
                    select(p.id, binSelection.source);
                  }}
                >
                  <span
                    className="shrink-0 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: tierColor }}
                    title={`T${c.tier}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-sm truncate">{p.id}</span>
                    <span className="block text-xs text-muted-foreground">
                      H: {p.hydrophobicity?.toFixed(2) ?? "\u2013"}
                      {" \u00B7 "}
                      Charge: {p.charge?.toFixed(1) ?? "\u2013"}
                      {" \u00B7 "}
                      μH: {p.muH?.toFixed(2) ?? "\u2013"}
                    </span>
                  </span>
                </button>
              );
            })}
            {binPeptides.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No matching peptides found.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
