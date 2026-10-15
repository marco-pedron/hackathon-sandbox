# Contract session — shared interfaces before the three streams split

> Paste this whole file as the first message of a Claude Code session on **one** MacBook (Dev B at the keyboard, A and C reviewing). Goal: in about 60–90 minutes, `main` contains every interface the three streams need, so they can work in parallel without touching each other's folders. **No business logic in this session**: only types, zod schemas, signatures, stubs, one fake and the dependencies.

---

You are working on the contract phase of SettleUp Trip. Read `CLAUDE.md`, `docs/PROMPT-hackathon.md` (sections 1–6) and `docs/STATUS.md` first.

## Rules for this session
- Branch: `phase-contract`. Commit after each step below (Conventional Commits, scope `contract`).
- Write **only** types, zod schemas, function signatures, interfaces, stubs, the fake AI service, placeholders and dependency changes. No real logic, no RGB calls, no QVAC calls.
- Do not change existing behaviour or existing exports in `packages/ledger`, `packages/shared`, `apps/server/src/rgb`. Add, don't rewrite.
- Amounts are `bigint` in minor units everywhere in TypeScript. On the wire (JSON) they are **decimal strings**; define one codec and reuse it.
- After each step: `pnpm typecheck && pnpm lint && pnpm test` must be green. Paste the output.
- Stop after Step 0 and wait for approval. After that, stop only if a step needs a human decision (listed below) or fails 3 times.

## Step 0 — Inventory and plan (then wait)
Read and report, briefly:
- what `packages/shared/src/ledger.ts` exports (schemas and types);
- the public functions of `packages/ledger` and its error codes;
- the `SettlementRail` interface and the types in `apps/server/src/rgb/`;
- the current dependencies of every workspace `package.json`, and whether `apps/web` and `apps/server` exist and with what.

Then propose: the exact list of files you will create or edit in Steps 1–6, the dependencies you want to add (name + workspace + why, only those needed by PROMPT sections 2, 4 and 5), and any conflict between the PROMPT and the existing code.

**Human decisions needed at Step 0:** the dependency list; anything you flag as a conflict.

## Step 1 — Kitty domain schemas (`packages/shared/src/kitty.ts`)
From PROMPT section 1 "Kitty rules" and section 3:
- `MemberId` (`alice | bob | charlie`), `CoordinatorId` (`dave`), `Role`.
- `Payout { id, to, amountCents, kind: 'reimbursement' | 'final' | 'withdrawal', status: 'proposed' | 'approved' | 'pending' | 'confirmed' | 'failed', transferRef?, expenseIds? }`.
- `LineDecision { expenseId, member, decision: 'approved' | 'contested', at }`.
- `ExpenseStatus`: `awaiting_approval | approved | contested | voided | reimbursed`.
- `QuotaView { member, depositsCents, netCents, payoutsCents, quotaCents, unpaidCreditCents, level: 'ok' | 'low' | 'topup_required' }`.
- `ClosePlan { payouts, unclaimed, uncovered, potCashCents }`.
- New error codes: `TOPUP_REQUIRED`, `NOT_REIMBURSABLE`, `EXPENSE_CONTESTED`, `NOT_IMPLEMENTED`.
Export everything from the package index.

## Step 2 — Phase 2c signatures in `packages/ledger` (stubs)
Create `packages/ledger/src/kitty.ts` with the signatures listed in PROMPT section 3 ("Phase 2c adds"): `quota`, `potCash`, `unpaidCredit`, `reimbursable`, `lowQuota`, `closePotWithPayouts` (payouts already made + `unreachable` set), `lineStatus` and `isExpenseApproved` (injected clock: `now: Date`, `silentAssentMs: number`), `voidExpense`.
- Each body throws `LedgerError('NOT_IMPLEMENTED')`.
- Each has a JSDoc quoting the rule from PROMPT section 1 it implements.
- Create `packages/ledger/test/kitty.test.ts` with the Phase 2c test plan as `it.todo(...)` entries (demo numbers, fast-check properties, silent-assent boundaries, contested, void, reserved, `POT_NOT_SETTLED`). This is Dev A's checklist.

## Step 3 — HTTP contract (`packages/shared/src/api.ts`)
- `moneyString`: the bigint ↔ decimal-string codec (cents).
- `ApiError { error: { code, message, action } }`: one human-readable action per error (PROMPT section 5).
- `ReceiptSchema`, `SplitProposalSchema` and `AiResult<T>` (`{ ok: true, data, attempts } | { ok: false, partial, error }`) from PROMPT section 4.
- `TransferProof { ref, status: 'pending' | 'confirmed' | 'failed', txid?, esploraUrl?, elapsedMs }`.
- A `routes` object: for each route, `method`, `path`, `request` schema, `response` schema. Cover exactly the PROMPT Phase 4b list:
  - `GET /api/trip` → members with `QuotaView`, potCash, dave node balance, pending items count
  - `POST /api/deposits` → `TransferProof`
  - `POST /api/expenses/extract` (image upload) → `AiResult<Receipt>`
  - `POST /api/expenses/split` → `AiResult<SplitProposal>`
  - `POST /api/expenses` → expense with status and per-member shares
  - `GET /api/expenses` → list with statuses and line decisions
  - `POST /api/expenses/:id/decision`, `POST /api/expenses/:id/void`
  - `GET /api/payouts/queue`, `POST /api/payouts/approve` (one or more) → `TransferProof`
  - `POST /api/close/propose` → `ClosePlan`, `POST /api/close/approve` → `TransferProof`
  - `GET /api/transfers/:ref` → `TransferProof`
  - `GET /api/rates`, `PUT /api/rates` (coordinator only)
  - `GET /api/ai/status` → `loading | ready | error`
- Every request that acts carries `as: MemberId | CoordinatorId` (the role from `?as=`).

**Human decision at Step 3:** Dev C reviews the route list and the response shapes (they drive the UI); Dev A reviews the receipt and split schemas.

## Step 4 — Typed client (`packages/shared/src/client.ts`)
- `ApiClient` interface with one method per route, built from `routes` (typed inputs and outputs, bigint in TS, strings on the wire).
- `createFetchClient(baseUrl)`: the real implementation over `fetch`, decoding responses with the zod schemas and turning `ApiError` into a typed exception.
- No fake client here: Dev C writes `apps/web/src/dev-fakes/` in their own stream.

## Step 5 — Server interfaces and the AI fake
- `apps/server/src/pot/types.ts`: `PotService { deposit(member, amountCents), payout(list), nodeBalance(), status(ref) }` returning the shared types.
- `apps/server/src/ai/types.ts`: `AiService { extractReceipt(image), proposeSplit(receipt, members, text), status() }`.
- `apps/server/src/ledger/store.ts`: `LedgerStore { append(event), list(filter?) }` interface only (append-only, PROMPT section 2).
- `apps/server/src/dev-fakes/fake-ai.ts`: returns the demo dinner receipt and the demo split from PROMPT section 1, with a 2 s delay. Enabled only when `FAKE_AI=1`; the server logs a visible banner when it is on. Add a guard so `demo:reset` (when it exists) refuses to run with `FAKE_AI=1`. Dev B uses this until Dev A delivers Phase 3.

## Step 6 — Team scaffolding
- Create `docs/status/ledger-ai.md`, `docs/status/rgb-api.md`, `docs/status/ui.md` with a one-line header each.
- Run `pnpm install` once more and commit the lockfile.
- Final check: `pnpm typecheck && pnpm lint && pnpm test` green. Print the list of commits on the branch.

Then stop. A human opens the PR, the three devs review it together, and it is merged into `main`.
