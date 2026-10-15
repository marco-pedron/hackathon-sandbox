import { describe, expect, it } from 'vitest';
import {
  ActorIdSchema,
  ClosePlanSchema,
  ErrorCodeSchema,
  LineDecisionSchema,
  PayoutSchema,
  QuotaViewSchema,
  TravelerIdSchema,
} from './index.js';

describe('kitty ids', () => {
  it('travelers are alice, bob and charlie; dave is only an actor', () => {
    expect(TravelerIdSchema.options).toEqual(['alice', 'bob', 'charlie']);
    expect(TravelerIdSchema.safeParse('dave').success).toBe(false);
    expect(ActorIdSchema.parse('dave')).toBe('dave');
    expect(ActorIdSchema.safeParse('mallory').success).toBe(false);
  });
});

describe('kitty schemas', () => {
  it('parses a reimbursement payout and rejects a zero amount', () => {
    const payout = {
      id: 'p1',
      to: 'alice',
      amountCents: 659n,
      kind: 'reimbursement',
      status: 'proposed',
      expenseIds: ['e1'],
    };
    expect(PayoutSchema.parse(payout)).toEqual(payout);
    expect(PayoutSchema.safeParse({ ...payout, amountCents: 0n }).success).toBe(false);
  });

  it('a payout cannot go to the coordinator', () => {
    const payout = { id: 'p1', to: 'dave', amountCents: 1n, kind: 'final', status: 'proposed' };
    expect(PayoutSchema.safeParse(payout).success).toBe(false);
  });

  it('parses a line decision', () => {
    const d = { expenseId: 'e1', member: 'bob', decision: 'contested', at: '2026-10-17T12:00:00Z' };
    expect(LineDecisionSchema.parse(d)).toEqual(d);
  });

  it('a quota may be negative, deposits may not', () => {
    const q = {
      member: 'charlie',
      depositsCents: 5000n,
      netCents: -5100n,
      payoutsCents: 0n,
      quotaCents: -100n,
      unpaidCreditCents: 0n,
      level: 'topup_required',
    };
    expect(QuotaViewSchema.parse(q)).toEqual(q);
    expect(QuotaViewSchema.safeParse({ ...q, depositsCents: -1n }).success).toBe(false);
  });

  it('parses the demo close plan (charlie unreachable)', () => {
    const plan = {
      payouts: [
        { id: 'f1', to: 'alice', amountCents: 5000n, kind: 'final', status: 'proposed' },
        { id: 'f2', to: 'bob', amountCents: 4691n, kind: 'final', status: 'proposed' },
      ],
      unclaimed: [{ member: 'charlie', amountCents: 4650n }],
      uncovered: { totalCents: 0n, charges: [] },
      potCashCents: 14341n,
    };
    expect(ClosePlanSchema.parse(plan)).toEqual(plan);
  });

  it('knows the new kitty error codes', () => {
    for (const code of [
      'TOPUP_REQUIRED',
      'NOT_REIMBURSABLE',
      'EXPENSE_CONTESTED',
      'NOT_IMPLEMENTED',
    ]) {
      expect(ErrorCodeSchema.safeParse(code).success).toBe(true);
    }
  });
});
