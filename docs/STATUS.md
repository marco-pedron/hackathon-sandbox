# STATUS

## Phase 1 — RGB core on regtest: 🚧 in progress

Acceptance: `pnpm rgb:e2e` sends 5.00 USD bob→alice, prints balances before/after and the witness txid, confirmed on esplora REST.

### Sub-steps
- ✅ (a) init + unlock: `pnpm rgb:seed` inits and unlocks alice/bob/charlie (`/init`, `/unlock` with BlockSync on `bitcoind:18443`, indexer `electrs:50001`). Rerun-safe; a restarted node is re-unlocked.
- ✅ (b) fund: `/address` → `infra/scripts/fund.sh` (miner wallet `sendtoaddress`, 1 BTC each) → mine 1. Skipped when a node already has ≥ 0.5 BTC.
- ✅ (c) RGB UTXOs: `/createutxos` `up_to: true, num: 10` → mine 1 → 10 settled colorable UTXOs per node (`/listunspents`). Skipped on `AllocationsAlreadyAvailable`.
- ✅ (d) NIA asset: `/issueassetnia` on alice, ticker `DUSD` "Demo Digital Dollar", precision 2, supply 1,000,000 units = 10,000.00 USD. No mining needed. Found again by ticker via `/listassets`; its id is cached in `infra/data/seed-state.json` (gitignored, changes on every reset).
- ✅ (e) distribute: bob and charlie `/rgbinvoice` (blinded, 50,000 units = 500.00) → alice `/sendrgb` (one witness tx, `donation: true` as in upstream tests) → mine 1 → `/refreshtransfers` until both receivers are `Settled`. Verified: tx `139cf072…fa6f` confirmed in esplora at height 107; balances alice 9,000.00, bob 500.00, charlie 500.00. Recovers an in-flight transfer from a crashed run instead of sending twice.
- ⏳ (f) on-chain SettlementRail + `pnpm rgb:e2e`

### Learned the hard way (RLN behaviour)
- A node that never held the asset answers `UnknownContractId` to `/assetbalance`, `/rgbinvoice` and `/refreshtransfers` with that `asset_id`. So: balance = 0, the first invoice uses `asset_id: null`, and refresh always runs with `asset_id: null` (as upstream tests do).
- A batch send shows up on the sender as one `Send` transfer per recipient with the same txid.

### Secrets
`.env` (gitignored, mode 600): `RLN_{ALICE,BOB,CHARLIE}_PASSWORD` (random, min 8 chars, required). `RLN_*_MNEMONIC` are written back by `rgb:seed` when a node is initialized without one. Other keys and defaults: `.env.example`.

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
