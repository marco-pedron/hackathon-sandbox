import type { Deposit, TripConfig } from '@settleup/shared';
import { allocateByWeight } from './allocate.js';
import type { Balances, NetPosition } from './balances.js';
import { LedgerError, assertUniqueIds, compareIds } from './errors.js';

export type MemberDeposit = { member: string; depositCents: bigint };

export type ExposureLevel = 'ok' | 'warn' | 'over';
export type Exposure = {
  member: string;
  depositCents: bigint;
  debtCents: bigint;
  level: ExposureLevel;
};

export type Payout = {
  member: string;
  depositCents: bigint;
  netCents: bigint;
  // Share of other members' uncovered debt this creditor absorbs (0 for everyone else).
  uncoveredChargeCents: bigint;
  payoutCents: bigint;
};

export type PotClosing = {
  potTotalCents: bigint;
  // Debt beyond the debtors' deposits, charged to creditors pro-rata to their nets.
  uncoveredCents: bigint;
  payouts: Payout[];
};

// Majority of members must approve the payout: floor(n/2) + 1.
export function potThreshold(memberCount: number): number {
  if (!Number.isInteger(memberCount) || memberCount < 1) {
    throw new LedgerError(
      'INVALID_TRIP_CONFIG',
      `a trip needs at least 1 member, got ${memberCount}`,
    );
  }
  return (memberCount - (memberCount % 2)) / 2 + 1;
}

function assertConfig(config: TripConfig): void {
  if (config.members.length === 0)
    throw new LedgerError('INVALID_TRIP_CONFIG', `trip ${config.tripId} has no members`);
  assertUniqueIds(config.members, 'trip members');
  if (config.depositPerMemberCents <= 0n) {
    throw new LedgerError(
      'INVALID_TRIP_CONFIG',
      `deposit per member must be positive, got ${config.depositPerMemberCents}`,
    );
  }
}

// Per member, the sum of their confirmed deposits (0 if none). Pending and failed deposits do
// not count. D is the target; a member who deposited a different amount keeps that amount.
// Returns one row per member, ordered by id ascending.
export function confirmedDeposits(
  config: TripConfig,
  deposits: readonly Deposit[],
): MemberDeposit[] {
  assertConfig(config);
  const byMember = new Map<string, bigint>(config.members.map((m) => [m, 0n]));
  for (const d of deposits) {
    if (d.tripId !== config.tripId) {
      throw new LedgerError(
        'INVALID_TRIP_CONFIG',
        `deposit ${d.id} belongs to trip ${d.tripId}, not ${config.tripId}`,
      );
    }
    const current = byMember.get(d.member);
    if (current === undefined) {
      throw new LedgerError(
        'UNKNOWN_PARTICIPANT',
        `deposit ${d.id}: "${d.member}" is not a trip member`,
        {
          participant: d.member,
        },
      );
    }
    if (d.status === 'confirmed') byMember.set(d.member, current + d.amountCents);
  }
  return [...byMember]
    .map(([member, depositCents]) => ({ member, depositCents }))
    .sort((a, b) => compareIds(a.member, b.member));
}

// Joins nets and deposits by member; both must cover exactly the same members.
function join(
  nets: readonly NetPosition[],
  deposits: readonly MemberDeposit[],
): { member: string; netCents: bigint; depositCents: bigint }[] {
  assertUniqueIds(
    nets.map((n) => n.participant),
    'nets',
  );
  assertUniqueIds(
    deposits.map((d) => d.member),
    'deposits',
  );
  const dep = new Map(deposits.map((d) => [d.member, d.depositCents]));
  const rows = nets.map((n) => {
    const depositCents = dep.get(n.participant);
    if (depositCents === undefined) {
      throw new LedgerError('UNKNOWN_PARTICIPANT', `"${n.participant}" has no deposit row`, {
        participant: n.participant,
      });
    }
    return { member: n.participant, netCents: n.netCents, depositCents };
  });
  if (rows.length !== deposits.length) {
    const missing = deposits.find((d) => !nets.some((n) => n.participant === d.member));
    throw new LedgerError('UNKNOWN_PARTICIPANT', `"${missing?.member}" has no net position`, {
      participant: missing?.member,
    });
  }
  return rows.sort((a, b) => compareIds(a.member, b.member));
}

// How much of each member's deposit is committed by their open debt (debt = max(0, −net)).
// warn at ≥ 80% of the deposit, over when debt exceeds it. Integer comparison, no division.
export function exposure(
  nets: readonly NetPosition[],
  deposits: readonly MemberDeposit[],
): Exposure[] {
  return join(nets, deposits).map(({ member, netCents, depositCents }) => {
    const debtCents = netCents < 0n ? -netCents : 0n;
    const level: ExposureLevel =
      debtCents > depositCents
        ? 'over'
        : debtCents > 0n && 5n * debtCents >= 4n * depositCents
          ? 'warn'
          : 'ok';
    return { member, depositCents, debtCents, level };
  });
}

// One payout from the pot settles every remaining balance: payout = deposit + net.
// A debtor whose debt exceeds their deposit gets 0; the excess is uncovered and charged to
// creditors pro-rata to their nets (largest remainder, ties by id ascending), so no payout is
// negative and the payouts sum exactly to the pot. Refuses while any settlement or deposit is
// pending: it could land after the payout and be counted twice.
export function closePot(input: {
  config: TripConfig;
  balances: Balances;
  deposits: readonly Deposit[];
}): PotClosing {
  const { config, balances, deposits } = input;
  const memberDeposits = confirmedDeposits(config, deposits);
  if (balances.pending.length > 0) {
    throw new LedgerError(
      'POT_NOT_SETTLED',
      `${balances.pending.length} settlement(s) still pending; wait for them to confirm or fail`,
      { pending: balances.pending.map((s) => s.id) },
    );
  }
  const pendingDeposits = deposits.filter((d) => d.status === 'pending');
  if (pendingDeposits.length > 0) {
    throw new LedgerError(
      'POT_NOT_SETTLED',
      `${pendingDeposits.length} deposit(s) still pending; wait for them to confirm or fail`,
      { pending: pendingDeposits.map((d) => d.id) },
    );
  }

  const rows = join(balances.nets, memberDeposits);
  const sum = rows.reduce((acc, r) => acc + r.netCents, 0n);
  if (sum !== 0n)
    throw new LedgerError('UNBALANCED_NETS', `nets sum to ${sum}, expected 0`, { sum });

  const potTotalCents = rows.reduce((acc, r) => acc + r.depositCents, 0n);
  let uncoveredCents = 0n;
  for (const r of rows) {
    if (r.depositCents + r.netCents < 0n) uncoveredCents += -(r.depositCents + r.netCents);
  }
  const creditors = rows.filter((r) => r.netCents > 0n);
  // Uncovered debt ≤ total debt = total credit, so each charge ≤ that creditor's net.
  const charges =
    uncoveredCents > 0n
      ? allocateByWeight(
          uncoveredCents,
          creditors.map((r) => ({ id: r.member, weight: r.netCents })),
        )
      : new Map<string, bigint>();

  const payouts = rows.map(({ member, netCents, depositCents }): Payout => {
    const uncoveredChargeCents = charges.get(member) ?? 0n;
    const raw = depositCents + netCents - uncoveredChargeCents;
    return {
      member,
      depositCents,
      netCents,
      uncoveredChargeCents,
      payoutCents: raw < 0n ? 0n : raw,
    };
  });

  const paid = payouts.reduce((acc, p) => acc + p.payoutCents, 0n);
  if (paid !== potTotalCents) {
    throw new LedgerError('UNBALANCED_NETS', `payouts sum to ${paid}, pot holds ${potTotalCents}`);
  }
  return { potTotalCents, uncoveredCents, payouts };
}
