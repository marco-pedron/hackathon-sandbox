import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Proves the money lint rules in eslint.config.js actually fire on ledger source.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function violations(code: string, file = 'packages/ledger/src/bad.ts'): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath: `${root}${file}` });
  return result?.messages.filter((m) => m.ruleId === 'no-restricted-syntax').length ?? 0;
}

describe('money lint rules', () => {
  it.each([
    ['number amount field', 'export type X = { amount: number };'],
    ['number total field', 'export type X = { usdTotalCents: number };'],
    ['Math.round', 'export const x = Math.round(1);'],
    ['parseFloat', "export const x = parseFloat('1.5');"],
    ['Number()', "export const x = Number('1');"],
    ['toFixed', 'export const x = (1).toFixed(2);'],
    ['float literal', 'export const x = 0.86;'],
  ])('flags %s', async (_name, code) => {
    expect(await violations(code)).toBeGreaterThan(0);
  });

  it('flags z.number() in the shared ledger schemas', async () => {
    expect(
      await violations(
        "import { z } from 'zod'; export const S = z.number();",
        'packages/shared/src/ledger.ts',
      ),
    ).toBeGreaterThan(0);
  });

  it('allows bigint amounts', async () => {
    expect(
      await violations('export type X = { amount: bigint }; export const y = 10n ** 2n;'),
    ).toBe(0);
  });
});
