/**
 * API Response Types
 * 
 * These types match the backend Pydantic models in backend/schemas/api_models.py
 * They define the exact shape of API responses from the backend.
 * 
 * Source: backend/schemas/api_models.py
 */

import type { ProviderStatus } from './peptide';

/**
 * Provider status summary in meta responses.
 * 
 * Source: backend/schemas/api_models.py:ProviderStatusSummary
 */
export interface ProviderStatusSummary {
  tango?: {
    status: string;
    requested?: number;
    parsed_ok?: number;
    parsed_bad?: number;
  } | null;
  psipred?: {
    status: string;
  } | null;
  jpred?: {
    status: string;
  } | null;
}

/**
 * Metadata included in all responses that return peptide rows.
 * 
 * Source: backend/schemas/api_models.py:Meta
 */
export interface Meta {
  // Provider flags
  use_jpred: boolean;
  use_tango: boolean;
  jpred_rows: number;
  ssw_rows: number;
  valid_seq_rows: number;
  
  // Provider status metadata
  provider_status: Record<string, any>;
  
  // Reproducibility primitives
  runId: string;
  traceId: string;
  inputsHash: string;
  configHash: string;
  
  // Provider status summary
  providerStatusSummary: ProviderStatusSummary;
  
  // Threshold configuration
  thresholdConfigRequested?: Record<string, any> | null;
  thresholdConfigResolved: Record<string, any>;
  thresholds: Record<string, any>;
  
  // UniProt-specific fields (only present in /api/uniprot/execute responses)
  source?: "uniprot_api" | null;
  query?: string | null;
  api_query_string?: string | null;
  mode?: string | null;
  url?: string | null;
  row_count?: number | null;
  size_requested?: number | null;
  size_returned?: number | null;
  run_tango?: boolean | null;
}

/**
 * Canonical PeptideRow from backend API.
 * 
 * This matches backend/schemas/api_models.py:PeptideRow exactly.
 * All fields are camelCase (id, sequence, charge, etc.) - NOT capitalized (Entry, Sequence).
 * 
 * Source: backend/schemas/api_models.py:PeptideRow
 * Normalization: backend/services/normalize.py:normalize_rows_for_ui()
 */
export interface ApiPeptideRow {
  // Identity & metadata
  id: string;
  name?: string | null;
  species?: string | null;
  
  // Sequence
  sequence: string;
  length?: number | null;
  
  // Basic biophysics
  hydrophobicity?: number | null;
  charge?: number | null;
  muH?: number | null;
  
  // SSW / TANGO predictions
  sswPrediction?: number | null; // -1/0/1
  sswScore?: number | null;
  sswDiff?: number | null;
  sswHelixPercentage?: number | null;
  sswBetaPercentage?: number | null;
  
  // FF-Helix
  ffHelixPercent?: number | null;
  ffHelixFragments?: Array<any> | null;
  
  // Provider status
  providerStatus?: ProviderStatus | null;

  // Additional fields in extras
  extras?: Record<string, any>;

  // Additional provider-specific fields may be in extras
  [key: string]: any;
}

/**
 * Response format for endpoints that return multiple peptide rows.
 * 
 * Used by:
 * - POST /api/upload-csv
 * - POST /api/uniprot/execute
 * - GET /api/example
 * 
 * Source: backend/schemas/api_models.py:RowsResponse
 */
export interface RowsResponse {
  rows: ApiPeptideRow[];
  meta: Meta;
}

/**
 * Response format for POST /api/predict endpoint.
 * 
 * Returns a single peptide row with metadata.
 * 
 * Source: backend/schemas/api_models.py:PredictResponse
 */
export interface PredictResponse {
  row: ApiPeptideRow;
  meta: Meta;
}

