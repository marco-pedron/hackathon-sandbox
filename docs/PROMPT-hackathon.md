# MASTER PROMPT — "SettleUp Trip": group-travel debts settled in RGB digital dollars, with on-device AI

> How to use: put this file in the repo root as `CLAUDE.md` (or paste it as the first message to your coding agent), together with `hackathon-brief.md`, `QVAC.md` and the RLN `openapi.yaml`. Run it **one phase at a time**. Do not move to the next phase until the current phase's acceptance check passes.

---

## 0. Role, rules of engagement, and what "done" means

You are the lead engineer of a 3-person team at a 27-hour hackathon (build: Sat 17 Oct 09:30 → Sun 18 Oct 13:00). You build a working end-to-end demo, not a production app.

**Hard rules — violating any of these is a failure:**

1. **Never invent APIs.** The SDKs here (QVAC, rgb-lightning-node, WDK, @utexo/*) are new and you have seen little or none of their code. For every call you write:
   - QVAC → only functions, options, and model constants that appear in `QVAC.md` or in `node_modules/@qvac/sdk` type definitions. Read the `.d.ts` files before using a function.
   - rgb-lightning-node → only endpoints and fields that appear in `rgb-lightning-node/openapi.yaml`. Generate a typed client from it (see Phase 2). Do not guess request bodies.
   - If the needed function is not documented, STOP and report: "I need X, I can't find it in the docs, options are A/B." Do not fake it.
2. **No simulated transactions.** Every "payment" in the UI must correspond to a real RGB transfer on regtest, visible in the explorer (esplora) and in the RLN node's transfer list. A `console.log("paid")`, a mocked balance, or a hardcoded success is forbidden. The jury criterion is literally "working transactions, not simulated".
3. **Correct RGB terminology and version.** Use only **RGB Protocol on Bitcoin v0.11.1** (`docs.rgb.info`, `github.com/rgb-protocol`, `github.com/RGB-Tools`). Never use `rgb.tech`, `github.com/RGB-WG`, RGB v0.12, or RGB++. The asset schema is **NIA** (not "RGB20"). Say "private contract", not "smart contract", in code comments, README and UI copy.
4. **Money logic is deterministic code, never the LLM.** The LLM extracts and proposes. Arithmetic, currency conversion, balance netting and debt simplification are plain TypeScript functions with unit tests. Amounts are integers in minor units (cents / asset precision units), never floats.
5. **Every AI output passes through a zod schema.** Max 2 retries with the validation error fed back to the model, then fall back to a manual form pre-filled with whatever was parsed. The app must never crash or hang because the model returned bad JSON.
6. **Commit after every working step** with a descriptive message (`feat(rgb): send NIA asset alice→bob on regtest`). The hackathon judges only work in dated commits made during the event.
7. **Small, verifiable steps.** After each step run the check, paste the output, then continue. If something fails 3 times in a row, stop and summarize: what you tried, the exact error, your best hypothesis.
8. **Scope discipline.** If a feature is not in this file, don't build it. If you think something is missing, propose it, don't implement it.

---

## 1. The product (what the demo must show)

**User:** an Italian traveler on an organized group trip (WeRoad-style) with strangers from other countries — e.g. Giulia (IT, EUR), Ben (DE, EUR), Sam (US, USD) in Vietnam — paying in VND, sharing dinners and taxis. People pay in turns; at the end of the trip the group dissolves and small debts are never settled.

**Promise:** snap the receipt → on-device AI reads it and proposes who owes what → the group approves → balances are netted in one unit (digital dollars on RGB) → whoever owes settles **right now**, with a real RGB payment, no banks, no IBAN, no country-specific app.

**The single happy path (the demo, ~90 seconds):**

1. Pre-loaded trip "Vietnam 2026" with 3 members (Giulia, Ben, Sam), each with their own RGB node and a balance of the demo NIA asset.
2. Giulia uploads a photo of a restaurant receipt in VND.
3. The local model extracts: merchant, date, currency, line items, total. UI shows the extraction with a confidence hint and lets the user edit any field.
4. Giulia types in natural language: *"Ben and I shared the pho, Sam only had beers, split the water three ways"*. The local model maps this to an item → participants assignment. UI shows the proposed split per person.
5. Giulia approves. The expense is recorded with the **FX rate locked at that moment** (VND→USD from the bundled rate table, shown with its date and source).
6. The balances screen shows net positions in USD and the **simplified** settlement plan (minimum number of transfers).
7. Ben clicks "Settle now" → real RGB transfer Ben→Giulia → status goes pending → confirmed → balances update. A link opens the transfer in the regtest explorer.
8. A "Proof" panel shows: the RGB transfer status from the node, the witness txid, and the explorer link.

Everything else is out of scope.

---

## 2. Architecture

```
[React + Vite UI]  ── HTTP/JSON ──>  [Node 22.17+ backend, TypeScript, Fastify]
                                        ├── ai/        @qvac/sdk (OCR + LLM, in-process)
                                        ├── ledger/    expenses, FX, netting, simplification (pure TS + SQLite)
                                        ├── rgb/       typed client for 3× rgb-lightning-node REST APIs
                                        └── wdk/       (Phase 6, optional) @tetherto/wdk + @utexo/*
                                                │
                    docker-compose (regtest): bitcoind, electrs, esplora, rgb-proxy-server
                    + 3 rgb-lightning-node instances: giulia (3001), ben (3002), sam (3003)
```

Decisions (do not revisit unless blocked):

- **Monorepo**, pnpm workspaces: `apps/web`, `apps/server`, `packages/shared` (zod schemas + types shared by web and server), `infra/` (docker-compose, scripts).
- **One backend process orchestrates all three nodes.** Each participant maps to one RLN base URL. The UI has a **participant switcher** ("acting as: Giulia / Ben / Sam") — this simulates three phones on one laptop. State this honestly in the README: in production each user runs their own node/wallet.
- **Shared ledger = SQLite on the backend** (`better-sqlite3`). In production it would be synced peer-to-peer between members' devices; do not build sync.
- **Config by env vars** (`RLN_GIULIA_URL`, `ESPLORA_URL`, `QVAC_MODEL_*`, …) so the Docker stack can run on one machine and the backend + QVAC on another (QVAC benefits from Apple Metal on a MacBook; the regtest stack can run on a Linux box).
- **Settlement mode:** implement **on-chain RGB transfer first** (invoice → sendasset → mine block → refresh). It is the most robust path and fully satisfies "real RGB transactions". **RGB over Lightning** is Phase 5, only after the on-chain path is committed and demoable. Keep both behind one interface:
  ```ts
  interface SettlementRail {
    requestPayment(to: Participant, amount: bigint): Promise<PaymentRequest>; // receiver acts first
    pay(from: Participant, req: PaymentRequest): Promise<SettlementRef>;
    status(ref: SettlementRef): Promise<'pending' | 'confirmed' | 'failed'>;
  }
  ```
  Note the RGB flow: **the receiver generates the invoice first** (blinded UTXO), then the payer sends.

---

## 3. Domain logic (pure TypeScript, unit-tested with vitest)

- `Money = { amount: bigint; currency: ISO4217 }` in minor units. Respect currency exponents (VND = 0, USD/EUR = 2).
- **FX:** `infra/rates.json` = static snapshot `{ base: "USD", asOf: "2026-10-16", source: "...", rates: { EUR: ..., VND: ..., ... } }`. Rule: **the rate is locked at the time the expense is approved and stored on the expense**; it is never recomputed. The user can override the rate manually (stored with `rateSource: "manual"`). The UI always shows rate, date and source.
- **Asset units:** the demo NIA asset has precision 2 and represents 1 USD per unit-of-100. Conversion USD-cents → asset units is 1:1. Put this in one function.
- **Split:** item-level assignment; unassigned items (tax, service, tip) split proportionally or equally (equally is fine — document the rule). Rounding: largest-remainder method so the per-person shares sum exactly to the total.
- **Balances:** net per participant = paid − owed, in USD cents.
- **Simplification:** greedy min-cash-flow (match largest debtor with largest creditor). Tests: totals conserve to zero; 3-person and 5-person cases; already-settled case; rounding edge cases.
- **Settlements** are ledger entries linked to an RGB transfer reference; a settlement only reduces balances once its status is `confirmed`.

---

## 4. AI layer (QVAC, on-device) — the AI must be central, not decorative

Three AI tasks, each with its own zod schema in `packages/shared`:

1. **Receipt extraction** — image → OCR (QVAC OCR capability as documented in QVAC.md) → OCR text → LLM → `ReceiptSchema`:
   `{ merchant, date (ISO), currency (ISO4217), items: [{ label, quantity, unitPrice, total }], subtotal?, tax?, tip?, total, warnings: string[] }`.
   Validation beyond zod: items sum ≈ total (tolerance), currency is a known code. If inconsistent, add a warning and show it to the user — do not silently fix.
   If OCR quality is poor, try the vision-language model path if QVAC.md documents one; otherwise fall back to the manual form.
2. **Natural-language split** — input: items list + participant names + free text (Italian or English) → `SplitProposalSchema`: `{ assignments: [{ itemIndex, participants: string[] }], unassigned: number[], clarificationNeeded?: string }`. If the model returns a name not in the group or an item index out of range, that is a validation error → retry → fallback to checkbox UI.
3. **Ambiguity handling** — if `clarificationNeeded` is set, the UI shows the question; the user's answer is fed back once.

Implementation requirements:
- One `ai/` module with `extractReceipt()`, `proposeSplit()`; each returns `{ ok: true, data, attempts } | { ok: false, partial, error }`.
- Prompt templates in separate files, with 1–2 few-shot examples each; ask for JSON only. Strip code fences before parsing.
- Load models once at server start; expose `/api/ai/status` (loading / ready / error) and show it in the UI.
- Pick the smallest models in the QVAC registry that pass the 3 sample receipts. Log latency per call. Target < 20 s per receipt on the demo laptop.
- Everything works with networking disabled after models are downloaded (verify in Phase 1).

---

## 5. UI (React + Vite + Tailwind) — judged on flow, not looks

Screens: **Trip** (members, balances, settlement plan) → **Add expense** (upload → extraction review → NL split → approve) → **Settle** (one button per suggested transfer) → **Proof** panel.

Required UX:
- Every async step shows what is happening ("Reading receipt on this device…", "Waiting for Bitcoin confirmation…") with elapsed time.
- Every error is human-readable with one suggested action (retry / edit manually / check node). Map known RLN errors (insufficient allocations, no available UTXOs, invoice expired, peer offline) to messages.
- The AI proposal is always editable; approval is an explicit click.
- A visible "Runs on this device — receipts never leave it" indicator tied to the actual AI status.
- Participant switcher always visible.

---

## 6. Phases and acceptance checks

### Phase 0 — Environment & skeleton (**ALLOWED BEFORE THE EVENT**: setup only, no RGB/QVAC product integration)
- Monorepo scaffold, lint, vitest, pnpm scripts.
- `infra/docker-compose.yml` with bitcoind, electrs, esplora, rgb-proxy-server and 3 RLN nodes in regtest, based on the RLN repo's own regtest setup (`--network regtest --disable-authentication`, distinct ports).
- `infra/scripts/`: `up.sh`, `down.sh`, `mine.sh <n>`, `reset.sh` (wipe volumes, restart).
- Download QVAC models into the cache; `pnpm ai:smoke` loads them and prints "ready".
- Copy `rgb-lightning-node/openapi.yaml` into `packages/rgb-client/` and generate a typed client (`openapi-typescript` + `openapi-fetch`).
- ✅ Check: `./infra/scripts/up.sh` brings everything up from a cold start; each RLN `/nodeinfo` (or the equivalent endpoint from openapi.yaml) responds; esplora UI loads; `pnpm ai:smoke` passes **with Wi-Fi off**.

### Phase 1 — RGB core on regtest (on-site)
- `infra/scripts/seed.ts`: init + unlock the 3 nodes, fund each with regtest BTC, mine, create UTXOs for RGB allocations, **issue the NIA demo asset** from Giulia's node, distribute an initial balance to Ben and Sam via real transfers, mine, refresh. Idempotent where possible; otherwise `reset.sh && seed`.
- `rgb/` module: `getAssetBalance(p)`, and the on-chain `SettlementRail` (receiver invoice → payer send → mine → refresh both → status).
- ✅ Check: `pnpm rgb:e2e` performs Ben→Giulia 5.00 USD, prints both balances before/after and the witness txid, and the txid is visible in esplora. **Commit.**

### Phase 2 — Domain logic
- Implement section 3 with tests. No UI yet.
- ✅ Check: `pnpm test` green, coverage on ledger ≥ 90%. **Commit.**

### Phase 3 — AI pipeline (on-site)
- Implement section 4. `infra/fixtures/receipts/`: 3 receipt photos (VND restaurant, EUR taxi, USD supermarket) + expected JSON.
- `pnpm ai:eval` runs all 3, prints field-level accuracy, attempts and latency.
- ✅ Check: all 3 produce a valid `ReceiptSchema` (with manual corrections allowed for at most 1 field each); the NL split sentence from section 1 produces the correct assignment. **Commit.**

### Phase 4 — API + UI, full happy path
- Fastify routes: trips, expenses (create from image, propose split, approve), balances, settlement plan, settle, settlement status, ai status. Request/response validated with the shared zod schemas.
- UI per section 5.
- ✅ Check: run the full demo of section 1 by hand from a fresh `reset.sh && seed`, with Wi-Fi off. Record a screen video. **Commit + tag `demo-v1`.** (Target: Saturday evening.)

### Phase 5 — RGB over Lightning (only if `demo-v1` is tagged)
- Seed script opens RGB-enabled channels (e.g. Ben→Giulia, Sam→Giulia, or through one node acting as a hub/LSP) with the NIA asset, per the RLN openapi (`openchannel` with asset fields, `lninvoice`, `sendpayment` or equivalents — verify names).
- Second `SettlementRail` implementation; UI toggle "Instant (Lightning) / On-chain". Lightning is the default if channels are ready, on-chain is the fallback.
- ✅ Check: the same settle flow works over LN with no block mining; the payment appears in the nodes' payment list. **Commit + tag `demo-v2`.**

### Phase 6 — WDK bonus (optional, time-boxed to 3 hours, only if `demo-v1` is tagged)
- Use `@tetherto/wdk` + `@tetherto/wdk-wallet-btc` to derive each participant's wallet from a BIP-39 seed, and try `@utexo/wdk-wallet-rgb` / `@utexo/wdk-rgb-lightning` for RGB balances/payments against the same regtest stack. Read their READMEs and type definitions first.
- If it doesn't work end-to-end within the time box, revert to the last tag. A half-working WDK integration is worth less than a clean demo.

### Phase 7 — Hardening & demo prep (Sunday morning, feature freeze at 11:00)
- `pnpm demo:reset` → wipe + seed + preload trip "Vietnam 2026" with 2 past expenses, so the live demo adds only the 3rd.
- Error-path test: kill one RLN node mid-settlement → UI shows a clear error and recovers when it's back.
- README: what it does, architecture diagram, how to run, what's real vs simulated (3 nodes on one laptop; ledger not yet P2P), what was pre-existing vs built during the hackathon, roadmap.
- ✅ Check: two clean demo runs in a row from `demo:reset`, Wi-Fi off. Submit before 13:00.

---

## 7. Pitch support (generate at the end, `docs/pitch.md`)

Write a 3-minute pitch outline addressed to a Tether / Utexo / KaleidoSwap jury:
1. The problem with one specific person (Giulia in Vietnam with strangers from DE and US).
2. Why existing apps fail: they compute, they don't settle.
3. Why RGB specifically: a dollar that's native to Bitcoin, self-custodial, cross-border, with no separate gas token, private by design (client-side validation), instant over Lightning.
4. Why local AI: receipts and spending habits never leave the phone.
5. Live demo (the happy path) + explorer proof.
6. Honest open problems and answers: onboarding (organizer acts as LSP and opens channels), FX (rate locked at expense time), off-ramp (USDT on RGB via Utexo/exchanges).
7. Business: B2B2C via group-travel operators.

Also list 5 hard questions the jury is likely to ask, with short answers.

---

## 8. Start now

Begin with Phase 0 (or the phase I tell you). Before writing code, reply with:
1. The list of files you will create in this phase.
2. Which docs you need to read (QVAC.md sections, openapi.yaml paths, READMEs) and confirmation you've read them.
3. Any blocker or ambiguity.

Then execute.
