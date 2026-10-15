import { z } from 'zod';
import {
  ActorIdSchema,
  ClosePlanSchema,
  CoordinatorIdSchema,
  ErrorCodeSchema,
  ExpenseStatusSchema,
  LineDecisionSchema,
  LineStatusSchema,
  PayoutSchema,
  QuotaViewSchema,
  TravelerIdSchema,
  type ErrorCode,
} from './kitty.js';
import { CurrencyCodeSchema, LockedRateSchema, RateTableSchema } from './ledger.js';

// HTTP contract (PROMPT §6 Phase 4b). Every schema here is a wire schema: amounts are decimal
// strings of minor units on the wire and bigint in TypeScript, through the one codec below.
// Server: `z.encode(schema, value)` before sending. Client: `z.decode(schema, json)`.

// ---------- money codec ----------

const integerString = z.string().regex(/^-?\d+$/, 'expected an integer string like "659"');
const minorCodec = { decode: (s: string) => BigInt(s), encode: (n: bigint) => n.toString() };

/** bigint ↔ decimal string of minor units ("-123"). Signed: quotas and nets can be negative. */
export const moneyString = z.codec(integerString, z.bigint(), minorCodec);
/** Same codec, ≥ 0. */
export const minorString = z.codec(integerString, z.bigint().nonnegative(), minorCodec);
/** Same codec, > 0. */
export const positiveMinorString = z.codec(integerString, z.bigint().positive(), minorCodec);

// ---------- errors ----------

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    // One suggested action for the user (PROMPT §5).
    action: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// The default human action per error code; the server may send a more specific one.
export const ERROR_ACTIONS: Record<ErrorCode, string> = {
  UNKNOWN_CURRENCY: 'Pick the receipt currency from the list.',
  MISSING_RATE: 'Ask the coordinator to add this currency to the rate of the day.',
  INVALID_RATE: 'Ask the coordinator to fix the rate of the day.',
  INVALID_RATE_TABLE: 'Check the rate table: every rate must be a positive number.',
  TOTAL_MISMATCH: 'The items do not add up to the total: fix an item or the total and retry.',
  UNKNOWN_PARTICIPANT: 'Assign the lines only to travelers on this trip.',
  DUPLICATE_PARTICIPANT: 'Remove the duplicate name and retry.',
  INVALID_ASSIGNMENT: 'Assign every line to at least one traveler.',
  NEGATIVE_AMOUNT: 'Amounts cannot be negative: fix the line and retry.',
  EMPTY_ALLOCATION: 'Assign at least one line before submitting.',
  UNBALANCED_NETS: 'The ledger is inconsistent: ask the coordinator to check the trip.',
  INVALID_TRIP_CONFIG: 'Ask the coordinator to check the trip setup.',
  POT_NOT_SETTLED: 'Wait for the pending transfers to confirm, then try again.',
  TOPUP_REQUIRED: 'Your quota is negative: top up the kitty to continue.',
  NOT_REIMBURSABLE:
    'Not reimbursable yet: it is waiting for another member to top up, or it is settled at close.',
  EXPENSE_CONTESTED: 'This expense is contested: the coordinator can void it, then resubmit it.',
  NOT_IMPLEMENTED: 'This feature is not ready yet.',
  VALIDATION_ERROR: 'Check the highlighted fields and retry.',
  FORBIDDEN_ROLE: 'Only the coordinator can do this.',
  NOT_FOUND: 'It may have been removed: refresh the page.',
  AI_NOT_READY: 'The on-device model is still loading: wait a moment or fill the form by hand.',
  INTERNAL: 'Something went wrong: retry, and tell the coordinator if it happens again.',
  RECEIVER_UNREACHABLE:
    'Their wallet is offline: the amount stays in the kitty as unclaimed until they are back.',
  NODE_UNAVAILABLE: 'The kitty wallet is not answering: wait a moment and retry.',
  INVOICE_EXPIRED: 'The payment request expired: retry to create a new one.',
  INSUFFICIENT_ALLOCATIONS: 'The wallet has no free RGB allocations: retry in a moment.',
  NO_AVAILABLE_UTXOS: 'The wallet has no free UTXOs: wait for the next block and retry.',
};

// ---------- kitty views on the wire ----------

export const MemberAmountWireSchema = z.object({
  member: TravelerIdSchema,
  amountCents: minorString,
});

export const PayoutWireSchema = PayoutSchema.extend({ amountCents: positiveMinorString });

export const QuotaViewWireSchema = QuotaViewSchema.extend({
  depositsCents: minorString,
  netCents: moneyString,
  payoutsCents: minorString,
  quotaCents: moneyString,
  unpaidCreditCents: minorString,
});

export const ClosePlanWireSchema = ClosePlanSchema.extend({
  payouts: z.array(PayoutWireSchema),
  unclaimed: z.array(MemberAmountWireSchema),
  uncovered: z.object({
    totalCents: minorString,
    charges: z.array(MemberAmountWireSchema),
  }),
  potCashCents: minorString,
});

// ---------- transfers ----------

// Proof of one real RGB transfer (one witness tx, possibly many recipients).
export const TransferProofSchema = z.object({
  ref: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'failed']),
  // Raw RLN transfer status, shown as-is in the proof panel.
  rlnStatus: z.string().optional(),
  txid: z.string().min(1).optional(),
  // esplora REST /tx/<txid>, opened in a new tab as an independent source.
  esploraUrl: z.url().optional(),
  elapsedMs: z.number().int().nonnegative(),
});
export type TransferProof = z.infer<typeof TransferProofSchema>;

// Result of sending payouts from the kitty: one batch, unreachable recipients left out.
export const PayoutBatchResultSchema = z.object({
  proof: TransferProofSchema.nullable(), // null when nobody was reachable
  payouts: z.array(PayoutWireSchema),
  unreachable: z.array(MemberAmountWireSchema),
});
export type PayoutBatchResult = z.output<typeof PayoutBatchResultSchema>;

// ---------- AI (PROMPT §4) ----------

// Amounts are in minor units of the receipt currency (VND exponent 0, EUR/USD cents).
export const ReceiptItemSchema = z.object({
  label: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: minorString,
  total: minorString,
});

export const ReceiptSchema = z.object({
  merchant: z.string(),
  date: z.iso.date(),
  currency: CurrencyCodeSchema,
  items: z.array(ReceiptItemSchema).min(1),
  subtotal: minorString.optional(),
  tax: minorString.optional(),
  tip: minorString.optional(),
  total: positiveMinorString,
  // Inconsistencies found by validation (items ≠ total, …): shown, never silently fixed.
  warnings: z.array(z.string()),
});
export type Receipt = z.output<typeof ReceiptSchema>;

// Travelers only, never the coordinator. Index ranges are checked against the receipt
// by the AI layer (bad index → retry → checkbox fallback).
export const SplitProposalSchema = z.object({
  assignments: z.array(
    z.object({
      itemIndex: z.number().int().nonnegative(),
      participants: z.array(TravelerIdSchema).min(1),
    }),
  ),
  unassigned: z.array(z.number().int().nonnegative()),
  clarificationNeeded: z.string().min(1).optional(),
});
export type SplitProposal = z.output<typeof SplitProposalSchema>;

/** `{ ok: true, data, attempts } | { ok: false, partial, error }` for any AI task. */
export function aiResult<D extends z.ZodType, P extends z.ZodType>(data: D, partial: P) {
  return z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      data,
      attempts: z.number().int().min(1),
      latencyMs: z.number().int().nonnegative(),
    }),
    z.object({
      ok: z.literal(false),
      // Whatever was parsed, to pre-fill the manual form.
      partial,
      error: z.string(),
      attempts: z.number().int().nonnegative(),
      latencyMs: z.number().int().nonnegative(),
    }),
  ]);
}
export type AiResult<T, P = Partial<T>> =
  | { ok: true; data: T; attempts: number; latencyMs: number }
  | { ok: false; partial: P; error: string; attempts: number; latencyMs: number };

export const ReceiptResultSchema = aiResult(ReceiptSchema, ReceiptSchema.partial());
export const SplitResultSchema = aiResult(SplitProposalSchema, SplitProposalSchema.partial());

export const AiStatusSchema = z.object({
  status: z.enum(['loading', 'ready', 'error']),
  error: z.string().optional(),
  // true when FAKE_AI=1: the UI must not claim on-device AI.
  fake: z.boolean(),
});
export type AiStatus = z.infer<typeof AiStatusSchema>;

// ---------- trip and expenses ----------

export const TripViewSchema = z.object({
  tripId: z.string().min(1),
  name: z.string(),
  coordinator: CoordinatorIdSchema,
  depositPerMemberCents: positiveMinorString,
  members: z.array(QuotaViewWireSchema),
  potCashCents: minorString,
  // dave's settled DUSD balance in cents; null when the kitty node is not answering.
  nodeBalanceCents: minorString.nullable(),
  // Counts for the `as` viewer's badges.
  pending: z.object({
    myLinesToApprove: z.number().int().nonnegative(),
    payoutsToApprove: z.number().int().nonnegative(),
    disputes: z.number().int().nonnegative(),
    transfersInFlight: z.number().int().nonnegative(),
  }),
});
export type TripView = z.output<typeof TripViewSchema>;

export const ExpenseShareSchema = z.object({
  member: TravelerIdSchema,
  originalAmount: minorString, // receipt currency
  usdCents: minorString,
  // null for the payer's own share (needs no approval).
  lineStatus: LineStatusSchema.nullable(),
});

export const ExpenseViewSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  payer: TravelerIdSchema,
  currency: CurrencyCodeSchema,
  total: positiveMinorString, // receipt currency
  usdTotalCents: positiveMinorString,
  items: z.array(
    z.object({
      label: z.string(),
      amount: minorString,
      participants: z.array(TravelerIdSchema),
    }),
  ),
  extras: z.object({
    tax: minorString.optional(),
    service: minorString.optional(),
    tip: minorString.optional(),
  }),
  lockedRate: LockedRateSchema,
  status: ExpenseStatusSchema,
  shares: z.array(ExpenseShareSchema),
  decisions: z.array(LineDecisionSchema),
  submittedAt: z.iso.datetime(),
  silentAssentAt: z.iso.datetime(),
  // The reimbursement payout, once proposed.
  payoutId: z.string().optional(),
});
export type ExpenseView = z.output<typeof ExpenseViewSchema>;

// ---------- requests ----------

const AsQuery = z.object({ as: ActorIdSchema });
const AsTraveler = z.object({ as: TravelerIdSchema });
const AsCoordinator = z.object({ as: CoordinatorIdSchema });
const IdParams = z.object({ id: z.string().min(1) });
const RefParams = z.object({ ref: z.string().min(1) });

export const DepositRequestSchema = AsTraveler.extend({ amountCents: positiveMinorString });

export const ExtractRequestSchema = AsTraveler.extend({
  image: z.object({
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    dataBase64: z.base64(),
  }),
});

export const SplitRequestSchema = AsTraveler.extend({
  receipt: ReceiptSchema,
  text: z.string().min(1),
  // The answer to a previous clarificationNeeded, fed back once (PROMPT §4.3).
  clarification: z.object({ question: z.string(), answer: z.string() }).optional(),
});

// The payer is `as`. The rate is locked from the rate of the day on submit.
export const SubmitExpenseRequestSchema = AsTraveler.extend({
  description: z.string(),
  receipt: ReceiptSchema,
  assignments: z.array(
    z.object({
      itemIndex: z.number().int().nonnegative(),
      participants: z.array(TravelerIdSchema).min(1),
    }),
  ),
});

export const DecisionRequestSchema = AsTraveler.extend({
  decision: z.enum(['approved', 'contested']),
});

export const ApprovePayoutsRequestSchema = AsCoordinator.extend({
  payoutIds: z.array(z.string().min(1)).min(1),
});

export const PutRatesRequestSchema = AsCoordinator.extend({ table: RateTableSchema });

// "Reimburse Alice 6.59 USD — from Bob 3.09, Charlie 3.50".
export const PayoutQueueItemSchema = z.object({
  payout: PayoutWireSchema,
  from: z.array(MemberAmountWireSchema),
});

// ---------- routes ----------

export type HttpMethod = 'GET' | 'POST' | 'PUT';

export type RouteDef = {
  method: HttpMethod;
  path: string;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  response: z.ZodType;
};

// One entry per Phase 4b route. GETs carry the role as `?as=`, actions in the body.
export const routes = {
  getTrip: { method: 'GET', path: '/api/trip', query: AsQuery, response: TripViewSchema },
  deposit: {
    method: 'POST',
    path: '/api/deposits',
    body: DepositRequestSchema,
    response: TransferProofSchema,
  },
  extractReceipt: {
    method: 'POST',
    path: '/api/expenses/extract',
    body: ExtractRequestSchema,
    response: ReceiptResultSchema,
  },
  proposeSplit: {
    method: 'POST',
    path: '/api/expenses/split',
    body: SplitRequestSchema,
    response: SplitResultSchema,
  },
  submitExpense: {
    method: 'POST',
    path: '/api/expenses',
    body: SubmitExpenseRequestSchema,
    response: ExpenseViewSchema,
  },
  listExpenses: {
    method: 'GET',
    path: '/api/expenses',
    query: AsQuery,
    response: z.object({ expenses: z.array(ExpenseViewSchema) }),
  },
  decideLines: {
    method: 'POST',
    path: '/api/expenses/:id/decision',
    params: IdParams,
    body: DecisionRequestSchema,
    response: ExpenseViewSchema,
  },
  voidExpense: {
    method: 'POST',
    path: '/api/expenses/:id/void',
    params: IdParams,
    body: AsCoordinator,
    response: ExpenseViewSchema,
  },
  payoutQueue: {
    method: 'GET',
    path: '/api/payouts/queue',
    query: AsQuery,
    response: z.object({ items: z.array(PayoutQueueItemSchema) }),
  },
  approvePayouts: {
    method: 'POST',
    path: '/api/payouts/approve',
    body: ApprovePayoutsRequestSchema,
    response: PayoutBatchResultSchema,
  },
  proposeClose: {
    method: 'POST',
    path: '/api/close/propose',
    body: AsCoordinator,
    response: ClosePlanWireSchema,
  },
  approveClose: {
    method: 'POST',
    path: '/api/close/approve',
    body: AsCoordinator,
    response: PayoutBatchResultSchema,
  },
  transferStatus: {
    method: 'GET',
    path: '/api/transfers/:ref',
    params: RefParams,
    query: AsQuery,
    response: TransferProofSchema,
  },
  getRates: { method: 'GET', path: '/api/rates', query: AsQuery, response: RateTableSchema },
  putRates: {
    method: 'PUT',
    path: '/api/rates',
    body: PutRatesRequestSchema,
    response: RateTableSchema,
  },
  aiStatus: { method: 'GET', path: '/api/ai/status', response: AiStatusSchema },
} as const satisfies Record<string, RouteDef>;

export type Routes = typeof routes;
export type RouteName = keyof Routes;
