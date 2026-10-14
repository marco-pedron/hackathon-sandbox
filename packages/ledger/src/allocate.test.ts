import { describe, expect, it } from 'vitest';
import { allocateByWeight, splitEqually } from './allocate.js';

const obj = (m: Map<string, bigint>) => Object.fromEntries(m);

describe('largest remainder', () => {
  it('100 cents / 3 people → 34/33/33, the extra cent to the lowest id', () => {
    expect(obj(splitEqually(100n, ['charlie', 'alice', 'bob']))).toEqual({
      alice: 34n,
      bob: 33n,
      charlie: 33n,
    });
  });

  it('1 VND / 3 people → 1/0/0', () => {
    expect(obj(splitEqually(1n, ['bob', 'charlie', 'alice']))).toEqual({
      alice: 1n,
      bob: 0n,
      charlie: 0n,
    });
  });

  it('returns ids in ascending order regardless of input order', () => {
    expect([...splitEqually(10n, ['c', 'a', 'b']).keys()]).toEqual(['a', 'b', 'c']);
  });

  it('larger remainder wins over a lower id', () => {
    // 10 ∝ 1:2 → 3.33 / 6.67 → b gets the leftover.
    expect(
      obj(
        allocateByWeight(10n, [
          { id: 'a', weight: 1n },
          { id: 'b', weight: 2n },
        ]),
      ),
    ).toEqual({ a: 3n, b: 7n });
  });

  it('zero weights get nothing; zero total gives zeros', () => {
    expect(
      obj(
        allocateByWeight(5n, [
          { id: 'a', weight: 0n },
          { id: 'b', weight: 3n },
        ]),
      ),
    ).toEqual({ a: 0n, b: 5n });
    expect(obj(splitEqually(0n, ['a', 'b']))).toEqual({ a: 0n, b: 0n });
  });

  it('rejects empty or all-zero weights, negatives and duplicate ids', () => {
    expect(() => splitEqually(1n, [])).toThrow(
      expect.objectContaining({ code: 'EMPTY_ALLOCATION' }),
    );
    expect(() => allocateByWeight(1n, [{ id: 'a', weight: 0n }])).toThrow(
      expect.objectContaining({ code: 'EMPTY_ALLOCATION' }),
    );
    expect(() => splitEqually(-1n, ['a'])).toThrow(
      expect.objectContaining({ code: 'NEGATIVE_AMOUNT' }),
    );
    expect(() => allocateByWeight(1n, [{ id: 'a', weight: -1n }])).toThrow(
      expect.objectContaining({ code: 'NEGATIVE_AMOUNT' }),
    );
    expect(() => splitEqually(1n, ['a', 'a'])).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_PARTICIPANT' }),
    );
  });
});
