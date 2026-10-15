import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeBalances, type NetPosition } from './balances.js';
import { approveExpense } from './expense.js';
import { simplify, type Transfer } from './simplify.js';
import { MEMBERS, balancedNets, expenseDraft, lockedRate } from './test/arbitraries.js';

const approvedExpense = expenseDraft(MEMBERS).chain((d) =>
  lockedRate(d.currency).map((rate) => approveExpense(d, rate, '2026-10-17T19:31:00.000Z')),
);

const sum = (xs: readonly bigint[]) => xs.reduce((a, b) => a + b, 0n);

function apply(nets: readonly NetPosition[], transfers: readonly Transfer[]): Map<string, bigint> {
  const m = new Map(nets.map((n) => [n.participant, n.netCents]));
  for (const t of transfers) {
    m.set(t.from, (m.get(t.from) ?? 0n) + t.amountCents);
    m.set(t.to, (m.get(t.to) ?? 0n) - t.amountCents);
  }
  return m;
}

describe('properties', () => {
  it('(a) per-expense USD shares sum to the converted total; original shares sum to the total', () => {
    fc.assert(
      fc.property(approvedExpense, (e) => {
        expect(sum(e.allocation.usdShares.map((s) => s.amount))).toBe(e.allocation.usdTotalCents);
        expect(sum(e.allocation.originalShares.map((s) => s.amount))).toBe(e.total);
        expect(e.allocation.usdShares.every((s) => s.amount >= 0n)).toBe(true);
      }),
    );
  });

  it('(b) the sum of all nets is 0, with or without settlements', () => {
    fc.assert(
      fc.property(fc.array(approvedExpense, { maxLength: 6 }), (expenses) => {
        const { nets } = computeBalances(MEMBERS, expenses, []);
        expect(sum(nets.map((n) => n.netCents))).toBe(0n);
        const plan = simplify(nets);
        const settlements = plan.map((t, i) => ({
          id: `s${i}`,
          tripId: 't',
          from: t.from,
          to: t.to,
          amountCents: t.amountCents,
          rail: 'onchain' as const,
          status: i % 2 === 0 ? ('confirmed' as const) : ('pending' as const),
          ref: null,
          createdAt: '2026-10-17T19:31:00.000Z',
        }));
        const after = computeBalances(MEMBERS, expenses, settlements);
        expect(sum(after.nets.map((n) => n.netCents))).toBe(0n);
        expect(after.projectedNets.every((n) => n.netCents === 0n)).toBe(true);
      }),
    );
  });

  it('(c) applying simplify() transfers zeroes every net; amounts are positive', () => {
    fc.assert(
      fc.property(balancedNets, (nets) => {
        const transfers = simplify(nets);
        expect([...apply(nets, transfers).values()].every((v) => v === 0n)).toBe(true);
        expect(transfers.every((t) => t.amountCents > 0n && t.from !== t.to)).toBe(true);
      }),
    );
  });

  it('(d) simplify() outputs at most n − 1 transfers (n = non-zero nets)', () => {
    fc.assert(
      fc.property(balancedNets, (nets) => {
        const nonZero = nets.filter((n) => n.netCents !== 0n).length;
        expect(simplify(nets).length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
      }),
    );
  });

  it('(e) simplify() does not depend on input order', () => {
    fc.assert(
      fc.property(balancedNets, (nets) => {
        expect(simplify([...nets].reverse())).toEqual(simplify(nets));
      }),
    );
  });
});
