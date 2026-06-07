/**
 * DemoCoachmark — PVL-themed react-joyride guided tour.
 *
 * V8-1 redesign:
 * - Custom tooltip matching PVL design system (bg-card, border-border, shadow-lg)
 * - Beacon: primary color, 16px pulsing dot
 * - Progress: "Step N of M"
 * - Buttons styled like shadcn Button (primary + ghost)
 * - Sentry tagging on completion/skip
 *
 * Each step targets an element by `id` selector. Missing targets are silently
 * dropped so the tour never strands the user on a missing anchor.
 */

import { useCallback, useEffect, useState } from "react";
import { Joyride, STATUS, type EventData, type Step, type TooltipRenderProps } from "react-joyride";
import * as Sentry from "@sentry/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Tour steps
// ---------------------------------------------------------------------------

const ALL_STEPS: Step[] = [
  {
    target: "#kpi-cards",
    title: "Dataset Overview",
    content:
      "Four symmetric KPI cards show the dataset breakdown across Peleg's classes — Helix · FF-Helix · SSW · FF-SSW. Click any card to filter the table to that class.",
    skipBeacon: true,
  },
  {
    target: "#set-diagram",
    title: "Classification Landscape",
    content:
      "The Set Diagram visualizes overlap between classification groups. Click any region to filter peptides.",
  },
  {
    target: "#smart-ranking",
    title: "Smart Ranking",
    content:
      "Adjust metric weights to surface candidates. Try the 'Helix Focus' preset for fibril-forming peptides.",
  },
  {
    target: "#peptide-detail-link",
    title: "Peptide Detail",
    content:
      "Click any row to open the peptide inspector — per-residue charts, 3D structure, and full predictions.",
  },
  {
    target: "#reproducibility-ribbon",
    title: "Reproducibility",
    content:
      "Every analysis generates a permalink. Share it — your reviewers see the exact same view you analyzed.",
  },
];

// ---------------------------------------------------------------------------
// Custom tooltip — PVL design system
// ---------------------------------------------------------------------------

function PVLTooltip({
  step,
  index,
  size,
  isLastStep,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="w-80 rounded-xl border border-border bg-card shadow-lg overflow-hidden"
      data-testid="coachmark-tooltip"
    >
      {/* Accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-primary via-purple-500 to-primary/60" />

      {/* Close */}
      <button
        {...closeProps}
        className="absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 transition-colors"
        aria-label="Close tour"
        data-testid="coachmark-close"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="px-4 pt-3 pb-4">
        {/* Title */}
        {step.title && (
          <h3 className="text-sm font-semibold text-foreground mb-1 pr-6">
            {step.title as string}
          </h3>
        )}

        {/* Body */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {step.content as string}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70" data-testid="coachmark-progress">
            Step {index + 1} of {size}
          </span>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                {...backProps}
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                data-testid="coachmark-back"
              >
                Back
              </Button>
            )}
            <Button
              {...primaryProps}
              variant="default"
              size="sm"
              className="h-7 text-xs"
              data-testid="coachmark-next"
            >
              {isLastStep ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DemoCoachmarkProps {
  run: boolean;
  onComplete: () => void;
}

export function DemoCoachmark({ run, onComplete }: DemoCoachmarkProps) {
  // Resolve which steps have a live target in the DOM
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    if (!run) {
      setSteps([]);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      const present = ALL_STEPS.filter((s) => {
        if (typeof s.target !== "string") return true;
        return document.querySelector(s.target) != null;
      });
      setSteps(present);
    });
    return () => window.cancelAnimationFrame(id);
  }, [run]);

  const handleEvent = useCallback(
    (data: EventData) => {
      const status = data.status;
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        try {
          Sentry.setTag("coachmark_completed", "true");
          Sentry.setTag("coachmark_outcome", status === STATUS.FINISHED ? "finished" : "skipped");
        } catch {
          // Sentry may be uninitialized in dev/tests
        }
        onComplete();
      }
    },
    [onComplete]
  );

  if (!run || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      onEvent={handleEvent}
      tooltipComponent={PVLTooltip}
      options={{
        showProgress: false,
        primaryColor: "hsl(var(--primary))",
        backgroundColor: "hsl(var(--card))",
        textColor: "hsl(var(--foreground))",
        zIndex: 10_000,
        skipBeacon: false,
        beaconSize: 16,
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  );
}
