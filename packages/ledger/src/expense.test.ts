import type { ExpenseDraft } from '@settleup/shared';
import { describe, expect, it } from 'vitest';
import type { LedgerErrorCode } from './errors.js';
import { allocateExpense, approveExpense, splitOriginal } from './expense.js';
import { manualRate } from './fx.js';
import { APPROVED_AT, LOCKED_AT, draft, vndDinner } from './test/fixtures.js';

const usd = manualRate('USD', '1', LOCKED_AT);
const amounts = (d: Parameters<typeof splitOriginal>[0]) => splitOriginal(d).map((s) => s.amount);

describe('splitOriginal', () => {
  it('tip of 1 minor unit across 2 people goes to the larger item subtotal', () => {
    const d = draft({
      items: [
        { label: 'x', amount: 100n, participants: ['alice'] },
        { label: 'y', amount: 300n, participants: ['bob'] },
      ],
      extras: { tip: 1n },
      total: 401n,
      payer: 'alice',
      participants: ['alice', 'bob'],
    });
    expect(amounts(d)).toEqual([100n, 301n]);
  });

  it('tip of 1 minor unit across 2 equal subtotals goes to the lowest id', () => {
    const d = draft({
      items: [{ label: 'x', amount: 200n, participants: [] }],
      extras: { tip: 1n },
      total: 201n,
      payer: 'bob',
      participants: ['bob', 'alice'],
    });
    expect(splitOriginal(d)).toEqual([
      { participant: 'alice', amount: 101n },
      { participant: 'bob', amount: 100n },
    ]);
  });

  it('tax + service + tip are one pool', () => {
    const d = draft({
      items: [{ label: 'x', amount: 300n, participants: [] }],
      extras: { tax: 1n, service: 1n, tip: 1n },
      total: 303n,
      payer: 'a',
      participants: ['a', 'b', 'c'],
    });
    expect(amounts(d)).toEqual([101n, 101n, 101n]);
  });

  it('zero-amount items are fine and weigh nothing', () => {
    const d = draft({
      items: [
        { label: 'free bread', amount: 0n, participants: ['bob'] },
        { label: 'soup', amount: 500n, participants: ['alice'] },
      ],
      extras: { tip: 50n },
      total: 550n,
      payer: 'alice',
      participants: ['alice', 'bob'],
    });
    expect(amounts(d)).toEqual([550n, 0n]);
  });

  it('extras only (every subtotal 0) are split equally among all participants', () => {
    const d = draft({
      items: [{ label: 'free', amount: 0n, participants: ['a'] }],
      extras: { service: 10n },
      total: 10n,
      payer: 'a',
      participants: ['a', 'b', 'c'],
    });
    expect(amounts(d)).toEqual([4n, 3n, 3n]);
  });

  it('single-participant expense: everything is theirs, even if someone else paid', () => {
    const d = draft({
      items: [{ label: 'museum', amount: 1_500n, participants: [] }],
      extras: { tip: 100n },
      total: 1_600n,
      payer: 'alice',
      participants: ['bob'],
    });
    const e = approveExpense(d, usd, APPROVED_AT);
    expect(e.allocation.usdShares).toEqual([{ participant: 'bob', amount: 1_600n }]);
  });
});

describe('validation', () => {
  type Case = [LedgerErrorCode, string, Partial<ExpenseDraft>];
  const base = {
    items: [{ label: 'x', amount: 100n, participants: [] as string[] }],
    total: 100n,
    payer: 'a',
    participants: ['a', 'b'],
  };

  it.each([
    ['TOTAL_MISMATCH', 'total ≠ items + extras', { total: 99n }],
    [
      'TOTAL_MISMATCH',
      'zero total',
      { items: [{ label: 'x', amount: 0n, participants: [] }], total: 0n },
    ],
    [
      'INVALID_ASSIGNMENT',
      'item assigned to a non-participant',
      { items: [{ label: 'x', amount: 100n, participants: ['zed'] }] },
    ],
    ['INVALID_ASSIGNMENT', 'no participants', { participants: [] }],
    ['DUPLICATE_PARTICIPANT', 'duplicate participant', { participants: ['a', 'a'] }],
    [
      'DUPLICATE_PARTICIPANT',
      'duplicate item participant',
      { items: [{ label: 'x', amount: 100n, participants: ['a', 'a'] }] },
    ],
    [
      'NEGATIVE_AMOUNT',
      'negative item',
      { items: [{ label: 'x', amount: -100n, participants: [] }], total: -100n },
    ],
    ['NEGATIVE_AMOUNT', 'negative tip', { extras: { tip: -1n }, total: 99n }],
    ['NEGATIVE_AMOUNT', 'negative tax', { extras: { tax: -1n }, total: 99n }],
    ['NEGATIVE_AMOUNT', 'negative service', { extras: { service: -1n }, total: 99n }],
    ['UNKNOWN_CURRENCY', 'unknown currency', { currency: 'THB' as ExpenseDraft['currency'] }],
  ] satisfies Case[])('%s: %s', (code, _name, overrides) => {
    expect(() => splitOriginal(draft({ ...base, ...overrides }))).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('refuses a rate locked for another currency', () => {
    expect(() => allocateExpense(vndDinner, usd)).toThrow(
      expect.objectContaining({ code: 'INVALID_RATE' }),
    );
  });
});

describe('approveExpense', () => {
  it('stores the locked rate and allocation; a later rate does not change the stored expense', () => {
    const rate = manualRate('VND', '26350', LOCKED_AT);
    const e = approveExpense(vndDinner, rate, APPROVED_AT);
    approveExpense(vndDinner, manualRate('VND', '20000', LOCKED_AT), APPROVED_AT);
    expect(e.lockedRate).toBe(rate);
    expect(e.allocation.usdTotalCents).toBe(968n);
  });

  it('a tiny amount can convert to 0 cents and still allocates', () => {
    const d = draft({
      currency: 'VND',
      items: [{ label: 'gum', amount: 1n, participants: [] }],
      total: 1n,
      payer: 'a',
      participants: ['a', 'b'],
    });
    const e = approveExpense(d, manualRate('VND', '26350', LOCKED_AT), APPROVED_AT);
    expect(e.allocation.usdTotalCents).toBe(0n);
    expect(e.allocation.usdShares.map((s) => s.amount)).toEqual([0n, 0n]);
  });
});
