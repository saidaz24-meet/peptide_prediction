import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Download,
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
import { ProviderBadge } from '@/components/ProviderBadge';
import { TangoBadge } from '@/components/TangoBadge';

// NEW: small additions for sliding-window profiles
import { useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceArea,
} from 'recharts';
import { buildProfilePoints, helixRanges } from '@/lib/profile';
import AppFooter from "@/components/AppFooter";


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

  // Use centralized TangoBadge for consistent display semantics
  const getSSWBadge = () => {
    // Use canonical tangoHasData field from backend (preferred)
    // Fallback to checking curves if tangoHasData not available
    const hasTangoData = peptide.tangoHasData ?? Boolean(
      peptide.tango?.beta?.length ||
      peptide.tango?.helix?.length ||
      peptide.extra?.['Tango Beta curve']?.length ||
      peptide.extra?.['Tango Helix curve']?.length
    );
    return (
      <TangoBadge
        providerStatus={peptide.providerStatus?.tango}
        sswPrediction={peptide.sswPrediction}
        hasTangoData={hasTangoData}
        showIcon={true}
      />
    );
  };

  // NEW: sliding-window profiles state + derived data (non-invasive)
  const [win, setWin] = useState(11); // window size (odd numbers recommended)
  const profilePoints = useMemo(
    () => buildProfilePoints(peptide.sequence, win),
    [peptide.sequence, win]
  );
  const helixBands = useMemo(
    () => helixRanges(peptide.jpred?.helixFragments as [number, number][] | undefined, win),
    [peptide.jpred, win]
  );

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

            <div className="flex items-center gap-2 flex-wrap">
              {/* Provider status pills */}
              {peptide.providerStatus?.tango && (
                <ProviderBadge
                  name="Tango"
                  status={peptide.providerStatus.tango as any}
                />
              )}
              {peptide.providerStatus?.s4pred && (
                <ProviderBadge
                  name="S4PRED"
                  status={peptide.providerStatus.s4pred as any}
                />
              )}
              {peptide.providerStatus?.psipred && (
                <ProviderBadge
                  name="PSIPRED"
                  status={peptide.providerStatus.psipred as any}
                />
              )}
              {peptide.providerStatus?.jpred && (
                <ProviderBadge
                  name="JPred"
                  status={peptide.providerStatus.jpred as any}
                />
              )}
              
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
                  {getSSWBadge()}
                  <Badge variant="outline" className="text-helix border-helix">
                    {typeof peptide.ffHelixPercent === 'number'
                      ? `${peptide.ffHelixPercent.toFixed(1)}% Helix`
                      : 'Not available'}
                  </Badge>
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
              <div>
                <h3 className="font-semibold mb-2">Secondary Structure</h3>
                {peptide.jpred?.helixFragments?.length ? (
                  <SegmentTrack
                    sequence={peptide.sequence}
                    helixFragments={peptide.jpred.helixFragments}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">JPred segments not available</div>
                )}
              </div>
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

          {/* NEW: Sliding-Window Profiles (frontend-only, non-destructive) */}
          {/* Gate: Hide per-residue charts for sequences > 200 residues (unreadable and slow) */}
          {peptide.length <= 200 ? (
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Sliding-Window Profiles</CardTitle>
                <CardDescription>
                  Hydrophobicity (Kyte–Doolittle) and hydrophobic moment (μH), computed on the fly from the sequence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Window size</span>
                    <span className="text-muted-foreground">{win}</span>
                  </div>
                  <Slider min={5} max={21} step={2} value={[win]} onValueChange={([v]) => setWin(v)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    Odd sizes recommended (e.g., 9, 11, 13). Larger window = smoother profiles.
                  </p>
                </div>

                {/* Hydrophobicity (KD) */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Hydrophobicity (Kyte–Doolittle)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={profilePoints}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" tickCount={10} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {helixBands.map((r, i) => (
                          <ReferenceArea key={i} x1={r.x1} x2={r.x2} opacity={0.15} />
                        ))}
                        <Line type="monotone" dataKey="H" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Hydrophobic moment (μH) */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Hydrophobic Moment (μH)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={profilePoints}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" tickCount={10} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {helixBands.map((r, i) => (
                          <ReferenceArea key={i} x1={r.x1} x2={r.x2} opacity={0.15} />
                        ))}
                        <Line type="monotone" dataKey="muH" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Shaded regions = JPred helix segments (if available).
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Sliding-Window Profiles</CardTitle>
                <CardDescription>
                  Per-residue profiles not available for long sequences.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm mb-2">
                    Sequence too long for per-residue plot (length: {peptide.length}).
                  </p>
                  <p className="text-xs">
                    Use windowing or open advanced view for detailed analysis.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* S4PRED Secondary Structure Predictions */}
          {peptide.s4pred && (peptide.s4pred.pH?.length || peptide.s4pred.pE?.length) && peptide.length && peptide.length <= 200 && (
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>S4PRED Secondary Structure Probabilities</CardTitle>
                <CardDescription>
                  Per-residue helix (H), beta (E), and coil (C) probabilities from S4PRED neural network prediction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Combined probability plot */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Secondary Structure Probabilities</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={(() => {
                          const pH = peptide.s4pred?.pH || [];
                          const pE = peptide.s4pred?.pE || [];
                          const pC = peptide.s4pred?.pC || [];
                          const maxLen = Math.max(pH.length, pE.length, pC.length);
                          return Array.from({ length: maxLen }, (_, i) => ({
                            x: i + 1,
                            'P(Helix)': pH[i] ?? null,
                            'P(Beta)': pE[i] ?? null,
                            'P(Coil)': pC[i] ?? null,
                          }));
                        })()}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" tickCount={10} label={{ value: 'Residue', position: 'bottom' }} />
                        <YAxis domain={[0, 1]} label={{ value: 'Probability', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="P(Helix)" stroke="hsl(var(--helix))" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="P(Beta)" stroke="hsl(var(--beta))" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="P(Coil)" stroke="hsl(var(--muted-foreground))" dot={false} strokeWidth={1} strokeDasharray="3 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* S4PRED summary stats */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="font-semibold text-helix">
                      {typeof peptide.s4predHelixPercent === 'number' ? `${peptide.s4predHelixPercent.toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">Helix %</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="font-semibold">
                      {peptide.s4predSswPrediction === 1 ? '✓ Yes' : peptide.s4predSswPrediction === -1 ? '✗ No' : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">SSW Predicted</div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/50">
                    <div className="font-semibold">
                      {peptide.s4pred?.helixSegments?.length ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Helix Segments</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  S4PRED: Single Sequence Secondary Structure PREDiction (neural network ensemble).
                </div>
              </CardContent>
            </Card>
          )}

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
                    : 'Not available'}
                </div>
                <div className="text-sm text-muted-foreground">FF-Helix</div>
                {stats && stats.meanFFHelixPercent !== null && stats.meanFFHelixPercent !== undefined && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cohort: {stats.meanFFHelixPercent.toFixed(0)}%
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <EvidencePanel peptide={peptide} cohortStats={stats} />

          <AppFooter />

        </motion.div>
      </div>
    </div>
  );
}
