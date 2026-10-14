// Seeds the regtest RGB demo state on the three RLN nodes. Idempotent: every step checks
// the current state first and skips what is already done. If a step can't recover,
// run `pnpm infra:reset && pnpm rgb:seed`.
import { loadConfig } from '../src/config.js';
import { PARTICIPANTS, rlnNodes } from '../src/rgb/nodes.js';
import { regtest } from '../src/rgb/regtest.js';
import {
  btcBalance,
  colorableUtxos,
  createUtxos,
  ensureReady,
  findNiaByTicker,
  getAssetBalance,
  issueNia,
  newAddress,
  nodeInfo,
  retryOn,
} from '../src/rgb/wallet.js';
import { ASSET_PRECISION, formatUsd } from '../src/rgb/units.js';
import { loadDotEnv, setEnvIfEmpty, writeSeedState } from './env.js';

loadDotEnv();
const cfg = loadConfig();
const nodes = rlnNodes(cfg);
const chain = regtest(cfg.ESPLORA_URL);

const FUND_BTC = 1;
const MIN_SATS = 50_000_000; // skip funding above 0.5 BTC (vanilla + colored)
const UTXOS = 10;
const SUPPLY = 1_000_000n; // 10,000.00 USD at precision 2
const btc = (sats: number) => (sats / 1e8).toFixed(8);

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

async function stepFund() {
  console.log('[b] fund with regtest BTC');
  let funded = false;
  for (const p of PARTICIPANTS) {
    const b = await btcBalance(nodes[p]);
    const total = b.vanilla.future + b.colored.future;
    if (total >= MIN_SATS) {
      console.log(`  ${p}: already has ${btc(total)} BTC, skip`);
      continue;
    }
    const address = await newAddress(nodes[p]);
    const txid = await chain.fund(address, FUND_BTC);
    console.log(`  ${p}: sent ${FUND_BTC} BTC to ${address} (tx ${txid})`);
    funded = true;
  }
  if (funded) console.log(`  mined 1 block, height ${await chain.mine(1)}`);
  for (const p of PARTICIPANTS) {
    const b = await btcBalance(nodes[p]);
    console.log(`  ${p}: vanilla ${btc(b.vanilla.spendable)} BTC spendable, colored ${btc(b.colored.spendable)}`);
  }
}

async function stepCreateUtxos() {
  console.log('[c] create UTXOs for RGB allocations');
  let created = false;
  for (const p of PARTICIPANTS) {
    const did = await retryOn(['InsufficientFunds'], () => createUtxos(nodes[p], UTXOS));
    console.log(`  ${p}: ${did ? `created up to ${UTXOS}` : 'allocations already available, skip'}`);
    created ||= did;
  }
  if (created) console.log(`  mined 1 block, height ${await chain.mine(1)}`);
  for (const p of PARTICIPANTS) {
    console.log(`  ${p}: ${await colorableUtxos(nodes[p])} settled colorable UTXOs`);
  }
}

async function stepIssue(): Promise<string> {
  console.log('[d] issue NIA demo asset on alice');
  const { DEMO_ASSET_TICKER: ticker, DEMO_ASSET_NAME: name } = cfg;
  let asset = await findNiaByTicker(nodes.alice, ticker);
  if (asset) {
    if (asset.precision !== ASSET_PRECISION) {
      throw new Error(`${ticker} exists with precision ${asset.precision}, expected ${ASSET_PRECISION}: run pnpm infra:reset`);
    }
    console.log(`  ${ticker} already issued: ${asset.asset_id}, skip`);
  } else {
    asset = await issueNia(nodes.alice, ticker, name, SUPPLY, ASSET_PRECISION);
    console.log(`  issued ${ticker} "${name}" ${asset.asset_id}, supply ${formatUsd(SUPPLY)} USD`);
  }
  writeSeedState({ assetId: asset.asset_id, ticker });
  const b = await getAssetBalance(nodes.alice, asset.asset_id);
  console.log(`  alice: settled ${formatUsd(b.settled)}, spendable ${formatUsd(b.spendable)} ${ticker}`);
  return asset.asset_id;
}

try {
  await stepInitUnlock();
  await stepFund();
  await stepCreateUtxos();
  await stepIssue();
  console.log('seed done');
} catch (err) {
  console.error('✖ rgb:seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
