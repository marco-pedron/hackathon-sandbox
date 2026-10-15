import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { approveExpense } from './expense.js';
import { computeBalances } from './balances.js';
import { lockRate, manualRate, parseRateTable } from './fx.js';
import { simplify } from './simplify.js';
import {
  APPROVED_AT,
  LOCKED_AT,
  eurTaxi,
  settlement,
  usdSupermarket,
  vndDinner,
} from './test/fixtures.js';

const table = parseRateTable(
  JSON.parse(readFileSync(new URL('../../../infra/rates.json', import.meta.url), 'utf8')),
);
const members = ['alice', 'bob', 'charlie'];
const approve = (d: typeof vndDinner) =>
  approveExpense(d, lockRate(table, d.currency, LOCKED_AT), APPROVED_AT);

describe('demo trip, worked out by hand', () => {
  it('VND dinner: items split, tip proportional, total converted once, USD shares exact', () => {
    const e = approve(vndDinner);
    // Item subtotals: alice 65,000 + 10,000 = 75,000; bob 75,000; charlie 75,000 + 10,000 = 85,000.
    // Tip 20,000 ∝ 75/75/85: 6,382.97 / 6,382.97 / 7,234.04 → floors 6,382/6,382/7,234 (sum 19,998),
    // two leftover units go to the largest remainders (alice, bob) → 6,383 / 6,383 / 7,234.
    expect(e.allocation.originalShares).toEqual([
      { participant: 'alice', amount: 81_383n },
      { participant: 'bob', amount: 81_383n },
      { participant: 'charlie', amount: 92_234n },
    ]);
    // 255,000 VND / 26,350 per USD = 9.6774… USD → 968 cents (half up, .74 rounds up).
    expect(e.lockedRate).toEqual({
      currency: 'VND',
      value: '26350',
      asOf: '2026-10-16',
      source: 'table',
      lockedAt: LOCKED_AT,
    });
    expect(e.allocation.usdTotalCents).toBe(968n);
    // 968 ∝ shares: 308.93 / 308.93 / 350.12 → 308/308/350 + 2 leftovers to alice, bob.
    expect(e.allocation.usdShares).toEqual([
      { participant: 'alice', amount: 309n },
      { participant: 'bob', amount: 309n },
      { participant: 'charlie', amount: 350n },
    ]);
    expect(e.approvedAt).toBe(APPROVED_AT);
  });

  it('EUR taxi: unassigned item shared by all, converted at the table rate', () => {
    const e = approve(eurTaxi);
    // 42.50 / 3 = 14.1666… → 1,417 / 1,417 / 1,416.
    expect(e.allocation.originalShares.map((s) => s.amount)).toEqual([1_417n, 1_417n, 1_416n]);
    // 42.50 EUR / 0.86 = 49.4186… USD → 4,942 cents.
    expect(e.allocation.usdTotalCents).toBe(4_942n);
    expect(e.allocation.usdShares.map((s) => s.amount)).toEqual([1_648n, 1_648n, 1_646n]);
  });

  it('USD supermarket: tax proportional to item subtotals, tie on remainder → lowest id', () => {
    const e = approve(usdSupermarket);
    // Subtotals: alice 433 + 1,500 = 1,933; bob 433; charlie 433. Tax 224 → 154.69 / 34.65 / 34.65:
    // floors 154/34/34, leftovers to alice (largest remainder) then bob (ties charlie, lower id).
    expect(e.allocation.originalShares.map((s) => s.amount)).toEqual([2_088n, 468n, 467n]);
    expect(e.lockedRate.value).toBe('1');
    expect(e.allocation.usdTotalCents).toBe(3_023n);
    expect(e.allocation.usdShares).toEqual(e.allocation.originalShares);
  });

  it('manual rate override is stored with source "manual" and used for conversion', () => {
    const rate = manualRate('VND', '25000', LOCKED_AT);
    const e = approveExpense(vndDinner, rate, APPROVED_AT);
    expect(e.lockedRate).toEqual({
      currency: 'VND',
      value: '25000',
      asOf: '2026-10-17',
      source: 'manual',
      lockedAt: LOCKED_AT,
    });
    expect(e.allocation.usdTotalCents).toBe(1_020n); // 255,000 / 25,000 = 10.20 USD
  });

  it('3-person balances: nets, plan, and the plan settles everything', () => {
    const expenses = [approve(vndDinner), approve(eurTaxi)];
    const { nets } = computeBalances(members, expenses, []);
    // alice +968 − 309 − 1,648 = −989; bob −309 + 4,942 − 1,648 = 2,985; charlie −350 − 1,646 = −1,996.
    expect(nets).toEqual([
      { participant: 'alice', netCents: -989n },
      { participant: 'bob', netCents: 2_985n },
      { participant: 'charlie', netCents: -1_996n },
    ]);
    expect(simplify(nets)).toEqual([
      { from: 'charlie', to: 'bob', amountCents: 1_996n },
      { from: 'alice', to: 'bob', amountCents: 989n },
    ]);
  });

  it('already settled: confirmed settlements zero every net and the plan is empty', () => {
    const expenses = [approve(vndDinner), approve(eurTaxi)];
    const settled = computeBalances(members, expenses, [
      settlement('charlie', 'bob', 1_996n, 'confirmed'),
      settlement('alice', 'bob', 989n, 'confirmed'),
    ]);
    expect(settled.nets.every((n) => n.netCents === 0n)).toBe(true);
    expect(simplify(settled.nets)).toEqual([]);
    expect(settled.pending).toEqual([]);
  });

  it('pending settlements do not change nets; projected nets plan the rest; failed are ignored', () => {
    const expenses = [approve(vndDinner), approve(eurTaxi)];
    const pending = settlement('charlie', 'bob', 1_996n, 'pending');
    const b = computeBalances(members, expenses, [
      pending,
      settlement('alice', 'bob', 989n, 'failed'),
    ]);
    expect(b.nets.map((n) => n.netCents)).toEqual([-989n, 2_985n, -1_996n]);
    expect(b.pending).toEqual([pending]);
    expect(b.projectedNets.map((n) => n.netCents)).toEqual([-989n, 989n, 0n]);
    expect(simplify(b.projectedNets)).toEqual([{ from: 'alice', to: 'bob', amountCents: 989n }]);
  });
});

describe('5-person balances', () => {
  it('nets and greedy plan with id tie-breaks', () => {
    const five = ['ana', 'ben', 'cai', 'dev', 'eli'];
    const usd = (r: string) => manualRate('USD', '1', r);
    const e1 = approveExpense(
      {
        id: 'x1',
        tripId: 't',
        description: 'boat',
        currency: 'USD',
        items: [{ label: 'Boat', amount: 5_000n, participants: [] }],
        extras: {},
        total: 5_000n,
        payer: 'ana',
        participants: five,
      },
      usd(LOCKED_AT),
      APPROVED_AT,
    );
    const e2 = approveExpense(
      {
        id: 'x2',
        tripId: 't',
        description: 'lunch',
        currency: 'USD',
        items: [{ label: 'Lunch', amount: 3_000n, participants: [] }],
        extras: {},
        total: 3_000n,
        payer: 'ben',
        participants: ['cai', 'dev', 'eli'],
      },
      usd(LOCKED_AT),
      APPROVED_AT,
    );
    const { nets } = computeBalances(five, [e1, e2], []);
    expect(nets.map((n) => n.netCents)).toEqual([4_000n, 2_000n, -2_000n, -2_000n, -2_000n]);
    // Debtors tie at 2,000 → cai first; creditors: ana (4,000), then ana/ben tie at 2,000 → ana.
    expect(simplify(nets)).toEqual([
      { from: 'cai', to: 'ana', amountCents: 2_000n },
      { from: 'dev', to: 'ana', amountCents: 2_000n },
      { from: 'eli', to: 'ben', amountCents: 2_000n },
    ]);
  });
});
