// Seeds the regtest RGB demo state on the three RLN nodes. Idempotent: every step checks
// the current state first and skips what is already done. If a step can't recover,
// run `pnpm infra:reset && pnpm rgb:seed`.
import { loadConfig } from '../src/config.js';
import { PARTICIPANTS, rlnNodes } from '../src/rgb/nodes.js';
import { ensureReady, nodeInfo } from '../src/rgb/wallet.js';
import { loadDotEnv, setEnvIfEmpty } from './env.js';

loadDotEnv();
const cfg = loadConfig();
const nodes = rlnNodes(cfg);

async function stepInitUnlock() {
  console.log('[a] init + unlock');
  for (const p of PARTICIPANTS) {
    const node = nodes[p];
    const r = await ensureReady(node, cfg);
    if (r.generatedMnemonic) {
      setEnvIfEmpty(`RLN_${p.toUpperCase()}_MNEMONIC`, r.generatedMnemonic);
      node.mnemonic = r.generatedMnemonic;
    }
    const info = await nodeInfo(node);
    console.log(
      `  ${p}: ${r.initialized ? 'initialized' : 'already initialized'}, ` +
        `${r.unlocked ? 'unlocked' : 'already unlocked'}, pubkey ${info.pubkey}` +
        (r.generatedMnemonic ? ' (mnemonic saved to .env)' : ''),
    );
  }
}

try {
  await stepInitUnlock();
  console.log('seed done');
} catch (err) {
  console.error('✖ rgb:seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
