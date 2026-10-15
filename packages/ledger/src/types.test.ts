import { describe, expectTypeOf, it } from 'vitest';
import type {
  Expense,
  ExpenseAllocation,
  ExpenseItem,
  LockedRate,
  Settlement,
  Share,
} from './index.js';
import type { Money } from './money.js';
import type { NetPosition } from './balances.js';
import type { Transfer } from './simplify.js';

// Fails `pnpm typecheck`/vitest if any amount type ever becomes `number`.
describe('amount types are bigint', () => {
  it('schemas and domain types', () => {
    expectTypeOf<Money['amount']>().toEqualTypeOf<bigint>();
    expectTypeOf<ExpenseItem['amount']>().toEqualTypeOf<bigint>();
    expectTypeOf<Expense['total']>().toEqualTypeOf<bigint>();
    expectTypeOf<NonNullable<Expense['extras']['tip']>>().toEqualTypeOf<bigint>();
    expectTypeOf<NonNullable<Expense['extras']['tax']>>().toEqualTypeOf<bigint>();
    expectTypeOf<NonNullable<Expense['extras']['service']>>().toEqualTypeOf<bigint>();
    expectTypeOf<ExpenseAllocation['usdTotalCents']>().toEqualTypeOf<bigint>();
    expectTypeOf<Share['amount']>().toEqualTypeOf<bigint>();
    expectTypeOf<Settlement['amountCents']>().toEqualTypeOf<bigint>();
    expectTypeOf<NetPosition['netCents']>().toEqualTypeOf<bigint>();
    expectTypeOf<Transfer['amountCents']>().toEqualTypeOf<bigint>();
  });

  it('rates are decimal strings, not numbers', () => {
    expectTypeOf<LockedRate['value']>().toEqualTypeOf<string>();
  });
});
