# Stream kickoff prompts

> After the contract PR is merged into `main`, each dev pulls `main` and pastes their prompt as the first message of their own Claude Code session.

## Dev A — Ledger + AI
You are on the **Ledger + AI** stream. You write only in `packages/ledger`, `apps/server/src/ai` and `infra/fixtures`. Everything else, including `packages/shared`, is read-only: if you need a contract change, describe it and stop.
Start with Phase 2c of `docs/PROMPT-hackathon.md`: the stubs in `packages/ledger/src/kitty.ts` and the `it.todo` list in `packages/ledger/test/kitty.test.ts` are your checklist. Propose the plan and wait for approval. Branch `phase-2c-kitty`.
Then Phase 3: implement `AiService` from `apps/server/src/ai/types.ts` (branch `phase-3-ai`).
Write your progress in `docs/status/ledger-ai.md`, never in `docs/STATUS.md`.

## Dev B — RGB + API
You are on the **RGB + API** stream. You own `infra/`, `apps/server/src/{rgb,pot,routes,db,ledger}` and `packages/shared`. You are the only one who runs `infra:reset`, `rgb:seed` and `demo:reset`.
Start with Phase 0b (branch `phase-0b-dave`), then Phase 4a (`phase-4a-pot`): implement `PotService`. Then the Fastify routes of Phase 4b against `packages/shared/src/api.ts`, using `FAKE_AI=1` until Dev A's `AiService` is merged. Until Phase 2c is merged, ledger functions throw `NOT_IMPLEMENTED`: build around them and test the RGB side with `pot:e2e`.
Any change to `packages/shared` goes in its own small PR, announced to the team.
Write your progress in `docs/status/rgb-api.md`.

## Dev C — UI
You are on the **UI** stream. You write only in `apps/web`. `packages/shared` is the contract and is read-only: if you need a change, describe it and stop.
Build the UI of PROMPT section 5 (Phase 4b, branch `phase-4b-ui`): one app, role from `?as=`, traveler and coordinator views, three phone-width windows. Work against a fake `ApiClient` you write in `apps/web/src/dev-fakes/`, enabled only with `VITE_FAKE_API=1`, built on the shared schemas and the demo numbers of PROMPT section 1. When Dev B's routes are merged, switch to `createFetchClient`.
Show every async state and every error of PROMPT section 5. Write your progress in `docs/status/ui.md`.
