import { RateTableSchema, type LockedRate, type RateTable } from '@settleup/shared';
import { LedgerError } from './errors.js';
import { assertCurrency, minorPerMajor, type CurrencyCode } from './money.js';
import { divRoundHalfUp, parseDecimal } from './rational.js';

// Validates infra/rates.json: base USD, rates[X] = units of X per 1 USD as decimal strings.
export function parseRateTable(json: unknown): RateTable {
  if (typeof json === 'object' && json !== null && 'rates' in json) {
    const rates = json.rates;
    if (typeof rates === 'object' && rates !== null)
      for (const code of Object.keys(rates)) assertCurrency(code);
  }
  const parsed = RateTableSchema.safeParse(json);
  if (!parsed.success) {
    throw new LedgerError('INVALID_RATE_TABLE', `invalid rate table: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    });
  }
  for (const value of Object.values(parsed.data.rates)) parseDecimal(value);
  return parsed.data;
}

// Locks the table rate for `currency` at approval time. USD is always "1".
export function lockRate(table: RateTable, currency: string, lockedAt: string): LockedRate {
  const code = assertCurrency(currency);
  const value = code === 'USD' ? '1' : table.rates[code];
  if (value === undefined) {
    throw new LedgerError('MISSING_RATE', `no ${code} rate in the table of ${table.asOf}`, {
      currency: code,
    });
  }
  parseDecimal(value);
  return { currency: code, value, asOf: table.asOf, source: 'table', lockedAt };
}

// A user-entered rate, same direction as the table: units of `currency` per 1 USD.
export function manualRate(currency: string, value: string, lockedAt: string): LockedRate {
  const code = assertCurrency(currency);
  parseDecimal(value);
  return { currency: code, value, asOf: lockedAt.slice(0, 10), source: 'manual', lockedAt };
}

// amountMinor of `currency` → USD cents, rounded half up once:
//   cents = amountMinor / 10^exp(currency) / rate * 100
export function convertToUsdCents(
  amountMinor: bigint,
  currency: CurrencyCode,
  rate: LockedRate,
): bigint {
  if (rate.currency !== currency) {
    throw new LedgerError('INVALID_RATE', `rate is for ${rate.currency}, amount is in ${currency}`);
  }
  const { num, den } = parseDecimal(rate.value);
  return divRoundHalfUp(amountMinor * minorPerMajor('USD') * den, minorPerMajor(currency) * num);
}
