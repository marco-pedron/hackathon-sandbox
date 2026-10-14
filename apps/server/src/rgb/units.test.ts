import { describe, expect, it } from 'vitest';
import { assetUnitsToUsdCents, formatUsd, fromApiAmount, toApiAmount, usdCentsToAssetUnits } from './units.js';

describe('asset units', () => {
  it('maps USD cents 1:1 to asset units', () => {
    expect(usdCentsToAssetUnits(500n)).toBe(500n);
    expect(assetUnitsToUsdCents(1_000_000n)).toBe(1_000_000n);
  });

  it('converts to and from API integers', () => {
    expect(toApiAmount(500n)).toBe(500);
    expect(fromApiAmount(49_500)).toBe(49_500n);
  });

  it('rejects zero, negative and unsafe amounts', () => {
    expect(() => toApiAmount(0n)).toThrow();
    expect(() => toApiAmount(-1n)).toThrow();
    expect(() => toApiAmount(2n ** 60n)).toThrow();
    expect(() => fromApiAmount(1.5)).toThrow();
  });

  it('formats units as USD', () => {
    expect(formatUsd(500n)).toBe('5.00');
    expect(formatUsd(1_000_005n)).toBe('10000.05');
    expect(formatUsd(-7n)).toBe('-0.07');
  });
});
