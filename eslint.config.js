import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const moneyMessage = 'Money code uses bigint minor units only (docs/STATUS.md, Phase 2 rules).';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      'coverage/**',
      '**/node_modules/**',
      'infra/vendor/**',
      'packages/rgb-client/src/schema.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    // No floats in money code: amounts are bigint, rates are decimal strings parsed exactly.
    files: ['packages/ledger/src/**/*.ts', 'packages/shared/src/ledger.ts'],
    ignores: ['**/*.test.ts', 'packages/ledger/src/test/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Math']",
          message: `No Math.* — ${moneyMessage}`,
        },
        {
          selector: 'CallExpression[callee.name=/^(parseFloat|parseInt|Number)$/]',
          message: `No float/number parsing — ${moneyMessage}`,
        },
        {
          selector: "CallExpression[callee.property.name='toFixed']",
          message: `No toFixed — ${moneyMessage}`,
        },
        {
          selector: 'Literal[raw=/^[0-9]*\\.[0-9]+$/]',
          message: `No float literals — ${moneyMessage}`,
        },
        {
          selector:
            'TSPropertySignature[key.name=/amount|total|tax|tip|service|cents|price|share|net|weight/i] TSNumberKeyword',
          message: `Amount fields must be bigint, not number — ${moneyMessage}`,
        },
        {
          selector: "CallExpression[callee.object.name='z'][callee.property.name='number']",
          message: `No z.number() in ledger schemas — ${moneyMessage}`,
        },
      ],
    },
  },
);
