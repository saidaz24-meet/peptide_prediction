/**
 * ActiveThresholdsPanel — Premium v2 redesign
 *
 * Read-only summary of the 9 active thresholds grouped into 4 columns:
 *   1. General SS   2. Helical   3. SSW   4. Fibril-formation
 *
 * Design: Bloomberg/Stripe/Linear quality — proper Card container, collapsible
 * via framer-motion, per-threshold modified dots, hover affordance, and
 * value-change highlight animation.
 *
 * Reads from `useThresholdStore`. Recomputes whenever the active set changes.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { Sliders, ChevronDown, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useThresholdStore } from "@/stores/thresholdStore";
import { DEFAULT_THRESHOLDS, type ResolvedThresholds } from "@/lib/thresholds";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Keys from Groups 1-4 only (not legacy fields) */
type ThresholdKey =
  | "minSegmentLength"
  | "maxGap"
  | "minS4predHelixScore"
  | "minHelixPercentContent"
  | "s4predMaxHelixBetaDiff"
  | "tangoMaxHelixBetaDiff"
  | "minSsPercentContent"
  | "muHCutoff"
  | "hydroCutoff";

interface Row {
  key: ThresholdKey;
  label: string;
  value: string;
  hint: string;
  isModified: boolean;
}

interface Group {
  title: string;
  rows: Row[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatNumber(n: number, digits = 2): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(digits);
}

/** Compare a single threshold value against its default */
function isThresholdModified(
  key: ThresholdKey,
  active: ResolvedThresholds,
  original: ResolvedThresholds
): boolean {
  return active[key] !== original[key];
}

/** Hook to track the previous value of a variable */
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/* ------------------------------------------------------------------ */
/*  Threshold row with change-highlight animation                      */
/* ------------------------------------------------------------------ */

function ThresholdRow({ row }: { row: Row }) {
  const prevValue = usePrevious(row.value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevValue !== undefined && prevValue !== row.value) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [row.value, prevValue]);

  return (
    <motion.li
      className="group/row relative flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
      animate={{
        backgroundColor: flash ? "hsl(var(--warning) / 0.12)" : "hsl(0 0% 0% / 0)",
      }}
      transition={{ duration: flash ? 0.15 : 1.2, ease: "easeOut" }}
    >
      {/* Label + info tooltip */}
      <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <span className="truncate">{row.label}</span>
        <UITooltip>
          <TooltipTrigger asChild>
            <Info
              className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/40 transition-colors group-hover/row:text-muted-foreground/70"
              aria-label={`${row.label} info`}
            />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
            {row.hint}
          </TooltipContent>
        </UITooltip>
      </span>

      {/* Value + modified dot */}
      <UITooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 items-center gap-1.5 cursor-default">
            <span className="font-mono tabular-nums text-foreground decoration-muted-foreground/30 underline-offset-2 transition-all group-hover/row:underline">
              {row.value}
            </span>
            {row.isModified && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                aria-label="Modified from default"
              />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Adjust in the Thresholds panel below
        </TooltipContent>
      </UITooltip>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */

export function ActiveThresholdsPanel() {
  const { active, original } = useThresholdStore();
  const [collapsed, setCollapsed] = useState(false);

  /* Build group data */
  const groups: Group[] = useMemo(
    () => [
      {
        title: "General SS",
        rows: [
          {
            key: "minSegmentLength" as ThresholdKey,
            label: "Min continuous residues",
            value: formatNumber(active.minSegmentLength, 0),
            hint: "Minimum consecutive residues to count as a segment.",
            isModified: isThresholdModified("minSegmentLength", active, original),
          },
          {
            key: "maxGap" as ThresholdKey,
            label: "Maximum gap",
            value: formatNumber(active.maxGap, 0),
            hint: "Mismatched residues allowed inside a segment stretch.",
            isModified: isThresholdModified("maxGap", active, original),
          },
        ],
      },
      {
        title: "Helical",
        rows: [
          {
            key: "minS4predHelixScore" as ThresholdKey,
            label: "Min S4PRED helix score",
            value: formatNumber(active.minS4predHelixScore, 2),
            hint: "Minimum average reliability of S4PRED alpha-helix prediction.",
            isModified: isThresholdModified("minS4predHelixScore", active, original),
          },
          {
            key: "minHelixPercentContent" as ThresholdKey,
            label: "Min % helix content",
            value: `${formatNumber(active.minHelixPercentContent, 0)}%`,
            hint: "Minimum percentage of residues predicted helical.",
            isModified: isThresholdModified("minHelixPercentContent", active, original),
          },
        ],
      },
      {
        title: "SSW",
        rows: [
          {
            key: "s4predMaxHelixBetaDiff" as ThresholdKey,
            label: "S4PRED helix-beta diff",
            value: formatNumber(active.s4predMaxHelixBetaDiff, 2),
            hint: "Maximum alpha-helix vs beta prediction-score difference (S4PRED).",
            isModified: isThresholdModified("s4predMaxHelixBetaDiff", active, original),
          },
          {
            key: "tangoMaxHelixBetaDiff" as ThresholdKey,
            label: "TANGO helix-beta diff",
            value: formatNumber(active.tangoMaxHelixBetaDiff, 2),
            hint: "Maximum alpha-helix vs beta prediction-score difference (TANGO).",
            isModified: isThresholdModified("tangoMaxHelixBetaDiff", active, original),
          },
          {
            key: "minSsPercentContent" as ThresholdKey,
            label: "Min % SS content",
            value: `${formatNumber(active.minSsPercentContent, 0)}%`,
            hint: "Minimum percentage of residues predicted as SS-switch.",
            isModified: isThresholdModified("minSsPercentContent", active, original),
          },
        ],
      },
      {
        title: "Fibril-formation",
        rows: [
          {
            key: "muHCutoff" as ThresholdKey,
            label: "Hydrophobic moment (µH)",
            value: formatNumber(active.muHCutoff, 2),
            hint: "Minimum µH for FF-Helix classification (range 0-3.26). Hydrophobic parameters by Fauchère & Pliska 1983.",
            isModified: isThresholdModified("muHCutoff", active, original),
          },
          {
            key: "hydroCutoff" as ThresholdKey,
            label: "Hydrophobicity",
            value: formatNumber(active.hydroCutoff, 2),
            hint: "Minimum hydrophobicity for FF-SSW classification (range -1.01-2.25).",
            isModified: isThresholdModified("hydroCutoff", active, original),
          },
        ],
      },
    ],
    [active, original]
  );

  /** Count how many individual thresholds differ from the original/server values */
  const modifiedCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.rows.filter((r) => r.isModified).length, 0),
    [groups]
  );

  return (
    <Card className="border-[hsl(var(--border))] bg-card shadow-sm">
      {/* ---- Header ---- */}
      <CardHeader className="flex-row items-center justify-between space-y-0 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
            <Sliders className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground leading-none">
                Active thresholds
              </h3>
              {modifiedCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium tabular-nums text-amber-600 dark:text-amber-400">
                  {modifiedCount} user-set
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground/70">Adjust in the Thresholds panel below</p>
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand thresholds" : "Collapse thresholds"}
        >
          <motion.div
            animate={{ rotate: collapsed ? -180 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </button>
      </CardHeader>

      {/* ---- Collapsible content ---- */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="thresholds-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <CardContent className="px-6 pb-5 pt-0">
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {groups.map((group) => (
                    <div key={group.title}>
                      {/* Group header */}
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {group.title}
                      </p>
                      {/* Threshold rows */}
                      <ul className="space-y-1">
                        {group.rows.map((row) => (
                          <ThresholdRow key={row.key} row={row} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
