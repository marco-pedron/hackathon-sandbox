import { CURRENCY_EXPONENTS, type CurrencyCode } from '@settleup/shared';
import { LedgerError } from './errors.js';

export { CURRENCY_EXPONENTS, type CurrencyCode };

export type Money = { amount: bigint; currency: CurrencyCode };

export function isCurrency(code: string): code is CurrencyCode {
  return Object.hasOwn(CURRENCY_EXPONENTS, code);
}

// Unknown currencies are an error, never a default exponent.
export function assertCurrency(code: string): CurrencyCode {
  if (!isCurrency(code))
    throw new LedgerError('UNKNOWN_CURRENCY', `unknown currency "${code}"`, { currency: code });
  return code;
}

// Minor units per major unit: 100n for USD, 1n for VND.
export function minorPerMajor(currency: CurrencyCode): bigint {
  return 10n ** BigInt(CURRENCY_EXPONENTS[assertCurrency(currency)]);
}

// "12.34 USD", "258500 VND", "-0.07 EUR".
export function formatMoney({ amount, currency }: Money): string {
  const unit = minorPerMajor(currency);
  const sign = amount < 0n ? '-' : '';
  const abs = amount < 0n ? -amount : amount;
  const major = (abs / unit).toString();
  if (unit === 1n) return `${sign}${major} ${currency}`;
  const minor = (abs % unit).toString().padStart(CURRENCY_EXPONENTS[currency], '0');
  return `${sign}${major}.${minor} ${currency}`;
}
