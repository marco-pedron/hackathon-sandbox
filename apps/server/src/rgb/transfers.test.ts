import { describe, expect, it } from 'vitest';
import { findReceive, findSend, settlementStatus, type Transfer } from './transfers.js';

const t = (over: Partial<Transfer>): Transfer => ({
  idx: 1,
  created_at: 0,
  updated_at: 0,
  status: 'WaitingCounterparty',
  assignments: [],
  kind: 'Send',
  transport_endpoints: [],
  ...over,
});

describe('settlementStatus', () => {
  it('is confirmed only when both sides are Settled', () => {
    expect(settlementStatus('Settled', 'Settled')).toBe('confirmed');
    expect(settlementStatus('Settled', 'WaitingConfirmations')).toBe('pending');
    expect(settlementStatus('WaitingCounterparty', 'Settled')).toBe('pending');
  });

  it('is pending while a side has not seen the transfer yet', () => {
    expect(settlementStatus('WaitingConfirmations', undefined)).toBe('pending');
    expect(settlementStatus(undefined, undefined)).toBe('pending');
  });

  it('is failed when either side failed', () => {
    expect(settlementStatus('Failed', 'Settled')).toBe('failed');
    expect(settlementStatus('Settled', 'Failed')).toBe('failed');
    expect(settlementStatus(undefined, 'Failed')).toBe('failed');
  });
});

describe('transfer lookup', () => {
  const list = [
    t({ idx: 1, kind: 'Issuance' }),
    t({ idx: 2, kind: 'Send', txid: 'aa' }),
    t({ idx: 3, kind: 'ReceiveBlind', recipient_id: 'utxob:x', txid: 'aa' }),
  ];

  it('finds the payer side by txid and kind Send', () => {
    expect(findSend(list, 'aa')?.idx).toBe(2);
    expect(findSend(list, 'bb')).toBeUndefined();
  });

  it('finds the payee side by recipient id', () => {
    expect(findReceive(list, 'utxob:x')?.idx).toBe(3);
    expect(findReceive(list, 'utxob:y')).toBeUndefined();
  });
});
