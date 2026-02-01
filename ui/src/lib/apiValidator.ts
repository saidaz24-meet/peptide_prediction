/**
 * Development-only API response validator.
 * 
 * Validates that backend responses match the canonical camelCase format.
 * This code is tree-shaken out of production builds.
 * 
 * Checks:
 * - Required keys: id, sequence
 * - Forbidden keys: Entry, Sequence, FF-Helix % (capitalized/CSV format)
 */

// Forbidden keys (capitalized/CSV format - should be camelCase)
const FORBIDDEN_KEYS = [
  'Entry',
  'Sequence',
  'FF-Helix %',
  'FF Helix %',
  'Length',
  'Charge',
  'Hydrophobicity',
  'Full length uH',
  'SSW prediction',
  'SSW score',
  'SSW diff',
  'SSW helix percentage',
  'SSW beta percentage',
  'Protein name',
  'Organism',
];

// Required keys (canonical camelCase format)
const REQUIRED_KEYS = ['id', 'sequence'];

/**
 * Validate a single API response row.
 * Only runs in development mode.
 * 
 * @param row - Backend API response row to validate
 * @param source - Source identifier for error messages (e.g., '/api/predict')
 * @returns Array of validation errors (empty if valid)
 */
export function validateApiRow(row: Record<string, any>, source: string = 'API'): string[] {
  // Only validate in development
  if (import.meta.env.PROD) {
    return [];
  }

  const errors: string[] = [];
  const keys = Object.keys(row);

  // Check for forbidden keys (capitalized/CSV format)
  const foundForbidden = keys.filter(key => FORBIDDEN_KEYS.includes(key));
  if (foundForbidden.length > 0) {
    errors.push(
      `[${source}] Response contains forbidden keys (should be camelCase): ${foundForbidden.join(', ')}`
    );
  }

  // Check for required keys
  const missingRequired = REQUIRED_KEYS.filter(key => !(key in row) || row[key] === undefined || row[key] === null);
  if (missingRequired.length > 0) {
    errors.push(
      `[${source}] Response missing required keys: ${missingRequired.join(', ')}`
    );
  }

  return errors;
}

/**
 * Validate multiple API response rows.
 * 
 * @param rows - Array of backend API response rows
 * @param source - Source identifier for error messages
 * @returns Array of validation errors (empty if all valid)
 */
export function validateApiRows(rows: Record<string, any>[], source: string = 'API'): string[] {
  if (import.meta.env.PROD) {
    return [];
  }

  const errors: string[] = [];
  rows.forEach((row, index) => {
    const rowErrors = validateApiRow(row, `${source}[${index}]`);
    errors.push(...rowErrors);
  });
  return errors;
}

/**
 * Report validation errors (console.error + trigger banner).
 * Only runs in development.
 * 
 * @param errors - Array of error messages
 */
export function reportValidationErrors(errors: string[]): void {
  if (import.meta.env.PROD || errors.length === 0) {
    return;
  }

  // Console error for each validation error
  errors.forEach(error => {
    console.error(`[API Validator] ${error}`);
  });

  // Dispatch custom event to show banner
  window.dispatchEvent(
    new CustomEvent('api-validation-error', {
      detail: { errors },
    })
  );
}

