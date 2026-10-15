import { describe, expect, it } from 'vitest';
import { assertNoFakes } from './guard.js';

describe('assertNoFakes', () => {
  it('passes with fakes off or unset', () => {
    expect(() => assertNoFakes({})).not.toThrow();
    expect(() => assertNoFakes({ FAKE_AI: '0', VITE_FAKE_API: '' })).not.toThrow();
  });

  it('refuses FAKE_AI=1 or VITE_FAKE_API=1', () => {
    expect(() => assertNoFakes({ FAKE_AI: '1' })).toThrow(/FAKE_AI=1/);
    expect(() => assertNoFakes({ VITE_FAKE_API: '1' })).toThrow(/VITE_FAKE_API=1/);
  });
});
