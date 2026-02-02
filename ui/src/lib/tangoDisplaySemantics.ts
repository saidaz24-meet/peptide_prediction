/**
 * Tango Display Semantics - SINGLE SOURCE OF TRUTH
 *
 * This file defines the rules for displaying Tango-related data in the UI.
 * All components must use these helpers to ensure consistent display.
 *
 * ## Two Separate Concepts
 *
 * A) **Provider Run Status** (from provider_status)
 *    - OFF: Provider was disabled in settings
 *    - UNAVAILABLE: Provider was enabled but execution failed (0 outputs)
 *    - PARTIAL: Provider ran but some peptides failed (N < M outputs)
 *    - AVAILABLE: Provider ran successfully (N = N outputs)
 *
 * B) **Per-Peptide Tango Results** (only meaningful if provider ran OK)
 *    - sswPrediction: 1 = Positive (switch predicted), -1 = Negative (no switch), 0 = Uncertain
 *    - null = No prediction available (provider didn't run or failed for this peptide)
 *
 * ## Display Rules
 *
 * - If provider status is OFF → show "Off" badge with tooltip "Tango is disabled"
 * - If provider status is UNAVAILABLE → show "Failed" badge with tooltip (reason)
 * - If provider status is PARTIAL or AVAILABLE:
 *   - If sswPrediction is 1 → show "Positive" badge
 *   - If sswPrediction is -1 → show "Negative" badge
 *   - If sswPrediction is 0 → show "Uncertain" badge
 *   - If sswPrediction is null → show "Missing" badge (output missing for this peptide)
 *
 * - "N/A" is ONLY for fields that don't apply (e.g., SSW diff when no SSW segments)
 * - Never show "N/A" for "failed to run" or "mapping missing" - use specific badges
 */

// Canonical uppercase status values
export type TangoProviderStatus = 'OFF' | 'UNAVAILABLE' | 'PARTIAL' | 'AVAILABLE';

export type TangoDisplayState =
  | { type: 'off'; reason?: string }
  | { type: 'failed'; reason: string }
  | { type: 'positive' }
  | { type: 'negative' }
  | { type: 'uncertain' }
  | { type: 'missing'; reason: string }
  | { type: 'na'; reason: string };  // truly not applicable

export interface ProviderStatusInfo {
  status: TangoProviderStatus | string;  // Accept any string for normalization
  reason?: string | null;
  stats?: {
    requested: number;
    parsed_ok: number;
    parsed_bad: number;
  };
}

/**
 * Normalize provider status to canonical uppercase form.
 * Maps various backend status strings to canonical values.
 *
 * Backend may send: available, unavailable, not_configured, disabled, running, partial
 * Canonical: AVAILABLE, UNAVAILABLE, OFF, PARTIAL
 */
export function normalizeProviderStatus(status: string | undefined | null): TangoProviderStatus | null {
  if (!status) return null;

  const upper = status.toUpperCase();

  // Direct matches
  if (upper === 'AVAILABLE') return 'AVAILABLE';
  if (upper === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (upper === 'PARTIAL' || upper === 'RUNNING') return 'PARTIAL';
  if (upper === 'OFF') return 'OFF';

  // Lowercase/snake_case variants from backend
  const lower = status.toLowerCase();
  if (lower === 'available') return 'AVAILABLE';
  if (lower === 'unavailable') return 'UNAVAILABLE';
  if (lower === 'partial' || lower === 'running') return 'PARTIAL';
  if (lower === 'off' || lower === 'disabled' || lower === 'not_configured') return 'OFF';

  // Unknown status - return null to trigger UNKNOWN display
  console.warn(`[tangoDisplaySemantics] Unknown provider status: "${status}"`);
  return null;
}

/**
 * Determine the display state for a Tango-dependent value.
 *
 * @param providerStatus - The Tango provider status from provider_status
 * @param sswPrediction - The SSW prediction value (1, -1, 0, null)
 * @param hasTangoData - Whether Tango curves/data exist (even if sswPrediction is null)
 * @returns TangoDisplayState indicating how to render the value
 */
export function getTangoDisplayState(
  providerStatus: ProviderStatusInfo | undefined,
  sswPrediction: number | null | undefined,
  hasTangoData: boolean = false
): TangoDisplayState {
  // Normalize status to canonical uppercase
  const status = normalizeProviderStatus(providerStatus?.status as string);

  // A) Provider Run Status checks first
  if (!status || status === 'OFF') {
    return {
      type: 'off',
      reason: providerStatus?.reason || 'Tango is disabled in settings',
    };
  }

  if (status === 'UNAVAILABLE') {
    return {
      type: 'failed',
      reason: providerStatus?.reason || 'Tango execution failed (0 outputs)',
    };
  }

  // B) Provider ran (AVAILABLE or PARTIAL) - check per-peptide result
  if (sswPrediction === null || sswPrediction === undefined) {
    // Provider ran but no SSW prediction for this peptide
    // Note: hasTangoData (curves exist) does NOT mean "uncertain" - it means
    // the SSW threshold calculation never ran. Only sswPrediction === 0 is "uncertain".
    if (status === 'PARTIAL') {
      return {
        type: 'missing',
        reason: 'Tango output missing for this peptide (partial run)',
      };
    }
    // AVAILABLE but null prediction - show as missing
    return {
      type: 'missing',
      reason: 'Tango prediction not computed for this peptide',
    };
  }

  // Valid prediction values
  if (sswPrediction === 1) {
    return { type: 'positive' };
  }
  if (sswPrediction === -1) {
    return { type: 'negative' };
  }
  if (sswPrediction === 0) {
    return { type: 'uncertain' };
  }

  // Unexpected value
  return {
    type: 'missing',
    reason: `Unexpected SSW prediction value: ${sswPrediction}`,
  };
}

/**
 * Get display properties for a Tango display state.
 *
 * @param state - The TangoDisplayState from getTangoDisplayState
 * @returns Display properties (label, variant, tooltip)
 */
export function getTangoDisplayProps(state: TangoDisplayState): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  tooltip: string;
  icon: 'check' | 'x' | 'info' | 'alert' | 'minus' | null;
} {
  switch (state.type) {
    case 'off':
      return {
        label: 'Off',
        variant: 'outline',
        tooltip: state.reason || 'Tango is disabled',
        icon: 'minus',
      };
    case 'failed':
      return {
        label: 'Failed',
        variant: 'destructive',
        tooltip: state.reason,
        icon: 'alert',
      };
    case 'positive':
      return {
        label: 'Positive',
        variant: 'default',
        tooltip: 'SSW prediction: structural switch predicted',
        icon: 'check',
      };
    case 'negative':
      return {
        label: 'Negative',
        variant: 'secondary',
        tooltip: 'SSW prediction: no structural switch',
        icon: 'x',
      };
    case 'uncertain':
      return {
        label: 'Uncertain',
        variant: 'outline',
        tooltip: 'SSW prediction: uncertain (0)',
        icon: 'info',
      };
    case 'missing':
      return {
        label: 'Missing',
        variant: 'outline',
        tooltip: state.reason,
        icon: 'info',
      };
    case 'na':
      return {
        label: 'N/A',
        variant: 'outline',
        tooltip: state.reason,
        icon: null,
      };
    default:
      return {
        label: 'Unknown',
        variant: 'outline',
        tooltip: 'Unknown Tango status',
        icon: 'info',
      };
  }
}

/**
 * Check if Tango provider ran successfully for at least some peptides.
 *
 * @param providerStatus - The Tango provider status
 * @returns true if AVAILABLE or PARTIAL, false if OFF or UNAVAILABLE
 */
export function didTangoRun(providerStatus: ProviderStatusInfo | undefined): boolean {
  const status = normalizeProviderStatus(providerStatus?.status as string);
  return status === 'AVAILABLE' || status === 'PARTIAL';
}

/**
 * Get a summary label for the provider status (for header badges).
 *
 * @param providerStatus - The Tango provider status
 * @returns Summary label and variant for the header badge
 */
export function getProviderSummary(providerStatus: ProviderStatusInfo | undefined): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  tooltip: string;
} {
  const status = normalizeProviderStatus(providerStatus?.status as string);
  const stats = providerStatus?.stats;

  if (!status || status === 'OFF') {
    return {
      label: 'Tango: OFF',
      variant: 'outline',
      tooltip: providerStatus?.reason || 'Tango is disabled in settings',
    };
  }

  if (status === 'UNAVAILABLE') {
    const requested = stats?.requested || 0;
    return {
      label: `Tango: FAILED (0/${requested})`,
      variant: 'destructive',
      tooltip: providerStatus?.reason || 'Tango execution failed',
    };
  }

  if (status === 'PARTIAL') {
    const parsed_ok = stats?.parsed_ok || 0;
    const requested = stats?.requested || 0;
    return {
      label: `Tango: PARTIAL (${parsed_ok}/${requested})`,
      variant: 'secondary',
      tooltip: providerStatus?.reason || `Only ${parsed_ok} of ${requested} peptides processed`,
    };
  }

  if (status === 'AVAILABLE') {
    const requested = stats?.requested || 0;
    return {
      label: `Tango: OK (${requested}/${requested})`,
      variant: 'default',
      tooltip: 'Tango processing completed successfully',
    };
  }

  // Unknown status should not happen after normalization
  return {
    label: 'Tango: UNKNOWN',
    variant: 'outline',
    tooltip: `Unknown Tango status: ${providerStatus?.status}`,
  };
}
