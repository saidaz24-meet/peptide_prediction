/**
 * ActiveThresholdsPanel (Peleg FIX-032)
 *
 * Read-only summary of the 9 active thresholds. Lives above the KPI row on the
 * Results page so users see exactly which values drive the classifications.
 *
 * Subtitle: "Active thresholds — adjust in the Thresholds panel" (per Peleg
 * directive, slide 33).
 *
 * Reads from `useThresholdStore`. Recomputes whenever the active set changes.
 */
import { Sliders, Info } from "lucide-react";
import { useThresholdStore } from "@/stores/thresholdStore";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Row {
  label: string;
  value: string;
  hint: string;
}

function formatNumber(n: number, digits = 2): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(digits);
}

export function ActiveThresholdsPanel() {
  const { active, isModified } = useThresholdStore();

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "General secondary structure",
      rows: [
        {
          label: "Minimal continuous residues",
          value: formatNumber(active.minSegmentLength, 0),
          hint: "Minimum consecutive residues to count as a segment.",
        },
        {
          label: "Maximum gap",
          value: formatNumber(active.maxGap, 0),
          hint: "Mismatched residues allowed inside a segment stretch.",
        },
      ],
    },
    {
      title: "Helical",
      rows: [
        {
          label: "Minimal S4PRED helix score",
          value: formatNumber(active.minS4predHelixScore, 2),
          hint: "Minimum average reliability of S4PRED α-helix prediction.",
        },
        {
          label: "Minimal % helix content",
          value: `${formatNumber(active.minHelixPercentContent, 0)}%`,
          hint: "Minimum percentage of residues predicted helical.",
        },
      ],
    },
    {
      title: "Secondary structure switch",
      rows: [
        {
          label: "S4PRED max helix–beta diff",
          value: formatNumber(active.s4predMaxHelixBetaDiff, 2),
          hint: "Maximum α-helix vs β prediction-score difference (S4PRED).",
        },
        {
          label: "TANGO max helix–beta diff",
          value: formatNumber(active.tangoMaxHelixBetaDiff, 2),
          hint: "Maximum α-helix vs β prediction-score difference (TANGO).",
        },
        {
          label: "Minimal % SS content",
          value: `${formatNumber(active.minSsPercentContent, 0)}%`,
          hint: "Minimum percentage of residues predicted as SS-switch.",
        },
      ],
    },
    {
      title: "Fibril-formation",
      rows: [
        {
          label: "uH (Hydrophobic moment)",
          value: formatNumber(active.muHCutoff, 2),
          hint: "Minimum uH for FF-Helix classification (range 0–3.26).",
        },
        {
          label: "Hydrophobicity",
          value: formatNumber(active.hydroCutoff, 2),
          hint: "Minimum hydrophobicity for FF-SSW classification (range −1.01–2.25).",
        },
      ],
    },
  ];

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Active thresholds</h3>
          {isModified && (
            <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5">
              User-set
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Active thresholds — adjust in the Thresholds panel below.
        </p>
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {groups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-semibold">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.rows.map((row) => (
                  <li key={row.label} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1 min-w-0">
                      <span className="truncate">{row.label}</span>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info
                            className="h-3 w-3 text-muted-foreground/50 shrink-0 cursor-help"
                            aria-label={`${row.label} info`}
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[260px] text-xs leading-relaxed"
                        >
                          {row.hint}
                        </TooltipContent>
                      </UITooltip>
                    </span>
                    <span className="font-mono tabular-nums text-foreground">{row.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
