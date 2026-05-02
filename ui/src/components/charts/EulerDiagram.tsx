/**
 * EulerDiagram — Legacy shim wrapping the new SetDiagram component.
 *
 * Preserves the existing `<EulerDiagram peptides={...} />` call-site API
 * while delegating all rendering and region computation to SetDiagram.
 *
 * @see SetDiagram.tsx for the generalized implementation.
 * @see docs/active/PELEG_FEEDBACK_INSTRUCTIONS.md FIX-007
 */

import { ExpandableChart } from "@/components/ExpandableChart";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { SetDiagram, buildPVLSets } from "@/components/charts/SetDiagram";
import type { Peptide } from "@/types/peptide";

interface EulerDiagramProps {
  peptides: Peptide[];
}

const SOURCE = "Results Venn Diagram";

export function EulerDiagram({ peptides }: EulerDiagramProps) {
  const { selectBin } = useChartSelection();
  const total = peptides.length;

  if (total === 0) return null;

  const sets = buildPVLSets(peptides);
  const universe = peptides.map((p) => p.id);

  return (
    <ExpandableChart
      title="Results Overview"
      description={`Classification landscape (n=${total})`}
      peptides={peptides}
    >
      <SetDiagram
        sets={sets}
        universe={universe}
        mode="euler"
        showCounts={true}
        outsideLabel="Neither"
        onRegionClick={(regionId, members) => {
          if (members.length > 0) {
            selectBin({ ids: members, binLabel: regionId, source: SOURCE });
          }
        }}
      />
    </ExpandableChart>
  );
}
