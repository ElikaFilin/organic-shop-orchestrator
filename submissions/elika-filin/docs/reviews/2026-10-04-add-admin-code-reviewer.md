# Review · add-admin · code-reviewer · 2026-10-04T13:20:31.993Z

> agent: code-reviewer · tools: Read, Grep, Glob, Bash(git diff *), Bash(git status *) · model: claude-opus-5[1m] · turns: 20 · cost: $1.16 · 145 s
> The reviewer is a separate `claude -p` session with read-only tools; the maker never sees this prompt.

## 1. Findings

- `apps/api/src/lib/catalog.ts:160` — `load()` awaits `settings.read()`, which throws on a bad settings file, so one corrupt admin file takes the whole storefront down instead of falling back to the snapshot — write `{"dataSource":"snapshot"}` to `.data/admin-settings.json` (zod 4's enum-keyed record requires `visibility`): `GET /api/products`, `GET /api/products/:id` and every basket route answer 500. AGENTS.md: the catalog falls back to the snapshot, never throws upward.
- `apps/api/src/lib/catalog.ts:182` — `findProduct` resolves against `load().products`, which is now the admin-filtered list, so hiding a product silently guts live baskets — basket holds `karashynyard:1498486363994` (665 ₴), admin unticks it, `GET /api/basket` returns that line with `product: null` and `totals.sum` 665 ₴ lower, with nothing in the spec covering it.
- `apps/web/src/pages/AdminPage.tsx:74` — the failure branch sets `alert` but leaves `saved: true` from an earlier success, so the panel shows both messages at once — switch to «Наживо» (succeeds, "Збережено" renders), then switch to «Знімок» with the API down: `role="status"` "Збережено" and `role="alert"` "Не вдалося зберегти" are on screen together. Untested — `AdminPage.test.tsx:367` starts from `saved: false`.
- `apps/web/src/pages/AdminPage.tsx:70` — `getAdminProducts()` sits inside the same `try` as `updateSettings`, so a failed *reload* reports a failed *save* — `PUT /api/admin/settings` returns 200 and the file is written, `GET /api/admin/products` then 500s: the user sees "Не вдалося зберегти" though the switch applied.
- `apps/api/src/server.ts:23` — top-level `await settingsStore.read()` has no catch, so a corrupt `.data/admin-settings.json` kills boot with an unhandled rejection and a raw zod stack, not a message naming the file (the comment at line 18 claims the zod message, but nothing formats it).
- `apps/api/src/lib/basket.ts:38` — one `findProduct` per line, each a full `loadAll()` plus a `settings.read()` serialized through the store's single promise queue: a 20-line basket does 20 settings reads and 40 snapshot reads per `GET /api/basket`. Pre-existing N+1, but this change adds the serialized file read to it.
- `apps/api/src/routes/admin.ts:40` — the session cookie value is a constant (`admin` signed with the token) with no nonce or expiry inside the signature; `Max-Age` is client-advisory, so a cookie value captured once stays valid for any non-browser client until `ADMIN_TOKEN` is rotated.

Accessibility is clean — labels wrap every radio and checkbox, the shop sections are `aria-labelledby`, lists are `<ul>`, both buttons have names. `process.env` stays in `config.ts`, adapters still return typed failures, prices are untouched UAH, and every new module has a test beside it.

## 2. Verdict

`FIX FIRST`
