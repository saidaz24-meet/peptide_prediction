// src/pages/Results.tsx
import { motion } from 'framer-motion';
import { Download, Filter, Search } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProviderBadge } from '@/components/ProviderBadge';
import { Slider } from '@/components/ui/slider';

import { ResultsKpis } from '@/components/ResultsKpis';
import { ResultsCharts } from '@/components/ResultsCharts';
import  {PeptideTable}  from '@/components/PeptideTable';
import { Legend } from '@/components/Legend';

import { useDatasetStore } from '@/stores/datasetStore';
import { useThresholds, scorePeptide } from '@/stores/datasetStore'; // smart ranking
import { exportResultsAsPDF } from '@/lib/report';
import { applyThresholds, DEFAULT_THRESHOLDS, meetsFFHelixThreshold, type ResolvedThresholds } from '@/lib/thresholds';
import { uploadCSV, predictOne } from '@/lib/api';
import { RotateCcw } from 'lucide-react';

import type { Peptide, ChameleonPrediction, SSWPrediction } from '@/types/peptide';

import { CorrelationCard } from '@/components/CorrelationCard';
import AppFooter from '@/components/AppFooter';
import { toast } from 'sonner';

// Reproduce button component
function ReproduceButton({ 
  getLastRun, 
  ingestBackendRows, 
  setLoading, 
  setError 
}: { 
  getLastRun: () => { type: 'upload' | 'predict' | null; input: any; config: any }; 
  ingestBackendRows: (rows: any[], meta?: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}) {
  const handleReproduce = async () => {
    const { type, input, config } = getLastRun();
    
    if (!type || !input) {
      toast.error('No previous run to reproduce. Upload or analyze a sequence first.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      if (type === 'upload') {
        // Reproduce upload
        if (!(input instanceof File)) {
          toast.error('Cannot reproduce: file data lost (page was refreshed). Please re-upload.');
          return;
        }
        const { rows, meta } = await uploadCSV(input, config);
        ingestBackendRows(rows, meta);
        toast.success('Run reproduced successfully');
      } else if (type === 'predict') {
        // Reproduce predict (single sequence)
        if (typeof input !== 'object' || !input.sequence) {
          toast.error('Cannot reproduce: sequence data lost. Please re-analyze.');
          return;
        }
        const result = await predictOne(input.sequence, input.entry, config);
        // For predict, we convert single result to array format for consistency
        const rows = [result];
        const meta = (result as any).meta || {};
        ingestBackendRows(rows, meta);
        toast.success('Run reproduced successfully');
      }
    } catch (e: any) {
      const errorMsg = e?.message || 'Reproduce failed';
      setError(errorMsg);
      toast.error(`Reproduce failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };
  
  const { type } = getLastRun();
  const canReproduce = type !== null;
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleReproduce}
      disabled={!canReproduce}
      title={canReproduce ? 'Reproduce last run with same input and config' : 'No previous run to reproduce'}
    >
      <RotateCcw className="w-4 h-4 mr-2" />
      Reproduce
    </Button>
  );
}

export default function Results() {
  const { peptides, stats, meta, getLastRun, ingestBackendRows, setLoading, setError } = useDatasetStore();
  const navigate = useNavigate();

  // smart ranking weights
  const { wH, wCharge, wMuH, wHelix, topN, setWeights } = useThresholds();

  // Use meta.thresholds as source of truth, fallback to defaults
  const resolvedThresholds: ResolvedThresholds = meta?.thresholds || DEFAULT_THRESHOLDS;
  
  // threshold mode from meta (for display)
  const thresholdMode = meta?.thresholdConfigResolved?.mode || meta?.thresholdConfigRequested?.mode || 'default';

  useEffect(() => {
    // Redirect to upload if no data
    if (peptides.length === 0) {
      navigate('/upload');
    }
  }, [peptides.length, navigate]);

  if (peptides.length === 0) {
    return null; // Will redirect
  }

  // -------- Type normalization (fixes lib/types shape mismatch) --------
  const normalizePeptide = (p: any): Peptide => {
    const sswRaw = p?.sswPrediction ?? p?.chameleonPrediction; // Backward compat
    const ssw: SSWPrediction =
      sswRaw === 1 ? 1 : sswRaw === 0 ? 0 : -1;

    // Ensure ID is always present — try canonical first, then fallbacks
    const id = String(p.id ?? p.Entry ?? p.entry ?? p.Accession ?? p.accession ?? '').trim();
    
    // preserve everything else; enforce the fields TS cares about
    return {
      id,
      name: p.name ?? p['Protein name'],
      species: p.species ?? p.Organism,
      sequence: String(p.sequence ?? p.Sequence ?? ''),
      length: Number(p.length ?? p.Length ?? 0),
      hydrophobicity: Number(p.hydrophobicity ?? p.Hydrophobicity ?? 0),
      muH: typeof p.muH === 'number' ? p.muH : (typeof p['Full length uH'] === 'number' ? p['Full length uH'] : undefined),
      charge: Number(p.charge ?? p.Charge ?? 0),
      sswPrediction: ssw,
      chameleonPrediction: ssw, // Backward compatibility alias
      ffHelixPercent: typeof p.ffHelixPercent === 'number' ? p.ffHelixPercent
        : (typeof p['FF-Helix %'] === 'number' ? p['FF-Helix %'] : undefined),
      jpred: p.jpred ?? {
        helixFragments: p['Helix fragments (Jpred)'] ?? undefined,
        helixScore: typeof p['Helix score (Jpred)'] === 'number' ? p['Helix score (Jpred)'] : undefined,
      },
      extra: p.extra ?? {},
    };
  };

  // Canonical typed arrays used everywhere below
  const peptidesTyped: Peptide[] = useMemo(
    () => peptides.map(normalizePeptide),
    [peptides]
  );

  // -------- Smart Candidate Ranking --------
  const shortlist: Peptide[] = useMemo(() => {
    if (!peptidesTyped?.length) return [];
    return [...peptidesTyped]
      .map((p) => ({ p, s: scorePeptide(p as any, { wH, wCharge, wMuH, wHelix }, resolvedThresholds.ffHelixPercentThreshold) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, Math.max(1, Number(topN) || 10))
      .map((x) => x.p);
  }, [peptidesTyped, wH, wCharge, wMuH, wHelix, topN, resolvedThresholds.ffHelixPercentThreshold]);

  function exportShortlistCSV() {
    if (!shortlist.length) return;
    const cols = [
      'id',
      'name',
      'species',
      'sequence',
      'length',
      'hydrophobicity',
      'charge',
      'muH',
      'ffHelixPercent',
      'chameleonPrediction',
    ];
    const rows = shortlist.map((p) =>
      cols.map((c) => {
        const val = (p as any)[c];
        if (val === undefined || val === null) return '';
        if (c === 'sswPrediction' || c === 'chameleonPrediction') { // Backward compat
          return val === 1 ? 'Positive' : val === -1 ? 'N/A' : 'Negative';
        }
        return val;
      })
    );
    const header = cols.join(',');
    const body = rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(',')
      )
      .join('\n');
    const csv = header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shortlist.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // -------- Threshold Tuner (view-only derived flags) --------
  // Use meta.thresholds as source of truth, apply consistently via helper
  const viewPeptides = useMemo(() => {
    return peptidesTyped.map((p) => {
      const { ffHelixView, sswView } = applyThresholds(p, resolvedThresholds);
      return { ...p, ffHelixView, sswView };
    });
  }, [peptidesTyped, resolvedThresholds]);

  const ffHelixOnCount = viewPeptides.filter((p: any) => p.ffHelixView === 1).length;
  const chamOnCount = viewPeptides.filter((p: any) => p.sswView === 1).length;

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8" id="results-root">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Analysis Results</h1>
              <p className="text-muted-foreground mt-1">Comprehensive peptide analysis and visualizations</p>
            </div>

            <div className="flex items-center space-x-3">
              {meta && (
                <div className="flex gap-2">
                  {meta.provider_status?.jpred ? (
                    <ProviderBadge 
                      name="JPred" 
                      status={meta.provider_status.jpred as any}
                    />
                  ) : (
                    <Badge variant={meta.use_jpred ? 'default' : 'outline'}>
                      JPred: {meta.use_jpred ? `ON (${meta.jpred_rows})` : 'OFF'}
                    </Badge>
                  )}
                  {meta.provider_status?.tango ? (
                    <ProviderBadge 
                      name="Tango" 
                      status={meta.provider_status.tango as any}
                    />
                  ) : (
                    <Badge variant="outline">
                      Tango: {meta.use_tango ? 'ENABLED' : 'OFF'}
                    </Badge>
                  )}
                  <Badge variant="secondary">n = {peptidesTyped.length}</Badge>
                  {meta?.thresholds && (
                    <Badge variant="outline" className="text-xs">
                      Using {thresholdMode === 'default' ? 'default' : thresholdMode === 'recommended' ? 'recommended' : 'custom'} thresholds
                    </Badge>
                  )}
                </div>
              )}

              <Legend />
              <ReproduceButton getLastRun={getLastRun} ingestBackendRows={ingestBackendRows} setLoading={setLoading} setError={setError} />
              <Button variant="outline" size="sm" onClick={() => exportResultsAsPDF()}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <ResultsKpis stats={stats} meta={meta} />

          {/* Smart Candidate Ranking */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Smart Candidate Ranking</CardTitle>
              <CardDescription>Tune weights to shortlist top candidates instantly for synthesis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Hydrophobicity weight</span>
                    <span className="text-muted-foreground">{wH.toFixed(2)}</span>
                  </div>
                  <Slider min={0} max={3} step={0.1} value={[wH]} onValueChange={([v]) => setWeights({ wH: v })} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>|Charge| weight</span>
                    <span className="text-muted-foreground">{wCharge.toFixed(2)}</span>
                  </div>
                  <Slider min={0} max={3} step={0.1} value={[wCharge]} onValueChange={([v]) => setWeights({ wCharge: v })} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>μH (moment) weight</span>
                    <span className="text-muted-foreground">{wMuH.toFixed(2)}</span>
                  </div>
                  <Slider min={0} max={3} step={0.1} value={[wMuH]} onValueChange={([v]) => setWeights({ wMuH: v })} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Helix flag weight</span>
                    <span className="text-muted-foreground">{wHelix.toFixed(2)}</span>
                  </div>
                  <Slider min={0} max={3} step={0.1} value={[wHelix]} onValueChange={([v]) => setWeights({ wHelix: v })} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Top N</span>
                  <Input
                    type="number"
                    className="w-20"
                    value={topN}
                    min={1}
                    onChange={(e) => setWeights({ topN: Math.max(1, Number(e.target.value) || 10) })}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={exportShortlistCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Export shortlist.csv
                </Button>
              </div>

              {/* Reuse your existing table look by passing just the top-N */}
              <div className="mt-4">
                <CardTitle className="text-base mb-2">Top {topN} candidates</CardTitle>
                <PeptideTable peptides={shortlist} />
              </div>
            </CardContent>
          </Card>

          {/* Flag Threshold Tuner (view-only, uses meta.thresholds) */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Flag Threshold Tuner</CardTitle>
              <CardDescription>
                Current thresholds from backend (mode: {thresholdMode}). Pass/fail labels use these values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>μH cutoff</span>
                  <span className="text-muted-foreground">{resolvedThresholds.muHCutoff.toFixed(2)}</span>
                </div>
                <Slider 
                  min={-5} 
                  max={5} 
                  step={0.1} 
                  value={[resolvedThresholds.muHCutoff]} 
                  disabled
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground mt-1">Read-only: set via threshold mode in upload</p>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Hydrophobicity cutoff</span>
                  <span className="text-muted-foreground">{resolvedThresholds.hydroCutoff.toFixed(2)}</span>
                </div>
                <Slider
                  min={-5}
                  max={5}
                  step={0.1}
                  value={[resolvedThresholds.hydroCutoff]}
                  disabled
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground mt-1">Read-only: set via threshold mode in upload</p>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>FF-Helix % threshold (for scoring)</span>
                  <span className="text-muted-foreground">{resolvedThresholds.ffHelixPercentThreshold.toFixed(1)}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={0.1}
                  value={[resolvedThresholds.ffHelixPercentThreshold]}
                  disabled
                  className="opacity-60"
                />
              </div>

              {/* Quick live counts */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">FF-Helix (view) = 1</div>
                  <div className="text-lg font-semibold">{ffHelixOnCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">SSW (view) = 1</div>
                  <div className="text-lg font-semibold">{chamOnCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview & Charts</TabsTrigger>
              <TabsTrigger value="data">Data Table</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Charts use the full dataset */}
              <ResultsCharts peptides={peptidesTyped} />
              {/* cohort correlation heatmap */}
              <CorrelationCard peptides={peptidesTyped} />
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <Card className="shadow-medium">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Peptide Dataset</CardTitle>
                      <CardDescription>Interactive table with filtering and sorting capabilities</CardDescription>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Search peptides..." className="pl-9 w-64" />
                      </div>
                      <Button variant="outline" size="sm">
                        <Filter className="w-4 h-4 mr-2" />
                        Filters
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Show full dataset in the table */}
                  <PeptideTable peptides={peptidesTyped} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <AppFooter />
        </motion.div>
      </div>
    </div>
  );
}
