import { describe, expect, it } from 'vitest';
import { computeBalances } from './balances.js';
import { approveExpense } from './expense.js';
import { manualRate } from './fx.js';
import { APPROVED_AT, LOCKED_AT, draft, settlement } from './test/fixtures.js';

const lunch = approveExpense(
  draft({
    items: [{ label: 'lunch', amount: 900n, participants: [] }],
    total: 900n,
    payer: 'alice',
    participants: ['alice', 'bob', 'charlie'],
  }),
  manualRate('USD', '1', LOCKED_AT),
  APPROVED_AT,
);
const members = ['charlie', 'alice', 'bob'];

describe('computeBalances', () => {
  it('members with nothing are 0; output is ordered by id', () => {
    expect(computeBalances(members, [], []).nets).toEqual([
      { participant: 'alice', netCents: 0n },
      { participant: 'bob', netCents: 0n },
      { participant: 'charlie', netCents: 0n },
    ]);
  });

  it('confirmed settlements move money from debtor to creditor', () => {
    const b = computeBalances(members, [lunch], [settlement('bob', 'alice', 300n, 'confirmed')]);
    expect(b.nets.map((n) => n.netCents)).toEqual([300n, 0n, -300n]);
  });

  it('rejects non-members, self-payments, duplicate members and corrupted allocations', () => {
    expect(() => computeBalances(['alice', 'bob'], [lunch], [])).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_PARTICIPANT' }),
    );
    expect(() => computeBalances(members, [{ ...lunch, payer: 'zed' }], [])).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_PARTICIPANT' }),
    );
    expect(() =>
      computeBalances(members, [], [settlement('alice', 'zed', 1n, 'confirmed')]),
    ).toThrow(expect.objectContaining({ code: 'UNKNOWN_PARTICIPANT' }));
    expect(() => computeBalances(members, [], [settlement('zed', 'alice', 1n, 'pending')])).toThrow(
      expect.objectContaining({ code: 'UNKNOWN_PARTICIPANT' }),
    );
    expect(() => computeBalances(members, [], [settlement('bob', 'bob', 1n, 'confirmed')])).toThrow(
      expect.objectContaining({ code: 'INVALID_ASSIGNMENT' }),
    );
    expect(() => computeBalances(['a', 'a'], [], [])).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_PARTICIPANT' }),
    );
    const corrupted = { ...lunch, allocation: { ...lunch.allocation, usdTotalCents: 901n } };
    expect(() => computeBalances(members, [corrupted], [])).toThrow(
      expect.objectContaining({ code: 'TOTAL_MISMATCH' }),
    );
  });
});
