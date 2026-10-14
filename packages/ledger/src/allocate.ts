import { LedgerError, assertNonNegative, assertUniqueIds, compareIds } from './errors.js';

export type Weighted = { id: string; weight: bigint };

// Largest-remainder method: splits `total` proportionally to the weights so the parts
// sum exactly to `total`. Each part gets floor(total * w / sum(w)); the leftover units go
// one each to the largest remainders, ties broken by id ascending.
// Returns a Map ordered by id ascending.
export function allocateByWeight(total: bigint, weights: readonly Weighted[]): Map<string, bigint> {
  assertNonNegative(total, 'amount to allocate');
  assertUniqueIds(
    weights.map((w) => w.id),
    'allocation',
  );
  let sum = 0n;
  for (const w of weights) {
    assertNonNegative(w.weight, `weight of ${w.id}`);
    sum += w.weight;
  }
  if (sum === 0n) {
    throw new LedgerError('EMPTY_ALLOCATION', `cannot allocate ${total} over zero total weight`, {
      ids: weights.map((w) => w.id),
    });
  }

  const parts = weights
    .map((w) => ({ id: w.id, base: (total * w.weight) / sum, rem: (total * w.weight) % sum }))
    .sort((a, b) => (a.rem === b.rem ? compareIds(a.id, b.id) : a.rem > b.rem ? -1 : 1));
  let leftover = total - parts.reduce((acc, p) => acc + p.base, 0n);
  for (const p of parts) {
    if (leftover === 0n) break;
    p.base += 1n;
    leftover -= 1n;
  }
  parts.sort((a, b) => compareIds(a.id, b.id));
  return new Map(parts.map((p) => [p.id, p.base]));
}

export function splitEqually(total: bigint, ids: readonly string[]): Map<string, bigint> {
  return allocateByWeight(
    total,
    ids.map((id) => ({ id, weight: 1n })),
  );
}
