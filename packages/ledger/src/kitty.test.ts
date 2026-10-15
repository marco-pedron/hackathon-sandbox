import type { ErrorCode } from '@settleup/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { LedgerError, type LedgerErrorCode } from './errors.js';
import { potCash } from './kitty.js';
import { demoTrip } from './test/fixtures.js';

// Phase 2c checklist (docs/PROMPT-hackathon.md §6, Phase 2c). Stream A turns each todo
// into a test while implementing packages/ledger/src/kitty.ts.

describe('kitty contract', () => {
  it('every LedgerErrorCode is a shared ErrorCode the API can return', () => {
    expectTypeOf<LedgerErrorCode>().toExtend<ErrorCode>();
  });

  it('stubs throw NOT_IMPLEMENTED until Phase 2c lands', () => {
    const state = { config: demoTrip, deposits: [], expenses: [], payouts: [] };
    expect(() => potCash(state)).toThrow(LedgerError);
  });
});

describe('demo numbers (PROMPT §1)', () => {
  it.todo('deposits of 50.00 each: quotas 50.00 / 50.00 / 50.00, potCash 150.00');
  it.todo('after the dinner: reimbursable(alice) = 6.59 (from bob 3.09, charlie 3.50)');
  it.todo('after reimbursing alice 6.59: quotas alice 50.00, bob 46.91, charlie 46.50');
  it.todo('after reimbursing alice 6.59: potCash = 143.41');
  it.todo('close with charlie unreachable: alice 50.00, bob 46.91, charlie unclaimed 46.50');
});

describe('quota and potCash', () => {
  it.todo('quota = confirmed deposits + net − confirmed payouts');
  it.todo('pending and failed deposits do not count');
  it.todo('pending and failed payouts do not reduce the quota');
  it.todo('a top-up is just another deposit');
  it.todo('only approved, non-voided expenses move nets');
});

describe('reimbursable', () => {
  it.todo('never exceeds unpaidCredit (credit above own deposit)');
  it.todo('never uses money that backs another member’s positive quota');
  it.todo('a debtor with negative quota: their uncovered share is not reimbursable yet');
  it.todo('it becomes reimbursable once the debtor tops up');
  it.todo('pending (and approved, unsent) payouts are reserved');
  it.todo('is 0 for a member with no credit');
});

describe('lowQuota', () => {
  it.todo('ok above 20% of deposits');
  it.todo('low exactly at 20% of deposits and below');
  it.todo('topup_required when quota < 0');
  it.todo('quota exactly 0 is low, not topup_required');
});

describe('line approvals (injected clock)', () => {
  it.todo('pending before the silent-assent deadline');
  it.todo('assented exactly at submittedAt + silentAssentMs');
  it.todo('assented after the deadline');
  it.todo('an explicit approve wins over the countdown');
  it.todo('an explicit contest before the deadline → contested');
  it.todo('the payer’s own share needs no decision');
  it.todo('isExpenseApproved: true only when every debtor is approved or assented');
  it.todo('a contested expense blocks its reimbursement (EXPENSE_CONTESTED)');
  it.todo('decisions from non-debtors are rejected (UNKNOWN_PARTICIPANT)');
});

describe('voidExpense', () => {
  it.todo('a voided expense leaves nets unchanged');
  it.todo('voiding an unknown expense id throws');
});

describe('closePotWithPayouts', () => {
  it.todo('refuses while any deposit is pending (POT_NOT_SETTLED)');
  it.todo('refuses while any payout is pending (POT_NOT_SETTLED)');
  it.todo('accounts for payouts already made');
  it.todo('unreachable members go to unclaimed, not to finals');
  it.todo(
    'negative quotas pay 0; uncovered part charged to creditors pro-rata (largest remainder)',
  );
  it.todo('zero payouts are omitted from finals');
});

describe('properties (fast-check)', () => {
  it.todo('Σ quota == potCash after any sequence of events');
  it.todo('a reimbursement never exceeds unpaidCredit');
  it.todo('a reimbursement never leaves another member’s positive quota unbacked');
  it.todo('close: Σ finals + Σ unclaimed == potCash');
  it.todo('close: no negative payout');
});
