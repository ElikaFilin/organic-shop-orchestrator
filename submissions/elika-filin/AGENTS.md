# Project rules — Organic Catalog · fwdays Crash Course: Agentic Engineering · capstone

Product: one storefront, **Organic Catalog**, over several organic shops. A catalog of products pulled from
karashynyard.com.ua and osio-organic.com.ua (10 visible per shop), a basket (add · change quantity · remove)
and an `/admin` panel that picks which products are visible and whether data comes **live** from the shops
or from the committed **snapshot** in `data/shops/`.

Trust level 3 ("Agent") inside an OpenSpec change: implement that change's `tasks.md` end to end — edit the
files it needs, run allow-listed commands — and finish with `pnpm check` output.
Outside a change: trust level 1 ("Assistant") — propose, then wait for a human decision before changing more
than one file or running anything that is not on the allow-list in `.claude/settings.json`.

## Layout (pnpm workspace — one repo, two apps)

- `apps/api` — Hono on Node, http://localhost:4000. Route handlers in `src/routes/`, pure logic in `src/lib/`,
  shop adapters in `src/shops/`, JSON stores under `.data/` (git-ignored). Fixtures in `fixtures/`.
- `apps/web` — Vite + React 19 SPA, http://localhost:5173, proxies `/api` to the API. Pages in `src/pages/`,
  the API client in `src/api/`.
- `packages/shared` — types and zod schemas both apps import as `@organic/shared`. No I/O, no framework imports.

## Commands (pnpm only — never npm or yarn)

- `pnpm dev` — both apps. Never start a second one.
- `pnpm check` — typecheck + lint + tests + `spec:check` + `hooks:selftest`. Run it before saying a task is
  done and quote its summary lines (`Tests … passed`, `spec:check ok — …`).
- `pnpm test` = `vitest run` across packages · `pnpm typecheck` = `tsc --noEmit` per package · `pnpm lint` = `eslint .`
- `pnpm spec:check` — OpenSpec gate, part of `pnpm check`. Run the CLI only as `pnpm exec openspec …`
  (pinned devDependency); after `pnpm exec openspec update`, run `pnpm openspec:pin`.
- `pnpm agent:log` — summary of `.agent-log/actions.jsonl`: what you actually did this session.
- `pnpm loop -- --change <name>` — the implement loop (`scripts/loop.mjs`); `pnpm review -- --change <name>` — the
  read-only reviewer (`scripts/review.mjs`). Humans run these, not the agent.

## Definition of done

- `pnpm check` is green; new behaviour has a test next to the code (`*.test.ts` / `*.test.tsx`) that asserts
  a spec scenario with the scenario's exact values.
- Evidence, not claims: report the command you ran and its exit code / test count.
- A change is done when every task in its `tasks.md` is `[x]`, it is archived, and a human has read the
  archived spec's `## Purpose`. `pnpm spec:check` fails on the placeholder `openspec archive` leaves.

## Conventions the linter does not enforce

- `process.env` is read only in `apps/api/src/config.ts` (a hook blocks it anywhere else under `apps/**`);
  everything else takes configuration as values, so tests never depend on the environment.
- Route handlers stay thin: parse with the shared zod schema, call a function from `src/lib/`, return JSON
  with the right status. Logic in `src/lib/` has no Hono import and a Vitest test beside it.
- Shop adapters never throw on a bad upstream: they return a typed failure, and the catalog falls back to
  the snapshot. Tests use fixtures in `apps/api/fixtures/`, never the live shops.
- Prices are UAH numbers exactly as the shops publish them; never converted or rounded.
- Ukrainian UI copy; English code, comments, specs and commit messages. Conventional Commits
  (`feat:`, `fix:`, `docs:`, `chore:`), one logical change per commit.

## Boundaries

- Ask before: adding a dependency, editing `vite.config.ts`, `tsconfig*.json`, `eslint.config.mjs`,
  `.claude/settings.json`, `.mcp.json`.
- Never: touch `.env*` (a hook blocks it anyway), delete tests or disable lint rules to get green,
  `git push --force`, `rm -rf`.
- Unsure about a library API (Hono, Vite, Vitest, React Router, Tailwind 4)? Ask Context7
  (`mcp__context7__resolve-library-id` → `mcp__context7__query-docs`) before guessing from memory.

<!-- Maintainers: keep this file under ~60 lines. Add a rule only after the agent gets something wrong twice.
     No repo overview beyond Layout, no file map, no linter rules, no API docs. -->
