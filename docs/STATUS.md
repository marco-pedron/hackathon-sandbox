# STATUS

## Phase 0 — Environment & skeleton: ✅ done (2026-10-14), one known gap

### What works
- Monorepo (pnpm workspaces, strict TS, vitest, eslint); typed RLN client generated from `openapi.yaml` in `packages/rgb-client`.
- Regtest stack in `infra/docker-compose.yml`: bitcoind, electrs, esplora (REST on :3010), rgb-proxy-server 0.3.0 (:3000), 3 rgb-lightning-node instances — giulia :3001, ben :3002, sam :3003 (`--network regtest --disable-authentication`).
- RLN image `settleup/rln:d4762ac` built locally from pinned upstream commit `d4762ac` (no public image exists).
- QVAC `@qvac/sdk` 0.21.0. Cached models (~2.1 GB in `~/.qvac/models`): OCR_LATIN, QWEN3_1_7B_INST_Q4, QWEN3_600M_INST_Q4, SMOLVLM2_500M_MULTIMODAL_Q8_0 + its mmproj.
- Acceptance check verified **with Wi-Fi off** (internet confirmed unreachable): `pnpm ai:smoke` → ready in ~6.8 s (OCR 2.4 s, Qwen3-1.7B 4.0 s, completion 0.25 s); stack restart + `check.sh` → all checks passed.

### How to run
```sh
./infra/scripts/build-rln.sh   # once, 15-40 min, needs network
pnpm ai:download               # once, needs network
pnpm infra:up                  # or ./infra/scripts/up.sh — cold or warm start
pnpm infra:check               # Phase 0 acceptance probe
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
