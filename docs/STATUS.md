# STATUS

## Phase 2 — Domain logic: ✅ done (2026-10-14)

Acceptance verified: `pnpm test` → 98 tests green; `pnpm test:cov` → ledger 100% statements, 98% branches (threshold 90/90); `pnpm typecheck` and `pnpm lint` green.

### What works
- `packages/ledger` (`@settleup/ledger`): pure TypeScript, no I/O. FX, expense split, balances, settlement plan, USD → asset units. Errors are `LedgerError` with a stable `code` (`UNKNOWN_CURRENCY`, `MISSING_RATE`, `INVALID_RATE`, `TOTAL_MISMATCH`, `INVALID_ASSIGNMENT`, `UNKNOWN_PARTICIPANT`, `DUPLICATE_PARTICIPANT`, `NEGATIVE_AMOUNT`, `EMPTY_ALLOCATION`, `UNBALANCED_NETS`, `INVALID_RATE_TABLE`) for the API to map to messages.
- Zod schemas `Expense`, `ExpenseDraft`, `LockedRate`, `Settlement`, `RateTable` live in `packages/shared/src/ledger.ts` (exported by `@settleup/shared`, re-exported by `@settleup/ledger`). Amounts are `z.bigint()`: JSON transport needs a string codec at the API layer (Phase 4).
- Public functions: `parseRateTable`, `lockRate`, `manualRate`, `convertToUsdCents`, `splitOriginal`, `allocateExpense`, `approveExpense`, `computeBalances`, `simplify`, `usdCentsToAssetUnits` (+ `allocateByWeight`, `splitEqually`, `parseDecimal`, `divRoundHalfUp`, `formatMoney`).
- `infra/rates.json`: static demo snapshot, base USD, `asOf` 2026-10-16. **The values are plausible, not live market data**; the `source` field says so.
- `apps/server/src/rgb/units.ts` now re-exports the asset-unit rule from the ledger.

### The money rules, in plain words (pitch material)
- **No floating point, ever.** Every amount is a whole number of the currency's smallest unit: cents for USD/EUR/GBP/CHF, whole dong for VND, whole yen for JPY. One table holds these. An unknown currency is an error, never a guess. A lint rule (with a test proving it fires) blocks `number` amounts, `Math.*`, `parseFloat` and float literals in money code.
- **Exchange rates are exact.** Rates are written as text ("26350", "0.86"), meaning "units of that currency per 1 US dollar", and read as exact fractions. Rounding happens in one place only: round half up to the nearest cent.
- **The rate is locked when the expense is approved.** The expense stores the rate, its date, where it came from (`table` or `manual` override) and when it was locked, plus the computed shares. Nothing is ever recomputed with a newer rate.
- **How a bill is split, in this order:**
  1. In the receipt's own currency, each item is divided equally among the people who had it. An item nobody is tagged on is shared by everyone at the table.
  2. Tax, service and tip, as one pool, are divided in proportion to what each person ate. If nobody ate anything with a price, they are divided equally.
  3. The receipt total is converted to US cents **once**, with the locked rate.
  4. Those cents are divided in proportion to each person's share from steps 1–2.
  5. Any leftover cent from a division goes to whoever lost the most to rounding ("largest remainder"). Ties go to the participant id first in alphabetical order. Shares always add up to the total exactly, never one cent more or less.
- **The receipt must add up.** Approval is refused when the total is not exactly items + tax + service + tip. The user fixes it; the ledger never absorbs a difference silently.
- **Balances.** For each person: what they paid minus what they owe, in US cents. A settlement counts only once its RGB transfer is confirmed. Pending settlements are listed separately and leave the balance alone. The balances of the group always add up to zero.
- **Settlement plan.** The person who owes the most pays the person owed the most, as much as possible; repeat. A group of n people with open balances needs at most n − 1 payments. This is a fast greedy method, not always the theoretical minimum. The plan is computed as if pending payments had already landed (`projectedNets`), so a payment in flight is never suggested twice.
- **Digital dollars.** The demo NIA asset has precision 2, so 1 US cent = 1 asset unit. One function does this.

### Tests
- Hand-computed examples: the demo dinner (VND, pho alice+bob, beers charlie, water three ways, tip → 9.68 USD: alice 3.09, bob 3.09, charlie 3.50), EUR taxi, USD supermarket with tax, manual rate, 3- and 5-person balances and plans, already-settled trip, pending vs confirmed vs failed.
- Rounding: 100 cents / 3, 1 VND / 3, a 1-unit tip across 2 people (unequal and equal subtotals), half-up at, below and above .5.
- Errors: unknown currency, missing rate, bad rate strings, total mismatch, non-member, duplicates, negatives, self-payment.
- fast-check properties: USD shares sum to the converted total; nets sum to 0; applying the plan zeroes every net; at most n − 1 transfers; output independent of input order.
- Type tests: every amount type is `bigint`.

### How to run
```sh
pnpm test        # all workspaces
pnpm test:cov    # with coverage; fails below 90% statements/branches on packages/ledger
pnpm typecheck && pnpm lint
```

### Known issues / decisions for Phase 4
- bigint amounts need a string codec in the HTTP schemas (zod 4.6 has `z.codec`).
- The settle button should use `projectedNets` (or hide pairs with a pending settlement) so nobody pays twice.
- Manual rates use the same direction as the table (units per 1 USD, e.g. "0.86" for EUR). The UI must label this clearly.
- `prettier --check .` reports 20 files formatted before this phase (none from Phase 2).

### Next step
Phase 3 — AI pipeline: receipt extraction and natural-language split with QVAC, zod-validated with retries.

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
