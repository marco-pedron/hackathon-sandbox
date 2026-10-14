import { LedgerError, assertUniqueIds, compareIds } from './errors.js';
import type { NetPosition } from './balances.js';

export type Transfer = { from: string; to: string; amountCents: bigint };

// Greedy min-cash-flow: the largest debtor pays the largest creditor the smaller of the two
// amounts; repeat until all nets are 0. Ties are broken by id ascending, so the output is
// deterministic. Each step zeroes at least one participant, so with n non-zero nets there are
// at most n − 1 transfers (not always the theoretical minimum).
export function simplify(nets: readonly NetPosition[]): Transfer[] {
  assertUniqueIds(
    nets.map((n) => n.participant),
    'nets',
  );
  const sum = nets.reduce((acc, n) => acc + n.netCents, 0n);
  if (sum !== 0n)
    throw new LedgerError('UNBALANCED_NETS', `nets sum to ${sum}, expected 0`, { sum });

  const work = nets.map((n) => ({ id: n.participant, net: n.netCents }));
  const pick = (sign: 1n | -1n) => {
    let best: { id: string; net: bigint } | undefined;
    for (const w of work) {
      const v = w.net * sign;
      if (v <= 0n) continue;
      const bestV = best ? best.net * sign : 0n;
      if (!best || v > bestV || (v === bestV && compareIds(w.id, best.id) < 0)) best = w;
    }
    return best;
  };

  const transfers: Transfer[] = [];
  for (;;) {
    const debtor = pick(-1n);
    const creditor = pick(1n);
    if (!debtor || !creditor) return transfers;
    const amount = -debtor.net < creditor.net ? -debtor.net : creditor.net;
    transfers.push({ from: debtor.id, to: creditor.id, amountCents: amount });
    debtor.net += amount;
    creditor.net -= amount;
  }
}
