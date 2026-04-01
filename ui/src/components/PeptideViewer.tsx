/**
 * Shared peptide display component.
 *
 * Renders KPI tiles, SequenceTrack, ConsensusCard, HelicalWheel,
 * S4PredChart, AggregationHeatmap, and AlphaFoldViewer for a single peptide.
 *
 * Used by QuickAnalyze.tsx. PeptideDetail.tsx will adopt this after redesign.
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
import { ConsensusCard } from "@/components/ConsensusCard";

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
              {typeof p.s4predHelixPercent === "number" && (
                <Badge variant="outline" className="text-helix border-helix">
                  S4PRED Helix: {p.s4predHelixPercent.toFixed(1)}%
                </Badge>
              )}
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

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {p.charge !== null ? `${p.charge > 0 ? "+" : ""}${p.charge.toFixed(1)}` : "N/A"}
            </div>
            <div className="text-sm text-muted-foreground">Charge</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {p.hydrophobicity !== null ? p.hydrophobicity.toFixed(2) : "N/A"}
            </div>
            <div className="text-sm text-muted-foreground">Hydrophobicity</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {p.muH != null ? p.muH.toFixed(2) : "N/A"}
            </div>
            <div className="text-sm text-muted-foreground">Hydrophobic moment</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-helix">
              {typeof p.s4predHelixPercent === "number"
                ? `${p.s4predHelixPercent.toFixed(0)}%`
                : "N/A"}
            </div>
            <div className="text-sm text-muted-foreground">S4PRED Helix</div>
            <div className="text-[10px] text-muted-foreground/60">
              neural network prediction
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Consensus Analysis ── */}
      <ConsensusCard peptide={p} />

      {/* ── Helical Wheel ── */}
      {p.length != null && p.length <= 40 && (
        <Card>
          <CardHeader>
            <CardTitle>Helical Wheel Projection</CardTitle>
            <CardDescription>
              Schiffer-Edmundson axial view. The red arrow shows the hydrophobic moment
              direction.
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
              Per-residue aggregation propensity. High scores indicate amyloid-forming
              regions.
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

      {/* ── Interpretation guidance ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interpretation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Charge</strong> and{" "}
            <strong className="text-foreground">hydrophobicity</strong> help screen
            antimicrobial and amyloid-prone candidates. Higher hydrophobicity with positive
            charge can suggest membrane activity.
          </p>
          <p>
            <strong className="text-foreground">Hydrophobic moment</strong> measures
            amphipathicity — the asymmetry of hydrophobic residue distribution around a helix
            axis.
          </p>
          <p>
            TANGO and S4PRED predictions show "N/A" if those tools are not installed on the
            server. Biochemical properties (charge, hydrophobicity, hydrophobic moment) are
            always computed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
