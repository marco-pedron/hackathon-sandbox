import type { Expense, Settlement } from '@settleup/shared';
import { LedgerError, assertUniqueIds, compareIds } from './errors.js';

export type NetPosition = { participant: string; netCents: bigint };

export type Balances = {
  // paid − owed + confirmed settlements. What the trip screen shows.
  nets: NetPosition[];
  // `nets` with pending settlements applied as if confirmed. Plan settlements from this,
  // so a transfer already in flight is not suggested again.
  projectedNets: NetPosition[];
  pending: Settlement[];
};

// net(p) = paid − owed in USD cents across all approved expenses. A confirmed settlement
// moves `amountCents` from debtor to creditor (from +, to −). Pending ones are returned
// separately and do not change `nets`; failed ones are ignored. Sum of nets is always 0.
export function computeBalances(
  members: readonly string[],
  expenses: readonly Expense[],
  settlements: readonly Settlement[],
): Balances {
  assertUniqueIds(members, 'trip members');
  const net = new Map<string, bigint>(members.map((m) => [m, 0n]));
  const adjust = (target: Map<string, bigint>, who: string, delta: bigint, context: string) => {
    const current = target.get(who);
    if (current === undefined) {
      throw new LedgerError('UNKNOWN_PARTICIPANT', `${context}: "${who}" is not a trip member`, {
        participant: who,
      });
    }
    target.set(who, current + delta);
  };

  for (const e of expenses) {
    const { usdTotalCents, usdShares } = e.allocation;
    const sharesSum = usdShares.reduce((acc, s) => acc + s.amount, 0n);
    if (sharesSum !== usdTotalCents) {
      throw new LedgerError(
        'TOTAL_MISMATCH',
        `expense ${e.id}: USD shares sum to ${sharesSum}, not ${usdTotalCents}`,
      );
    }
    adjust(net, e.payer, usdTotalCents, `expense ${e.id}`);
    for (const s of usdShares) adjust(net, s.participant, -s.amount, `expense ${e.id}`);
  }

  const pending: Settlement[] = [];
  const applySettlement = (target: Map<string, bigint>, s: Settlement) => {
    if (s.from === s.to)
      throw new LedgerError('INVALID_ASSIGNMENT', `settlement ${s.id} pays itself`);
    adjust(target, s.from, s.amountCents, `settlement ${s.id}`);
    adjust(target, s.to, -s.amountCents, `settlement ${s.id}`);
  };
  for (const s of settlements) {
    if (s.status === 'confirmed') applySettlement(net, s);
    else if (s.status === 'pending') pending.push(s);
  }

  const projected = new Map(net);
  for (const s of pending) applySettlement(projected, s);

  return { nets: toPositions(net), projectedNets: toPositions(projected), pending };
}

function toPositions(map: Map<string, bigint>): NetPosition[] {
  return [...map]
    .map(([participant, netCents]) => ({ participant, netCents }))
    .sort((a, b) => compareIds(a.participant, b.participant));
}
