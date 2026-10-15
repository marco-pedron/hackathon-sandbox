import type { AiResult, AiStatus, MemberId, Receipt, SplitProposal } from '@settleup/shared';

// On-device AI (PROMPT §4), QVAC in-process. Implemented by stream A in Phase 3;
// dev-fakes/fake-ai.ts stands in until then (FAKE_AI=1).

export type ReceiptImage = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: Uint8Array;
};

export interface AiService {
  /** Image → OCR → LLM → ReceiptSchema, max 2 retries, then `ok: false` with what was parsed. */
  extractReceipt(image: ReceiptImage): Promise<AiResult<Receipt>>;

  /**
   * Items + travelers' names (never the coordinator) + free text (Italian or English) →
   * SplitProposalSchema. A name not in `members` or an item index out of range is a
   * validation error → retry → `ok: false`. `clarification` is the answer to a previous
   * `clarificationNeeded`, fed back once.
   */
  proposeSplit(
    receipt: Receipt,
    members: readonly MemberId[],
    text: string,
    clarification?: { question: string; answer: string },
  ): Promise<AiResult<SplitProposal>>;

  /** Models are loaded once at server start: loading → ready | error. */
  status(): AiStatus;
}
