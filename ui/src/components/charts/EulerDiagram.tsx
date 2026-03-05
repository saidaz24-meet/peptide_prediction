import { useMemo } from "react";
import { ExpandableChart, useChartFrame } from "@/components/ExpandableChart";
import { useChartSelection } from "@/stores/chartSelectionStore";
import type { Peptide } from "@/types/peptide";

interface EulerDiagramProps {
  peptides: Peptide[];
}

// Color palette
const SSW_COLOR = "#D55E00"; // warm/orange
const FF_SSW_COLOR = "#A03000"; // darker orange
const HELIX_COLOR = "#0072B2"; // cool/blue
const FF_HELIX_COLOR = "#004A75"; // darker blue
const BOTH_COLOR = "#7B4F8A"; // purple blend
const NEITHER_COLOR = "#e5e5e5";

const SOURCE = "Pipeline Venn Diagram";

interface Region {
  label: string;
  ids: string[];
  color: string;
}

/**
 * 4-set Venn diagram showing the pipeline classification landscape.
 * SSW and Helix as overlapping circles; FF-SSW nested in SSW, FF-Helix nested in Helix.
 * Each region is clickable with colored fill. Summary table below.
 */
export function EulerDiagram({ peptides }: EulerDiagramProps) {
  const { isExpanded } = useChartFrame();
  const { selectBin } = useChartSelection();
  const total = peptides.length;

  const regions = useMemo(() => {
    const sswSet = new Set(peptides.filter((p) => p.sswPrediction === 1).map((p) => p.id));
    const helixSet = new Set(
      peptides.filter((p) => p.s4predHelixPrediction === 1).map((p) => p.id)
    );
    const ffSswSet = new Set(peptides.filter((p) => p.ffSswFlag === 1).map((p) => p.id));
    const ffHelixSet = new Set(peptides.filter((p) => p.ffHelixFlag === 1).map((p) => p.id));

    // 8 meaningful regions (FF ⊆ parent, so only 8 not 16)
    // Region 1: SSW only, not Helix, not FF-SSW
    const sswOnlyPlain = peptides
      .filter((p) => sswSet.has(p.id) && !helixSet.has(p.id) && !ffSswSet.has(p.id))
      .map((p) => p.id);

    // Region 2: Helix only, not SSW, not FF-Helix
    const helixOnlyPlain = peptides
      .filter((p) => helixSet.has(p.id) && !sswSet.has(p.id) && !ffHelixSet.has(p.id))
      .map((p) => p.id);

    // Region 3: SSW ∩ Helix, not any FF
    const bothPlain = peptides
      .filter(
        (p) =>
          sswSet.has(p.id) && helixSet.has(p.id) && !ffSswSet.has(p.id) && !ffHelixSet.has(p.id)
      )
      .map((p) => p.id);

    // Region 4: FF-SSW only (inside SSW, not Helix)
    const ffSswOnly = peptides
      .filter((p) => ffSswSet.has(p.id) && !helixSet.has(p.id))
      .map((p) => p.id);

    // Region 5: FF-Helix only (inside Helix, not SSW)
    const ffHelixOnly = peptides
      .filter((p) => ffHelixSet.has(p.id) && !sswSet.has(p.id))
      .map((p) => p.id);

    // Region 6: FF-SSW ∩ Helix (FF-SSW + Helix but not FF-Helix)
    const ffSswAndHelix = peptides
      .filter((p) => ffSswSet.has(p.id) && helixSet.has(p.id) && !ffHelixSet.has(p.id))
      .map((p) => p.id);

    // Region 7: SSW ∩ FF-Helix (SSW + FF-Helix but not FF-SSW)
    const sswAndFfHelix = peptides
      .filter((p) => sswSet.has(p.id) && ffHelixSet.has(p.id) && !ffSswSet.has(p.id))
      .map((p) => p.id);

    // Region 8: FF-SSW ∩ FF-Helix (both FF flags)
    const bothFF = peptides
      .filter((p) => ffSswSet.has(p.id) && ffHelixSet.has(p.id))
      .map((p) => p.id);

    // Region 9: Neither
    const neither = peptides
      .filter((p) => !sswSet.has(p.id) && !helixSet.has(p.id))
      .map((p) => p.id);

    const result: Region[] = [
      { label: "SSW only", ids: sswOnlyPlain, color: SSW_COLOR },
      { label: "Helix only", ids: helixOnlyPlain, color: HELIX_COLOR },
      { label: "SSW ∩ Helix", ids: bothPlain, color: BOTH_COLOR },
      { label: "FF-SSW (not Helix)", ids: ffSswOnly, color: FF_SSW_COLOR },
      { label: "FF-Helix (not SSW)", ids: ffHelixOnly, color: FF_HELIX_COLOR },
      { label: "FF-SSW ∩ Helix", ids: ffSswAndHelix, color: "#8B5A2B" },
      { label: "SSW ∩ FF-Helix", ids: sswAndFfHelix, color: "#4B6B8A" },
      { label: "Both FF", ids: bothFF, color: "#5C3D6E" },
      { label: "Neither", ids: neither, color: NEITHER_COLOR },
    ];

    return {
      all: result,
      sswTotal: sswSet.size,
      helixTotal: helixSet.size,
      ffSswTotal: ffSswSet.size,
      ffHelixTotal: ffHelixSet.size,
    };
  }, [peptides]);

  if (total === 0) return null;

  const pct = (n: number) => ((n / total) * 100).toFixed(1);

  // SVG dimensions
  const W = 480;
  const H = 320;

  const click = (ids: string[], label: string) => {
    if (ids.length > 0) selectBin({ ids, binLabel: label, source: SOURCE });
  };

  // Gather regions with counts for SVG labels
  const sswOnlyPlain = regions.all[0];
  const helixOnlyPlain = regions.all[1];
  const bothPlain = regions.all[2];
  const ffSswOnly = regions.all[3];
  const ffHelixOnly = regions.all[4];
  const ffSswAndHelix = regions.all[5];
  const sswAndFfHelix = regions.all[6];
  const bothFF = regions.all[7];
  const neither = regions.all[8];

  // Combined SSW+Helix overlap count (all sub-regions in the intersection)
  const overlapIds = [...bothPlain.ids, ...ffSswAndHelix.ids, ...sswAndFfHelix.ids, ...bothFF.ids];

  return (
    <ExpandableChart
      title="Pipeline Overview"
      description={`Classification landscape (n=${total})`}
      peptides={peptides}
    >
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`select-none w-full h-auto ${isExpanded ? "max-w-[700px]" : "max-w-[480px]"}`}
        >
          {/* Outer rectangle = All Peptides (clickable for "Neither") */}
          <rect
            x={10}
            y={10}
            width={W - 20}
            height={H - 20}
            rx={8}
            fill={NEITHER_COLOR}
            fillOpacity={0.12}
            stroke="#999"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            className="cursor-pointer"
            onClick={() => click(neither.ids, neither.label)}
          />
          <text x={W - 20} y={28} textAnchor="end" fontSize={10} fill="#999">
            All: {total}
          </text>

          {/* SSW circle (left) — filled region */}
          <circle
            cx={185}
            cy={160}
            r={110}
            fill={SSW_COLOR}
            fillOpacity={0.12}
            stroke={SSW_COLOR}
            strokeWidth={2}
            className="cursor-pointer"
            onClick={() => click(sswOnlyPlain.ids, sswOnlyPlain.label)}
          />

          {/* Helix circle (right) — filled region */}
          <circle
            cx={295}
            cy={160}
            r={110}
            fill={HELIX_COLOR}
            fillOpacity={0.12}
            stroke={HELIX_COLOR}
            strokeWidth={2}
            className="cursor-pointer"
            onClick={() => click(helixOnlyPlain.ids, helixOnlyPlain.label)}
          />

          {/* Overlap region (SSW ∩ Helix) — lens-shaped clickable area */}
          <clipPath id="ssw-clip">
            <circle cx={185} cy={160} r={110} />
          </clipPath>
          <circle
            cx={295}
            cy={160}
            r={110}
            clipPath="url(#ssw-clip)"
            fill={BOTH_COLOR}
            fillOpacity={0.2}
            className="cursor-pointer"
            onClick={() => click(overlapIds, "SSW ∩ Helix (all)")}
          />

          {/* FF-SSW nested circle (inside SSW, left) */}
          {regions.ffSswTotal > 0 && (
            <circle
              cx={145}
              cy={180}
              r={50}
              fill={FF_SSW_COLOR}
              fillOpacity={0.3}
              stroke={FF_SSW_COLOR}
              strokeWidth={2}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                click([...ffSswOnly.ids, ...ffSswAndHelix.ids, ...bothFF.ids], "FF-SSW (all)");
              }}
            />
          )}

          {/* FF-Helix nested circle (inside Helix, right) */}
          {regions.ffHelixTotal > 0 && (
            <circle
              cx={335}
              cy={180}
              r={50}
              fill={FF_HELIX_COLOR}
              fillOpacity={0.3}
              stroke={FF_HELIX_COLOR}
              strokeWidth={2}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                click([...ffHelixOnly.ids, ...sswAndFfHelix.ids, ...bothFF.ids], "FF-Helix (all)");
              }}
            />
          )}

          {/* ── Labels ── */}

          {/* SSW circle label */}
          <text x={110} y={75} textAnchor="middle" fontSize={12} fontWeight={600} fill={SSW_COLOR}>
            SSW ({regions.sswTotal})
          </text>

          {/* Helix circle label */}
          <text
            x={370}
            y={75}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill={HELIX_COLOR}
          >
            Helix ({regions.helixTotal})
          </text>

          {/* SSW-only count */}
          <text
            x={110}
            y={140}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="currentColor"
          >
            {sswOnlyPlain.ids.length}
          </text>
          <text x={110} y={155} textAnchor="middle" fontSize={9} fill="#666">
            SSW only ({pct(sswOnlyPlain.ids.length)}%)
          </text>

          {/* Helix-only count */}
          <text
            x={370}
            y={140}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="currentColor"
          >
            {helixOnlyPlain.ids.length}
          </text>
          <text x={370} y={155} textAnchor="middle" fontSize={9} fill="#666">
            Helix only ({pct(helixOnlyPlain.ids.length)}%)
          </text>

          {/* Overlap count */}
          <text
            x={240}
            y={130}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="currentColor"
            className="cursor-pointer"
            onClick={() => click(overlapIds, "SSW ∩ Helix (all)")}
          >
            {overlapIds.length}
          </text>
          <text
            x={240}
            y={145}
            textAnchor="middle"
            fontSize={9}
            fill="#666"
            className="cursor-pointer"
            onClick={() => click(overlapIds, "SSW ∩ Helix (all)")}
          >
            Both ({pct(overlapIds.length)}%)
          </text>

          {/* FF-SSW count */}
          {regions.ffSswTotal > 0 && (
            <>
              <text
                x={145}
                y={177}
                textAnchor="middle"
                fontSize={14}
                fontWeight={700}
                fill="currentColor"
              >
                {regions.ffSswTotal}
              </text>
              <text x={145} y={192} textAnchor="middle" fontSize={9} fill="#666">
                FF-SSW ({pct(regions.ffSswTotal)}%)
              </text>
            </>
          )}

          {/* FF-Helix count */}
          {regions.ffHelixTotal > 0 && (
            <>
              <text
                x={335}
                y={177}
                textAnchor="middle"
                fontSize={14}
                fontWeight={700}
                fill="currentColor"
              >
                {regions.ffHelixTotal}
              </text>
              <text x={335} y={192} textAnchor="middle" fontSize={9} fill="#666">
                FF-Helix ({pct(regions.ffHelixTotal)}%)
              </text>
            </>
          )}

          {/* Neither count */}
          <text x={50} y={40} textAnchor="middle" fontSize={12} fontWeight={600} fill="#999">
            {neither.ids.length}
          </text>
          <text x={50} y={53} textAnchor="middle" fontSize={9} fill="#999">
            Neither
          </text>
        </svg>
      </div>

      {/* Summary table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 px-2 font-medium text-muted-foreground">Region</th>
              <th className="text-right py-1 px-2 font-medium text-muted-foreground">Count</th>
              <th className="text-right py-1 px-2 font-medium text-muted-foreground">%</th>
            </tr>
          </thead>
          <tbody>
            {regions.all
              .filter((r) => r.ids.length > 0)
              .sort((a, b) => b.ids.length - a.ids.length)
              .map((r) => (
                <tr
                  key={r.label}
                  className="border-b cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => click(r.ids, r.label)}
                >
                  <td className="py-1 px-2 flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm shrink-0"
                      style={{
                        backgroundColor: r.color,
                        opacity: r.color === NEITHER_COLOR ? 0.4 : 0.6,
                      }}
                    />
                    {r.label}
                  </td>
                  <td className="py-1 px-2 text-right font-mono">{r.ids.length}</td>
                  <td className="py-1 px-2 text-right text-muted-foreground">
                    {pct(r.ids.length)}%
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] text-muted-foreground/60 text-center mt-1">
        Click any region or table row to view peptides.
      </p>
    </ExpandableChart>
  );
}
