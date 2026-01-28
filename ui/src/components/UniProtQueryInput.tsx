import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Loader2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE, executeUniProtQuery } from '@/lib/api';

type QueryMode = 'auto' | 'accession' | 'keyword' | 'organism' | 'keyword_organism';
type SortOrder = 'best' | 'length-asc' | 'length-desc' | 'protein-asc' | 'protein-desc' | 'organism-asc' | 'organism-desc' | 'reviewed-asc' | 'reviewed-desc';

interface ParsedQuery {
  mode: QueryMode;
  accession?: string;
  keyword?: string;
  organism_id?: string;
  normalized_query: string;
  api_query_string: string;
  error?: string;
}

interface UniProtQueryInputProps {
  onQueryExecuted: (rows: any[], meta: any) => void;
  onLoadingChange?: (loading: boolean) => void;
}

interface QueryControls {
  reviewed: boolean | null; // true = reviewed only, false = unreviewed only, null = both
  lengthMin: number | null;
  lengthMax: number | null;
  sort: SortOrder;
  includeIsoforms: boolean;
  size: number;
  runTango: boolean;
  runPsipred: boolean;
}

export function UniProtQueryInput({ onQueryExecuted, onLoadingChange }: UniProtQueryInputProps) {
  const [query, setQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<QueryMode>('auto');
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [finalApiQuery, setFinalApiQuery] = useState<string | null>(null);
  
  // Query controls state
  const [controls, setControls] = useState<QueryControls>({
    reviewed: true, // Default: reviewed (Swiss-Prot) first
    lengthMin: null, // No default - user must explicitly set if they want length filter
    lengthMax: null, // No default - user must explicitly set if they want length filter
    sort: 'best', // Best Match → omit sort parameter
    includeIsoforms: false,
    size: 500,
    runTango: false, // Default: OFF for fast response
    runPsipred: false, // Default: OFF for fast response
  });

  // Auto-parse query when it changes (debounced)
  useEffect(() => {
    if (!query.trim()) {
      setParsedQuery(null);
      setFinalApiQuery(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsParsing(true);
      try {
        const response = await fetch(`${API_BASE}/api/uniprot/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          throw new Error('Failed to parse query');
        }

        const parsed: ParsedQuery = await response.json();
        setParsedQuery(parsed);
        
        // Auto-select detected mode if auto is selected
        if (selectedMode === 'auto' && (parsed.mode as string) !== 'unknown') {
          // Mode is already 'auto', just use parsed.api_query_string
        }
      } catch (error) {
        console.error('Query parse error:', error);
        toast.error('Failed to parse query');
      } finally {
        setIsParsing(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, selectedMode]);

  // Single source of truth: Map UI sort labels to UniProt API format
  // Best Match → omit `sort` parameter (UniProt defaults to best match)
  const UNIPROT_SORT_MAP: Record<string, string | null> = {
    'best': null,                       // Best Match → omit `sort`
    'length-asc': 'length asc',
    'length-desc': 'length desc',
    'protein-asc': 'protein_name asc',
    'protein-desc': 'protein_name desc',
    'organism-asc': 'organism_name asc',
    'organism-desc': 'organism_name desc',
    'reviewed-asc': 'reviewed asc',
    'reviewed-desc': 'reviewed desc',
  };

  const handleExecute = async (retryWithoutSort = false, retryWithoutLength = false) => {
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }

    setIsExecuting(true);
    onLoadingChange?.(true);
    setFinalApiQuery(null);

    // Create AbortController for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 30000); // 30 second timeout

    try {
      // Map sort to UniProt format using single source of truth
      // Defensive: handle legacy "score" value and any unexpected values
      let sortValue: string | null = null;
      if (!retryWithoutSort) {
        // Defensive check: if sort is "score" (legacy), treat as "best"
        const sortKey = (controls.sort as string) === 'score' ? 'best' : controls.sort;
        
        const mappedSort = UNIPROT_SORT_MAP[sortKey];
        if (mappedSort === undefined) {
          // Unknown sort key - warn and omit (should not happen with type safety, but guard anyway)
          console.warn(`[UNIPROT][UI] Unknown sort key: ${controls.sort} (normalized: ${sortKey}), omitting sort`);
          toast(`Unknown sort option, using default (best match)`);
          sortValue = null; // Omit sort for unknown keys
        } else {
          sortValue = mappedSort; // null for "best", or mapped value like "length asc"
        }
        
        // Debug logging
        console.log(`[UNIPROT][UI] Sort mapping: ${controls.sort} → ${sortValue === null ? '(omitted)' : sortValue}`);
      }
      // If retryWithoutSort is true, sortValue stays null (omit sort on retry)

      // Build request body - clean request with only explicitly set parameters
      const requestBody: any = {
        query,
        mode: selectedMode,
        include_isoforms: controls.includeIsoforms,
        size: controls.size,
        run_tango: controls.runTango,  // Use UI toggle state
        run_psipred: controls.runPsipred,  // Use UI toggle state
        max_provider_sequences: 50,  // Limit if providers are enabled
      };
      
      // Reviewed: pass true|false|null (null = omit from query)
      if (controls.reviewed !== null) {
        requestBody.reviewed = controls.reviewed;
      }
      
      // Length bounds: only include if at least one is explicitly set (and not retrying without length)
      if (!retryWithoutLength) {
        // If only min set → send length_min (backend will format [min TO *])
        if (controls.lengthMin !== null && controls.lengthMin !== undefined) {
          requestBody.length_min = controls.lengthMin;
        }
        // If only max set → send length_max (backend will format [* TO max])
        if (controls.lengthMax !== null && controls.lengthMax !== undefined) {
          requestBody.length_max = controls.lengthMax;
        }
        // If both set → send both (backend will format [min TO max])
        // If both null/undefined → omit length entirely (no length_min or length_max in request)
      }
      
      // Sort: only include if mapped value is not null (i.e., not "best" and valid)
      // "best" maps to null → omit sort parameter (UniProt defaults to best match)
      // Defensive: NEVER send "score" - it's invalid
      if (sortValue !== null && sortValue !== 'score' && sortValue !== undefined) {
        requestBody.sort = sortValue;
      }
      // Explicitly do NOT set requestBody.sort if sortValue is null, "score", or undefined
      
      // Debug logging before sending (remove sort from log if sensitive)
      const logBody = { ...requestBody };
      console.log('[UNIPROT][UI] Request body:', JSON.stringify(logBody, null, 2));

      try {
        const result = await executeUniProtQuery(requestBody, abortController.signal);
        clearTimeout(timeoutId);
        
        // Log final API query for transparency
        const apiQuery = result.meta?.api_query_string || parsedQuery?.api_query_string || query;
        setFinalApiQuery(apiQuery);
        console.log('[UNIPROT][UI] Final API query executed:', apiQuery);
        console.log('[UNIPROT][UI] Query URL:', result.meta?.url);
        console.log('[UNIPROT][UI] Results:', result.meta?.row_count, 'rows');
        
        // Log provider status if available
        if (result.meta?.provider_status) {
          const ps = result.meta.provider_status;
          console.log('[UNIPROT][UI] Provider status:', {
            tango: ps.tango?.skipped_reason || (ps.tango?.ran ? 'completed' : 'not run'),
            psipred: ps.psipred?.skipped_reason || (ps.psipred?.ran ? 'completed' : 'not run'),
          });
        }

        onQueryExecuted(result.rows, result.meta);
        
        // Show provider status in toast if providers were skipped
        const ps = result.meta?.provider_status;
        if (ps?.tango?.skipped_reason || ps?.psipred?.skipped_reason) {
          const reasons = [];
          if (ps.tango?.skipped_reason) reasons.push(`Tango: ${ps.tango.skipped_reason}`);
          if (ps.psipred?.skipped_reason) reasons.push(`PSIPRED: ${ps.psipred.skipped_reason}`);
          if (reasons.length > 0) {
            toast(`Providers not computed: ${reasons.join(', ')}`);
          }
        }
        
        toast.success(`Retrieved ${result.meta?.row_count || result.rows.length} entries from UniProt`);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('UniProt query error:', error);
        
        // Auto-retry logic for 400 errors
        const is400Error = (error as any).status === 400 || error.message?.toLowerCase().includes('400');
        if (is400Error && !retryWithoutSort && !retryWithoutLength) {
          const lowerMessage = error.message.toLowerCase();
          const hasInvalidSort = lowerMessage.includes('sort') || lowerMessage.includes('invalid sort');
          const hasLengthIssue = lowerMessage.includes('length') || 
                                (controls.lengthMin === null && controls.lengthMax === null && 
                                 (requestBody.length_min !== undefined || requestBody.length_max !== undefined));
          
          if (hasInvalidSort || hasLengthIssue) {
            console.log('[UNIPROT][UI] Auto-retrying without sort/length due to 400 error');
            setIsExecuting(false);
            onLoadingChange?.(false);
            toast('Adjusted query (removed unsupported sort/length). Retrying...');
            // Retry without sort and without length
            return handleExecute(true, true);
          }
        }
        
        if (error.name === 'AbortError') {
          toast.error('Query timed out after 30 seconds. Please try a smaller query or check your connection.');
        } else {
          toast.error(error.message || 'Failed to execute UniProt query');
        }
      }
    } finally {
      // Always reset loading state, even on error or timeout
      setIsExecuting(false);
      onLoadingChange?.(false);
    }
  };

  const displayMode = selectedMode === 'auto' ? (parsedQuery?.mode || 'auto') : selectedMode;
  const displayApiQuery = finalApiQuery || parsedQuery?.api_query_string || '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query UniProt Database</CardTitle>
        <CardDescription>
          Search by accession, keyword, organism, or combinations. Examples: P12345, "amyloid", "9606", "amyloid organism_id:9606"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Query Input */}
        <div className="space-y-2">
          <Label htmlFor="uniprot-query">Query</Label>
          <div className="flex gap-2">
            <Input
              id="uniprot-query"
              placeholder="e.g., P12345, amyloid, 9606, or amyloid organism_id:9606"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isExecuting) {
                  handleExecute();
                }
              }}
              disabled={isExecuting}
            />
            <Button
              onClick={() => handleExecute()}
              disabled={isExecuting || !query.trim() || isParsing}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="space-y-2">
          <Label htmlFor="query-mode">Query Mode</Label>
          <Select
            value={selectedMode}
            onValueChange={(value) => setSelectedMode(value as QueryMode)}
            disabled={isExecuting}
          >
            <SelectTrigger id="query-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect (default)</SelectItem>
              <SelectItem value="accession">Accession (e.g., P12345)</SelectItem>
              <SelectItem value="keyword">Keyword (e.g., amyloid)</SelectItem>
              <SelectItem value="organism">Organism ID (e.g., 9606)</SelectItem>
              <SelectItem value="keyword_organism">Keyword + Organism</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Parsed Query Info */}
        {parsedQuery && (
          <Alert className={parsedQuery.error ? 'border-destructive' : ''}>
            {parsedQuery.error ? (
              <>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parsedQuery.error}</AlertDescription>
              </>
            ) : (
              <>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div>
                      <strong>Detected mode:</strong> {displayMode}
                      {selectedMode === 'auto' && (parsedQuery.mode as string) !== 'unknown' && ' (auto-detected)'}
                    </div>
                    {parsedQuery.accession && <div><strong>Accession:</strong> {parsedQuery.accession}</div>}
                    {parsedQuery.keyword && <div><strong>Keyword:</strong> {parsedQuery.keyword}</div>}
                    {parsedQuery.organism_id && <div><strong>Organism ID:</strong> {parsedQuery.organism_id}</div>}
                  </div>
                </AlertDescription>
              </>
            )}
          </Alert>
        )}

        {/* Query Controls */}
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label>Query Controls</Label>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Reviewed/Unreviewed */}
              <div className="space-y-2">
                <Label htmlFor="reviewed-filter">Protein Status</Label>
                <Select
                  value={controls.reviewed === true ? 'reviewed' : controls.reviewed === false ? 'unreviewed' : 'all'}
                  onValueChange={(value) => {
                    setControls(prev => ({
                      ...prev,
                      reviewed: value === 'reviewed' ? true : value === 'unreviewed' ? false : null,
                    }));
                  }}
                  disabled={isExecuting}
                >
                  <SelectTrigger id="reviewed-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reviewed">Reviewed (Swiss-Prot) - Default</SelectItem>
                    <SelectItem value="unreviewed">Unreviewed (TrEMBL)</SelectItem>
                    <SelectItem value="all">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <Label htmlFor="sort-order">Sort Order</Label>
                <Select
                  value={controls.sort}
                  onValueChange={(value) => setControls(prev => ({ ...prev, sort: value as SortOrder }))}
                  disabled={isExecuting}
                >
                  <SelectTrigger id="sort-order">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best">Best Match First (Default)</SelectItem>
                    <SelectItem value="length-asc">Length (Shortest First)</SelectItem>
                    <SelectItem value="length-desc">Length (Longest First)</SelectItem>
                    <SelectItem value="protein-asc">Protein Name (A-Z)</SelectItem>
                    <SelectItem value="protein-desc">Protein Name (Z-A)</SelectItem>
                    <SelectItem value="organism-asc">Organism Name (A-Z)</SelectItem>
                    <SelectItem value="organism-desc">Organism Name (Z-A)</SelectItem>
                    <SelectItem value="reviewed-asc">Reviewed Status (Ascending)</SelectItem>
                    <SelectItem value="reviewed-desc">Reviewed Status (Descending)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Length Min */}
              <div className="space-y-2">
                <Label htmlFor="length-min">Min Length (optional)</Label>
                <Input
                  id="length-min"
                  type="number"
                  min="1"
                  placeholder="e.g., 10"
                  value={controls.lengthMin ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    setControls(prev => ({ ...prev, lengthMin: val && val > 0 ? val : null }));
                  }}
                  disabled={isExecuting}
                />
              </div>

              {/* Length Max */}
              <div className="space-y-2">
                <Label htmlFor="length-max">Max Length (optional)</Label>
                <Input
                  id="length-max"
                  type="number"
                  min="1"
                  placeholder="e.g., 100"
                  value={controls.lengthMax ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    setControls(prev => ({ ...prev, lengthMax: val && val > 0 ? val : null }));
                  }}
                  disabled={isExecuting}
                />
              </div>

              {/* Include Isoforms */}
              <div className="space-y-2">
                <Label htmlFor="include-isoforms">Options</Label>
                <div className="flex items-center space-x-2 h-10">
                  <input
                    type="checkbox"
                    id="include-isoforms"
                    checked={controls.includeIsoforms}
                    onChange={(e) => setControls(prev => ({ ...prev, includeIsoforms: e.target.checked }))}
                    disabled={isExecuting}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <Label htmlFor="include-isoforms" className="cursor-pointer font-normal">
                    Include Isoforms
                  </Label>
                </div>
              </div>

              {/* Max Results */}
              <div className="space-y-2">
                <Label htmlFor="max-results">Max Results</Label>
                <Input
                  id="max-results"
                  type="number"
                  min="1"
                  max="10000"
                  placeholder="500"
                  value={controls.size}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setControls(prev => ({ ...prev, size: val && val > 0 ? Math.min(val, 10000) : 500 }));
                  }}
                  disabled={isExecuting}
                />
              </div>
            </div>

            {/* Provider Toggles */}
            <div className="space-y-4 border-t pt-4">
              <Label>Analysis Providers (may take longer)</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="run-tango" className="text-sm font-medium">
                      Run TANGO (SSW Prediction)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Predicts Secondary Structure Switch. Limited to first 50 sequences.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="run-tango"
                    checked={controls.runTango}
                    onChange={(e) => setControls(prev => ({ ...prev, runTango: e.target.checked }))}
                    disabled={isExecuting}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="run-psipred" className="text-sm font-medium">
                      Run PSIPRED (Secondary Structure)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Predicts Helix/Sheet/Coil. Limited to first 50 sequences.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="run-psipred"
                    checked={controls.runPsipred}
                    onChange={(e) => setControls(prev => ({ ...prev, runPsipred: e.target.checked }))}
                    disabled={isExecuting}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final API Query (Debug Area) */}
        {displayApiQuery && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="text-xs font-mono text-muted-foreground">Final UniProt API Query:</div>
                <div className="text-sm font-mono bg-muted p-2 rounded break-all">
                  {displayApiQuery}
                </div>
                {finalApiQuery && (
                  <div className="text-xs text-muted-foreground mt-1">
                    This query was executed successfully.
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

