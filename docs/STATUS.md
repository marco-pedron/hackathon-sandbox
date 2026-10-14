# STATUS

## Phase 1 — RGB core on regtest: ✅ done (2026-10-14)

Acceptance verified from a cold `pnpm infra:reset`: `pnpm rgb:seed` → `pnpm rgb:seed` (rerun) → `pnpm rgb:e2e`. Bob → alice 5.00 USD: bob 500.00 → 495.00, alice 9,000.00 → 9,005.00, witness tx `b731fa23…246a` confirmed at height 108 on esplora REST, about 6 s end to end.

### What works
- (a) init + unlock: `/init` (password from `.env`; mnemonic from `.env` or generated and written back) then `/unlock` (BlockSync on `bitcoind:18443`, indexer `electrs:50001`). `ensureReady()` is rerun-safe and re-unlocks a restarted node (tested with `docker compose restart`).
- (b) fund: `/address` → `infra/scripts/fund.sh` (miner wallet, 1 BTC each) → mine 1. Skipped when a node already has ≥ 0.5 BTC.
- (c) RGB UTXOs: `/createutxos` `up_to: true, num: 10` → mine 1 → 10 colorable UTXOs. On a rerun it tops back up to 10 (invoices and receipts use UTXOs), otherwise it is skipped on `AllocationsAlreadyAvailable`.
- (d) NIA asset: `/issueassetnia` on alice, `DUSD` "Demo Digital Dollar", precision 2, 1,000,000 units = 10,000.00 USD. No mining. Found again by ticker via `/listassets`; the id is cached in `infra/data/seed-state.json`.
- (e) distribute: bob and charlie `/rgbinvoice` (blinded UTXO, 500.00 each) → alice `/sendrgb` (one witness tx, `donation: true` as in upstream tests) → mine 1 → `/refreshtransfers` until settled. Refreshes first, so a transfer in flight from a crashed run is not sent twice.
- (f) `SettlementRail` (`apps/server/src/rgb/rail.ts`) + on-chain implementation (`onchain-rail.ts`):
  - `requestPayment`: payee `/rgbinvoice`.
  - `pay`: payer `/sendrgb`, then the `afterBroadcast` hook (mine 1 when `RGB_AUTO_MINE=true`).
  - `status`: `/refreshtransfers` payee then payer, then `/listtransfers` on both. Both `Settled` → confirmed, either `Failed` → failed, else pending.
- Unit tests: units/bigint conversion, settlement status mapping, transfer lookup, config (13 tests).

### How to run
```sh
pnpm infra:up             # or pnpm infra:reset for a cold chain
pnpm rgb:seed             # idempotent; needs RLN_*_PASSWORD in .env
pnpm rgb:e2e              # bob → alice 5.00, prints balances, txid, esplora status
pnpm stack:logs rln-bob   # node logs when something fails
```

### Learned the hard way (RLN behaviour)
- A node that never held the asset answers `UnknownContractId` to `/assetbalance`, `/rgbinvoice` and `/refreshtransfers` with that `asset_id`. So: balance = 0, the first invoice falls back to `asset_id: null`, and refresh always runs with `asset_id: null` (as upstream tests do).
- A batch send shows up on the sender as one `Send` transfer per recipient, all with the same txid.
- Passwords need ≥ 8 chars (upstream `PASSWORD_MIN_LENGTH`).
- `openapi.yaml` declares no error responses; the `{error, code, name}` body comes from upstream `src/error.rs`.

### Secrets
`.env` (gitignored, mode 600): `RLN_{ALICE,BOB,CHARLIE}_PASSWORD` (random, required). `RLN_*_MNEMONIC` are written back by `rgb:seed` when a node is initialized without one; the same mnemonics are reused after `infra:reset`. Other keys and defaults: `.env.example`.

### Known issues
- Still no esplora web UI (Phase 0 gap): the proof is the REST `/tx/<txid>/status`. A clickable explorer for demo step 7 is needed by Phase 4.
- Each `rgb:e2e` run moves 5.00 from bob to alice; bob runs out after about 100 runs → `pnpm infra:reset && pnpm rgb:seed`.
- Needs `infra:reset`: changed password or mnemonic (`WrongPassword`), a demo asset issued with the wrong precision (the seed refuses), or a transfer stuck `Failed`/pending past the 90 s timeout.

### Next step
Phase 2 — domain logic (FX, split, balances, simplification) with vitest, ledger coverage ≥ 90%.

## Phase 0 — Environment & skeleton: ✅ done (2026-10-14), one known gap

### What works
- Monorepo (pnpm workspaces, strict TS, vitest, eslint); typed RLN client generated from `openapi.yaml` in `packages/rgb-client`.
- Regtest stack in `infra/docker-compose.yml`: bitcoind, electrs, esplora (REST on :3010), rgb-proxy-server 0.3.0 (:3000), 3 rgb-lightning-node instances — alice :3001, bob :3002, charlie :3003 (`--network regtest --disable-authentication`).
- RLN image `settleup/rln:d4762ac` built locally from pinned upstream commit `d4762ac` (no public image exists).
- QVAC `@qvac/sdk` 0.21.0. Cached models (~2.1 GB in `~/.qvac/models`): OCR_LATIN, QWEN3_1_7B_INST_Q4, QWEN3_600M_INST_Q4, SMOLVLM2_500M_MULTIMODAL_Q8_0 + its mmproj.
- Acceptance check verified **with Wi-Fi off** (internet confirmed unreachable): `pnpm ai:smoke` → ready in ~6.8 s (OCR 2.4 s, Qwen3-1.7B 4.0 s, completion 0.25 s); stack restart + `check.sh` → all checks passed.

### How to run
```sh
./infra/scripts/build-rln.sh   # once, 15-40 min, needs network
pnpm ai:download               # once, needs network
pnpm infra:up                  # or ./infra/scripts/up.sh — cold or warm start
pnpm infra:check               # Phase 0 acceptance probe
pnpm stack:ps                  # docker compose ps for the stack
pnpm stack:logs <service>      # e.g. pnpm stack:logs rln-bob --tail 100 -f
pnpm ai:smoke                  # loads OCR + LLM from cache, prints "ready"
./infra/scripts/mine.sh <n>    # mine n blocks
pnpm infra:down                # stop, keep data
pnpm infra:reset               # wipe volumes and restart cold
```
RLN nodes answer `/nodeinfo` with 403 `LockedNode` until init + unlock (done by the Phase 1 seed script).

### Known issues
- **No esplora web UI.** :3010 serves only the electrs REST API (`/` is 404). The Phase 0 check says "esplora UI loads", and demo step 7 needs a clickable explorer link. To fix before/at Phase 1: run the full `blockstream/esplora` image (UI + API) or link to the REST `/tx/<txid>` endpoint.
- Docker Desktop has ~4 GB RAM; RLN build uses `CARGO_BUILD_JOBS=2` to avoid OOM.
- Qwen3 emits an empty `<think></think>` block even with `/no_think`; Phase 3 parsing must strip it.

### Next step
Phase 1 — RGB core on regtest (on-site): seed script (init/unlock/fund/issue NIA/distribute) and `pnpm rgb:e2e`.
