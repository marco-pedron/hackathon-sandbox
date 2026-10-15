# CLAUDE.md — project instructions (loaded automatically at every session)

## Source of truth
- Product, phases, rules: @docs/PROMPT-hackathon.md (pivot of 2026-10-15: prefunded group kitty custodied by the coordinator)
- Hackathon rules and context: @docs/hackathon-brief.md
- Team calendar and owners: `docs/ROADMAP.md` (for humans; read it when asked what to do next)
- Current state of the code: `docs/STATUS.md` (read the "Pivot — 2026-10-15" section before touching `packages/ledger` or `apps/server/src/pot`)
- API references (read these before writing integration code, never guess):
  - QVAC SDK: `docs/vendor/QVAC.md` = full docs of the **v0.21** line (`docs.qvac.tether.io/sdk/v0.21/llms-full.txt`). Pin `@qvac/sdk` to `~0.21.0`. It is large: search it with grep for the section you need instead of reading it all. Never use docs from another line. If a different version gets installed, stop and tell me.
  - QVAC docs are also available via the `qvac-docs` MCP server (online only); the local file wins if they disagree.
  - rgb-lightning-node REST API: `docs/vendor/rln-openapi.yaml`

## Naming
- Travelers: Alice, Bob, Charlie. Coordinator and kitty custodian: Dave. Ids: `alice`, `bob`, `charlie`, `dave`.
- No other invented names; no real people or real companies in code, UI or demo data.

## Working agreement with the team
- Work ONE phase at a time. At the start of each session, state which phase you're on and what the acceptance check is.
- Before writing code in a new phase: propose a plan (files to create, docs to read, risks) and wait for approval.
- Commit after each working step with Conventional Commits (`feat(pot): …`, `test(ledger): …`). Never commit secrets, `.env`, model files or Docker volumes.
- Never `git push --force`, never rewrite history on `main`. Work on a branch named `phase-N-short-name`; a human opens the PR.
- If a command fails 3 times, stop and report: what you tried, the exact error, your hypothesis.
- If information you need is not in the docs listed above, say so and ask. Do not invent APIs, endpoints, model names or CLI flags.

## Environment
- Node >= 22.17, pnpm via corepack, Docker Desktop (Compose v2: use `docker compose`, not `docker-compose`), TypeScript strict mode.
- Network for RGB: regtest only. Never mainnet, never real funds.
- Stack: 4 RLN nodes (alice :3001, bob :3002, charlie :3003, dave :3004 = kitty) + bitcoind, electrs, esplora REST (:3010), rgb-proxy-server (:3000). Docker Desktop has ~4 GB RAM: check `docker stats` after adding a container.

## Status log
Keep `docs/STATUS.md` updated at the end of every phase: what works, how to run it, known issues, next step. This is how teammates pick up your work.
