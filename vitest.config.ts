import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/server'],
    // `pnpm test:cov`: the ledger holds all money logic and must stay ≥ 90% covered.
    coverage: {
      provider: 'v8',
      include: ['packages/ledger/src/**/*.ts'],
      exclude: ['**/*.test.ts', 'packages/ledger/src/test/**'],
      thresholds: { statements: 90, branches: 90 },
    },
  },
});
