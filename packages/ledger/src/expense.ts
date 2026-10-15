import type { Expense, ExpenseAllocation, ExpenseDraft, LockedRate, Share } from '@settleup/shared';
import { allocateByWeight, splitEqually } from './allocate.js';
import { LedgerError, assertNonNegative, assertUniqueIds, compareIds } from './errors.js';
import { convertToUsdCents } from './fx.js';
import { assertCurrency } from './money.js';

function extrasTotal(draft: ExpenseDraft): bigint {
  const { tax = 0n, service = 0n, tip = 0n } = draft.extras;
  assertNonNegative(tax, 'tax');
  assertNonNegative(service, 'service');
  assertNonNegative(tip, 'tip');
  return tax + service + tip;
}

// Rules a draft must satisfy before it can be split: known currency, unique participants,
// items assigned only to participants, no negative amounts, total = items + extras exactly.
export function validateDraft(draft: ExpenseDraft): void {
  assertCurrency(draft.currency);
  if (draft.participants.length === 0) {
    throw new LedgerError('INVALID_ASSIGNMENT', `expense ${draft.id} has no participants`);
  }
  assertUniqueIds(draft.participants, `participants of expense ${draft.id}`);
  const members = new Set(draft.participants);
  let itemsTotal = 0n;
  draft.items.forEach((item, index) => {
    assertNonNegative(item.amount, `item ${index} (${item.label})`);
    assertUniqueIds(item.participants, `item ${index} (${item.label})`);
    for (const p of item.participants) {
      if (!members.has(p)) {
        throw new LedgerError(
          'INVALID_ASSIGNMENT',
          `item ${index} (${item.label}) is assigned to "${p}", who is not in this expense`,
          {
            itemIndex: index,
            participant: p,
          },
        );
      }
    }
    itemsTotal += item.amount;
  });
  const expected = itemsTotal + extrasTotal(draft);
  if (draft.total !== expected) {
    throw new LedgerError('TOTAL_MISMATCH', `total ${draft.total} ≠ items + extras ${expected}`, {
      total: draft.total,
      itemsPlusExtras: expected,
    });
  }
  if (draft.total <= 0n)
    throw new LedgerError('TOTAL_MISMATCH', `expense ${draft.id} has a zero total`);
}

function toShares(map: Map<string, bigint>): Share[] {
  return [...map].map(([participant, amount]) => ({ participant, amount }));
}

// Pipeline step 2, in the ORIGINAL currency:
// - each item is split equally among its participants (all participants if none listed),
//   largest remainder, ties by id;
// - tax + service + tip, as one pool, are split proportionally to each participant's item
//   subtotal (largest remainder); if every subtotal is 0, equally among all participants.
// Returns one share per participant, ordered by id, summing exactly to the total.
export function splitOriginal(draft: ExpenseDraft): Share[] {
  validateDraft(draft);
  const subtotals = new Map<string, bigint>(draft.participants.map((p) => [p, 0n]));
  const add = (target: Map<string, bigint>, parts: Map<string, bigint>) => {
    for (const [p, v] of parts) target.set(p, (target.get(p) ?? 0n) + v);
  };

  for (const item of draft.items) {
    if (item.amount === 0n) continue;
    add(
      subtotals,
      splitEqually(
        item.amount,
        item.participants.length > 0 ? item.participants : draft.participants,
      ),
    );
  }

  const shares = new Map(subtotals);
  const extras = extrasTotal(draft);
  if (extras > 0n) {
    const itemsSum = [...subtotals.values()].reduce((a, b) => a + b, 0n);
    add(
      shares,
      itemsSum > 0n
        ? allocateByWeight(
            extras,
            [...subtotals].map(([id, weight]) => ({ id, weight })),
          )
        : splitEqually(extras, draft.participants),
    );
  }
  return toShares(new Map([...shares].sort(([a], [b]) => compareIds(a, b))));
}

// Pipeline steps 3–4: convert the TOTAL once with the locked rate, then allocate those USD
// cents proportionally to the original-currency shares (largest remainder), so the USD
// shares sum exactly to the converted total.
export function allocateExpense(draft: ExpenseDraft, rate: LockedRate): ExpenseAllocation {
  const originalShares = splitOriginal(draft);
  const usdTotalCents = convertToUsdCents(draft.total, draft.currency, rate);
  const usd = allocateByWeight(
    usdTotalCents,
    originalShares.map((s) => ({ id: s.participant, weight: s.amount })),
  );
  return { usdTotalCents, originalShares, usdShares: toShares(usd) };
}

// Pipeline step 5: the approved expense carries its locked rate and the allocation computed
// with it. Balances read this snapshot; nothing is recomputed later.
export function approveExpense(draft: ExpenseDraft, rate: LockedRate, approvedAt: string): Expense {
  return { ...draft, lockedRate: rate, allocation: allocateExpense(draft, rate), approvedAt };
}
