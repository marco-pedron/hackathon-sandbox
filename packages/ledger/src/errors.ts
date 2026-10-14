export type LedgerErrorCode =
  | 'UNKNOWN_CURRENCY'
  | 'MISSING_RATE'
  | 'INVALID_RATE'
  | 'INVALID_RATE_TABLE'
  | 'TOTAL_MISMATCH'
  | 'UNKNOWN_PARTICIPANT'
  | 'DUPLICATE_PARTICIPANT'
  | 'INVALID_ASSIGNMENT'
  | 'NEGATIVE_AMOUNT'
  | 'EMPTY_ALLOCATION'
  | 'UNBALANCED_NETS';

// Every rule violation in the ledger throws this, with a stable code the API and UI can map.
export class LedgerError extends Error {
  override readonly name = 'LedgerError';

  constructor(
    readonly code: LedgerErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// Deterministic id order: plain UTF-16 code-unit comparison, independent of locale.
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function assertUniqueIds(ids: readonly string[], what: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id))
      throw new LedgerError('DUPLICATE_PARTICIPANT', `${what}: "${id}" appears twice`, { id });
    seen.add(id);
  }
}

export function assertNonNegative(amount: bigint, what: string): void {
  if (amount < 0n)
    throw new LedgerError('NEGATIVE_AMOUNT', `${what} must not be negative, got ${amount}`);
}
