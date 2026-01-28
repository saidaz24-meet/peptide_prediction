import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useDatasetStore } from '@/stores/datasetStore';
import { ColumnMapping, Peptide, SSWPrediction } from '@/types/peptide';
import { toast } from 'react-hot-toast';
import React from "react";
import { CSV_HEADERS } from "../lib/peptideSchema";

interface ColumnMapperProps {
  headers: string[];
  onMappingComplete: () => void;
}

const requiredFields = [
  { key: 'entry', label: 'ID/Accession', description: 'Unique identifier for the peptide', required: true },
  { key: 'sequence', label: 'Sequence', description: 'Amino acid sequence', required: true },
  ];

const optionalFields = [
  { key: 'length', label: 'Length', description: 'Sequence length (auto-calculated if not provided)' },
  { key: 'hydrophobic_moment', label: 'Hydrophobic Moment (μH)', description: 'Amphipathic character measure' },
  { key: 'ff_helix_percent', label: 'FF-Helix %', description: 'Predicted helix percentage' },
  { key: 'jpred_helix_percent', label: 'JPred Helix %', description: 'Alternative helix prediction' },
  { key: 'jpred_helix_score', label: 'JPred Helix Score', description: 'Confidence score for helix prediction' },
  { key: 'species', label: 'Species', description: 'Source organism' },
  { key: 'hydrophobicity', label: 'Hydrophobicity', description: 'Hydrophobicity value (auto-calculated if not provided)' },
  { key: 'charge', label: 'Charge', description: 'Net charge at physiological pH (auto-calculated if not provided)' },
  { key: 'chameleon_prediction', label: 'SSW Prediction', description: 'Switch (SSW) prediction (auto-calculated if not provided)' },
  { key: 'name', label: 'Name', description: 'Peptide name or description' },
  { key: 'notes', label: 'Notes', description: 'Additional information' },
];

// sentinel value so we never pass "" to Radix Select
const NONE = '__NONE__';

export function ColumnMapper({ headers, onMappingComplete }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { rawData, setColumnMapping, setPeptides, setLoading } = useDatasetStore();

    // sanitize headers once (no UI change, just safety)
    const cleanHeaders = (headers ?? [])
    .map((h) => (h ?? '').toString().trim())
    .filter((h) => h.length > 0);

  useEffect(() => {
    const auto: ColumnMapping = {};
    headers.forEach((h) => {
      const s = h.toLowerCase();
      if (s.includes('id') || s.includes('accession') || s.includes('entry')) auto.entry = h;
      else if (s.includes('sequence') || s.includes('seq')) auto.sequence = h;
      else if (s.includes('hydrophobic')) {
        if (s.includes('moment') || s.includes('μh') || s.includes('muh')) auto.hydrophobic_moment = h;
        else auto.hydrophobicity = h;
      } else if (s.includes('charge')) auto.charge = h;
      else if (s.includes('ssw') || s.includes('switch')) auto.ssw_prediction = h;
      else if (s.includes('length') || s.includes('len')) auto.length = h;
      else if (s.includes('helix') && (s.includes('ff') || s.includes('fold'))) auto.ff_helix_percent = h;
      else if (s.includes('jpred') && s.includes('helix')) auto.jpred_helix_percent = h;
      else if (s.includes('species') || s.includes('organism')) auto.species = h;
      else if (s.includes('name') || s.includes('protein')) auto.name = h;
    });
    setMapping(auto);
  }, [headers]);

  const handleMappingChange = (field: string, headerOrNone: string) => {
    const next =
      headerOrNone === NONE ? undefined : (headerOrNone || undefined); // map "None" to undefined
    setMapping((prev) => ({ ...prev, [field]: next }));
  };

  const validateAndProcess = async () => {
    if (!rawData || !Array.isArray(rawData.rows)) {
      toast.error('No raw data available');
      return;
    }

    const missing = requiredFields.filter((f) => !mapping[f.key as keyof ColumnMapping]);
    if (missing.length) {
      toast.error(`Missing required fields: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    setIsProcessing(true);
    setLoading(true);

    try {
      const peptides: Peptide[] = [];
      const rows = rawData.rows as Record<string, any>[];

      let dropped = 0;

      rows.forEach((row, i) => {
        const entry = String(row[mapping.entry!]).trim();
        const sequence = String(row[mapping.sequence!]).trim().toUpperCase();
        
        // These fields are optional - backend will compute them if not provided
        const hydrophobicity = mapping.hydrophobicity && row[mapping.hydrophobicity] 
          ? Number(row[mapping.hydrophobicity]) : 0;
        const charge = mapping.charge && row[mapping.charge] 
          ? Number(row[mapping.charge]) : 0;

        let sswPrediction: SSWPrediction = 0;
        const predictionKey = mapping.ssw_prediction || mapping.chameleon_prediction; // Backward compat
        if (predictionKey && row[predictionKey]) {
          const chValue = String(row[predictionKey]).toLowerCase();
          if (['1', 'true', 'positive', 'yes'].includes(chValue)) sswPrediction = 1;
          else if (['-1', 'false', 'negative', 'no'].includes(chValue)) sswPrediction = -1;
        }

        if (!/^[ACDEFGHIKLMNPQRSTVWYXBZJUO*-]+$/.test(sequence)) return;


        const length =
          mapping.length && Number.isFinite(Number(row[mapping.length]))
            ? Number(row[mapping.length])
            : sequence.length;

        const muH =
          mapping.hydrophobic_moment && Number.isFinite(Number(row[mapping.hydrophobic_moment]))
            ? Number(row[mapping.hydrophobic_moment])
            : undefined;

        const ffHelixPercent =
          mapping.ff_helix_percent && Number.isFinite(Number(row[mapping.ff_helix_percent]))
            ? Number(row[mapping.ff_helix_percent])
            : undefined;

        peptides.push({
          id: entry,
          name: mapping.name ? String(row[mapping.name] ?? '') : undefined,
          species: mapping.species ? String(row[mapping.species] ?? '') : undefined,
          sequence,
          length,
          hydrophobicity,
          muH,
          charge,
          sswPrediction,
          chameleonPrediction: sswPrediction, // Backward compatibility alias
          ffHelixPercent,
        });
      });

      console.log('Total rows:', rows.length, 'Accepted:', peptides.length, 'Dropped:', dropped);


      if (!peptides.length) {
        toast.error('Could not process any rows from the preview.');
        setIsProcessing(false);
        setLoading(false);
        return;
      }

      setColumnMapping(mapping);
      setPeptides(peptides);
      onMappingComplete?.();
      setIsProcessing(false);
      setLoading(false);
      navigate('/results');
    } catch (err: any) {
      toast.error(`Processing failed: ${err.message || 'Unknown error'}`);
      setIsProcessing(false);
      setLoading(false);
    }
  };

    // Keep “None” visually, but never pass empty string to Radix
    const availableHeaders = [NONE, ...cleanHeaders];

    // which headers are already used (exclude undefined)
    const used = new Set(
      Object.values(mapping).filter((v): v is string => typeof v === 'string' && v.length > 0)
    );

  // csvColumns: string[] from uploaded CSV
  // show suggestions using CSV_HEADERS values (exact strings)
  const suggestions = Object.values(CSV_HEADERS);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Map your CSV columns to the required peptide properties. Auto-detection has been applied where possible.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
            Required Fields
          </CardTitle>
          <CardDescription>These fields are mandatory for processing your dataset</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiredFields.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key} className="text-sm font-medium">
                {f.label}
                <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
              </Label>
              <Select
                value={(mapping as any)[f.key] || ''}
                onValueChange={(v) => handleMappingChange(f.key, v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                <SelectContent>
                  {availableHeaders.map((h) => (
                    <SelectItem
                      key={h}
                      value={h}
                      disabled={h !== '' && used.has(h) && (mapping as any)[f.key] !== h}
                    >
                      {h || 'None'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            Optional Fields
          </CardTitle>
          <CardDescription>Additional fields to enhance your analysis</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {optionalFields.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key} className="text-sm font-medium">
                {f.label}
                <Badge variant="outline" className="ml-2 text-xs">Optional</Badge>
              </Label>
              <Select
                value={(mapping as any)[f.key] || ''}
                onValueChange={(v) => handleMappingChange(f.key, v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                <SelectContent>
                  {availableHeaders.map((h) => (
                    <SelectItem
                      key={h}
                      value={h}
                      disabled={h !== '' && used.has(h) && (mapping as any)[f.key] !== h}
                    >
                      {h || 'None'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => window.history.back()} disabled={isProcessing}>
          Back to Preview
        </Button>
        <Button
          onClick={validateAndProcess}
          disabled={
            isProcessing || requiredFields.some((f) => !(mapping as any)[f.key])
          }
          className="min-w-[120px]"
        >
          {isProcessing ? 'Processing...' : 'Process Data'}
        </Button>
      </div>
    </motion.div>
  );
}
