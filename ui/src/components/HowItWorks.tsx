/**
 * HowItWorks — visual walkthrough for the landing page.
 *
 * Each card: icon, step label, title, 1-sentence description.
 * Designed for the "How it works" section below the hero.
 */

import {
  Upload,
  Cpu,
  Filter,
  BarChart3,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HowItWorksProps {
  className?: string;
}

const STEPS = [
  {
    step: "1",
    icon: Upload,
    title: "Paste or Upload",
    description:
      "Single sequence, CSV batch, FASTA file, or UniProt proteome query. Any input, same pipeline.",
    accent: "from-primary/20 to-primary/5",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    tooltip: null as string | null,
  },
  {
    step: "2",
    icon: Cpu,
    title: "Run Predictors",
    description:
      "S4PRED secondary structure, TANGO aggregation, and biochemical metrics run for every sequence.",
    accent: "from-purple-500/20 to-purple-500/5",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    tooltip: null,
  },
  {
    step: "3",
    icon: Filter,
    title: "Classify Fibril-formation candidates",
    description:
      "Apply dataset-derived thresholds to flag Helix, SSW, FF-Helix, and FF-SSW peptides.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/5",
    iconBg: "bg-fuchsia-500/10",
    iconColor: "text-fuchsia-500",
    tooltip: null,
  },
  {
    step: "4",
    icon: BarChart3,
    title: "Interactive Dashboard",
    description:
      "Classification analysis, distribution charts, correlation matrices, 3D structure overlay, and per-residue drill-down.",
    accent: "from-green-500/20 to-green-500/5",
    iconBg: "bg-green-500/10",
    iconColor: "text-green-500",
    tooltip: null,
  },
  {
    step: "5",
    icon: FileDown,
    title: "Export & Cite",
    description:
      "Download a publication-ready figure pack (SVG/PNG) or copy a reproducible permalink with auto-generated BibTeX.",
    accent: "from-amber-500/20 to-amber-500/5",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    tooltip: null,
  },
] as const;

export function HowItWorks({ className }: HowItWorksProps) {
  return (
    <div className={className} data-testid="how-it-works">
      {/* Heading */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
          How It Works
        </h2>
        <p className="text-lg text-muted-foreground leading-relaxed">
          From sequence to publication, step by step.
        </p>
      </div>

      {/* Step cards — Peleg 2026-06-07: step 2 split into 2a (raw predictors)
          and 2b (downstream FF gates), so 5 cards total. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {STEPS.map(({ step, icon: Icon, title, description, accent, iconBg, iconColor, tooltip }) => (
          <div
            key={step}
            className="relative rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 group hover:border-border transition-colors"
            data-testid={`how-step-${step}`}
            title={tooltip ?? undefined}
          >
            {/* Gradient accent top */}
            <div
              className={cn(
                "absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r",
                accent,
              )}
            />

            {/* Step number */}
            <span className="text-xs font-mono text-muted-foreground/50 mb-3 block">
              Step {step}
            </span>

            {/* Icon */}
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center mb-4",
                iconBg,
              )}
            >
              <Icon className={cn("h-6 w-6", iconColor)} />
            </div>

            {/* Content */}
            <h3 className="text-base font-semibold text-foreground mb-2">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
