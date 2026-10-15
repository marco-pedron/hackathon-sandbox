import { z } from 'zod';

// Ledger domain schemas. Every amount is a bigint in minor units of its currency
// (VND has exponent 0, USD/EUR cents have exponent 2). Amounts never use `number`.
// These are in-process schemas: JSON transport encodes bigints as strings (Phase 4).

// The single currency table: ISO 4217 code → number of minor-unit digits.
export const CURRENCY_EXPONENTS = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CHF: 2,
  VND: 0,
  JPY: 0,
} as const;
export type CurrencyCode = keyof typeof CURRENCY_EXPONENTS;

const currencyCodes = Object.keys(CURRENCY_EXPONENTS) as [CurrencyCode, ...CurrencyCode[]];
export const CurrencyCodeSchema = z.enum(currencyCodes);

// Participant ids are plain strings in the ledger; the trip decides who is a member.
export const MemberIdSchema = z.string().min(1);
export const MinorAmountSchema = z.bigint().nonnegative();
export const PositiveMinorAmountSchema = z.bigint().positive();

// A positive decimal written as a string, e.g. "25450.5". Never a JS number.
export const DecimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'expected a decimal string like "25450.5"');

// rates[X] = units of X per 1 USD.
export const RateTableSchema = z.object({
  base: z.literal('USD'),
  asOf: z.iso.date(),
  source: z.string().min(1),
  rates: z.partialRecord(CurrencyCodeSchema, DecimalStringSchema),
});
export type RateTable = z.infer<typeof RateTableSchema>;

// The rate locked when an expense is approved; stored on the expense, never recomputed.
export const LockedRateSchema = z.object({
  currency: CurrencyCodeSchema,
  value: DecimalStringSchema, // units of `currency` per 1 USD
  asOf: z.iso.date(),
  source: z.enum(['table', 'manual']),
  lockedAt: z.iso.datetime(),
});
export type LockedRate = z.infer<typeof LockedRateSchema>;

// An item with no participants is shared by all participants of the expense.
export const ExpenseItemSchema = z.object({
  label: z.string(),
  amount: MinorAmountSchema,
  participants: z.array(MemberIdSchema),
});
export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;

export const ExpenseExtrasSchema = z.object({
  tax: MinorAmountSchema.optional(),
  service: MinorAmountSchema.optional(),
  tip: MinorAmountSchema.optional(),
});
export type ExpenseExtras = z.infer<typeof ExpenseExtrasSchema>;

// An expense before approval, in its original currency. total = items + extras exactly.
export const ExpenseDraftSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  description: z.string(),
  currency: CurrencyCodeSchema,
  items: z.array(ExpenseItemSchema),
  extras: ExpenseExtrasSchema,
  total: PositiveMinorAmountSchema,
  payer: MemberIdSchema,
  participants: z.array(MemberIdSchema).min(1),
});
export type ExpenseDraft = z.infer<typeof ExpenseDraftSchema>;

export const ShareSchema = z.object({
  participant: MemberIdSchema,
  amount: MinorAmountSchema,
});
export type Share = z.infer<typeof ShareSchema>;

// Snapshot computed at approval: shares in the original currency and in USD cents.
export const ExpenseAllocationSchema = z.object({
  usdTotalCents: MinorAmountSchema,
  originalShares: z.array(ShareSchema),
  usdShares: z.array(ShareSchema),
});
export type ExpenseAllocation = z.infer<typeof ExpenseAllocationSchema>;

export const ExpenseSchema = ExpenseDraftSchema.extend({
  lockedRate: LockedRateSchema,
  allocation: ExpenseAllocationSchema,
  approvedAt: z.iso.datetime(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

// A debt payment in USD cents, linked to an RGB transfer by `ref`.
// Only `confirmed` settlements change balances.
export const SettlementSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  from: MemberIdSchema,
  to: MemberIdSchema,
  amountCents: PositiveMinorAmountSchema,
  rail: z.enum(['onchain', 'lightning']),
  status: z.enum(['pending', 'confirmed', 'failed']),
  ref: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Settlement = z.infer<typeof SettlementSchema>;

// The group deposit pot: every member deposits `depositPerMemberCents` (D) at trip start.
// The payout threshold is derived from `members` (floor(n/2) + 1), never stored.
export const TripConfigSchema = z.object({
  tripId: z.string().min(1),
  members: z.array(MemberIdSchema).min(1),
  depositPerMemberCents: PositiveMinorAmountSchema,
});
export type TripConfig = z.infer<typeof TripConfigSchema>;

// A deposit into the pot, linked to an RGB transfer by `ref`. Custody, not an expense:
// it never changes nets. Only `confirmed` deposits count.
export const DepositSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  member: MemberIdSchema,
  amountCents: PositiveMinorAmountSchema,
  status: z.enum(['pending', 'confirmed', 'failed']),
  ref: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Deposit = z.infer<typeof DepositSchema>;
