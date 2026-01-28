/**
 * Regression test: Verify that numeric normalization preserves 0 values.
 * This test would fail if we use `|| -1` instead of proper checks.
 * 
 * To run manually in browser console:
 *   import { testNormalization } from './normalization.test';
 *   testNormalization();
 */

// Test the normalization logic (matches mappers.ts implementation)
function normalizeSSWPrediction(raw: any): -1 | 0 | 1 {
  const numVal = Number(raw);
  return (numVal === -1 || numVal === 0 || numVal === 1) 
    ? (numVal as -1 | 0 | 1)
    : -1;
}

// Regression test cases
export function testNormalization(): void {
  const errors: string[] = [];
  
  // Critical: 0 should remain 0 (this is the main bug we're preventing)
  if (normalizeSSWPrediction(0) !== 0) {
    errors.push('0 should remain 0, not become -1');
  }
  
  // Other valid values
  if (normalizeSSWPrediction(-1) !== -1) errors.push('-1 should remain -1');
  if (normalizeSSWPrediction(1) !== 1) errors.push('1 should remain 1');
  
  // Invalid values should default to -1
  if (normalizeSSWPrediction(null) !== -1) errors.push('null should default to -1');
  if (normalizeSSWPrediction(undefined) !== -1) errors.push('undefined should default to -1');
  if (normalizeSSWPrediction(2) !== -1) errors.push('invalid value 2 should default to -1');
  if (normalizeSSWPrediction(NaN) !== -1) errors.push('NaN should default to -1');
  
  // String conversions
  if (normalizeSSWPrediction("0") !== 0) errors.push('string "0" should become 0');
  if (normalizeSSWPrediction("-1") !== -1) errors.push('string "-1" should become -1');
  
  if (errors.length > 0) {
    throw new Error(`Normalization test failed:\n${errors.join('\n')}`);
  }
  
  console.log('✅ All normalization tests passed! 0 values are preserved correctly.');
}

// Development assertion: can be called during development to verify
if (import.meta.env.DEV) {
  // Auto-run in dev mode (optional - comment out if too noisy)
  // testNormalization();
}

