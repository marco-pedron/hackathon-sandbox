import { describe, expect, it } from 'vitest';
import { divRoundHalfUp, parseDecimal } from './rational.js';

describe('parseDecimal', () => {
  it('parses exactly and reduces', () => {
    expect(parseDecimal('25450.5')).toEqual({ num: 50_901n, den: 2n });
    expect(parseDecimal('0.86')).toEqual({ num: 43n, den: 50n });
    expect(parseDecimal('26350')).toEqual({ num: 26_350n, den: 1n });
    expect(parseDecimal('1.000')).toEqual({ num: 1n, den: 1n });
  });

  it.each(['0', '0.00', '-1', '1e3', '1,5', '', ' 1', '.5', '1.', 'abc'])('rejects %j', (s) => {
    expect(() => parseDecimal(s)).toThrow(expect.objectContaining({ code: 'INVALID_RATE' }));
  });
});

describe('divRoundHalfUp', () => {
  it('rounds half up', () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n); // 2.5 → 3
    expect(divRoundHalfUp(1n, 2n)).toBe(1n); // 0.5 → 1
    expect(divRoundHalfUp(4n, 3n)).toBe(1n); // 1.33 → 1
    expect(divRoundHalfUp(5n, 3n)).toBe(2n); // 1.67 → 2
    expect(divRoundHalfUp(49n, 100n)).toBe(0n); // just below .5
    expect(divRoundHalfUp(51n, 100n)).toBe(1n); // just above .5
    expect(divRoundHalfUp(0n, 7n)).toBe(0n);
  });

  it('rejects negative amounts and non-positive divisors', () => {
    expect(() => divRoundHalfUp(-1n, 2n)).toThrow(
      expect.objectContaining({ code: 'NEGATIVE_AMOUNT' }),
    );
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(expect.objectContaining({ code: 'INVALID_RATE' }));
  });
});
