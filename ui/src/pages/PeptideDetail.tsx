import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Download,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { useDatasetStore } from '@/stores/datasetStore';
import { SegmentTrack } from '@/components/SegmentTrack';
import { EvidencePanel } from '@/components/EvidencePanel';
import { PeptideRadarChart } from '@/components/PeptideRadarChart';
import { PositionBars } from '@/components/PositionBars';

export default function PeptideDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPeptideById, peptides, stats } = useDatasetStore();

  const peptide = id ? getPeptideById(id) : undefined;

  if (!peptide) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle>Peptide Not Found</CardTitle>
            <CardDescription>
              The requested peptide could not be found in the current dataset.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/results')}>Back to Results</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCopySequence = () => {
    navigator.clipboard.writeText(peptide.sequence);
    toast.success('Sequence copied to clipboard');
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(peptide, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `peptide_${peptide.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Peptide data downloaded');
  };

  const getChameleonBadge = () => {
    switch (peptide.chameleonPrediction) {
      case 1:
        return (
          <Badge className="bg-chameleon-positive text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Chameleon Positive
          </Badge>
        );
      case -1:
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Chameleon Negative
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Info className="w-3 h-3 mr-1" />
            Uncertain
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto space-y-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/results')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Results
              </Button>

              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Peptide {peptide.id}
                </h1>
                {peptide.species && (
                  <p className="text-muted-foreground">Species: {peptide.species}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleCopySequence}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Sequence
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
                <Download className="w-4 h-4 mr-2" />
                Download JSON
              </Button>
            </div>
          </div>

          {/* Main Info Card */}
          <Card className="shadow-medium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Peptide Information</CardTitle>
                  <CardDescription>
                    Length: {peptide.length} amino acids
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {getChameleonBadge()}
                  {typeof peptide.ffHelixPercent === 'number' && (
                    <Badge variant="outline" className="text-helix border-helix">
                      {peptide.ffHelixPercent.toFixed(1)}% Helix
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sequence */}
              <div>
                <h3 className="font-semibold mb-2">Sequence</h3>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm break-all">
                  {peptide.sequence}
                </div>
              </div>

              {/* Secondary structure track (JPred) */}
              {peptide.jpred?.helixFragments && (
                <div>
                  <h3 className="font-semibold mb-2">Secondary Structure</h3>
                  <SegmentTrack
                    sequence={peptide.sequence}
                    helixFragments={peptide.jpred.helixFragments}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Feature Comparison</CardTitle>
                <CardDescription>
                  How this peptide compares to the cohort
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PeptideRadarChart peptide={peptide} cohortStats={stats} />
              </CardContent>
            </Card>

            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Cohort Position</CardTitle>
                <CardDescription>Percentile ranking across key metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <PositionBars peptide={peptide} allPeptides={peptides} />
              </CardContent>
            </Card>
          </div>

          {/* Feature tiles */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">
                  {peptide.hydrophobicity.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Hydrophobicity</div>
                {stats && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cohort: {stats.meanHydrophobicity.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">
                  {peptide.muH?.toFixed(2) ?? 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">μH</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Hydrophobic moment
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">
                  {peptide.charge > 0 ? '+' : ''}
                  {peptide.charge.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Charge</div>
                {stats && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cohort: {stats.meanCharge > 0 ? '+' : ''}
                    {stats.meanCharge.toFixed(1)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-helix">
                  {typeof peptide.ffHelixPercent === 'number'
                    ? `${peptide.ffHelixPercent.toFixed(0)}%`
                    : 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground">FF-Helix</div>
                {stats && stats.meanFFHelixPercent > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cohort: {stats.meanFFHelixPercent.toFixed(0)}%
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <EvidencePanel peptide={peptide} cohortStats={stats} />
        </motion.div>
      </div>
    </div>
  );
}
