import type { Participant, RlnNode } from './nodes.js';
import type { PaymentRequest, SettlementRail, SettlementRef } from './rail.js';
import {
  findReceive,
  findSend,
  listTransfers,
  refreshTransfers,
  rgbInvoice,
  sendRgb,
  settlementStatus,
  type SettlementStatus,
} from './transfers.js';

export interface OnchainRailOptions {
  nodes: Record<Participant, RlnNode>;
  assetId: string;
  proxyEndpoint: string;
  /** Runs after the witness tx is broadcast. On regtest: mine a block (RGB_AUTO_MINE). */
  afterBroadcast?: ((txid: string) => Promise<void>) | undefined;
}

// On-chain RGB transfer: payee invoice (blinded UTXO) → payer /sendrgb → witness tx is
// mined → both nodes refresh → Settled on both sides = confirmed. Nothing is simulated:
// status always comes from the two nodes.
export function onchainRail(opts: OnchainRailOptions): SettlementRail {
  const { nodes, assetId, proxyEndpoint } = opts;

  return {
    async requestPayment(to: Participant, amount: bigint): Promise<PaymentRequest> {
      const inv = await rgbInvoice(nodes[to], assetId, amount, proxyEndpoint);
      return {
        rail: 'onchain',
        payee: to,
        assetId,
        amount,
        invoice: inv.invoice,
        recipientId: inv.recipientId,
        expiresAt: inv.expiresAt,
      };
    },

    async pay(from: Participant, req: PaymentRequest): Promise<SettlementRef> {
      if (from === req.payee) throw new Error(`${from} cannot pay themselves`);
      if (req.expiresAt * 1000 <= Date.now()) throw new Error('payment request expired, ask the payee for a new one');
      const txid = await sendRgb(
        nodes[from],
        req.assetId,
        [{ recipientId: req.recipientId, units: req.amount }],
        proxyEndpoint,
      );
      await opts.afterBroadcast?.(txid);
      return {
        rail: 'onchain',
        payer: from,
        payee: req.payee,
        assetId: req.assetId,
        amount: req.amount,
        recipientId: req.recipientId,
        txid,
      };
    },

    async status(ref: SettlementRef): Promise<SettlementStatus> {
      // Payee first: it fetches the consignment from the proxy, validates it and ACKs.
      await refreshTransfers(nodes[ref.payee]);
      await refreshTransfers(nodes[ref.payer]);
      const payer = findSend(await listTransfers(nodes[ref.payer], ref.assetId), ref.txid);
      const payee = findReceive(await listTransfers(nodes[ref.payee], ref.assetId), ref.recipientId);
      return settlementStatus(payer?.status, payee?.status);
    },
  };
}
