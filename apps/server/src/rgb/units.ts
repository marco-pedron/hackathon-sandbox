// The USD cents ↔ NIA asset units rule lives in the ledger (one place).
export { ASSET_PRECISION, assetUnitsToUsdCents, usdCentsToAssetUnits } from '@settleup/ledger';

// The RLN API carries amounts as JSON integers (JS number); the domain uses bigint.
export function toApiAmount(units: bigint): number {
  if (units <= 0n) throw new Error(`amount must be positive, got ${units}`);
  const n = Number(units);
  if (!Number.isSafeInteger(n)) throw new Error(`amount ${units} exceeds the safe integer range`);
  return n;
}

export function fromApiAmount(n: number): bigint {
  if (!Number.isSafeInteger(n)) throw new Error(`amount ${n} is not a safe integer`);
  return BigInt(n);
}

export function formatUsd(units: bigint): string {
  const sign = units < 0n ? '-' : '';
  const abs = units < 0n ? -units : units;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}
