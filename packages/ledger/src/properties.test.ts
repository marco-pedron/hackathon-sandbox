import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeBalances, type NetPosition } from './balances.js';
import { approveExpense } from './expense.js';
import { closePot, confirmedDeposits, exposure } from './pot.js';
import { simplify, type Transfer } from './simplify.js';
import {
  MEMBERS,
  balancedNets,
  expenseDraft,
  lockedRate,
  potScenario,
} from './test/arbitraries.js';

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

describe('pot properties', () => {
  it('(f) payouts sum exactly to the pot and none is negative', () => {
    fc.assert(
      fc.property(potScenario, (input) => {
        const { potTotalCents, payouts } = closePot(input);
        expect(sum(payouts.map((p) => p.payoutCents))).toBe(potTotalCents);
        expect(payouts.every((p) => p.payoutCents >= 0n)).toBe(true);
      }),
    );
  });

  it('(g) creditors get at least their deposit, debtors at most theirs', () => {
    fc.assert(
      fc.property(potScenario, (input) => {
        for (const p of closePot(input).payouts) {
          if (p.netCents > 0n) expect(p.payoutCents).toBeGreaterThanOrEqual(p.depositCents);
          if (p.netCents < 0n) expect(p.payoutCents).toBeLessThanOrEqual(p.depositCents);
        }
      }),
    );
  });

  it('(h) uncovered = Σ debt beyond deposit = Σ charges to creditors', () => {
    fc.assert(
      fc.property(potScenario, (input) => {
        const { uncoveredCents, payouts } = closePot(input);
        const excess = sum(
          payouts.map((p) =>
            p.depositCents + p.netCents < 0n ? -(p.depositCents + p.netCents) : 0n,
          ),
        );
        expect(uncoveredCents).toBe(excess);
        expect(sum(payouts.map((p) => p.uncoveredChargeCents))).toBe(excess);
      }),
    );
  });

  it('(i) when nobody is over their deposit, payout = deposit + net', () => {
    fc.assert(
      fc.property(potScenario, (input) => {
        const deposits = confirmedDeposits(input.config, input.deposits);
        fc.pre(exposure(input.balances.nets, deposits).every((e) => e.level !== 'over'));
        const closing = closePot(input);
        expect(closing.uncoveredCents).toBe(0n);
        for (const p of closing.payouts) expect(p.payoutCents).toBe(p.depositCents + p.netCents);
      }),
    );
  });

  it('(j) closePot does not depend on input order', () => {
    fc.assert(
      fc.property(potScenario, (input) => {
        const nets = [...input.balances.nets].reverse();
        const reversed = {
          config: { ...input.config, members: [...input.config.members].reverse() },
          balances: { nets, projectedNets: nets, pending: [] },
          deposits: [...input.deposits].reverse(),
        };
        expect(closePot(reversed)).toEqual(closePot(input));
      }),
    );
  });
});
