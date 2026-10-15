import type { MemberId, Payout, PayoutBatchResult, TransferProof } from '@settleup/shared';

// The kitty on RGB (PROMPT §2, Phase 4a). dave's node is the kitty; every call is a real
// RGB transfer on regtest through the on-chain SettlementRail. Implemented by stream B.
export interface PotService {
  /** Traveler → kitty (deposit or top-up): dave's node issues the invoice, the member's node pays. */
  deposit(member: MemberId, amountCents: bigint): Promise<TransferProof>;

  /**
   * Kitty → travelers: each recipient's invoice, then one dave `/sendrgb` with every
   * recipient (one witness tx), mine, refresh. A recipient whose node does not return an
   * invoice is left out and reported in `unreachable`.
   */
  payout(list: readonly Payout[]): Promise<PayoutBatchResult>;

  /** dave's settled DUSD balance, in USD cents. Shown next to potCash ("kitty = node balance"). */
  nodeBalance(): Promise<bigint>;

  /** Current proof for a transfer started by deposit() or payout(). */
  status(ref: string): Promise<TransferProof>;

  /** Members whose node answers right now; close/propose marks the others as unclaimed. */
  reachable(members: readonly MemberId[]): Promise<Set<MemberId>>;
}
