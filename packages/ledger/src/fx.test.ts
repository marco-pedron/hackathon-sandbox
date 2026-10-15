import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { convertToUsdCents, lockRate, manualRate, parseRateTable } from './fx.js';
import { LOCKED_AT } from './test/fixtures.js';

const rawTable = JSON.parse(
  readFileSync(new URL('../../../infra/rates.json', import.meta.url), 'utf8'),
);

describe('rate table', () => {
  it('infra/rates.json is valid: base USD, asOf, source, decimal-string rates', () => {
    const t = parseRateTable(rawTable);
    expect(t.base).toBe('USD');
    expect(t.asOf).toBe('2026-10-16');
    expect(t.source).toMatch(/demo/i);
    expect(t.rates.VND).toBe('26350');
  });

  it('rejects unknown currencies, number rates, bad rate strings and wrong bases', () => {
    const base = { base: 'USD', asOf: '2026-10-16', source: 's' };
    expect(() => parseRateTable({ ...base, rates: { THB: '36' } })).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_CURRENCY' }),
    );
    expect(() => parseRateTable({ ...base, rates: { EUR: 0.86 } })).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE_TABLE' }),
    );
    expect(() => parseRateTable({ ...base, rates: { EUR: '0' } })).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE' }),
    );
    expect(() => parseRateTable({ ...base, base: 'EUR', rates: {} })).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE_TABLE' }),
    );
    expect(() => parseRateTable(null)).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE_TABLE' }),
    );
    expect(() => parseRateTable({ ...base, rates: null })).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE_TABLE' }),
    );
  });
});

describe('locking rates', () => {
  const table = parseRateTable(rawTable);

  it('locks the table rate with its date and source', () => {
    expect(lockRate(table, 'EUR', LOCKED_AT)).toEqual({
      currency: 'EUR',
      value: '0.86',
      asOf: '2026-10-16',
      source: 'table',
      lockedAt: LOCKED_AT,
    });
  });

  it('USD is always 1, even if missing from the table', () => {
    expect(lockRate({ ...table, rates: {} }, 'USD', LOCKED_AT).value).toBe('1');
  });

  it('errors on an unknown currency or a missing rate', () => {
    expect(() => lockRate(table, 'THB', LOCKED_AT)).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_CURRENCY' }),
    );
    expect(() => lockRate({ ...table, rates: {} }, 'EUR', LOCKED_AT)).toThrow(
      expect.objectContaining({ code: 'MISSING_RATE' }),
    );
  });

  it('manual rates are validated and dated at lock time', () => {
    expect(manualRate('EUR', '0.9', LOCKED_AT)).toMatchObject({
      source: 'manual',
      asOf: '2026-10-17',
      value: '0.9',
    });
    expect(() => manualRate('EUR', '0.9.1', LOCKED_AT)).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE' }),
    );
    expect(() => manualRate('THB', '36', LOCKED_AT)).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_CURRENCY' }),
    );
  });
});

describe('convertToUsdCents', () => {
  const vnd = (v: string) => manualRate('VND', v, LOCKED_AT);

  it('rounds half up exactly once', () => {
    expect(convertToUsdCents(1n, 'VND', vnd('200'))).toBe(1n); // 0.5 cent → 1
    expect(convertToUsdCents(3n, 'VND', vnd('200'))).toBe(2n); // 1.5 → 2
    expect(convertToUsdCents(1n, 'VND', vnd('400'))).toBe(0n); // 0.25 → 0
    expect(convertToUsdCents(1n, 'VND', vnd('26350'))).toBe(0n);
  });

  it('handles fractional rates and 2-decimal currencies', () => {
    expect(convertToUsdCents(4_250n, 'EUR', manualRate('EUR', '0.86', LOCKED_AT))).toBe(4_942n);
    expect(convertToUsdCents(1_000n, 'JPY', manualRate('JPY', '150.5', LOCKED_AT))).toBe(664n); // 6.6445 → 6.64
    expect(convertToUsdCents(1_234n, 'USD', manualRate('USD', '1', LOCKED_AT))).toBe(1_234n);
  });

  it('refuses a rate locked for another currency', () => {
    expect(() => convertToUsdCents(1n, 'EUR', vnd('200'))).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE' }),
    );
  });
});
