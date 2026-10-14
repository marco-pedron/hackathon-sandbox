import { describe, expect, it } from 'vitest';
import { LedgerError } from './errors.js';
import { assertCurrency, formatMoney, isCurrency, minorPerMajor } from './money.js';

describe('currencies', () => {
  it('uses the single exponent table', () => {
    expect(minorPerMajor('USD')).toBe(100n);
    expect(minorPerMajor('CHF')).toBe(100n);
    expect(minorPerMajor('VND')).toBe(1n);
    expect(minorPerMajor('JPY')).toBe(1n);
  });

  it('rejects unknown currencies with a typed error, never a default', () => {
    expect(isCurrency('THB')).toBe(false);
    expect(isCurrency('toString')).toBe(false);
    expect(() => assertCurrency('THB')).toThrow(LedgerError);
    expect(() => assertCurrency('THB')).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_CURRENCY' }),
    );
    expect(() => minorPerMajor('XXX' as 'USD')).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_CURRENCY' }),
    );
  });

  it('formats money by exponent', () => {
    expect(formatMoney({ amount: 1_234n, currency: 'USD' })).toBe('12.34 USD');
    expect(formatMoney({ amount: 5n, currency: 'EUR' })).toBe('0.05 EUR');
    expect(formatMoney({ amount: -7n, currency: 'EUR' })).toBe('-0.07 EUR');
    expect(formatMoney({ amount: 255_000n, currency: 'VND' })).toBe('255000 VND');
  });
});
