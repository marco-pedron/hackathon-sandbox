// On-chain RGB transfer primitives: receiver invoice (blinded UTXO), payer send, refresh,
// and lookup of a transfer's status on each side.
import type { RlnSchemas } from '@settleup/rgb-client';
import { isRlnError } from './errors.js';
import { rln, type RlnNode } from './nodes.js';
import { toApiAmount } from './units.js';
import { FEE_RATE } from './wallet.js';

export type Transfer = RlnSchemas['Transfer'];
export type TransferStatus = RlnSchemas['TransferStatus'];
export type SettlementStatus = 'pending' | 'confirmed' | 'failed';

const INVOICE_TTL_S = 3600;
const now = () => Math.floor(Date.now() / 1000);

export interface Invoice {
  invoice: string;
  recipientId: string;
  batchTransferIdx: number;
  expiresAt: number;
}

// Receiver side, always first: a blinded-UTXO invoice for an exact amount of the asset.
// A node that has never held the asset rejects its id (UnknownContractId); as in the
// upstream tests, its first invoice then leaves asset_id null.
export async function rgbInvoice(
  node: RlnNode,
  assetId: string,
  units: bigint,
  proxyEndpoint: string,
): Promise<Invoice> {
  const request = (asset_id: string | null) =>
    rln(
      node,
      '/rgbinvoice',
      node.client.POST('/rgbinvoice', {
        body: {
          asset_id,
          assignment: { type: 'Fungible', value: toApiAmount(units) },
          min_confirmations: 1,
          witness: false,
          expiration_timestamp: now() + INVOICE_TTL_S,
          transport_endpoints: [proxyEndpoint],
        },
      }),
    );
  let res;
  try {
    res = await request(assetId);
  } catch (e) {
    if (!isRlnError(e, 'UnknownContractId')) throw e;
    res = await request(null);
  }
  return {
    invoice: res.invoice,
    recipientId: res.recipient_id,
    batchTransferIdx: res.batch_transfer_idx,
    expiresAt: res.expiration_timestamp,
  };
}

export interface Payout {
  recipientId: string;
  units: bigint;
}

// Payer side: one witness transaction paying every recipient. donation: true broadcasts
// right away, as in the upstream rgb-lightning-node send/receive tests. Returns the txid.
export async function sendRgb(
  node: RlnNode,
  assetId: string,
  payouts: Payout[],
  proxyEndpoint: string,
): Promise<string> {
  const res = await rln(
    node,
    '/sendrgb',
    node.client.POST('/sendrgb', {
      body: {
        donation: true,
        fee_rate: FEE_RATE,
        min_confirmations: 1,
        expiration_timestamp: now() + INVOICE_TTL_S,
        recipient_map: {
          [assetId]: payouts.map((p) => ({
            recipient_id: p.recipientId,
            assignment: { type: 'Fungible' as const, value: toApiAmount(p.units) },
            transport_endpoints: [proxyEndpoint],
          })),
        },
      },
    }),
  );
  return res.txid;
}

// Refreshes every pending transfer on the node (no asset filter): a receiver doesn't know
// the contract until this refresh imports the consignment, so filtering by id would fail.
export async function refreshTransfers(node: RlnNode): Promise<void> {
  await rln(
    node,
    '/refreshtransfers',
    node.client.POST('/refreshtransfers', { body: { asset_id: null, filter: [], skip_sync: false } }),
  );
}

export async function listTransfers(node: RlnNode, assetId: string): Promise<Transfer[]> {
  try {
    const res = await rln(
      node,
      '/listtransfers',
      node.client.POST('/listtransfers', { body: { asset_filter: { type: 'Id', value: assetId } } }),
    );
    return res.transfers;
  } catch (e) {
    if (isRlnError(e, 'UnknownContractId')) return [];
    throw e;
  }
}

export function findSend(transfers: Transfer[], txid: string): Transfer | undefined {
  return transfers.find((t) => t.kind === 'Send' && t.txid === txid);
}

export function findReceive(transfers: Transfer[], recipientId: string): Transfer | undefined {
  return transfers.find((t) => t.kind === 'ReceiveBlind' && t.recipient_id === recipientId);
}

// A settlement is confirmed only when both sides see the transfer as Settled.
export function settlementStatus(
  payer: TransferStatus | undefined,
  payee: TransferStatus | undefined,
): SettlementStatus {
  if (payer === 'Failed' || payee === 'Failed') return 'failed';
  if (payer === 'Settled' && payee === 'Settled') return 'confirmed';
  return 'pending';
}
