import type { Deposit, ExpenseDraft, Settlement, TripConfig } from '@settleup/shared';

export const LOCKED_AT = '2026-10-17T19:30:00.000Z';
export const APPROVED_AT = '2026-10-17T19:31:00.000Z';

export function draft(
  overrides: Partial<ExpenseDraft> &
    Pick<ExpenseDraft, 'items' | 'total' | 'payer' | 'participants'>,
): ExpenseDraft {
  return {
    id: 'e1',
    tripId: 'vietnam-2026',
    description: 'test expense',
    currency: 'USD',
    extras: {},
    ...overrides,
  };
}

export function settlement(
  from: string,
  to: string,
  amountCents: bigint,
  status: Settlement['status'],
  id = `s-${from}-${to}-${status}`,
): Settlement {
  return {
    id,
    tripId: 'vietnam-2026',
    from,
    to,
    amountCents,
    rail: 'onchain',
    status,
    ref: status === 'pending' ? null : 'b731fa23',
    createdAt: APPROVED_AT,
  };
}

// The demo receipt from docs/PROMPT-hackathon.md §1: Alice pays dinner in Hanoi.
// "Bob and I shared the pho, Charlie only had beers, split the water three ways" + tip.
export const vndDinner: ExpenseDraft = draft({
  id: 'dinner',
  description: 'Pho Gia Truyen',
  currency: 'VND',
  items: [
    { label: 'Pho bo x2', amount: 130_000n, participants: ['alice', 'bob'] },
    { label: 'Bia Saigon x3', amount: 75_000n, participants: ['charlie'] },
    { label: 'Water', amount: 30_000n, participants: ['alice', 'bob', 'charlie'] },
  ],
  extras: { tip: 20_000n },
  total: 255_000n,
  payer: 'alice',
  participants: ['alice', 'bob', 'charlie'],
});

// Bob pays a taxi in EUR; one item with no participants = shared by everyone.
export const eurTaxi: ExpenseDraft = draft({
  id: 'taxi',
  description: 'Taxi to the airport',
  currency: 'EUR',
  items: [{ label: 'Taxi', amount: 4_250n, participants: [] }],
  total: 4_250n,
  payer: 'bob',
  participants: ['alice', 'bob', 'charlie'],
});

// Charlie pays a supermarket run in USD with sales tax.
export const usdSupermarket: ExpenseDraft = draft({
  id: 'supermarket',
  description: 'Circle K',
  currency: 'USD',
  items: [
    { label: 'Snacks', amount: 1_299n, participants: [] },
    { label: 'Sunscreen', amount: 1_500n, participants: ['alice'] },
  ],
  extras: { tax: 224n },
  total: 3_023n,
  payer: 'charlie',
  participants: ['alice', 'bob', 'charlie'],
});

// The demo trip from docs/PROMPT-hackathon.md §1: D = 50.00 USD per member.
export const demoTrip: TripConfig = {
  tripId: 'vietnam-2026',
  members: ['alice', 'bob', 'charlie'],
  depositPerMemberCents: 5_000n,
};

export function deposit(
  member: string,
  amountCents: bigint,
  status: Deposit['status'] = 'confirmed',
  id = `d-${member}-${status}`,
): Deposit {
  return {
    id,
    tripId: 'vietnam-2026',
    member,
    amountCents,
    status,
    ref: status === 'pending' ? null : 'c0ffee01',
    createdAt: LOCKED_AT,
  };
}
