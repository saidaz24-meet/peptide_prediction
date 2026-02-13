// src/pages/Results.tsx
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
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
import { exportShortlistPDF } from '@/lib/report';
import { applyThresholds, DEFAULT_THRESHOLDS, type ResolvedThresholds } from '@/lib/thresholds';
import { uploadCSV, predictOne } from '@/lib/api';
import { RotateCcw } from 'lucide-react';

import type { Peptide } from '@/types/peptide';
// mapApiRowsToPeptides removed - peptides from store are already mapped

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
        // result is PredictResponse: {row, meta}
        const rows = [result.row];
        const meta = result.meta || {};
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
  
  const { type, input } = getLastRun();
  const canReproduce = type !== null;
  // Check if file-based run lost its File object (non-serializable, lost after refresh)
  const fileLost = type === 'upload' && !(input instanceof File);

  const tooltip = !canReproduce
    ? 'No previous run available'
    : fileLost
    ? 'Re-upload your CSV to re-run (file data is lost after refresh)'
    : 'Re-run the same analysis with identical parameters';

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReproduce}
      disabled={!canReproduce || fileLost}
      title={tooltip}
    >
      <RotateCcw className="w-4 h-4 mr-2" />
      Re-run
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

  // peptides from store is already Peptide[] (mapped by ingestBackendRows)
  // No re-mapping needed - use directly
  const peptidesTyped: Peptide[] = peptides;

  // -------- Smart Candidate Ranking --------
  const shortlist: Peptide[] = useMemo(() => {
    if (!peptidesTyped?.length) return [];
    return [...peptidesTyped]
      .map((p) => ({ p, s: scorePeptide(p as any, { wH, wCharge, wMuH, wHelix }, resolvedThresholds.ffHelixPercentThreshold) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, Math.max(1, Number(topN) || 10))
      .map((x) => x.p);
  }, [peptidesTyped, wH, wCharge, wMuH, wHelix, topN, resolvedThresholds.ffHelixPercentThreshold]);

  function exportAllFASTA() {
    if (!peptidesTyped.length) return;
    const lines = peptidesTyped.map((p) => {
      const header = `>${p.id}${p.species ? `|${p.species}` : ''}${p.name ? ` ${p.name}` : ''}`;
      const wrapped = p.sequence.match(/.{1,80}/g)?.join('\n') ?? p.sequence;
      return `${header}\n${wrapped}`;
    });
    const fasta = lines.join('\n') + '\n';
    const blob = new Blob([fasta], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'peptides.fasta';
    a.click();
    URL.revokeObjectURL(url);
  }

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
      's4predHelixPercent',
      'sswPrediction',
      's4predSswPrediction',
      'ffHelixFlag',
      'ffSswFlag',
    ];
    const sswCols = new Set(['sswPrediction', 's4predSswPrediction']);
    const flagCols = new Set(['ffHelixFlag', 'ffSswFlag']);
    const rows = shortlist.map((p) =>
      cols.map((c) => {
        const val = (p as any)[c];
        if (val === undefined || val === null) return '';
        if (sswCols.has(c)) {
          if (val === 1) return 'Positive';
          if (val === -1) return 'Negative';
          if (val === 0) return 'Uncertain';
          return '';
        }
        if (flagCols.has(c)) {
          if (val === 1) return 'Candidate';
          if (val === -1) return 'Not candidate';
          return '';
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
                  {meta.provider_status?.tango ? (
                    <ProviderBadge
                      name="TANGO"
                      status={meta.provider_status.tango as any}
                    />
                  ) : (
                    <Badge variant="outline">
                      TANGO: {meta.use_tango ? 'ENABLED' : 'OFF'}
                    </Badge>
                  )}
                  {meta.provider_status?.s4pred ? (
                    <ProviderBadge
                      name="S4PRED"
                      status={meta.provider_status.s4pred as any}
                    />
                  ) : (
                    <Badge variant="outline">
                      S4PRED: OFF
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
              <Button variant="outline" size="sm" onClick={exportAllFASTA}>
                <Download className="w-4 h-4 mr-2" />
                FASTA
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportShortlistPDF(
                peptidesTyped, stats!, meta, { wH, wCharge, wMuH, wHelix }, topN,
                resolvedThresholds.ffHelixPercentThreshold,
              )}>
                <Download className="w-4 h-4 mr-2" />
                PDF Report
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <ResultsKpis stats={stats} meta={meta} />

          {/* Main Content Tabs — Data Table first (researcher workflow) */}
          <Tabs defaultValue="data" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="data">Data Table</TabsTrigger>
              <TabsTrigger value="ranking">Candidate Ranking</TabsTrigger>
              <TabsTrigger value="charts">Charts & Analysis</TabsTrigger>
            </TabsList>

            {/* Data Table — default view */}
            <TabsContent value="data" className="space-y-6">
              <Card className="shadow-medium">
                <CardHeader>
                  <CardTitle>Peptide Dataset</CardTitle>
                  <CardDescription>Interactive table with search, column filters, sorting, and export</CardDescription>
                </CardHeader>
                <CardContent>
                  <PeptideTable peptides={peptidesTyped} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Candidate Ranking */}
            <TabsContent value="ranking" className="space-y-6">
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

                  <div className="mt-4">
                    <CardTitle className="text-base mb-2">Top {topN} candidates</CardTitle>
                    <PeptideTable peptides={shortlist} />
                  </div>
                </CardContent>
              </Card>

              {/* Classification Summary */}
              <Card className="shadow-medium">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Classification Summary</CardTitle>
                  <CardDescription>
                    Thresholds applied during analysis ({thresholdMode} mode)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">FF-Helix Candidates</div>
                      <div className="text-xl font-semibold">{ffHelixOnCount}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        of {peptidesTyped.length} ({peptidesTyped.length > 0 ? ((ffHelixOnCount / peptidesTyped.length) * 100).toFixed(0) : 0}%)
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">SSW Candidates</div>
                      <div className="text-xl font-semibold">{chamOnCount}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        of {peptidesTyped.length} ({peptidesTyped.length > 0 ? ((chamOnCount / peptidesTyped.length) * 100).toFixed(0) : 0}%)
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">μH cutoff</div>
                      <div className="text-lg font-semibold tabular-nums">{resolvedThresholds.muHCutoff.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {resolvedThresholds.muHCutoff === 0 ? 'Not applied' : 'Dataset avg'}
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Hydrophobicity cutoff</div>
                      <div className="text-lg font-semibold tabular-nums">{resolvedThresholds.hydroCutoff.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {resolvedThresholds.hydroCutoff === 0 ? 'Not applied' : 'Dataset avg'}
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">FF-Helix % threshold</div>
                      <div className="text-lg font-semibold tabular-nums">{resolvedThresholds.ffHelixPercentThreshold.toFixed(0)}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1">For scoring</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Charts & Analysis */}
            <TabsContent value="charts" className="space-y-6">
              <ResultsCharts peptides={peptidesTyped} providerStatus={meta?.provider_status} />
              <CorrelationCard peptides={peptidesTyped} />
            </TabsContent>
          </Tabs>

          <AppFooter />
        </motion.div>
      </div>
    </div>
  );
}
