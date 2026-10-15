import type {
  ActorId,
  Deposit,
  Expense,
  LineDecision,
  Payout,
  RateTable,
  TripConfig,
} from '@settleup/shared';

// The shared ledger (PROMPT §2): one append-only `events` table in SQLite, no UPDATE or
// DELETE. State is derived from the events by @settleup/ledger. Status changes are new
// events, never edits. Implemented by stream B; bigints are stored with the shared codec.

export type LedgerEvent =
  | { type: 'trip_created'; config: TripConfig; name: string }
  | { type: 'rates_set'; table: RateTable }
  | { type: 'deposit_started'; deposit: Deposit }
  | { type: 'deposit_status'; depositId: string; status: Deposit['status']; ref: string | null }
  // The rate is locked at submission: `expense.lockedRate` and `allocation` are final.
  | { type: 'expense_submitted'; expense: Expense }
  | { type: 'line_decided'; decision: LineDecision }
  | { type: 'expense_voided'; expenseId: string }
  | { type: 'payout_proposed'; payout: Payout }
  | { type: 'payout_status'; payoutId: string; status: Payout['status']; transferRef?: string };

export type LedgerEventType = LedgerEvent['type'];

export type StoredEvent = {
  seq: number; // 1, 2, 3… in append order
  at: string; // ISO datetime
  actor: ActorId | 'system';
  event: LedgerEvent;
};

export interface LedgerStore {
  /** Appends one event and returns it with its sequence number. Never updates or deletes. */
  append(event: LedgerEvent, meta: { actor: ActorId | 'system'; at: string }): StoredEvent;

  /** Events in append order, optionally only some types or only after a sequence number. */
  list(filter?: { types?: readonly LedgerEventType[]; afterSeq?: number }): StoredEvent[];
}
