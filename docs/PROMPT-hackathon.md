# MASTER PROMPT — "SettleUp Trip": the transparent digital group kitty for organized trips, in RGB digital dollars, with on-device AI

> How to use: this file lives at `docs/PROMPT-hackathon.md` and is loaded through `CLAUDE.md`, together with `docs/hackathon-brief.md`, `docs/vendor/QVAC.md` and `docs/vendor/rln-openapi.yaml`. The human calendar (who does what, when) is `docs/ROADMAP.md`. Run **one phase at a time**. Do not move to the next phase until the current phase's acceptance check passes.
>
> **Pivot of 2026-10-15.** The product is no longer "split debts, then travelers settle peer-to-peer". It is a **prefunded group kitty, custodied by the trip coordinator, that reimburses whoever pays a shared expense**. It replaces the coordinator's cash envelope. Phases 0, 1, 2 and 2b remain valid and are reused. What changes in the existing code is listed in `docs/STATUS.md` under "Pivot — 2026-10-15".

---

## 0. Role, rules of engagement, and what "done" means

You are the lead engineer of a 3-person team at a 27-hour hackathon (build: Sat 17 Oct 09:30 → Sun 18 Oct 13:00). You build a working end-to-end demo, not a production app.

**Hard rules — violating any of these is a failure:**

1. **Never invent APIs.** The SDKs here (QVAC, rgb-lightning-node, WDK, @utexo/*) are new and you have seen little or none of their code. For every call you write:
   - QVAC → only functions, options and model constants that appear in `docs/vendor/QVAC.md` or in `node_modules/@qvac/sdk` type definitions. Read the `.d.ts` files before using a function.
   - rgb-lightning-node → only endpoints and fields that appear in `docs/vendor/rln-openapi.yaml`, through the typed client in `packages/rgb-client`. Do not guess request bodies.
   - If the needed function is not documented, STOP and report: "I need X, I can't find it in the docs, options are A/B." Do not fake it.
2. **No simulated transactions.** Every deposit, reimbursement and payout in the UI must correspond to a real RGB transfer on regtest, visible in the RLN nodes' transfer lists and on the esplora REST API. A `console.log("paid")`, a mocked balance or a hardcoded success is forbidden. The jury criterion is literally "working transactions, not simulated".
3. **Correct RGB terminology and version.** Only **RGB Protocol on Bitcoin v0.11.1** (`docs.rgb.info`, `github.com/rgb-protocol`, `github.com/RGB-Tools`). Never `rgb.tech`, `github.com/RGB-WG`, RGB v0.12 or RGB++. The asset schema is **NIA** (not "RGB20"). Say "private contract", not "smart contract", in code comments, README and UI copy.
4. **Money logic is deterministic code, never the LLM.** The LLM extracts and proposes. Arithmetic, currency conversion, quotas, reimbursements and payouts are plain TypeScript functions with unit tests. Amounts are integers in minor units (bigint), never floats.
5. **Every AI output passes through a zod schema.** Max 2 retries with the validation error fed back to the model, then fall back to a manual form pre-filled with whatever was parsed. The app must never crash or hang because the model returned bad JSON.
6. **Commit after every working step** with a Conventional Commit message (`feat(pot): reimburse payer from the kitty on regtest`). The judges only count work in dated commits made during the event.
7. **Small, verifiable steps.** After each step run the check, paste the output, then continue. If something fails 3 times in a row, stop and summarize: what you tried, the exact error, your best hypothesis.
8. **Scope discipline.** If a feature is not in this file, don't build it. If you think something is missing, propose it, don't implement it.
9. **Naming.** The travelers are Alice, Bob and Charlie; the coordinator is Dave. Ids in code: `alice`, `bob`, `charlie`, `dave`. No other invented names, and no names of real people or real companies in code, UI or demo data.

---

## 1. The product (what the demo must show)

### Who
- **Buyer (B2B2C):** an operator of organized group trips (WeRoad-style). Real operators may be named in the pitch as market examples only, never as partners.
- **Operator user:** the trip **coordinator** (Dave). Today he holds the group's cash envelope.
- **End users:** travelers who are strangers from different countries. Alice (IT, EUR), Bob (DE, EUR) and Charlie (US, USD) on a trip in Vietnam, paying in VND.

### The problem
Shared expenses on these trips work in one of two bad ways:
- a **cash envelope** held by the coordinator: opaque, cash in local currency, one custodian, leftovers handed back by hand;
- or somebody **fronts the money** and the group "settles later" with an app that computes but never pays. The most generous people end up as creditors of strangers who vanish.

### The promise
At trip start every traveler prefunds a **digital kitty** with D digital dollars (the demo NIA asset on RGB). When someone pays a shared expense, they snap the receipt. The on-device AI reads it and proposes who had what. Each person concerned approves their own lines, the coordinator approves the reimbursement, and the payer is paid back **from the kitty, out of the other members' own quotas**, with a real RGB transfer. Nobody fronts unsecured money to strangers, nobody chases anybody at the end, and every number is visible to the whole group.

**Honest framing (use it in the pitch):** the value is the **certainty of being repaid**, not spendable cash during the trip. A restaurant in Hanoi does not accept digital dollars on RGB.

### Kitty rules (deterministic, in `packages/ledger`, built in Phase 2c)

1. **Custody.** The kitty is the RGB node of the coordinator (`dave`, port 3004). This is **custodial**: say so in the README and the pitch. Exposure is bounded by a small D, top-ups when needed, and reimbursements paid during the trip. A 2-of-3 multisig is **roadmap only** and is not built at the hackathon.
2. **Quota.** For each member m, in USD cents:
   `quota(m) = confirmedDeposits(m) + net(m) − confirmedPayoutsTo(m)`
   - `net(m)` = paid − owed over approved, non-voided expenses (existing `computeBalances`).
   - Deposits and top-ups are the same operation.
3. **Invariants.**
   - `potCash = Σ confirmed deposits − Σ confirmed payouts = Σ quota(m)`.
   - `potCash` must equal the settled DUSD balance of dave's node. The UI shows both numbers side by side.
4. **Reimbursement.**
   - `unpaidCredit(m) = max(0, quota(m) − confirmedDeposits(m))`.
   - `reimbursable(m) = max(0, min(unpaidCredit(m), potCash − reserved − Σ_{k≠m} max(0, quota(k))))`, where `reserved` is the sum of pending payouts.

   In words: a payer can be reimbursed only for credit above their own deposit, and only with money that does not belong to the other members' positive quotas. When a debtor's quota is negative, their uncovered share is simply not reimbursable yet. It stays in the payer's quota as a claim. It becomes reimbursable when the debtor tops up, and otherwise it is handled at close.
5. **Low quota.**
   - Warning when a member's quota drops to 20% of their deposits or less (the existing 80% exposure rule, applied to quotas).
   - `quota < 0` → `TOPUP_REQUIRED`. Withdrawals are blocked for that member, and the payer sees the warning while tagging lines.
6. **Approvals.**
   - **Expense lines:** each debtor approves the lines assigned to them (one decision per debtor per expense). The payer's own share needs no approval.
     - Contest → the expense becomes `contested`, its reimbursement is blocked, and it appears in the coordinator's disputes. The coordinator can only **void** it; the payer then resubmits.
     - **Silent assent** after `SILENT_ASSENT_SECONDS` (demo: 20; in production: hours).
     - The coordinator never approves lines on a traveler's behalf.
   - **Payouts:** the coordinator approves them. This is the human-in-the-loop moment of the demo. They are then sent from dave's node. Several payouts can go in **one batch**: one witness tx, many recipients. RLN batch send was verified in Phase 1.
7. **FX.** The rate table is the coordinator's "rate of the day": `infra/rates.json` in the demo, with `asOf` and `source`. The rate is locked when the expense is approved, as today. Only the coordinator may set a manual rate.
8. **Close.**
   - The coordinator proposes final payouts: `closePot` over quotas, generalized to payouts already made.
   - Close is refused while any deposit or payout is pending (`POT_NOT_SETTLED`).
   - Members with quota > 0 whose node returns a receive invoice are paid in one batch.
   - A member whose node is unreachable keeps their quota in the kitty as **unclaimed**, claimable later.
   - Negative quotas pay out 0, and the uncovered part is shared by the creditors pro-rata (existing largest-remainder rule).
9. **Early exit** (Phase 5d, stretch): a member withdraws their quota and leaves, with the same rules as close for one member.

### The single happy path (the demo, about 2 minutes)

Before going on stage: `pnpm demo:reset`. This wipes the chain, seeds the 4 nodes and makes **real deposits** of D = 50.00 from alice, bob and charlie into dave's kitty. Trip "Vietnam 2026" is pre-loaded. On screen: three phone-sized windows side by side, Alice (`?as=alice`), Bob (`?as=bob`) and Dave (`?as=dave`, coordinator). Charlie's window is not open: he is not answering.

1. Alice taps "I paid" and uploads the VND restaurant receipt.
2. On-device extraction ("Reading the receipt on this device…", with elapsed time) → editable review of merchant, date, currency, items, total and warnings.
3. Alice types: *"Bob and I shared the pho, Charlie only had beers, split the water three ways"* → proposed lines per person → she submits. The rate is locked from Dave's rate of the day, shown with its date and source.
4. Bob's window shows his lines and his amount → Approve. Charlie's lines show a silent-assent countdown → assented.
5. Dave's window, payout queue: "Reimburse Alice 6.59 USD — from Bob 3.09, Charlie 3.50" → Approve → real RGB transfer dave → alice → pending → confirmed (auto-mine on regtest).
6. Proof panel: the RLN transfer status, the witness txid, and a link to esplora REST `/tx/<txid>` (new tab, an independent source).
7. Trip screen: quotas Alice 50.00, Bob 46.91, Charlie 46.50 (numbers for this dinner alone), kitty 143.41, next to dave's node balance 143.41.
8. Close trip (Dave). `rln-charlie` has been stopped (`pnpm demo:charlie-offline`). The payout table from `closePot` appears → Approve → one batch transfer to Alice (50.00) and Bob (46.91). Charlie's 46.50 shows as "unclaimed — claimable when he is back". **Charlie vanished, nobody lost a cent, nobody chased anybody.** This is the closing moment of the demo.

Everything else is out of scope unless it is listed in Phase 5.

---

## 2. Architecture

```
[React + Vite UI, role from ?as=<id>]  ── HTTP/JSON ──>  [Node 22.17+ backend, TypeScript, Fastify]
                                                            ├── ai/      @qvac/sdk (OCR + LLM, in-process)
                                                            ├── ledger/  SQLite append-only events + @settleup/ledger
                                                            ├── rgb/     typed client for 4× rgb-lightning-node + on-chain SettlementRail
                                                            ├── pot/     kitty flows: deposit, reimburse, batch payout, close
                                                            └── wdk/     (Phase 5a, optional) @tetherto/wdk + @utexo/*
                                                                    │
                       docker compose (regtest): bitcoind, electrs, esplora REST, rgb-proxy-server
                       + 4 rgb-lightning-node: alice (3001), bob (3002), charlie (3003), dave = kitty (3004)
```

Decisions (do not revisit unless blocked):

- **Monorepo**, pnpm workspaces: `apps/web`, `apps/server`, `packages/shared`, `packages/ledger`, `packages/rgb-client`, `infra/`.
- **One backend process orchestrates all four nodes.** The UI role comes from the URL (`?as=alice|bob|charlie|dave`); three browser windows simulate three phones. Every member still has their own RLN node, so every transfer is real. Keep a small dev-only switcher. The README says honestly that in production each traveler runs their own wallet on their phone.
- **Shared ledger = SQLite** (`better-sqlite3`) with an **append-only `events` table** (no UPDATE or DELETE on events). State is derived by `@settleup/ledger` functions. P2P sync and signed entries are roadmap; a hash chain is Phase 5b.
- **Config by env vars**, adding `RLN_DAVE_URL`, `RLN_DAVE_PASSWORD`, `RLN_DAVE_MNEMONIC`, `POT_DEPOSIT_CENTS` (default 5000) and `SILENT_ASSENT_SECONDS` (default 20) to the existing ones.
- **Settlement:** the on-chain `SettlementRail` built in Phase 1 is reused for every money movement. Deposits and top-ups go traveler → dave. Reimbursements and final payouts go dave → traveler. Batch payouts use one `/sendrgb` with several recipients; verify the body in `rln-openapi.yaml`, and the Phase 1 seed already does one.
- **No direct traveler ↔ traveler settlement in the UI.** `simplify()` stays in the ledger but the demo does not use it.
- **Lightning** is Phase 5c only, with dave as the hub/LSP.

---

## 3. Domain logic

Done in Phases 2 and 2b (see `docs/STATUS.md`): FX with locked rates, item-level split with proportional tax/tip and largest remainder, balances, greedy simplification, deposits, exposure, `closePot`, `POT_NOT_SETTLED`. Do not rewrite it; extend it.

Phase 2c adds the kitty model of section 1, "Kitty rules":
- `quota`, `potCash`, `unpaidCredit`, `reimbursable`;
- `lowQuota` (exposure applied to quotas), `TOPUP_REQUIRED`;
- `closePot` generalized to payouts already made and to an `unreachable` member set (→ `unclaimed`);
- the line-approval state machine with an injected clock (`approved | contested | assented | pending`, then `isExpenseApproved`);
- `voidExpense` (a voided expense leaves nets unchanged).

New zod schemas in `packages/shared`: `Payout { id, to, amountCents, kind: 'reimbursement' | 'final' | 'withdrawal', status, transferRef? }`, `LineDecision { expenseId, member, decision: 'approved' | 'contested', at }`, `ExpenseStatus`.

---

## 4. AI layer (QVAC, on-device) — the AI must be central, not decorative

Three AI tasks, each with its own zod schema in `packages/shared`:

1. **Receipt extraction:** image → OCR (QVAC OCR capability as documented in QVAC.md) → OCR text → LLM → `ReceiptSchema`:
   `{ merchant, date (ISO), currency (ISO4217), items: [{ label, quantity, unitPrice, total }], subtotal?, tax?, tip?, total, warnings: string[] }`.
   Validation beyond zod: items sum ≈ total (tolerance), and the currency is a known code. If inconsistent, add a warning and show it to the user; do not silently fix.
   If OCR quality is poor, try the vision-language model path if QVAC.md documents one; otherwise fall back to the manual form.
2. **Natural-language split:** input = items list + the **travelers'** names (never the coordinator) + free text in Italian or English → `SplitProposalSchema`: `{ assignments: [{ itemIndex, participants: string[] }], unassigned: number[], clarificationNeeded?: string }`. A name not in the group or an item index out of range is a validation error → retry → fallback to the checkbox UI.
3. **Ambiguity handling:** if `clarificationNeeded` is set, the UI shows the question and the user's answer is fed back once.

Implementation requirements:
- One `ai/` module with `extractReceipt()` and `proposeSplit()`. Each returns `{ ok: true, data, attempts } | { ok: false, partial, error }`.
- Prompt templates in separate files, with 1–2 few-shot examples each. Ask for JSON only. Strip code fences and the empty `<think></think>` block that Qwen3 emits before parsing.
- Load models once at server start. Expose `/api/ai/status` (loading / ready / error) and show it in the UI.
- Use the smallest cached models that pass the 3 fixture receipts. Log latency per call. Target < 20 s per receipt on the demo laptop.
- Everything works with networking disabled (verified in Phase 3).

---

## 5. UI (React + Vite + Tailwind) — judged on flow, not looks

One app, mobile-first, with views by role.

**Traveler (Alice, Bob, Charlie)**
- **Home:** my quota (bar plus warning), kitty total, badge with lines waiting for my approval, trip ledger (every expense, who paid, status).
- **I paid:** upload → extraction review → natural-language split → submit.
- **To approve:** my lines per expense, with Approve / Contest and a visible silent-assent countdown.
- **Top up:** shown when the quota is low; a real deposit into the kitty.

**Coordinator (Dave)**
- **Payout queue:** approved expenses waiting for reimbursement → Approve (single or batch).
- **Members:** quota per member, warnings, `TOPUP_REQUIRED`, disputes (void).
- **Rate of the day:** the table with date and source; manual override.
- **Close trip:** the payout table from `closePot` (including uncovered and unclaimed amounts) shown before anything is sent → Approve.

**Shared**
- Proof panel for every transfer.
- "Kitty = node balance" check visible on the Trip screen.
- "Runs on this device — receipts never leave it" indicator, tied to the real AI status.

Required UX:
- Every async step says what is happening ("Reading the receipt on this device…", "Waiting for Bitcoin confirmation…") with elapsed time.
- Every error is human-readable with one suggested action. Map at least `TOPUP_REQUIRED`, `POT_NOT_SETTLED`, `TOTAL_MISMATCH`, receiver node unreachable (→ unclaimed), invoice expired, insufficient allocations, no available UTXOs.
- The AI proposal is always editable; approval is always an explicit click.

---

## 6. Phases and acceptance checks

**Done:** Phase 0 (environment), Phase 1 (RGB seed + on-chain rail), Phase 2 (ledger), Phase 2b (pot logic). See `docs/STATUS.md`.

### Phase 0b — Coordinator node in the stack
- Add `rln-dave` (port 3004, same image `settleup/rln:d4762ac`) to `infra/docker-compose.yml`, `check.sh` and the stack scripts. Add `RLN_DAVE_*` to `.env.example`.
- Measure memory with 4 RLN nodes plus the stack (`docker stats --no-stream`). If the total is above ~3.5 GB of Docker's 4 GB, raise the Docker Desktop memory limit or move the stack to the Linux laptop.
- Do **not** add dave to the seed: that is an RGB flow (Phase 4a).
- ✅ Check: a cold `pnpm infra:reset` brings up 4 nodes; `pnpm infra:check` passes (dave answering `LockedNode` is fine); the memory figure is recorded in STATUS. **Commit.**

### Phase 2c — Kitty model
- Implement section 3, "Phase 2c adds", in `packages/ledger` and `packages/shared`.
- Tests:
  - demo numbers: reimbursement 6.59; quotas 50.00 / 46.91 / 46.50; close with charlie unreachable → alice 50.00, bob 46.91, charlie unclaimed 46.50;
  - fast-check properties: `Σ quota == potCash` after any sequence of events; a reimbursement never exceeds `unpaidCredit` and never leaves another member's positive quota unbacked; close: `Σ final payouts + unclaimed == potCash`, no negative payout;
  - silent assent exactly at, before and after the deadline; contested blocks reimbursement; void leaves nets unchanged; pending payouts are reserved; `POT_NOT_SETTLED`.
- ✅ Check: `pnpm test`, `pnpm test:cov` (ledger ≥ 90/90), `pnpm typecheck`, `pnpm lint` green. **Commit.** Update STATUS.

### Phase 3 — AI pipeline
- Implement section 4. Fixtures in `infra/fixtures/receipts/`: 3 receipt photos (VND restaurant, EUR taxi, USD supermarket) plus their expected JSON.
- `pnpm ai:eval` runs all 3 and prints field-level accuracy, attempts and latency.
- ✅ Check: all 3 produce a valid `ReceiptSchema` (manual corrections allowed for at most 1 field each); the split sentence of section 1 produces the correct assignment; it works with Wi-Fi off. **Commit.**

### Phase 4a — Kitty on RGB
- Seed: dave init, unlock, fund with regtest BTC (it pays the fees of every payout), create colorable UTXOs. Dave receives no DUSD from the seed.
- `pot/` module on top of the existing rail:
  - `deposit(member, amount)`: dave invoice → member `/sendrgb`;
  - `payout(list)`: each recipient's invoice → one dave `/sendrgb` with all recipients → mine → refresh;
  - an unreachable recipient is left out and reported.
- `pnpm pot:e2e`: 3 deposits of 50.00 → the dinner expense through the ledger → reimburse alice 6.59 → stop `rln-charlie` → close: batch to alice and bob, charlie unclaimed. Assert `potCash == dave settled balance` after every step and print every txid.
- ✅ Check: `pot:e2e` green from a cold reset; txids confirmed on esplora REST. **Commit.**

### Phase 4b — API + UI, full happy path
- Fastify routes, validated with the shared zod schemas (bigint ↔ string codec): trip and members with quotas; deposits and top-ups; expenses (create from image, propose split, submit, line decision, void); payout queue (propose, approve, status); close (propose, approve, status); rate of the day; AI status; proof (transfer status, txid, esplora link); kitty vs node balance.
- UI per section 5.
- `pnpm demo:reset` (wipe + seed + real deposits) and `pnpm demo:charlie-offline` (stops `rln-charlie`).
- ✅ Check: run the section 1 demo by hand from `pnpm demo:reset`, Wi-Fi off, three windows. Record a screen video. **Commit + tag `demo-v1`** (target: Saturday 22:00).

### Phase 5 — Only after `demo-v1`, in this order, each time-boxed; if a box expires, revert to the last tag
- **5a WDK bonus (3 h).** `@tetherto/wdk` + `@tetherto/wdk-wallet-btc` to derive each traveler's wallet from a BIP-39 seed; try `@utexo/wdk-wallet-rgb` for RGB balances against the same regtest stack. Read their READMEs and type definitions first. A half-working integration is worth less than a clean demo.
- **5b Hash-chained ledger (1.5 h).** Each event stores `sha256(prevHash ‖ canonical JSON of the event)`. The UI shows "Ledger verified" by recomputing the chain, and the Proof panel shows the head hash.
- **5c RGB over Lightning (4 h).** Dave acts as hub/LSP with DUSD channels traveler ↔ dave (`openchannel` with asset fields, `lninvoice`, `sendpayment` or equivalents — verify the names). A second `SettlementRail`; Lightning by default when channels are ready, on-chain as fallback. Check: a reimbursement works with no block mined.
- **5d Early exit (1 h).** "Withdraw my quota and leave" for one member.
- **Not built at the hackathon:** multisig custody (roadmap slide only), P2P ledger sync, speech-to-text order capture.

### Phase 7 — Hardening and demo prep (Sunday morning, feature freeze at 11:00)
- `demo:reset` optionally pre-loads 1 past expense, already reimbursed, so the ledger is not empty (update the numbers in the pitch).
- Error path: stop `rln-dave` during a payout → the UI shows a clear error and recovers when the node is back.
- README: what it does, architecture diagram, how to run, what is real vs simulated (4 nodes on one laptop, custodial coordinator, ledger not yet P2P), roadmap.
- ✅ Check: two clean demo runs in a row from `demo:reset`, Wi-Fi off. Submit before 13:00 (target 12:30).

---

## 7. Pitch support (generate at the end, `docs/pitch.md`)

A 3-minute outline for a Tether / Utexo / KaleidoSwap jury:
1. **One person:** Alice on an organized trip in Vietnam with strangers from Germany and the US. Today either the coordinator holds a cash envelope, or Alice fronts the dinner and never sees the money again.
2. **Today's options fail:** the cash envelope is opaque, single-custodian and in local cash; Splitwise-style apps compute but never pay.
3. **The kitty:** prefunded at trip start, reimburses the payer within minutes, fully visible to the group, residuals paid back in one batch at the end.
4. **Why RGB:** a dollar native to Bitcoin that works the same for every nationality with no IBAN; no separate gas token; one witness transaction pays the whole group at close; private by design (client-side validation); instant over Lightning with the coordinator as hub (roadmap).
5. **Why local AI:** receipts and spending habits never leave the phone; the AI reads the receipt and maps a plain sentence to the lines, then humans approve.
6. **Live demo** plus the explorer proof and "kitty = node balance".
7. **Charlie vanishes:** his share was already covered by his own deposit; his leftover waits for him; nobody lost anything.
8. **Honest limits:** custodial coordinator (bounded exposure, operator liability, multisig on the roadmap); on-ramp at booking; the value is certainty, not spendable cash; a lost phone means a lost stash without a backup (encrypted backup on the roadmap).
9. **Business:** B2B2C via group-travel operators; the competitor is the cash envelope.

Hard questions with short answers (at least these):
- "Why not Revolut or cash?"
- "The coordinator can run off with the kitty."
- "How do travelers get USDT on RGB?"
- "What if the AI reads the receipt wrong?"
- "Isn't a tour operator holding stablecoins for customers a regulated activity in the EU?"
- "What happens if a traveler loses their phone?"

---

## 8. Start now

Begin with the phase I tell you (by default the first phase that is not done in `docs/STATUS.md`). Before writing code, reply with:
1. The phase and its acceptance check.
2. The list of files you will create or change.
3. Which docs you need to read (QVAC.md sections, openapi paths, READMEs) and confirmation that you have read them.
4. Any blocker or ambiguity.

Then wait for approval, as `CLAUDE.md` requires.
