import { assertNonNegative } from './errors.js';

// The demo NIA asset has precision 2: 100 units = 1.00 USD, so USD cents ↔ asset units is 1:1.
export const ASSET_PRECISION = 2;

export function usdCentsToAssetUnits(cents: bigint): bigint {
  assertNonNegative(cents, 'USD cents');
  return cents;
}

export function assetUnitsToUsdCents(units: bigint): bigint {
  assertNonNegative(units, 'asset units');
  return units;
}
