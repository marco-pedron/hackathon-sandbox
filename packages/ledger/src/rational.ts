import { LedgerError } from './errors.js';

// An exact positive rational: den > 0, reduced to lowest terms.
export type Rational = { num: bigint; den: bigint };

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

// Parses a positive decimal string ("25450.5") exactly. No exponents, signs, commas or spaces.
export function parseDecimal(s: string): Rational {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m)
    throw new LedgerError('INVALID_RATE', `"${s}" is not a decimal like "25450.5"`, { value: s });
  const [, intPart = '', fracPart = ''] = m;
  const num = BigInt(intPart + fracPart);
  if (num === 0n)
    throw new LedgerError('INVALID_RATE', `rate "${s}" must be greater than zero`, { value: s });
  const den = 10n ** BigInt(fracPart.length);
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

// THE rounding rule of the ledger: round half up (x.5 → x+1) of num/den.
// Only defined for num >= 0 and den > 0, where half-up equals half away from zero.
export function divRoundHalfUp(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new LedgerError('INVALID_RATE', `divisor must be positive, got ${den}`);
  if (num < 0n)
    throw new LedgerError('NEGATIVE_AMOUNT', `cannot round a negative amount, got ${num}/${den}`);
  const q = num / den;
  return 2n * (num % den) >= den ? q + 1n : q;
}
