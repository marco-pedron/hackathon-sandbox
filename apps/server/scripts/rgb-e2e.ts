// Phase 1 acceptance: bob pays alice 5.00 USD with a real on-chain RGB transfer on regtest.
// Prints balances before/after and the witness txid, then checks the txid on esplora.
// Needs `pnpm rgb:seed` first.
import { loadConfig } from '../src/config.js';
import { rlnNodes, type Participant } from '../src/rgb/nodes.js';
import { onchainRail } from '../src/rgb/onchain-rail.js';
import { regtest } from '../src/rgb/regtest.js';
import { assetUnitsToUsdCents, formatUsd, usdCentsToAssetUnits } from '../src/rgb/units.js';
import { ensureReady, findNiaByTicker, getAssetBalance } from '../src/rgb/wallet.js';
import { loadDotEnv } from './env.js';

const AMOUNT_USD_CENTS = 500n; // 5.00 USD
const PAYER: Participant = 'bob';
const PAYEE: Participant = 'alice';
const TIMEOUT_MS = 90_000;

loadDotEnv();
const cfg = loadConfig();
const nodes = rlnNodes(cfg);
const chain = regtest(cfg.ESPLORA_URL);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

async function balances(assetId: string) {
  const [payer, payee] = await Promise.all([
    getAssetBalance(nodes[PAYER], assetId),
    getAssetBalance(nodes[PAYEE], assetId),
  ]);
  return { payer: payer.settled, payee: payee.settled };
}

async function main() {
  for (const p of [PAYER, PAYEE]) await ensureReady(nodes[p], cfg);
  const asset = await findNiaByTicker(nodes.alice, cfg.DEMO_ASSET_TICKER);
  if (!asset) throw new Error(`${cfg.DEMO_ASSET_TICKER} not issued: run pnpm rgb:seed`);
  const ticker = asset.ticker;
  const amount = usdCentsToAssetUnits(AMOUNT_USD_CENTS);

  const rail = onchainRail({
    nodes,
    assetId: asset.asset_id,
    proxyEndpoint: cfg.RGB_PROXY_ENDPOINT,
    afterBroadcast: cfg.RGB_AUTO_MINE
      ? async () => console.log(`  mined 1 block, height ${await chain.mine(1)}`)
      : undefined,
  });

  const before = await balances(asset.asset_id);
  console.log(`asset ${ticker} ${asset.asset_id}`);
  console.log(`before: ${PAYER} ${formatUsd(before.payer)}  ${PAYEE} ${formatUsd(before.payee)} ${ticker}`);

  console.log(`[1] ${PAYEE} creates invoice for ${formatUsd(amount)} ${ticker}`);
  const req = await rail.requestPayment(PAYEE, amount);
  console.log(`  ${req.invoice}`);

  console.log(`[2] ${PAYER} pays`);
  const ref = await rail.pay(PAYER, req);
  console.log(`  witness txid ${ref.txid}`);

  console.log('[3] waiting for both nodes to settle');
  let status = await rail.status(ref);
  while (status === 'pending') {
    if (Date.now() - t0 > TIMEOUT_MS) throw new Error(`still pending after ${TIMEOUT_MS / 1000}s`);
    await sleep(2000);
    status = await rail.status(ref);
  }
  console.log(`  status ${status} (${elapsed()})`);
  if (status !== 'confirmed') throw new Error(`settlement ${status}`);

  const after = await balances(asset.asset_id);
  console.log(`after:  ${PAYER} ${formatUsd(after.payer)}  ${PAYEE} ${formatUsd(after.payee)} ${ticker}`);

  const tx = await chain.txStatus(ref.txid);
  console.log(`esplora ${cfg.ESPLORA_URL}/tx/${ref.txid}/status → ${JSON.stringify(tx)}`);

  const problems: string[] = [];
  if (!tx.confirmed) problems.push('witness tx not confirmed on esplora');
  if (before.payer - after.payer !== amount) problems.push(`${PAYER} balance changed by ${before.payer - after.payer}`);
  if (after.payee - before.payee !== amount) problems.push(`${PAYEE} balance changed by ${after.payee - before.payee}`);
  if (problems.length) throw new Error(problems.join('; '));

  console.log(
    `✔ ${PAYER} → ${PAYEE} ${formatUsd(assetUnitsToUsdCents(amount))} USD settled on-chain, ` +
      `txid ${ref.txid}, block ${tx.block_height} (${elapsed()})`,
  );
}

try {
  await main();
} catch (err) {
  console.error('✖ rgb:e2e failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
