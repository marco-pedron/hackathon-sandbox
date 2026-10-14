// Seeds the regtest RGB demo state on the three RLN nodes. Idempotent: every step checks
// the current state first and skips what is already done. If a step can't recover,
// run `pnpm infra:reset && pnpm rgb:seed`.
import { loadConfig } from '../src/config.js';
import { PARTICIPANTS, rlnNodes, type Participant } from '../src/rgb/nodes.js';
import { regtest } from '../src/rgb/regtest.js';
import {
  findReceive,
  findSend,
  listTransfers,
  refreshTransfers,
  rgbInvoice,
  sendRgb,
  settlementStatus,
  type Payout,
} from '../src/rgb/transfers.js';
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
const INITIAL = 50_000n; // 500.00 USD each to bob and charlie
const SETTLE_TIMEOUT_MS = 90_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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

async function stepDistribute(assetId: string) {
  console.log('[e] distribute to bob and charlie (real RGB transfer, one witness tx)');
  const receivers: Participant[] = ['bob', 'charlie'];
  // Refresh first so a transfer left in flight by an earlier run counts in `future`
  // and is not sent twice.
  for (const p of PARTICIPANTS) await refreshTransfers(nodes[p]);
  const todo: Participant[] = [];
  for (const p of receivers) {
    const b = await getAssetBalance(nodes[p], assetId);
    if (b.future >= INITIAL) console.log(`  ${p}: already has ${formatUsd(b.future)} (future), skip`);
    else todo.push(p);
  }

  let sent: { txid: string; recipientIds: Map<Participant, string> } | undefined;
  if (todo.length > 0) {
    // Receivers act first: each generates a blinded-UTXO invoice.
    const recipientIds = new Map<Participant, string>();
    const payouts: Payout[] = [];
    for (const p of todo) {
      const inv = await rgbInvoice(nodes[p], assetId, INITIAL, cfg.RGB_PROXY_ENDPOINT);
      recipientIds.set(p, inv.recipientId);
      payouts.push({ recipientId: inv.recipientId, units: INITIAL });
      console.log(`  ${p}: invoice ${inv.invoice}`);
    }
    const txid = await sendRgb(nodes.alice, assetId, payouts, cfg.RGB_PROXY_ENDPOINT);
    console.log(`  alice: sent, witness txid ${txid}`);
    console.log(`  mined 1 block, height ${await chain.mine(1)}`);
    sent = { txid, recipientIds };
  }

  // Wait until every receiver's settled balance reaches the target.
  const start = Date.now();
  for (;;) {
    for (const p of [...receivers, 'alice' as const]) await refreshTransfers(nodes[p]);
    const settled = await Promise.all(receivers.map(async (p) => (await getAssetBalance(nodes[p], assetId)).settled));
    if (settled.every((v) => v >= INITIAL)) break;
    if (sent) {
      const payer = findSend(await listTransfers(nodes.alice, assetId), sent.txid)?.status;
      for (const [p, rid] of sent.recipientIds) {
        const payee = findReceive(await listTransfers(nodes[p], assetId), rid)?.status;
        if (settlementStatus(payer, payee) === 'failed') {
          throw new Error(`transfer ${sent.txid} to ${p} failed (alice ${payer}, ${p} ${payee})`);
        }
      }
    }
    if (Date.now() - start > SETTLE_TIMEOUT_MS) {
      throw new Error(
        `receivers not settled after ${SETTLE_TIMEOUT_MS / 1000}s (settled ${settled.map(formatUsd)}); ` +
          'check `pnpm stack:logs rln-bob`, or `pnpm infra:reset && pnpm rgb:seed`',
      );
    }
    await sleep(2000);
  }
  if (sent) {
    const st = await chain.txStatus(sent.txid);
    console.log(`  settled on all nodes; esplora: confirmed=${st.confirmed} block ${st.block_height}`);
  }

  for (const p of PARTICIPANTS) {
    const b = await getAssetBalance(nodes[p], assetId);
    console.log(`  ${p}: settled ${formatUsd(b.settled)}, future ${formatUsd(b.future)} ${cfg.DEMO_ASSET_TICKER}`);
  }
}

try {
  await stepInitUnlock();
  await stepFund();
  await stepCreateUtxos();
  await stepDistribute(await stepIssue());
  console.log('seed done');
} catch (err) {
  console.error('✖ rgb:seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
