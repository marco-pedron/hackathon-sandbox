import { describe, expect, it } from 'vitest';
import { ASSET_PRECISION, assetUnitsToUsdCents, usdCentsToAssetUnits } from './asset.js';

describe('NIA asset units', () => {
  it('maps USD cents 1:1 to asset units at precision 2', () => {
    expect(ASSET_PRECISION).toBe(2);
    expect(usdCentsToAssetUnits(500n)).toBe(500n);
    expect(assetUnitsToUsdCents(1_000_000n)).toBe(1_000_000n);
  });

  it('rejects negative amounts', () => {
    expect(() => usdCentsToAssetUnits(-1n)).toThrow(
      expect.objectContaining({ code: 'NEGATIVE_AMOUNT' }),
    );
    expect(() => assetUnitsToUsdCents(-1n)).toThrow(
      expect.objectContaining({ code: 'NEGATIVE_AMOUNT' }),
    );
  });
});
