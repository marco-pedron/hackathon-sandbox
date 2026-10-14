import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses localhost defaults', () => {
    const c = loadConfig({});
    expect(c.RLN_BEN_URL).toBe('http://localhost:3002');
    expect(c.ESPLORA_URL).toBe('http://localhost:3010');
    expect(c.SERVER_PORT).toBe(8080);
  });

  it('rejects a malformed URL', () => {
    expect(() => loadConfig({ RLN_GIULIA_URL: 'not a url' })).toThrow();
  });
});
