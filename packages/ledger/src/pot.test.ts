import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeBalances, type Balances } from './balances.js';
import { LedgerError } from './errors.js';
import { approveExpense } from './expense.js';
import { lockRate, parseRateTable } from './fx.js';
import { closePot, confirmedDeposits, exposure, potThreshold } from './pot.js';
import {
  APPROVED_AT,
  LOCKED_AT,
  demoTrip,
  deposit,
  settlement,
  vndDinner,
} from './test/fixtures.js';

const table = parseRateTable(
  JSON.parse(readFileSync(new URL('../../../infra/rates.json', import.meta.url), 'utf8')),
);
const D = demoTrip.depositPerMemberCents;
const fullDeposits = demoTrip.members.map((m) => deposit(m, D));

// Balances built straight from nets, for cases that don't need real expenses.
const fromNets = (a: bigint, b: bigint, c: bigint): Balances => {
  const nets = [
    { participant: 'alice', netCents: a },
    { participant: 'bob', netCents: b },
    { participant: 'charlie', netCents: c },
  ];
  return { nets, projectedNets: nets, pending: [] };
};

const payoutsOf = (r: ReturnType<typeof closePot>) => r.payouts.map((p) => p.payoutCents);

function expectCode(fn: () => unknown, code: LedgerError['code']) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(LedgerError);
    expect((e as LedgerError).code).toBe(code);
    return;
  }
  throw new Error(`expected LedgerError ${code}`);
}

describe('potThreshold', () => {
  it('is a strict majority: floor(n/2) + 1', () => {
    expect([1, 2, 3, 4, 5].map(potThreshold)).toEqual([1, 2, 2, 3, 3]);
  });

  it('rejects an empty or non-integer member count', () => {
    expectCode(() => potThreshold(0), 'INVALID_TRIP_CONFIG');
    expectCode(() => potThreshold(2.5), 'INVALID_TRIP_CONFIG');
  });
});

describe('confirmedDeposits', () => {
  it('counts confirmed only, sums several per member, 0 for a member with none', () => {
    const rows = confirmedDeposits(demoTrip, [
      deposit('alice', 3_000n, 'confirmed', 'd1'),
      deposit('alice', 2_000n, 'confirmed', 'd2'),
      deposit('bob', 5_000n, 'pending'),
      deposit('bob', 5_000n, 'failed'),
    ]);
    expect(rows).toEqual([
      { member: 'alice', depositCents: 5_000n },
      { member: 'bob', depositCents: 0n },
      { member: 'charlie', depositCents: 0n },
    ]);
  });

  it('rejects a non-member, another trip and a bad config', () => {
    expectCode(() => confirmedDeposits(demoTrip, [deposit('mallory', D)]), 'UNKNOWN_PARTICIPANT');
    expectCode(
      () => confirmedDeposits(demoTrip, [{ ...deposit('alice', D), tripId: 'other' }]),
      'INVALID_TRIP_CONFIG',
    );
    expectCode(
      () => confirmedDeposits({ ...demoTrip, members: ['alice', 'alice'] }, []),
      'DUPLICATE_PARTICIPANT',
    );
    expectCode(() => confirmedDeposits({ ...demoTrip, members: [] }, []), 'INVALID_TRIP_CONFIG');
    expectCode(
      () => confirmedDeposits({ ...demoTrip, depositPerMemberCents: 0n }, []),
      'INVALID_TRIP_CONFIG',
    );
  });
});

describe('demo trip §1: D = 50.00, charlie never settles', () => {
  it('bob settles, charlie runs away: his share of the dinner is paid from his deposit', () => {
    const dinner = approveExpense(vndDinner, lockRate(table, 'VND', LOCKED_AT), APPROVED_AT);
    // Alice paid 9.68; shares 3.09 / 3.09 / 3.50 (see examples.test.ts). Bob pays his 3.09.
    const balances = computeBalances(
      demoTrip.members,
      [dinner],
      [settlement('bob', 'alice', 309n, 'confirmed')],
    );
    expect(balances.nets.map((n) => n.netCents)).toEqual([350n, 0n, -350n]);

    const deposits = confirmedDeposits(demoTrip, fullDeposits);
    // Charlie owes 3.50 of a 50.00 deposit = 7% → ok.
    expect(exposure(balances.nets, deposits)).toEqual([
      { member: 'alice', depositCents: 5_000n, debtCents: 0n, level: 'ok' },
      { member: 'bob', depositCents: 5_000n, debtCents: 0n, level: 'ok' },
      { member: 'charlie', depositCents: 5_000n, debtCents: 350n, level: 'ok' },
    ]);

    const closing = closePot({ config: demoTrip, balances, deposits: fullDeposits });
    expect(closing.potTotalCents).toBe(15_000n);
    expect(closing.uncoveredCents).toBe(0n);
    expect(closing.payouts).toEqual([
      {
        member: 'alice',
        depositCents: 5_000n,
        netCents: 350n,
        uncoveredChargeCents: 0n,
        payoutCents: 5_350n,
      },
      {
        member: 'bob',
        depositCents: 5_000n,
        netCents: 0n,
        uncoveredChargeCents: 0n,
        payoutCents: 5_000n,
      },
      {
        member: 'charlie',
        depositCents: 5_000n,
        netCents: -350n,
        uncoveredChargeCents: 0n,
        payoutCents: 4_650n,
      },
    ]);
  });

  it("charlie's debt beyond his deposit: payout 0, excess charged 6:1 to the creditors", () => {
    const balances = fromNets(6_000n, 1_000n, -7_000n);
    expect(exposure(balances.nets, confirmedDeposits(demoTrip, fullDeposits))[2]?.level).toBe(
      'over',
    );
    const closing = closePot({ config: demoTrip, balances, deposits: fullDeposits });
    // Uncovered 2,000 ∝ 6,000 : 1,000 → 1,714.28 / 285.71 → floors 1,714 / 285, the leftover
    // cent goes to bob (larger remainder).
    expect(closing.uncoveredCents).toBe(2_000n);
    expect(closing.payouts.map((p) => p.uncoveredChargeCents)).toEqual([1_714n, 286n, 0n]);
    expect(payoutsOf(closing)).toEqual([9_286n, 5_714n, 0n]);
    expect(closing.potTotalCents).toBe(15_000n);
  });
});

describe('closePot', () => {
  it('tie on the uncovered charge: the extra cent goes to the lowest id', () => {
    const trip = { ...demoTrip, depositPerMemberCents: 501n };
    const deposits = trip.members.map((m) => deposit(m, 501n));
    const closing = closePot({
      config: trip,
      balances: fromNets(1_000n, 1_000n, -2_000n),
      deposits,
    });
    // Uncovered 2,000 − 501 = 1,499 split 749.5 / 749.5 → alice 750, bob 749.
    expect(closing.uncoveredCents).toBe(1_499n);
    expect(closing.payouts.map((p) => p.uncoveredChargeCents)).toEqual([750n, 749n, 0n]);
    expect(payoutsOf(closing)).toEqual([751n, 752n, 0n]);
  });

  it('a member whose deposit failed and who owes: the whole debt is uncovered', () => {
    const deposits = [deposit('alice', D), deposit('bob', D), deposit('charlie', D, 'failed')];
    const closing = closePot({ config: demoTrip, balances: fromNets(350n, 0n, -350n), deposits });
    expect(closing.potTotalCents).toBe(10_000n);
    expect(closing.uncoveredCents).toBe(350n);
    expect(payoutsOf(closing)).toEqual([5_000n, 5_000n, 0n]);
  });

  it('two debtors over their deposit at once', () => {
    const closing = closePot({
      config: demoTrip,
      balances: fromNets(12_000n, -6_000n, -6_000n),
      deposits: fullDeposits,
    });
    expect(closing.uncoveredCents).toBe(2_000n);
    expect(payoutsOf(closing)).toEqual([15_000n, 0n, 0n]);
  });

  it('already settled trip: everyone gets their deposit back', () => {
    const closing = closePot({
      config: demoTrip,
      balances: fromNets(0n, 0n, 0n),
      deposits: fullDeposits,
    });
    expect(payoutsOf(closing)).toEqual([D, D, D]);
    expect(closing.uncoveredCents).toBe(0n);
  });

  it('refuses while a settlement or a deposit is pending', () => {
    const pending = settlement('charlie', 'alice', 350n, 'pending');
    expectCode(
      () =>
        closePot({
          config: demoTrip,
          balances: { ...fromNets(350n, 0n, -350n), pending: [pending] },
          deposits: fullDeposits,
        }),
      'POT_NOT_SETTLED',
    );
    expectCode(
      () =>
        closePot({
          config: demoTrip,
          balances: fromNets(0n, 0n, 0n),
          deposits: [...fullDeposits, deposit('bob', 100n, 'pending', 'd-extra')],
        }),
      'POT_NOT_SETTLED',
    );
  });

  it('rejects unbalanced, unknown, missing and duplicate nets', () => {
    const close = (balances: Balances) =>
      closePot({ config: demoTrip, balances, deposits: fullDeposits });
    expectCode(() => close(fromNets(1n, 0n, 0n)), 'UNBALANCED_NETS');
    const withNets = (nets: Balances['nets']): Balances => ({
      nets,
      projectedNets: nets,
      pending: [],
    });
    expectCode(
      () =>
        close(
          withNets([
            { participant: 'alice', netCents: 0n },
            { participant: 'mallory', netCents: 0n },
            { participant: 'charlie', netCents: 0n },
          ]),
        ),
      'UNKNOWN_PARTICIPANT',
    );
    expectCode(
      () =>
        close(
          withNets([
            { participant: 'alice', netCents: 0n },
            { participant: 'bob', netCents: 0n },
          ]),
        ),
      'UNKNOWN_PARTICIPANT',
    );
    expectCode(
      () =>
        close(
          withNets([
            { participant: 'alice', netCents: 0n },
            { participant: 'alice', netCents: 0n },
            { participant: 'charlie', netCents: 0n },
          ]),
        ),
      'DUPLICATE_PARTICIPANT',
    );
  });
});

describe('exposure', () => {
  const deposits = confirmedDeposits(demoTrip, fullDeposits);
  const levelFor = (debt: bigint) =>
    exposure(fromNets(debt, 0n, -debt).nets, deposits).find((e) => e.member === 'charlie')?.level;

  it('warns at 80% of the deposit and is over only above 100%', () => {
    expect(levelFor(3_999n)).toBe('ok');
    expect(levelFor(4_000n)).toBe('warn');
    expect(levelFor(5_000n)).toBe('warn');
    expect(levelFor(5_001n)).toBe('over');
  });

  it('a creditor is ok; with no deposit any debt is over, no debt is ok', () => {
    const noDeposit = confirmedDeposits(demoTrip, []);
    expect(exposure(fromNets(10n, 0n, -10n).nets, noDeposit).map((e) => e.level)).toEqual([
      'ok',
      'ok',
      'over',
    ]);
  });
});
