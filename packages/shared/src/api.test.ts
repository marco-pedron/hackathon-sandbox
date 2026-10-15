import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ApiErrorSchema,
  ERROR_ACTIONS,
  minorString,
  moneyString,
  positiveMinorString,
  routes,
  type RouteName,
} from './api.js';
import { ErrorCodeSchema } from './kitty.js';

// Wire round trip: encode (server) → JSON → decode (client) gives back the same value.
const roundTrip = <S extends z.ZodType>(schema: S, value: z.output<S>) =>
  z.decode(schema, JSON.parse(JSON.stringify(z.encode(schema, value))) as z.input<S>);

describe('moneyString codec', () => {
  it('decodes integer strings to bigint and back', () => {
    expect(z.decode(moneyString, '-659')).toBe(-659n);
    expect(z.encode(moneyString, 14341n)).toBe('14341');
    expect(z.decode(moneyString, '123456789012345678901234567890')).toBe(
      123456789012345678901234567890n,
    );
  });

  it('rejects decimals, floats and empty strings', () => {
    for (const bad of ['6.59', '1e3', '', ' 1', '+1']) {
      expect(moneyString.safeDecode(bad).success).toBe(false);
    }
  });

  it('enforces sign constraints on both sides', () => {
    expect(minorString.safeDecode('-1').success).toBe(false);
    expect(minorString.safeEncode(-1n).success).toBe(false);
    expect(positiveMinorString.safeDecode('0').success).toBe(false);
  });
});

describe('errors', () => {
  it('every error code has a human action', () => {
    for (const code of ErrorCodeSchema.options) expect(ERROR_ACTIONS[code]).toMatch(/\S/);
  });

  it('parses an ApiError body', () => {
    const body = {
      error: {
        code: 'TOPUP_REQUIRED',
        message: 'quota -1.00',
        action: ERROR_ACTIONS.TOPUP_REQUIRED,
      },
    };
    expect(ApiErrorSchema.parse(body)).toEqual(body);
  });
});

const proof = {
  ref: 'tr-1',
  status: 'confirmed' as const,
  txid: 'ab'.repeat(32),
  esploraUrl: 'http://localhost:3010/tx/' + 'ab'.repeat(32),
  elapsedMs: 4200,
};
const receipt = {
  merchant: 'Pho Gia Truyen',
  date: '2026-10-17',
  currency: 'VND' as const,
  items: [{ label: 'Pho bo', quantity: 2, unitPrice: 65_000n, total: 130_000n }],
  tip: 20_000n,
  total: 150_000n,
  warnings: [],
};
const payout = {
  id: 'p1',
  to: 'alice' as const,
  amountCents: 659n,
  kind: 'reimbursement' as const,
  status: 'proposed' as const,
  expenseIds: ['dinner'],
};
const expense = {
  id: 'dinner',
  description: 'Pho Gia Truyen',
  payer: 'alice' as const,
  currency: 'VND' as const,
  total: 255_000n,
  usdTotalCents: 968n,
  items: [{ label: 'Bia Saigon x3', amount: 75_000n, participants: ['charlie' as const] }],
  extras: { tip: 20_000n },
  lockedRate: {
    currency: 'VND' as const,
    value: '26350',
    asOf: '2026-10-16',
    source: 'table' as const,
    lockedAt: '2026-10-17T19:30:00.000Z',
  },
  status: 'awaiting_approval' as const,
  shares: [
    { member: 'alice' as const, originalAmount: 81_667n, usdCents: 310n, lineStatus: null },
    {
      member: 'bob' as const,
      originalAmount: 81_666n,
      usdCents: 309n,
      lineStatus: 'pending' as const,
    },
  ],
  decisions: [],
  submittedAt: '2026-10-17T19:30:00.000Z',
  silentAssentAt: '2026-10-17T19:30:20.000Z',
};
const quota = {
  member: 'bob' as const,
  depositsCents: 5000n,
  netCents: -309n,
  payoutsCents: 0n,
  quotaCents: 4691n,
  unpaidCreditCents: 0n,
  level: 'ok' as const,
};
const batch = { proof, payouts: [{ ...payout, status: 'pending' as const }], unreachable: [] };
const rates = {
  base: 'USD' as const,
  asOf: '2026-10-16',
  source: 'demo',
  rates: { VND: '26350' },
};

// One request/response example per route: every route must be listed here.
const examples: Record<RouteName, { request?: unknown; response: unknown }> = {
  getTrip: {
    request: { as: 'dave' },
    response: {
      tripId: 'vietnam-2026',
      name: 'Vietnam 2026',
      coordinator: 'dave',
      depositPerMemberCents: 5000n,
      members: [quota],
      potCashCents: 14341n,
      nodeBalanceCents: null,
      pending: { myLinesToApprove: 0, payoutsToApprove: 1, disputes: 0, transfersInFlight: 0 },
    },
  },
  deposit: { request: { as: 'charlie', amountCents: 5000n }, response: proof },
  extractReceipt: {
    request: { as: 'alice', image: { mimeType: 'image/jpeg', dataBase64: 'aGVsbG8=' } },
    response: { ok: true, data: receipt, attempts: 1, latencyMs: 9000 },
  },
  proposeSplit: {
    request: { as: 'alice', receipt, text: 'Bob and I shared the pho' },
    response: {
      ok: false,
      partial: { unassigned: [0] },
      error: 'invalid JSON',
      attempts: 3,
      latencyMs: 12000,
    },
  },
  submitExpense: {
    request: {
      as: 'alice',
      description: 'Dinner',
      receipt,
      assignments: [{ itemIndex: 0, participants: ['alice', 'bob'] }],
    },
    response: expense,
  },
  listExpenses: { request: { as: 'bob' }, response: { expenses: [expense] } },
  decideLines: { request: { as: 'bob', decision: 'approved' }, response: expense },
  voidExpense: { request: { as: 'dave' }, response: { ...expense, status: 'voided' } },
  payoutQueue: {
    request: { as: 'dave' },
    response: {
      items: [
        {
          payout,
          from: [
            { member: 'bob', amountCents: 309n },
            { member: 'charlie', amountCents: 350n },
          ],
        },
      ],
    },
  },
  approvePayouts: { request: { as: 'dave', payoutIds: ['p1'] }, response: batch },
  proposeClose: {
    request: { as: 'dave' },
    response: {
      payouts: [{ id: 'f1', to: 'alice', amountCents: 5000n, kind: 'final', status: 'proposed' }],
      unclaimed: [{ member: 'charlie', amountCents: 4650n }],
      uncovered: { totalCents: 0n, charges: [] },
      potCashCents: 14341n,
    },
  },
  approveClose: { request: { as: 'dave' }, response: { ...batch, proof: null } },
  transferStatus: {
    request: { as: 'alice' },
    response: { ref: 'tr-1', status: 'pending', elapsedMs: 0 },
  },
  getRates: { request: { as: 'dave' }, response: rates },
  putRates: { request: { as: 'dave', table: rates }, response: rates },
  aiStatus: { response: { status: 'ready', fake: false } },
};

describe('routes', () => {
  it('paths are unique per method and start with /api/', () => {
    const keys = Object.values(routes).map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of Object.values(routes)) expect(r.path).toMatch(/^\/api\//);
  });

  for (const [name, route] of Object.entries(routes) as [RouteName, (typeof routes)[RouteName]][]) {
    it(`${name}: example request and response survive the wire`, () => {
      const ex = examples[name];
      const input = 'body' in route ? route.body : 'query' in route ? route.query : undefined;
      if (input) expect(roundTrip(input, ex.request as never)).toEqual(ex.request);
      expect(roundTrip(route.response, ex.response as never)).toEqual(ex.response);
    });
  }

  it('acting requests reject an unknown role', () => {
    expect(
      routes.deposit.body.safeDecode({ as: 'mallory', amountCents: '1' } as never).success,
    ).toBe(false);
    expect(routes.voidExpense.body.safeDecode({ as: 'alice' } as never).success).toBe(false);
  });
});
