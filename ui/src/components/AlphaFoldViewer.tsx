import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  fetchAlphaFoldEntry,
  isValidUniProtAccession,
  getMolstarViewerUrl,
  type AlphaFoldEntry,
} from '@/lib/alphafold';

interface AlphaFoldViewerProps {
  peptideId: string;
}

function ConfidenceBar({ label, fraction, color }: { label: string; fraction: number; color: string }) {
  const pct = (fraction * 100).toFixed(1);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${fraction * 100}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right font-mono">{pct}%</span>
    </div>
  );
}

export function AlphaFoldViewer({ peptideId }: AlphaFoldViewerProps) {
  const [entry, setEntry] = useState<AlphaFoldEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const isValid = isValidUniProtAccession(peptideId);

  useEffect(() => {
    if (!isValid) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchAlphaFoldEntry(peptideId).then((data) => {
      if (!cancelled) {
        setEntry(data);
        setChecked(true);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [peptideId, isValid]);

  // Don't render anything if not a valid UniProt ID or no structure found
  if (!isValid || (checked && !entry)) return null;

  if (loading) {
    return (
      <Card className="shadow-medium">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Checking AlphaFold DB...</span>
        </CardContent>
      </Card>
    );
  }

  if (!entry) return null;

  const plddt = entry.globalMetricValue;
  const plddtColor = plddt >= 90 ? 'text-blue-600' : plddt >= 70 ? 'text-cyan-600' : plddt >= 50 ? 'text-yellow-600' : 'text-orange-600';

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">AlphaFold Predicted Structure</CardTitle>
            <CardDescription>
              {entry.modelEntityId}
              {entry.gene && ` (${entry.gene})`}
              {entry.organismScientificName && ` — ${entry.organismScientificName}`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://alphafold.ebi.ac.uk/entry/${entry.uniprotAccession}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                AlphaFold
              </Button>
            </a>
            {entry.pdbUrl && (
              <a href={entry.pdbUrl} download>
                <Button variant="outline" size="sm">PDB</Button>
              </a>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence metrics */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">Mean pLDDT:</span>
              <span className={`text-lg font-bold ${plddtColor}`}>{plddt.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {plddt >= 90 ? 'Very high confidence' :
               plddt >= 70 ? 'Confident' :
               plddt >= 50 ? 'Low confidence' : 'Very low confidence'}
            </p>
          </div>
          <div className="space-y-2">
            <ConfidenceBar label="Very high" fraction={entry.fractionPlddtVeryHigh} color="#0053d6" />
            <ConfidenceBar label="Confident" fraction={entry.fractionPlddtConfident} color="#65cbf3" />
            <ConfidenceBar label="Low" fraction={entry.fractionPlddtLow} color="#ffdb13" />
            <ConfidenceBar label="Very low" fraction={entry.fractionPlddtVeryLow} color="#ff7d45" />
          </div>
        </div>

        {/* Short peptide caveat */}
        {entry.sequenceLength < 30 && (
          <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-400">
            <strong>Caution:</strong> AlphaFold predictions for peptides shorter than 30 residues
            should be interpreted with care. The model requires sufficient sequence context for
            reliable structure prediction.
          </div>
        )}

        {/* Embedded 3D viewer (lazy-loaded on click) */}
        {showViewer ? (
          <div className="rounded-lg overflow-hidden border" style={{ height: 400 }}>
            <iframe
              src={getMolstarViewerUrl(entry.uniprotAccession, entry.cifUrl)}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="fullscreen"
              title={`AlphaFold structure: ${entry.uniprotAccession}`}
              style={{ border: 'none' }}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowViewer(true)}
            className="w-full rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <div className="text-sm font-medium">Load 3D Structure Viewer</div>
            <div className="text-xs text-muted-foreground mt-1">
              Opens EBI Mol* viewer ({entry.sequenceLength} residues, colored by pLDDT confidence)
            </div>
          </button>
        )}

        <div className="text-xs text-muted-foreground">
          Structure predicted by AlphaFold v2 (DeepMind/EMBL-EBI). Colors: blue = high confidence, orange = low confidence.
        </div>
      </CardContent>
    </Card>
  );
}
