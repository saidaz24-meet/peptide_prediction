import { useMemo } from "react";
import { ExpandableChart, useChartFrame } from "@/components/ExpandableChart";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { Info } from "lucide-react";
import type { Peptide } from "@/types/peptide";

interface UpsetMatrixProps {
  peptides: Peptide[];
}

// 4 sets
const SET_LABELS = ["SSW", "Helix", "FF-SSW", "FF-Helix"] as const;
const SET_COLORS = ["#D55E00", "#0072B2", "#A03000", "#004A75"];
const SOURCE = "Pipeline UpSet Matrix";

type SetKey = (typeof SET_LABELS)[number];

function getSetMembership(p: Peptide): Record<SetKey, boolean> {
  return {
    SSW: p.sswPrediction === 1,
    Helix: p.s4predHelixPrediction === 1,
    "FF-SSW": p.ffSswFlag === 1,
    "FF-Helix": p.ffHelixFlag === 1,
  };
}

function membershipKey(m: Record<SetKey, boolean>): string {
  return SET_LABELS.map((s) => (m[s] ? "1" : "0")).join("");
}

/**
 * UpSet-style intersection matrix for the 4 pipeline sets.
 * Rows = sets, columns = non-empty intersections sorted by count.
 * Horizontal bars show count per intersection. Dots = set membership.
 * Click any bar to select those peptides.
 *
 * No external library — pure div/SVG.
 */
export function UpsetMatrix({ peptides }: UpsetMatrixProps) {
  const { isExpanded } = useChartFrame();
  const { selectBin } = useChartSelection();

  const { intersections, agreement } = useMemo(() => {
    // Build intersection groups
    const groups = new Map<string, { ids: string[]; membership: Record<SetKey, boolean> }>();
    for (const p of peptides) {
      const m = getSetMembership(p);
      const key = membershipKey(m);
      const existing = groups.get(key);
      if (existing) {
        existing.ids.push(p.id);
      } else {
        groups.set(key, { ids: [p.id], membership: m });
      }
    }

    // Sort by count descending, filter empty
    const sorted = [...groups.values()]
      .filter((g) => g.ids.length > 0)
      .sort((a, b) => b.ids.length - a.ids.length);

    // TANGO vs S4PRED SSW agreement
    const both = peptides.filter(
      (p) =>
        p.sswPrediction != null &&
        p.sswPrediction !== 0 &&
        p.s4predSswPrediction != null &&
        p.s4predSswPrediction !== 0
    );
    const agree = both.filter((p) => p.sswPrediction === p.s4predSswPrediction).length;

    return {
      intersections: sorted,
      agreement:
        both.length > 0
          ? { agree, total: both.length, pct: ((agree / both.length) * 100).toFixed(0) }
          : null,
    };
  }, [peptides]);

  if (peptides.length === 0) return null;

  const maxCount = intersections.length > 0 ? intersections[0].ids.length : 1;

  // Scale dimensions based on expanded mode
  const barMaxH = isExpanded ? 240 : 120;
  const colW = isExpanded ? 36 : 24;
  const dotSize = isExpanded ? 10 : 8;
  const rowH = isExpanded ? 28 : 20;
  const labelW = isExpanded ? 90 : 76;
  const fontSize = isExpanded ? 11 : 10;
  const countFontSize = isExpanded ? 11 : 9;

  // Generate intersection label
  const getLabel = (m: Record<SetKey, boolean>) => {
    const active = SET_LABELS.filter((s) => m[s]);
    if (active.length === 0) return "Neither";
    return active.join(" + ");
  };

  return (
    <ExpandableChart
      title="Pipeline Intersections"
      description="UpSet-style view of set overlaps across all 4 classification sets"
      peptides={peptides}
      footer={
        agreement ? (
          <div className="mt-2 p-2 rounded bg-muted/30 text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              TANGO vs S4PRED SSW agreement: {agreement.pct}% ({agreement.agree}/{agreement.total}{" "}
              definitive pairs)
            </span>
          </div>
        ) : undefined
      }
    >
      <div className={isExpanded ? "flex justify-center" : "overflow-x-auto"}>
        <div className={isExpanded ? "w-full max-w-[700px]" : ""}>
          {/* Bar chart (top) */}
          <div className="flex items-end gap-1 mb-1" style={{ paddingLeft: labelW + 4 }}>
            {intersections.map((inter, col) => {
              const barH = Math.max(4, (inter.ids.length / maxCount) * barMaxH);
              return (
                <div
                  key={col}
                  className="flex flex-col items-center cursor-pointer group"
                  style={{ width: colW }}
                  onClick={() =>
                    selectBin({
                      ids: inter.ids,
                      binLabel: getLabel(inter.membership),
                      source: SOURCE,
                    })
                  }
                >
                  <span
                    className="font-mono text-muted-foreground mb-0.5"
                    style={{ fontSize: countFontSize }}
                  >
                    {inter.ids.length}
                  </span>
                  <div
                    className="w-3 rounded-t-sm bg-primary/70 group-hover:bg-primary transition-colors"
                    style={{ height: barH, width: isExpanded ? 14 : 12 }}
                  />
                </div>
              );
            })}
          </div>

          {/* Dot matrix (bottom) */}
          <div className="border-t pt-1">
            {SET_LABELS.map((setName, row) => (
              <div key={setName} className="flex items-center gap-1" style={{ height: rowH }}>
                <div
                  className="font-medium text-right shrink-0"
                  style={{ width: labelW, color: SET_COLORS[row], fontSize }}
                >
                  {setName}
                </div>
                {intersections.map((inter, col) => {
                  const active = inter.membership[setName];
                  return (
                    <div
                      key={col}
                      className="flex items-center justify-center cursor-pointer"
                      style={{ width: colW }}
                      onClick={() =>
                        selectBin({
                          ids: inter.ids,
                          binLabel: getLabel(inter.membership),
                          source: SOURCE,
                        })
                      }
                    >
                      <div
                        className={`rounded-full ${active ? "" : "opacity-20"}`}
                        style={{
                          width: dotSize,
                          height: dotSize,
                          backgroundColor: active ? SET_COLORS[row] : "#ccc",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ExpandableChart>
  );
}
