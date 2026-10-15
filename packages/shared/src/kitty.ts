import { z } from 'zod';
import { MinorAmountSchema, PositiveMinorAmountSchema } from './ledger.js';

// Kitty domain schemas (PROMPT §1 "Kitty rules", §3). The kitty is dave's RGB node.
// In-process schemas: amounts are bigint USD cents. The wire variants live in api.ts.

// Travelers own a quota in the kitty. `MemberIdSchema` (ledger.ts) stays a plain string
// for the ledger; this is the closed set the API and UI accept.
export const ParticipantIdSchema = z.enum(['alice', 'bob', 'charlie']);
export type ParticipantId = z.infer<typeof ParticipantIdSchema>;
export const TravelerIdSchema = ParticipantIdSchema;
export type MemberId = z.infer<typeof TravelerIdSchema>;

export const CoordinatorIdSchema = z.literal('dave');
export type CoordinatorId = z.infer<typeof CoordinatorIdSchema>;

// Whoever acts in a request: the role from `?as=`.
export const ActorIdSchema = z.union([TravelerIdSchema, CoordinatorIdSchema]);
export type ActorId = z.infer<typeof ActorIdSchema>;

export const RoleSchema = z.enum(['traveler', 'coordinator']);
export type Role = z.infer<typeof RoleSchema>;

// Signed USD cents: quotas and nets can be negative.
export const SignedMinorAmountSchema = z.bigint();

export const MemberAmountSchema = z.object({
  member: TravelerIdSchema,
  amountCents: MinorAmountSchema,
});
export type MemberAmount = z.infer<typeof MemberAmountSchema>;

export const PayoutKindSchema = z.enum(['reimbursement', 'final', 'withdrawal']);
export type PayoutKind = z.infer<typeof PayoutKindSchema>;

// proposed → approved (by dave) → pending (RGB transfer sent) → confirmed | failed.
// Pending payouts are reserved: they reduce what can be reimbursed.
export const PayoutStatusSchema = z.enum([
  'proposed',
  'approved',
  'pending',
  'confirmed',
  'failed',
]);
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

// A transfer from the kitty (dave) to one traveler. Only `confirmed` payouts change quotas.
export const PayoutSchema = z.object({
  id: z.string().min(1),
  to: TravelerIdSchema,
  amountCents: PositiveMinorAmountSchema,
  kind: PayoutKindSchema,
  status: PayoutStatusSchema,
  transferRef: z.string().min(1).optional(),
  // Reimbursements: the expenses this payout pays back.
  expenseIds: z.array(z.string().min(1)).optional(),
});
export type Payout = z.infer<typeof PayoutSchema>;

// One decision per debtor per expense. The payer's own share needs none.
export const LineDecisionSchema = z.object({
  expenseId: z.string().min(1),
  member: TravelerIdSchema,
  decision: z.enum(['approved', 'contested']),
  at: z.iso.datetime(),
});
export type LineDecision = z.infer<typeof LineDecisionSchema>;

// A debtor's lines on one expense: explicit decision, silent assent after the deadline,
// or still pending.
export const LineStatusSchema = z.enum(['approved', 'contested', 'assented', 'pending']);
export type LineStatus = z.infer<typeof LineStatusSchema>;

// Approval state only. Reimbursement state lives on Payout (expenseIds): a reimbursement is
// capped by `reimbursable` and can be partial or cover several expenses, so it is not a
// per-expense status.
export const ExpenseStatusSchema = z.enum(['awaiting_approval', 'approved', 'contested', 'voided']);
export type ExpenseStatus = z.infer<typeof ExpenseStatusSchema>;

// low: quota ≤ 20% of deposits. topup_required: quota < 0 (withdrawals blocked).
export const QuotaLevelSchema = z.enum(['ok', 'low', 'topup_required']);
export type QuotaLevel = z.infer<typeof QuotaLevelSchema>;

// quota = confirmedDeposits + net − confirmedPayoutsTo.
export const QuotaViewSchema = z.object({
  member: TravelerIdSchema,
  depositsCents: MinorAmountSchema,
  netCents: SignedMinorAmountSchema,
  payoutsCents: MinorAmountSchema,
  quotaCents: SignedMinorAmountSchema,
  unpaidCreditCents: MinorAmountSchema,
  level: QuotaLevelSchema,
});
export type QuotaView = z.infer<typeof QuotaViewSchema>;

// The coordinator's close proposal, shown before anything is sent.
// Σ payouts + Σ unclaimed = potCashCents.
export const ClosePlanSchema = z.object({
  // kind 'final', one per reachable member with quota > 0.
  payouts: z.array(PayoutSchema),
  // Members whose node is unreachable: their quota stays in the kitty, claimable later.
  unclaimed: z.array(MemberAmountSchema),
  // Negative quotas not covered by their owners, charged to creditors pro-rata.
  uncovered: z.object({
    totalCents: MinorAmountSchema,
    charges: z.array(MemberAmountSchema),
  }),
  potCashCents: MinorAmountSchema,
});
export type ClosePlan = z.infer<typeof ClosePlanSchema>;

// Every error code the API can return: ledger rule violations plus API and RGB failures.
// The ledger's LedgerErrorCode must stay a subset (checked in packages/ledger).
export const ErrorCodeSchema = z.enum([
  // ledger (Phase 2 / 2b)
  'UNKNOWN_CURRENCY',
  'MISSING_RATE',
  'INVALID_RATE',
  'INVALID_RATE_TABLE',
  'TOTAL_MISMATCH',
  'UNKNOWN_PARTICIPANT',
  'DUPLICATE_PARTICIPANT',
  'INVALID_ASSIGNMENT',
  'NEGATIVE_AMOUNT',
  'EMPTY_ALLOCATION',
  'UNBALANCED_NETS',
  'INVALID_TRIP_CONFIG',
  'POT_NOT_SETTLED',
  // kitty (Phase 2c)
  'TOPUP_REQUIRED',
  'NOT_REIMBURSABLE',
  'EXPENSE_CONTESTED',
  'NOT_IMPLEMENTED',
  // API
  'VALIDATION_ERROR',
  'FORBIDDEN_ROLE',
  'NOT_FOUND',
  'AI_NOT_READY',
  'INTERNAL',
  // RGB / nodes
  'RECEIVER_UNREACHABLE',
  'NODE_UNAVAILABLE',
  'INVOICE_EXPIRED',
  'INSUFFICIENT_ALLOCATIONS',
  'NO_AVAILABLE_UTXOS',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
