import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface LegendProps {
  defaultOpen?: boolean;
}

/** Shared legend body — used in both Dialog and Popover */
function LegendContent() {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-sm mb-3">Color Conventions</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">SSW</span>
            <Badge className="bg-chameleon-positive text-white">SSW</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">No SSW</span>
            <Badge variant="secondary">No SSW</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">SSW Not Available</span>
            <Badge variant="outline">Not available</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Helix Segments</span>
            <div className="w-4 h-4 rounded bg-helix"></div>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold text-sm mb-3">Metric Ranges</h4>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div>Hydrophobicity: -2.0 to +2.0</div>
          <div>Hydrophobic Moment: 0.0 to 1.0</div>
          <div>S4PRED Helix: 0% to 100%</div>
          <div>Charge: Positive/Negative values</div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-semibold text-sm mb-3">Abbreviations</h4>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div>
            <strong>SSW</strong> — Structural Switching (TANGO)
          </div>
          <div>
            <strong>FF</strong> — Fibril-Forming
          </div>
          <div>
            <strong>CF</strong> — Chou-Fasman (helix propensity)
          </div>
          <div>
            <strong>S4PRED</strong> — Secondary Structure Prediction (neural network)
          </div>
          <div>
            <strong>μH</strong> — Hydrophobic moment
          </div>
        </div>
      </div>

      <Separator />

      <div className="text-xs text-muted-foreground">
        <p>Click any data point or table row to view detailed analysis</p>
      </div>
    </div>
  );
}

export function Legend({ defaultOpen = false }: LegendProps) {
  const [dialogOpen, setDialogOpen] = useState(defaultOpen);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // First visit → Dialog with blurred backdrop
  // Subsequent visits → Popover via button click
  return (
    <>
      {/* First-visit dialog overlay */}
      <AnimatePresence>
        {dialogOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Legend & Guide
                </DialogTitle>
                <DialogDescription>
                  Quick reference for colors, metrics, and abbreviations used in PVL.
                </DialogDescription>
              </DialogHeader>
              <LegendContent />
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Button → Popover for subsequent visits */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Info className="w-4 h-4 mr-2" />
            Legend
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <LegendContent />
          </motion.div>
        </PopoverContent>
      </Popover>
    </>
  );
}
