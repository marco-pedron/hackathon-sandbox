import { readFileSync } from 'node:fs';
import { approveExpense, lockRate, parseRateTable } from '@settleup/ledger';
import { ReceiptSchema, SplitProposalSchema, type ExpenseDraft } from '@settleup/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DEMO_RECEIPT, DEMO_SPLIT, createFakeAi } from './fake-ai.js';

const AT = '2026-10-17T19:30:00.000Z';
const table = parseRateTable(
  JSON.parse(readFileSync(new URL('../../../../infra/rates.json', import.meta.url), 'utf8')),
);

describe('fake AI', () => {
  it('returns contract-valid demo data and reports itself as fake', async () => {
    const ai = createFakeAi({ delayMs: 0 });
    expect(ai.status()).toEqual({ status: 'ready', fake: true });
    const receipt = await ai.extractReceipt({ mimeType: 'image/jpeg', bytes: new Uint8Array() });
    const split = await ai.proposeSplit(DEMO_RECEIPT, ['alice', 'bob', 'charlie'], 'any text');
    expect(receipt.ok && z.encode(ReceiptSchema, receipt.data)).toBeTruthy();
    expect(split.ok && z.encode(SplitProposalSchema, split.data)).toBeTruthy();
  });

  it('fails like the real AI when the split names someone not in the trip', async () => {
    const split = await createFakeAi({ delayMs: 0 }).proposeSplit(DEMO_RECEIPT, ['alice'], 'x');
    expect(split.ok).toBe(false);
  });

  it('the demo receipt and split give the PROMPT §1 numbers (total 9.68, alice and bob 3.09, charlie 3.50)', () => {
    const draft: ExpenseDraft = {
      id: 'dinner',
      tripId: 'vietnam-2026',
      description: DEMO_RECEIPT.merchant,
      currency: DEMO_RECEIPT.currency,
      items: DEMO_SPLIT.assignments.map(({ itemIndex, participants }) => {
        const item = DEMO_RECEIPT.items[itemIndex]!;
        return { label: item.label, amount: item.total, participants };
      }),
      extras: { tip: DEMO_RECEIPT.tip! },
      total: DEMO_RECEIPT.total,
      payer: 'alice',
      participants: ['alice', 'bob', 'charlie'],
    };
    const { allocation } = approveExpense(draft, lockRate(table, 'VND', AT), AT);
    expect(allocation.usdTotalCents).toBe(968n);
    expect(allocation.usdShares).toEqual([
      { participant: 'alice', amount: 309n },
      { participant: 'bob', amount: 309n },
      { participant: 'charlie', amount: 350n },
    ]);
  });
});
