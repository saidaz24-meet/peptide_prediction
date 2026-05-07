/**
 * Shared peptide display component.
 *
 * Renders KPI tiles, SequenceTrack, HelicalWheel, S4PredChart,
 * AggregationHeatmap, and AlphaFoldViewer for a single peptide.
 *
 * Used by QuickAnalyze.tsx. PeptideDetail.tsx will adopt this after redesign.
 *
 * Peleg FIX-013: ConsensusCard tier system removed (certainty math
 * unjustified). See lib/consensus.ts header.
 */
import { AlertTriangle, Copy, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Peptide } from "@/types/peptide";
import { TangoBadge } from "@/components/TangoBadge";
import { SequenceTrack } from "@/components/SequenceTrack";
import { HelicalWheel } from "@/components/HelicalWheel";
import { AggregationHeatmap } from "@/components/AggregationHeatmap";
import { AlphaFoldViewer } from "@/components/AlphaFoldViewer";
import { S4PredChart } from "@/components/S4PredChart";
import { BiochemComparison, DEFAULT_PVL_METRICS } from "@/components/BiochemComparison";

interface PeptideViewerProps {
  peptide: Peptide;
}

export function PeptideViewer({ peptide: p }: PeptideViewerProps) {
  const handleCopySequence = () => {
    navigator.clipboard.writeText(p.sequence);
    toast.success("Sequence copied to clipboard");
  };

  const handleDownloadFASTA = () => {
    const header = `>${p.id}`;
    const wrapped = p.sequence.match(/.{1,80}/g)?.join("\n") ?? p.sequence;
    const fasta = `${header}\n${wrapped}\n`;
    const blob = new Blob([fasta], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${p.id}.fasta`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("FASTA downloaded");
  };

  return (
    <div className="space-y-6">
      {/* ── Header: Entry + Length + Badges + Actions ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-xl">
                {/^[A-Z][0-9][A-Z0-9]{3}[0-9](-\d+)?$/i.test(p.id) ? (
                  <a
                    href={`https://www.uniprot.org/uniprotkb/${p.id}/entry`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {p.id}
                  </a>
                ) : (
                  p.id
                )}
              </CardTitle>
              <CardDescription>{p.length ?? "?"} amino acids</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <TangoBadge
                providerStatus={p.providerStatus?.tango}
                sswPrediction={p.sswPrediction}
                hasTangoData={p.tangoHasData ?? false}
                showIcon
                sswContext={{ sswHelixPercentage: p.sswHelixPct, sswDiff: p.sswDiff }}
              />
              {/* S4PRED Helix value moved to BiochemComparison to avoid header duplication */}
              <Button variant="outline" size="sm" onClick={handleCopySequence}>
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadFASTA}>
                <Download className="w-4 h-4 mr-1" />
                FASTA
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SequenceTrack peptide={p} />
        </CardContent>
      </Card>

      {/* ── Sequence modification notice (ISSUE-024) ── */}
      {p.sequenceNotes && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)]">
          <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Sequence Modified</p>
            <p className="text-sm text-muted-foreground mt-0.5">{p.sequenceNotes}</p>
            {p.originalSequence && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Show original sequence
                </summary>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                  {p.originalSequence}
                </p>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Wave Q.1: KPI tile row replaced with the unified BiochemComparison.
          Quick Analyze (single sequence, no database) auto-falls back to the
          single-peptide empty-state via allPeptides.length < 2. */}
      <BiochemComparison peptide={p} allPeptides={[p]} stats={null} metrics={DEFAULT_PVL_METRICS} />

      {/* ── Helical Wheel ── */}
      {p.length != null && p.length <= 40 && (
        <Card>
          <CardHeader>
            <CardTitle>Helical Wheel Projection</CardTitle>
            <CardDescription>
              Schiffer-Edmundson axial view. The red arrow shows the hydrophobic moment direction.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <HelicalWheel sequence={p.sequence} />
          </CardContent>
        </Card>
      )}

      {/* ── S4PRED Per-Residue Probabilities ── */}
      <S4PredChart peptide={p} />

      {/* ── TANGO Aggregation Heatmap ── */}
      {p.tango?.agg && p.tango.agg.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>TANGO Aggregation Profile</CardTitle>
            <CardDescription>
              Per-residue aggregation propensity. Higher scores indicate regions with higher
              aggregation propensity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AggregationHeatmap
              sequence={p.sequence}
              aggCurve={p.tango.agg}
              betaCurve={p.tango.beta}
              helixCurve={p.tango.helix}
              peptideId={p.id}
            />
          </CardContent>
        </Card>
      )}

      {/* ── AlphaFold Viewer ── */}
      <AlphaFoldViewer peptideId={p.id} />

      {/* ── Interpretation guidance ──
          PELEG-FIX-015 (2026-05-07): auto-generated interpretive bullets
          replaced with a muted disclaimer. Peleg requested a live decision-
          tree review (slide 24) before the tool ships any interpretive
          claims. */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">
            Biological interpretation requires expert review. See the{" "}
            <a href="/help" className="underline hover:text-foreground">
              Help page
            </a>{" "}
            for metric definitions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
