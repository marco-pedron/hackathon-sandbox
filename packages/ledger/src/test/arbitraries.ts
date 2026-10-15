import fc from 'fast-check';
import type { ExpenseDraft, LockedRate } from '@settleup/shared';
import { CURRENCY_EXPONENTS, type CurrencyCode } from '../money.js';
import type { NetPosition } from '../balances.js';

export const MEMBERS = ['alice', 'bob', 'charlie', 'dana', 'eve', 'femi'] as const;
const currencies = Object.keys(CURRENCY_EXPONENTS) as CurrencyCode[];

// Positive decimal strings: integer part 0–99,999, up to 4 decimals, never "0".
const rateValue = fc
  .tuple(
    fc.integer({ min: 0, max: 99_999 }),
    fc.option(fc.integer({ min: 0, max: 9_999 }), { nil: undefined }),
  )
  .map(([i, f]) => (f === undefined ? `${i}` : `${i}.${f.toString().padStart(4, '0')}`))
  .filter((s) => /[1-9]/.test(s));

export const lockedRate = (currency: CurrencyCode): fc.Arbitrary<LockedRate> =>
  rateValue.map((value) => ({
    currency,
    value,
    asOf: '2026-10-16',
    source: 'table',
    lockedAt: '2026-10-17T19:30:00.000Z',
  }));

const amount = fc.bigInt({ min: 0n, max: 50_000_000n });

export const expenseDraft = (members: readonly string[]): fc.Arbitrary<ExpenseDraft> =>
  fc
    .record({
      currency: fc.constantFrom(...currencies),
      payer: fc.constantFrom(...members),
      participants: fc.shuffledSubarray([...members], { minLength: 1 }),
      rawItems: fc.array(
        fc.record({
          amount,
          pick: fc.array(fc.boolean(), { minLength: members.length, maxLength: members.length }),
        }),
        { maxLength: 8 },
      ),
      tax: fc.option(amount, { nil: undefined }),
      tip: fc.option(fc.bigInt({ min: 0n, max: 1_000n }), { nil: undefined }),
    })
    .map(({ currency, payer, participants, rawItems, tax, tip }) => {
      const items = rawItems.map((it, i) => ({
        label: `item ${i}`,
        amount: it.amount,
        participants: participants.filter((_, j) => it.pick[j]),
      }));
      const extras = { ...(tax !== undefined && { tax }), ...(tip !== undefined && { tip }) };
      const total = items.reduce((a, it) => a + it.amount, 0n) + (tax ?? 0n) + (tip ?? 0n);
      return {
        id: 'p',
        tripId: 't',
        description: 'prop',
        currency,
        items,
        extras,
        total,
        payer,
        participants,
      };
    })
    .filter((d) => d.total > 0n);

// Random nets that sum to zero: n − 1 random values, the last one balances them.
export const balancedNets = fc
  .integer({ min: 0, max: MEMBERS.length })
  .chain((n) =>
    fc.array(fc.bigInt({ min: -100_000n, max: 100_000n }), { minLength: n, maxLength: n }),
  )
  .map((values): NetPosition[] => {
    if (values.length === 0) return [];
    const head = values.slice(0, -1);
    const last = -head.reduce((a, b) => a + b, 0n);
    return [...head, last].map((netCents, i) => ({ participant: MEMBERS[i] ?? `m${i}`, netCents }));
  });

// A trip at close: balanced nets for 1–6 members and a confirmed deposit per member
// (0 = no deposit), so some debtors are over their deposit and some are not.
export const potScenario = balancedNets
  .filter((nets) => nets.length > 0)
  .chain((nets) =>
    fc
      .array(fc.bigInt({ min: 0n, max: 100_000n }), {
        minLength: nets.length,
        maxLength: nets.length,
      })
      .map((amounts) => ({
        config: {
          tripId: 'vietnam-2026',
          members: nets.map((n) => n.participant),
          depositPerMemberCents: 5_000n,
        },
        balances: { nets, projectedNets: nets, pending: [] },
        deposits: amounts.flatMap((amountCents, i) =>
          amountCents === 0n
            ? []
            : [
                {
                  id: `d${i}`,
                  tripId: 'vietnam-2026',
                  member: nets[i]?.participant ?? '',
                  amountCents,
                  status: 'confirmed' as const,
                  ref: 'c0ffee01',
                  createdAt: '2026-10-17T19:30:00.000Z',
                },
              ],
        ),
      })),
  );
