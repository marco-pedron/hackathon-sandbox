// openapi.yaml declares no error responses. The body shape { error, code, name } and the
// names below come from upstream rgb-lightning-node src/error.rs (APIErrorResponse,
// APIError::name) at the pinned commit d4762ac. We only branch on `name`.
export type RlnErrorName =
  | 'AlreadyInitialized'
  | 'AlreadyUnlocked'
  | 'UnlockedNode'
  | 'LockedNode'
  | 'NotInitialized'
  | 'WrongPassword'
  | 'AllocationsAlreadyAvailable'
  | 'NoAvailableUtxos'
  | 'InsufficientAssets'
  | 'InsufficientFunds'
  | 'RecipientIDAlreadyUsed'
  | 'InvalidRecipientID';

export class RlnError extends Error {
  constructor(
    readonly node: string,
    readonly endpoint: string,
    readonly status: number,
    override readonly name: string,
    readonly detail: string,
  ) {
    super(`${node} ${endpoint}: HTTP ${status} ${name}: ${detail}`);
  }
}

export function isRlnError(e: unknown, name: RlnErrorName): e is RlnError {
  return e instanceof RlnError && e.name === name;
}

// Build an RlnError from whatever the node returned (JSON body, text, or nothing).
export function toRlnError(node: string, endpoint: string, status: number, body: unknown): RlnError {
  if (body && typeof body === 'object' && 'name' in body && typeof body.name === 'string') {
    const detail = 'error' in body && typeof body.error === 'string' ? body.error : '';
    return new RlnError(node, endpoint, status, body.name, detail);
  }
  const detail = typeof body === 'string' ? body : JSON.stringify(body ?? null);
  return new RlnError(node, endpoint, status, 'Unknown', detail);
}
