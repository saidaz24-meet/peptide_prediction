/**
 * DatasetCreditCard — attribution card for the Staphylococcus 2023 benchmark
 * dataset.
 *
 * Released for public display 2026-05-08 with attribution per ADR-014. Used
 * internally for trust-signal benchmarks (predictor accuracy badges) and as
 * the demo dataset that auto-loads on first visit.
 *
 * Two layouts:
 *  - default: full card, mounted on the About page
 *  - compact: condensed strip, surfaced on the Help page near the
 *    forthcoming gold-standard accuracy badge
 */

import { Database, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEMO_DATASET_INFO } from "@/hooks/useDemoMode";

interface DatasetCreditCardProps {
  variant?: "default" | "compact";
  className?: string;
}

const STATS = {
  n: 2916,
  validated: 66,
  provider: "Dr. Peleg Ragonis-Bachar",
  affiliation: "Technion, 2023",
  releaseDate: "2026-05-08",
} as const;

export function DatasetCreditCard({
  variant = "default",
  className,
}: DatasetCreditCardProps) {
  const datasetName = DEMO_DATASET_INFO.name;

  if (variant === "compact") {
    return (
      <div
        className={`rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 ${className ?? ""}`}
        data-testid="dataset-credit-card-compact"
        aria-label="Staphylococcus 2023 dataset attribution"
      >
        <div className="flex items-start gap-2.5">
          <Database className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium text-foreground">
              {datasetName} benchmark
            </p>
            <p className="text-muted-foreground">
              N = {STATS.n.toLocaleString()} peptides ·{" "}
              {STATS.validated} experimentally validated · provided by{" "}
              <span className="text-foreground/80">{STATS.provider}</span> (
              {STATS.affiliation})
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card
      className={`shadow-soft border-[hsl(var(--border))] rounded-xl ${className ?? ""}`}
      data-testid="dataset-credit-card"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" aria-hidden="true" />
          <CardTitle>Staphylococcus 2023 benchmark</CardTitle>
        </div>
        <CardDescription>
          Reference dataset used for trust-signal benchmarks and the public
          demo. Released for public display per ADR-014.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Stat row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="text-xs font-mono"
            data-testid="dataset-stat-n"
          >
            N = {STATS.n.toLocaleString()} peptides
          </Badge>
          <Badge
            variant="secondary"
            className="text-xs font-mono"
            data-testid="dataset-stat-validated"
          >
            {STATS.validated} experimentally validated
          </Badge>
          <Badge variant="outline" className="text-xs">
            Released {STATS.releaseDate}
          </Badge>
        </div>

        {/* Provider line */}
        <p className="text-muted-foreground" data-testid="dataset-provider">
          Provided by{" "}
          <span className="font-medium text-foreground">{STATS.provider}</span>{" "}
          ({STATS.affiliation}).
        </p>

        {/* Description */}
        <p className="text-muted-foreground">
          Used internally for trust-signal benchmarks — the upcoming
          predictor accuracy badges read sensitivity and specificity directly
          off this dataset's threshold curves. Public attribution required for
          any downstream reference.
        </p>

        {/* External reference link */}
        <p className="pt-1 text-xs text-muted-foreground/80">
          <a
            href="https://www.uniprot.org/proteomes/UP000008816"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            data-testid="dataset-uniprot-link"
          >
            S. aureus reference proteome (UniProt)
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
