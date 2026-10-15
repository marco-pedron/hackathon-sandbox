import type { AiResult, AiStatus, MemberId, Receipt, SplitProposal } from '@settleup/shared';
import type { AiService } from '../ai/types.js';

// DEV ONLY (FAKE_AI=1): a stand-in AiService until stream A delivers Phase 3. It never reads
// the image or the text: it always returns the demo dinner of PROMPT §1 after a delay.
// /api/ai/status reports `fake: true`, so the UI must not claim on-device AI.

// The demo dinner in Hanoi, paid by alice (VND, exponent 0). Same items as the ledger fixture.
export const DEMO_RECEIPT: Receipt = {
  merchant: 'Pho restaurant, Hanoi',
  date: '2026-10-17',
  currency: 'VND',
  items: [
    { label: 'Pho bo x2', quantity: 2, unitPrice: 65_000n, total: 130_000n },
    { label: 'Bia Saigon x3', quantity: 3, unitPrice: 25_000n, total: 75_000n },
    { label: 'Water', quantity: 3, unitPrice: 10_000n, total: 30_000n },
  ],
  subtotal: 235_000n,
  tip: 20_000n,
  total: 255_000n,
  warnings: [],
};

// "Bob and I shared the pho, Charlie only had beers, split the water three ways".
export const DEMO_SPLIT: SplitProposal = {
  assignments: [
    { itemIndex: 0, participants: ['alice', 'bob'] },
    { itemIndex: 1, participants: ['charlie'] },
    { itemIndex: 2, participants: ['alice', 'bob', 'charlie'] },
  ],
  unassigned: [],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFakeAi(opts: { delayMs?: number } = {}): AiService {
  const delayMs = opts.delayMs ?? 2_000;
  return {
    async extractReceipt(): Promise<AiResult<Receipt>> {
      await sleep(delayMs);
      return { ok: true, data: DEMO_RECEIPT, attempts: 1, latencyMs: delayMs };
    },
    async proposeSplit(
      _receipt: Receipt,
      members: readonly MemberId[],
    ): Promise<AiResult<SplitProposal>> {
      await sleep(delayMs);
      const known = DEMO_SPLIT.assignments.every((a) =>
        a.participants.every((p) => members.includes(p)),
      );
      return known
        ? { ok: true, data: DEMO_SPLIT, attempts: 1, latencyMs: delayMs }
        : {
            ok: false,
            partial: { unassigned: DEMO_SPLIT.assignments.map((a) => a.itemIndex) },
            error: 'fake AI: the demo split names a traveler who is not in this trip',
            attempts: 1,
            latencyMs: delayMs,
          };
    },
    status(): AiStatus {
      return { status: 'ready', fake: true };
    },
  };
}
