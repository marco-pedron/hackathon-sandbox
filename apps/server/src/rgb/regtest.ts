// Regtest-only chain helpers: mining and funding go through infra/scripts (bitcoin-cli in
// the bitcoind container), chain state is read from the esplora REST API.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SCRIPTS = fileURLToPath(new URL('../../../../infra/scripts/', import.meta.url));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Regtest {
  /** Mine n blocks, wait until esplora has indexed them, return the new height. */
  mine(n: number): Promise<number>;
  /** Send BTC from the miner wallet to an address (not mined). Returns the txid. */
  fund(address: string, btc: number): Promise<string>;
  tipHeight(): Promise<number>;
  txStatus(txid: string): Promise<TxStatus>;
}

export interface TxStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
}

export function regtest(esploraUrl: string, timeoutMs = 60_000): Regtest {
  async function esplora(path: string): Promise<Response> {
    return fetch(`${esploraUrl}${path}`);
  }

  async function tipHeight(): Promise<number> {
    const res = await esplora('/blocks/tip/height');
    if (!res.ok) throw new Error(`esplora /blocks/tip/height: HTTP ${res.status}`);
    return Number(await res.text());
  }

  async function waitForTip(height: number): Promise<void> {
    const start = Date.now();
    while ((await tipHeight().catch(() => -1)) < height) {
      if (Date.now() - start > timeoutMs) throw new Error(`esplora did not reach height ${height}`);
      await sleep(500);
    }
  }

  return {
    async mine(n) {
      const { stdout } = await run(`${SCRIPTS}mine.sh`, [String(n)]);
      const height = Number(/height (\d+)/.exec(stdout)?.[1]);
      if (!Number.isInteger(height)) throw new Error(`mine.sh: unexpected output ${stdout}`);
      await waitForTip(height);
      return height;
    },
    async fund(address, btc) {
      const { stdout } = await run(`${SCRIPTS}fund.sh`, [address, String(btc)]);
      return stdout.trim();
    },
    tipHeight,
    async txStatus(txid) {
      const res = await esplora(`/tx/${txid}/status`);
      if (res.status === 404) return { confirmed: false };
      if (!res.ok) throw new Error(`esplora /tx/${txid}/status: HTTP ${res.status}`);
      return (await res.json()) as TxStatus;
    },
  };
}
