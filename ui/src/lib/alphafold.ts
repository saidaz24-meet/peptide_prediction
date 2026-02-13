/**
 * AlphaFold DB API integration.
 *
 * Fetches predicted structure metadata from the free AlphaFold DB API.
 * No authentication required.
 *
 * API docs: https://alphafold.ebi.ac.uk/api-docs
 */

const AF_API_BASE = 'https://alphafold.ebi.ac.uk/api/prediction';

export interface AlphaFoldEntry {
  modelEntityId: string;
  uniprotAccession: string;
  gene: string | null;
  organismScientificName: string | null;
  globalMetricValue: number;  // pLDDT mean (0-100)
  fractionPlddtVeryHigh: number;   // >90
  fractionPlddtConfident: number;  // 70-90
  fractionPlddtLow: number;        // 50-70
  fractionPlddtVeryLow: number;    // <50
  pdbUrl: string;
  cifUrl: string;
  paeImageUrl: string | null;
  sequenceLength: number;
}

/**
 * Fetch AlphaFold predicted structure info for a UniProt accession.
 * Returns null if no prediction exists (404) or on error.
 */
export async function fetchAlphaFoldEntry(uniprotId: string): Promise<AlphaFoldEntry | null> {
  try {
    const res = await fetch(`${AF_API_BASE}/${uniprotId}`, {
      signal: AbortSignal.timeout(8000),  // 8s timeout
    });
    if (!res.ok) return null;
    const data = await res.json();
    // API returns array — take first entry
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry) return null;

    return {
      modelEntityId: entry.modelEntityId ?? '',
      uniprotAccession: entry.uniprotAccession ?? uniprotId,
      gene: entry.gene ?? null,
      organismScientificName: entry.organismScientificName ?? null,
      globalMetricValue: entry.globalMetricValue ?? 0,
      fractionPlddtVeryHigh: entry.fractionPlddtVeryHigh ?? 0,
      fractionPlddtConfident: entry.fractionPlddtConfident ?? 0,
      fractionPlddtLow: entry.fractionPlddtLow ?? 0,
      fractionPlddtVeryLow: entry.fractionPlddtVeryLow ?? 0,
      pdbUrl: entry.pdbUrl ?? '',
      cifUrl: entry.cifUrl ?? '',
      paeImageUrl: entry.paeImageUrl ?? null,
      sequenceLength: entry.uniprotEnd ?? entry.sequence?.length ?? 0,
    };
  } catch {
    return null;
  }
}

/** Check if an ID looks like a valid UniProt accession */
export function isValidUniProtAccession(id: string): boolean {
  return /^[A-Z][0-9][A-Z0-9]{3}[0-9](-\d+)?$/i.test(id);
}

/** Get the embedded Mol* viewer URL for an AlphaFold structure */
export function getMolstarViewerUrl(uniprotId: string): string {
  return `https://www.ebi.ac.uk/pdbe/molstar/alphafold/${uniprotId}`;
}
