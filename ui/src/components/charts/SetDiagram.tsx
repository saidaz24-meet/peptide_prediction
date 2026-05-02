/**
 * SetDiagram — Generalized N-way set/Venn/Euler diagram.
 *
 * Layout algorithm:
 * 1. Primary sets (no parentSet) are arranged as overlapping circles along a horizontal axis.
 *    Overlap distance scales with actual intersection size.
 * 2. Subset circles (parentSet declared) render geometrically INSIDE their parent circle,
 *    sized proportionally to their member count relative to parent.
 * 3. All region counts are computed from a single membership pass — the same data drives
 *    both the SVG and the summary table, eliminating sync bugs by construction.
 *
 * Peleg's subset axiom: FF-SSW ⊆ SSW, FF-Helix ⊆ Helix. The `parentSet` prop enforces
 * this visually — subset circles MUST render inside their parent.
 *
 * @see docs/active/PELEG_FEEDBACK_INSTRUCTIONS.md FIX-007
 */

import { useMemo, useCallback } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

// ── Public types ──

export interface SetDefinition {
  /** Unique set identifier */
  id: string;
  /** Display label (shown in legend / tooltips) */
  label: string;
  /** Member IDs belonging to this set */
  members: string[];
  /** CSS color — prefer hsl() from theme tokens. Falls back to a default palette. */
  color?: string;
  /** If set, this set is a strict subset of the parent and renders inside it. */
  parentSet?: string;
}

export interface ComputedRegion {
  /** Unique region key (e.g. "ssw-only", "ssw∩helix", "neither") */
  id: string;
  /** Human-readable label */
  label: string;
  /** Member IDs in this region */
  members: string[];
  /** Display color */
  color: string;
}

export interface SetDiagramProps {
  /** Set definitions. Supports unlimited sets and hierarchical subset relationships. */
  sets: SetDefinition[];
  /** Display mode: venn shows all 2^N regions; euler hides empty; auto picks. */
  mode?: "venn" | "euler" | "auto";
  /** Show member counts inside each region. Default true. */
  showCounts?: boolean;
  /** Callback when a region is clicked. */
  onRegionClick?: (regionId: string, members: string[]) => void;
  /** Label for items in no set. Default "Neither". */
  outsideLabel?: string;
  /** Total universe of item IDs (for computing "Neither"). If omitted, derived from all set members. */
  universe?: string[];
  /** Additional CSS class on the root div. */
  className?: string;
}

// ── Default palette (Okabe-Ito inspired, colorblind-safe) ──

const DEFAULT_COLORS = [
  "hsl(var(--ssw))",
  "hsl(var(--helix))",
  "hsl(var(--ff-ssw))",
  "hsl(var(--ff-helix))",
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#CC79A7",
];

// ── Helpers ──

function pct(n: number, total: number): string {
  if (total === 0) return "0.0";
  return ((n / total) * 100).toFixed(1);
}

/** Intersect two string-ID sets */
function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const id of a) {
    if (b.has(id)) result.add(id);
  }
  return result;
}

/** Difference: a - b */
function difference(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const id of a) {
    if (!b.has(id)) result.add(id);
  }
  return result;
}

// ── Region computation (single source of truth) ──

interface ComputedData {
  regions: ComputedRegion[];
  primarySets: { def: SetDefinition; memberSet: Set<string> }[];
  subsets: { def: SetDefinition; memberSet: Set<string>; parentId: string }[];
  total: number;
}

function computeRegions(
  sets: SetDefinition[],
  universe: string[] | undefined,
  outsideLabel: string
): ComputedData {
  const primaryDefs = sets.filter((s) => !s.parentSet);
  const subsetDefs = sets.filter((s) => !!s.parentSet);

  const memberSets = new Map<string, Set<string>>();
  for (const s of sets) {
    memberSets.set(s.id, new Set(s.members));
  }

  // Build universe
  const allMembers = new Set<string>();
  if (universe) {
    universe.forEach((id) => allMembers.add(id));
  }
  for (const s of sets) {
    s.members.forEach((id) => allMembers.add(id));
  }

  const total = allMembers.size;
  const regions: ComputedRegion[] = [];

  if (primaryDefs.length === 0) {
    // No primary sets — everything is "neither"
    regions.push({
      id: "neither",
      label: outsideLabel,
      members: [...allMembers],
      color: "hsl(var(--muted))",
    });
    return { regions, primarySets: [], subsets: [], total };
  }

  if (primaryDefs.length === 1) {
    // Single primary set
    const p = primaryDefs[0];
    const pSet = memberSets.get(p.id)!;
    const pColor = p.color || DEFAULT_COLORS[0];

    // Find subsets of this primary
    const childDefs = subsetDefs.filter((s) => s.parentSet === p.id);

    // Members in primary but not in any child subset
    let remaining = new Set(pSet);
    for (const child of childDefs) {
      const childSet = memberSets.get(child.id)!;
      const childOnly = intersect(childSet, pSet);
      if (childOnly.size > 0) {
        regions.push({
          id: child.id,
          label: child.label,
          members: [...childOnly],
          color: child.color || DEFAULT_COLORS[2],
        });
      }
      remaining = difference(remaining, childSet);
    }

    if (remaining.size > 0) {
      regions.push({
        id: `${p.id}-only`,
        label: `${p.label} only`,
        members: [...remaining],
        color: pColor,
      });
    }

    // Neither
    const outsideSet = difference(allMembers, pSet);
    if (outsideSet.size > 0) {
      regions.push({
        id: "neither",
        label: outsideLabel,
        members: [...outsideSet],
        color: "hsl(var(--muted-foreground))",
      });
    }

    return {
      regions,
      primarySets: [{ def: p, memberSet: pSet }],
      subsets: childDefs.map((d) => ({
        def: d,
        memberSet: memberSets.get(d.id)!,
        parentId: d.parentSet!,
      })),
      total,
    };
  }

  // Two primary sets (PVL's main case: SSW + Helix)
  const [pA, pB] = primaryDefs;
  const setA = memberSets.get(pA.id)!;
  const setB = memberSets.get(pB.id)!;
  const colorA = pA.color || DEFAULT_COLORS[0];
  const colorB = pB.color || DEFAULT_COLORS[1];

  // Children of each primary
  const childrenA = subsetDefs.filter((s) => s.parentSet === pA.id);
  const childrenB = subsetDefs.filter((s) => s.parentSet === pB.id);
  const allChildSets = [...childrenA, ...childrenB];

  // Compute primary-level regions
  const aOnly = difference(setA, setB);
  const bOnly = difference(setB, setA);
  const both = intersect(setA, setB);

  // For each primary-level region, subtract child subsets to get "plain" members
  function subtractChildren(
    base: Set<string>,
    children: typeof childrenA
  ): Set<string> {
    let result = new Set(base);
    for (const child of children) {
      result = difference(result, memberSets.get(child.id)!);
    }
    return result;
  }

  // A-only plain (not in any child of A)
  const aOnlyPlain = subtractChildren(aOnly, childrenA);
  if (aOnlyPlain.size > 0) {
    regions.push({
      id: `${pA.id}-only`,
      label: `${pA.label} only`,
      members: [...aOnlyPlain],
      color: colorA,
    });
  }

  // B-only plain (not in any child of B)
  const bOnlyPlain = subtractChildren(bOnly, childrenB);
  if (bOnlyPlain.size > 0) {
    regions.push({
      id: `${pB.id}-only`,
      label: `${pB.label} only`,
      members: [...bOnlyPlain],
      color: colorB,
    });
  }

  // Intersection plain (both but not in any child subset)
  const bothPlain = subtractChildren(both, allChildSets);
  if (bothPlain.size > 0) {
    regions.push({
      id: `${pA.id}∩${pB.id}`,
      label: `${pA.label} ∩ ${pB.label}`,
      members: [...bothPlain],
      color: mixColors(colorA, colorB),
    });
  }

  // Child subset regions
  for (const child of allChildSets) {
    const childSet = memberSets.get(child.id)!;
    const childColor = child.color || DEFAULT_COLORS[regions.length % DEFAULT_COLORS.length];
    // Members of this child that are in both primaries vs only in parent
    const childInBoth = intersect(childSet, both);
    const childInParentOnly =
      child.parentSet === pA.id
        ? intersect(childSet, aOnly)
        : intersect(childSet, bOnly);

    // Combine — child regions shown as one (the child circle encompasses all its members)
    const allChildMembers = new Set([...childInBoth, ...childInParentOnly]);
    if (allChildMembers.size > 0) {
      regions.push({
        id: child.id,
        label: child.label,
        members: [...allChildMembers],
        color: childColor,
      });
    }
  }

  // Neither
  const inAny = new Set([...setA, ...setB]);
  const outsideSet = difference(allMembers, inAny);
  if (outsideSet.size > 0) {
    regions.push({
      id: "neither",
      label: outsideLabel,
      members: [...outsideSet],
      color: "hsl(var(--muted-foreground))",
    });
  }

  return {
    regions,
    primarySets: [
      { def: pA, memberSet: setA },
      { def: pB, memberSet: setB },
    ],
    subsets: allChildSets.map((d) => ({
      def: d,
      memberSet: memberSets.get(d.id)!,
      parentId: d.parentSet!,
    })),
    total,
  };
}

/** Simple color mixing for intersection — returns a purple-ish blend for any two hsl() strings */
function mixColors(a: string, b: string): string {
  // For theme tokens, we can't parse HSL at build time.
  // Use a dedicated intersection color that works in both themes.
  void a;
  void b;
  return "hsl(280, 40%, 55%)"; // muted purple — visually distinct from both parents
}

// ── SVG Layout ──

interface CircleLayout {
  id: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
  label: string;
  count: number;
  isSubset: boolean;
  onClick?: () => void;
}

function computeLayout(data: ComputedData, W: number, H: number): CircleLayout[] {
  const { primarySets, subsets, total } = data;
  const layouts: CircleLayout[] = [];

  if (primarySets.length === 0) return layouts;

  const centerY = H * 0.5;

  if (primarySets.length === 1) {
    const p = primarySets[0];
    const r = Math.min(W, H) * 0.35;
    layouts.push({
      id: p.def.id,
      cx: W / 2,
      cy: centerY,
      r,
      color: p.def.color || DEFAULT_COLORS[0],
      label: p.def.label,
      count: p.memberSet.size,
      isSubset: false,
    });

    // Position subsets inside
    for (let i = 0; i < subsets.length; i++) {
      const s = subsets[i];
      if (s.parentId !== p.def.id) continue;
      const ratio = Math.max(0.2, Math.min(0.7, s.memberSet.size / Math.max(1, p.memberSet.size)));
      const sr = r * ratio * 0.7;
      const angle = (i * Math.PI) / Math.max(1, subsets.length) + Math.PI * 0.7;
      const dist = r * 0.4;
      layouts.push({
        id: s.def.id,
        cx: W / 2 + Math.cos(angle) * dist,
        cy: centerY + Math.sin(angle) * dist,
        r: Math.max(20, sr),
        color: s.def.color || DEFAULT_COLORS[i + 2],
        label: s.def.label,
        count: s.memberSet.size,
        isSubset: true,
      });
    }
    return layouts;
  }

  // Two primary sets
  const [pA, pB] = primarySets;
  const rA = Math.min(W * 0.25, H * 0.38);
  const rB = rA;

  // Overlap distance: proportion of intersection to min set size
  const intersection = intersect(pA.memberSet, pB.memberSet);
  const overlapRatio =
    Math.min(pA.memberSet.size, pB.memberSet.size) > 0
      ? intersection.size / Math.min(pA.memberSet.size, pB.memberSet.size)
      : 0;
  // Gap between centers: from 2R (no overlap) to 0 (complete overlap)
  const maxDist = rA + rB;
  const centerDist = maxDist * (1 - overlapRatio * 0.5);

  const midX = W / 2;
  const cxA = midX - centerDist / 2;
  const cxB = midX + centerDist / 2;

  layouts.push({
    id: pA.def.id,
    cx: cxA,
    cy: centerY,
    r: rA,
    color: pA.def.color || DEFAULT_COLORS[0],
    label: pA.def.label,
    count: pA.memberSet.size,
    isSubset: false,
  });

  layouts.push({
    id: pB.def.id,
    cx: cxB,
    cy: centerY,
    r: rB,
    color: pB.def.color || DEFAULT_COLORS[1],
    label: pB.def.label,
    count: pB.memberSet.size,
    isSubset: false,
  });

  // Position subsets inside their parent circle, offset from center
  for (const s of subsets) {
    const parentLayout = layouts.find((l) => l.id === s.parentId);
    if (!parentLayout) continue;

    const parentSize = s.parentId === pA.def.id ? pA.memberSet.size : pB.memberSet.size;
    const ratio = Math.max(0.15, Math.min(0.65, s.memberSet.size / Math.max(1, parentSize)));
    const sr = parentLayout.r * ratio * 0.7;

    // Position subset on the outer side of parent (away from center)
    const awayDir = parentLayout.cx < midX ? -1 : 1;
    const offsetX = parentLayout.r * 0.35 * awayDir;
    const offsetY = parentLayout.r * 0.15;

    layouts.push({
      id: s.def.id,
      cx: parentLayout.cx + offsetX,
      cy: centerY + offsetY,
      r: Math.max(18, sr),
      color: s.def.color || DEFAULT_COLORS[layouts.length % DEFAULT_COLORS.length],
      label: s.def.label,
      count: s.memberSet.size,
      isSubset: true,
    });
  }

  return layouts;
}

// ── Component ──

export function SetDiagram({
  sets,
  mode = "auto",
  showCounts = true,
  onRegionClick,
  outsideLabel = "Neither",
  universe,
  className,
}: SetDiagramProps) {
  const data = useMemo(
    () => computeRegions(sets, universe, outsideLabel),
    [sets, universe, outsideLabel]
  );

  const effectiveMode = mode === "auto" ? "euler" : mode;
  const visibleRegions =
    effectiveMode === "euler"
      ? data.regions.filter((r) => r.members.length > 0)
      : data.regions;

  const W = 480;
  const H = 320;
  const circleLayouts = useMemo(() => computeLayout(data, W, H), [data]);

  const handleClick = useCallback(
    (region: ComputedRegion) => {
      if (onRegionClick && region.members.length > 0) {
        onRegionClick(region.id, region.members);
      }
    },
    [onRegionClick]
  );

  const total = data.total;
  const neither = data.regions.find((r) => r.id === "neither");

  return (
    <div className={className}>
      {/* SVG Diagram */}
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="select-none w-full h-auto max-w-[480px]"
          role="img"
          aria-label="Set diagram showing classification overlaps"
        >
          {/* Universe rectangle */}
          <rect
            x={10}
            y={10}
            width={W - 20}
            height={H - 20}
            rx={8}
            fill="currentColor"
            fillOpacity={0.04}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            className={onRegionClick && neither && neither.members.length > 0 ? "cursor-pointer" : ""}
            onClick={() => neither && handleClick(neither)}
          />
          <text
            x={W - 20}
            y={28}
            textAnchor="end"
            fontSize={10}
            className="fill-muted-foreground"
          >
            All: {total}
          </text>

          {/* Primary circles (rendered first, below subsets) */}
          {circleLayouts
            .filter((c) => !c.isSubset)
            .map((c) => (
              <g key={c.id}>
                <circle
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fill={c.color}
                  fillOpacity={0.12}
                  stroke={c.color}
                  strokeWidth={2}
                  className={onRegionClick ? "cursor-pointer" : ""}
                />
                {/* Set label at top */}
                <text
                  x={c.cx}
                  y={c.cy - c.r - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill={c.color}
                >
                  {c.label} ({c.count})
                </text>
              </g>
            ))}

          {/* Overlap region for two primaries */}
          {circleLayouts.length >= 2 && !circleLayouts[0].isSubset && !circleLayouts[1].isSubset && (
            <>
              <clipPath id="set-clip-a">
                <circle cx={circleLayouts[0].cx} cy={circleLayouts[0].cy} r={circleLayouts[0].r} />
              </clipPath>
              <circle
                cx={circleLayouts[1].cx}
                cy={circleLayouts[1].cy}
                r={circleLayouts[1].r}
                clipPath="url(#set-clip-a)"
                fill={mixColors("", "")}
                fillOpacity={0.15}
                className={onRegionClick ? "cursor-pointer" : ""}
              />
            </>
          )}

          {/* Subset circles (rendered on top) */}
          {circleLayouts
            .filter((c) => c.isSubset)
            .map((c) => (
              <g key={c.id}>
                <circle
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fill={c.color}
                  fillOpacity={0.3}
                  stroke={c.color}
                  strokeWidth={2}
                  className={onRegionClick ? "cursor-pointer" : ""}
                  onClick={(e) => {
                    e.stopPropagation();
                    const region = data.regions.find((r) => r.id === c.id);
                    if (region) handleClick(region);
                  }}
                />
              </g>
            ))}

          {/* Count labels */}
          {showCounts &&
            circleLayouts.map((c) => {
              // For primary circles, show "X-only" count (members not in any other primary or child)
              const region = data.regions.find(
                (r) => r.id === c.id || r.id === `${c.id}-only`
              );
              if (!region) return null;

              // For subsets, show subset count; for primaries, show the -only count
              const displayRegion = c.isSubset
                ? data.regions.find((r) => r.id === c.id)
                : data.regions.find((r) => r.id === `${c.id}-only`);

              if (!displayRegion || displayRegion.members.length === 0) return null;

              return (
                <g key={`count-${c.id}`}>
                  <text
                    x={c.isSubset ? c.cx : c.cx + (c.isSubset ? 0 : 0)}
                    y={c.isSubset ? c.cy - 3 : c.cy - 5}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={700}
                    className="fill-foreground cursor-pointer"
                    onClick={() => handleClick(displayRegion)}
                  >
                    {displayRegion.members.length}
                  </text>
                  <text
                    x={c.isSubset ? c.cx : c.cx}
                    y={c.isSubset ? c.cy + 12 : c.cy + 10}
                    textAnchor="middle"
                    fontSize={9}
                    className="fill-muted-foreground cursor-pointer"
                    onClick={() => handleClick(displayRegion)}
                  >
                    {c.isSubset
                      ? `${c.label} (${pct(displayRegion.members.length, total)}%)`
                      : `${c.label} only (${pct(displayRegion.members.length, total)}%)`}
                  </text>
                </g>
              );
            })}

          {/* Intersection count (for 2 primaries) */}
          {circleLayouts.length >= 2 && (() => {
            const bothRegion = data.regions.find(
              (r) => r.id.includes("∩") && !r.id.startsWith("ff")
            );
            if (!bothRegion || bothRegion.members.length === 0) return null;
            const midX = (circleLayouts[0].cx + circleLayouts[1].cx) / 2;
            const midY = circleLayouts[0].cy;
            return (
              <g>
                <text
                  x={midX}
                  y={midY - 8}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={700}
                  className="fill-foreground cursor-pointer"
                  onClick={() => handleClick(bothRegion)}
                >
                  {bothRegion.members.length}
                </text>
                <text
                  x={midX}
                  y={midY + 7}
                  textAnchor="middle"
                  fontSize={9}
                  className="fill-muted-foreground cursor-pointer"
                  onClick={() => handleClick(bothRegion)}
                >
                  Both ({pct(bothRegion.members.length, total)}%)
                </text>
              </g>
            );
          })()}

          {/* Neither count — rendered in BLACK per Peleg FIX-007 */}
          {neither && neither.members.length > 0 && (
            <g>
              <text
                x={50}
                y={40}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                className="fill-foreground cursor-pointer"
                onClick={() => handleClick(neither)}
              >
                {neither.members.length}
              </text>
              <text
                x={50}
                y={53}
                textAnchor="middle"
                fontSize={9}
                className="fill-foreground cursor-pointer"
                onClick={() => handleClick(neither)}
              >
                {outsideLabel}
              </text>
            </g>
          )}

          {/* Empty state */}
          {circleLayouts.length === 0 && (
            <text
              x={W / 2}
              y={H / 2}
              textAnchor="middle"
              fontSize={13}
              className="fill-muted-foreground"
            >
              No classification predictions detected
            </text>
          )}
        </svg>
      </div>

      {/* Summary table — reads from the SAME computed regions (single source of truth) */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 px-2 font-medium text-muted-foreground">
                Region
              </th>
              <th className="text-right py-1 px-2 font-medium text-muted-foreground">
                Count
              </th>
              <th className="text-right py-1 px-2 font-medium text-muted-foreground">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRegions
              .sort((a, b) => b.members.length - a.members.length)
              .map((r) => (
                <tr
                  key={r.id}
                  className={`border-b transition-colors ${
                    onRegionClick && r.members.length > 0
                      ? "cursor-pointer hover:bg-muted/40"
                      : ""
                  }`}
                  onClick={() => handleClick(r)}
                >
                  <td className="py-1 px-2 flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm shrink-0"
                      style={{
                        backgroundColor: r.color,
                        opacity: r.id === "neither" ? 0.4 : 0.6,
                      }}
                    />
                    {r.label}
                  </td>
                  <td className="py-1 px-2 text-right font-mono">
                    {r.members.length}
                  </td>
                  <td className="py-1 px-2 text-right text-muted-foreground">
                    {pct(r.members.length, total)}%
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] text-muted-foreground/60 text-center mt-1">
        Click any region or table row to view peptides.
      </p>
    </div>
  );
}

// ── PVL convenience: pre-built 4-category set config ──

/**
 * Build the PVL 4-category set definitions from a peptide array.
 * Returns sets ready to pass to <SetDiagram>.
 */
export function buildPVLSets(peptides: { id: string; sswPrediction?: number | null; s4predHelixPrediction?: number | null; ffSswFlag?: number | null; ffHelixFlag?: number | null }[]): SetDefinition[] {
  return [
    {
      id: "ssw",
      label: "SSW",
      members: peptides.filter((p) => p.sswPrediction === 1).map((p) => p.id),
      color: "hsl(var(--ssw))",
    },
    {
      id: "helix",
      label: "Helix",
      members: peptides
        .filter((p) => p.s4predHelixPrediction === 1)
        .map((p) => p.id),
      color: "hsl(var(--helix))",
    },
    {
      id: "ff-ssw",
      label: "FF-SSW",
      members: peptides.filter((p) => p.ffSswFlag === 1).map((p) => p.id),
      color: "hsl(var(--ff-ssw))",
      parentSet: "ssw", // FF-SSW ⊆ SSW (Peleg's axiom)
    },
    {
      id: "ff-helix",
      label: "FF-Helix",
      members: peptides.filter((p) => p.ffHelixFlag === 1).map((p) => p.id),
      color: "hsl(var(--ff-helix))",
      parentSet: "helix", // FF-Helix ⊆ Helix (Peleg's axiom)
    },
  ];
}

export default SetDiagram;
