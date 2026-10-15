import { describe, expect, it } from 'vitest';
import { simplify } from './simplify.js';

const nets = (o: Record<string, bigint>) =>
  Object.entries(o).map(([participant, netCents]) => ({ participant, netCents }));

describe('simplify', () => {
  it('largest debtor pays largest creditor', () => {
    expect(simplify(nets({ a: 500n, b: -100n, c: -400n }))).toEqual([
      { from: 'c', to: 'a', amountCents: 400n },
      { from: 'b', to: 'a', amountCents: 100n },
    ]);
  });

  it('one debtor can pay several creditors', () => {
    expect(simplify(nets({ a: 300n, b: 200n, c: -500n }))).toEqual([
      { from: 'c', to: 'a', amountCents: 300n },
      { from: 'c', to: 'b', amountCents: 200n },
    ]);
  });

  it('is deterministic under ties and input order', () => {
    const expected = [
      { from: 'b', to: 'a', amountCents: 100n },
      { from: 'd', to: 'c', amountCents: 100n },
    ];
    expect(simplify(nets({ a: 100n, b: -100n, c: 100n, d: -100n }))).toEqual(expected);
    expect(simplify(nets({ d: -100n, c: 100n, b: -100n, a: 100n }))).toEqual(expected);
  });

  it('nothing to do when all nets are zero or the list is empty', () => {
    expect(simplify(nets({ a: 0n, b: 0n }))).toEqual([]);
    expect(simplify([])).toEqual([]);
  });

  it('rejects unbalanced or duplicated nets', () => {
    expect(() => simplify(nets({ a: 1n, b: 0n }))).toThrow(
      expect.objectContaining({ code: 'UNBALANCED_NETS' }),
    );
    expect(() => simplify([...nets({ a: 1n }), ...nets({ a: -1n })])).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_PARTICIPANT' }),
    );
  });
});
