import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses localhost defaults', () => {
    const c = loadConfig({});
    expect(c.RLN_BOB_URL).toBe('http://localhost:3002');
    expect(c.ESPLORA_URL).toBe('http://localhost:3010');
    expect(c.SERVER_PORT).toBe(8080);
  });

  it('rejects a malformed URL', () => {
    expect(() => loadConfig({ RLN_ALICE_URL: 'not a url' })).toThrow();
  });

  it('treats empty secrets as unset and parses RGB_AUTO_MINE', () => {
    const c = loadConfig({ RLN_BOB_PASSWORD: '', RLN_BOB_MNEMONIC: 'a b c', RGB_AUTO_MINE: 'false' });
    expect(c.RLN_BOB_PASSWORD).toBeUndefined();
    expect(c.RLN_BOB_MNEMONIC).toBe('a b c');
    expect(c.RGB_AUTO_MINE).toBe(false);
    expect(c.RGB_PROXY_ENDPOINT).toBe('rpc://proxy:3000/json-rpc');
  });
});
