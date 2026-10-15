import type {
  Deposit,
  Expense,
  LineDecision,
  LineStatus,
  Payout,
  QuotaLevel,
  TripConfig,
} from '@settleup/shared';
import { LedgerError } from './errors.js';

// Phase 2c — the kitty model (docs/PROMPT-hackathon.md §1 "Kitty rules", §3).
// CONTRACT STUBS: every body throws NOT_IMPLEMENTED until stream A delivers Phase 2c.
// All amounts are USD cents (bigint). Pure functions, no I/O, no clock reads.

// Everything the kitty rules read. `expenses` are the ones that count for nets: approved
// (isExpenseApproved) and not voided (voidExpense). Deposits and payouts carry their status;
// only confirmed ones move money, pending payouts are reserved.
export type KittyState = {
  config: TripConfig;
  deposits: readonly Deposit[];
  expenses: readonly Expense[];
  payouts: readonly Payout[];
};

export type KittyMemberAmount = { member: string; amountCents: bigint };

// Close proposal without ids or statuses: the server turns `finals` into `final` payouts.
export type KittyClosing = {
  potCashCents: bigint;
  // One row per reachable member with a positive payout.
  finals: KittyMemberAmount[];
  // Reachable-or-not is decided by the caller; unreachable members' payouts land here.
  unclaimed: KittyMemberAmount[];
  uncovered: { totalCents: bigint; charges: KittyMemberAmount[] };
};

// Injected clock for line approvals: never read Date.now() in the ledger.
export type ApprovalClock = {
  // When the expense was submitted: the silent-assent countdown starts here.
  submittedAt: Date;
  now: Date;
  silentAssentMs: number;
};

function notImplemented(fn: string): never {
  throw new LedgerError('NOT_IMPLEMENTED', `${fn} is a Phase 2c stub`);
}

/**
 * Rule 2, Quota. For each member m, in USD cents:
 * `quota(m) = confirmedDeposits(m) + net(m) − confirmedPayoutsTo(m)`.
 * `net(m)` = paid − owed over approved, non-voided expenses (existing `computeBalances`).
 * Deposits and top-ups are the same operation.
 */
export function quota(state: KittyState, member: string): bigint {
  void state;
  void member;
  return notImplemented('quota');
}

/**
 * Rule 3, Invariants.
 * `potCash = Σ confirmed deposits − Σ confirmed payouts = Σ quota(m)`.
 * `potCash` must equal the settled DUSD balance of dave's node.
 */
export function potCash(state: KittyState): bigint {
  void state;
  return notImplemented('potCash');
}

/**
 * Rule 4, Reimbursement. `unpaidCredit(m) = max(0, quota(m) − confirmedDeposits(m))`.
 */
export function unpaidCredit(state: KittyState, member: string): bigint {
  void state;
  void member;
  return notImplemented('unpaidCredit');
}

/**
 * Rule 4, Reimbursement.
 * `reimbursable(m) = max(0, min(unpaidCredit(m), potCash − reserved − Σ_{k≠m} max(0, quota(k))))`,
 * where `reserved` is the sum of pending payouts (approved or pending in `state.payouts`).
 * "A payer can be reimbursed only for credit above their own deposit, and only with money
 * that does not belong to the other members' positive quotas."
 */
export function reimbursable(state: KittyState, member: string): bigint {
  void state;
  void member;
  return notImplemented('reimbursable');
}

/**
 * Rule 5, Low quota. `low` when a member's quota drops to 20% of their deposits or less
 * (the 80% exposure rule, applied to quotas). `quota < 0` → `topup_required`: withdrawals
 * are blocked for that member (TOPUP_REQUIRED).
 */
export function lowQuota(state: KittyState, member: string): QuotaLevel {
  void state;
  void member;
  return notImplemented('lowQuota');
}

/**
 * Rule 8, Close. `closePot` over quotas, generalized to payouts already made.
 * - Refused while any deposit or payout is pending (`POT_NOT_SETTLED`).
 * - Members with quota > 0 that are reachable are paid in one batch (`finals`).
 * - A member in `unreachable` keeps their quota in the kitty as `unclaimed`.
 * - Negative quotas pay out 0; the uncovered part is shared by the creditors pro-rata
 *   (existing largest-remainder rule).
 * Invariant: Σ finals + Σ unclaimed = potCash, no negative amount.
 */
export function closePotWithPayouts(input: {
  state: KittyState;
  unreachable: ReadonlySet<string>;
}): KittyClosing {
  void input;
  return notImplemented('closePotWithPayouts');
}

/**
 * Rule 6, Approvals (expense lines). One decision per debtor per expense; the payer's own
 * share needs none. `approved` / `contested` from the latest decision; otherwise `assented`
 * once `now ≥ submittedAt + silentAssentMs` (silent assent), else `pending`.
 * The coordinator never approves lines on a traveler's behalf.
 */
export function lineStatus(
  expense: Expense,
  member: string,
  decisions: readonly LineDecision[],
  clock: ApprovalClock,
): LineStatus {
  void expense;
  void member;
  void decisions;
  void clock;
  return notImplemented('lineStatus');
}

/**
 * Rule 6, Approvals. An expense counts (and can be reimbursed) when every debtor's line
 * status is `approved` or `assented`. Any `contested` line blocks its reimbursement
 * (EXPENSE_CONTESTED) until the coordinator voids it and the payer resubmits.
 */
export function isExpenseApproved(
  expense: Expense,
  decisions: readonly LineDecision[],
  clock: ApprovalClock,
): boolean {
  void expense;
  void decisions;
  void clock;
  return notImplemented('isExpenseApproved');
}

/**
 * Rule 6, Contest. "The coordinator can only void it; the payer then resubmits."
 * A voided expense leaves nets unchanged: returns the expenses that still count, without
 * `expenseId`.
 */
export function voidExpense(expenses: readonly Expense[], expenseId: string): Expense[] {
  void expenses;
  void expenseId;
  return notImplemented('voidExpense');
}
