import type { Participant } from './nodes.js';
import type { SettlementStatus } from './transfers.js';

// One interface for every way of settling a debt (on-chain now, RGB over Lightning in
// Phase 5). In RGB the receiver acts first: requestPayment runs on the payee's node.
export interface PaymentRequest {
  rail: 'onchain';
  payee: Participant;
  assetId: string;
  /** Asset units (precision 2: USD cents). */
  amount: bigint;
  invoice: string;
  recipientId: string;
  expiresAt: number;
}

export interface SettlementRef {
  rail: 'onchain';
  payer: Participant;
  payee: Participant;
  assetId: string;
  amount: bigint;
  recipientId: string;
  /** Witness transaction id: the Bitcoin tx anchoring the RGB transfer. */
  txid: string;
}

export interface SettlementRail {
  requestPayment(to: Participant, amount: bigint): Promise<PaymentRequest>;
  pay(from: Participant, req: PaymentRequest): Promise<SettlementRef>;
  status(ref: SettlementRef): Promise<SettlementStatus>;
}
