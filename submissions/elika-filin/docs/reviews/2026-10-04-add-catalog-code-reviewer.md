# Review · add-catalog · code-reviewer · 2026-10-04T11:36:08.414Z

> agent: code-reviewer · tools: Read, Grep, Glob, Bash(git diff *), Bash(git status *) · model: claude-opus-5[1m] · turns: 24 · cost: $1.40 · 260 s
> The reviewer is a separate `claude -p` session with read-only tools; the maker never sees this prompt.

## 1. Findings

- `docs/session-notes.md:22` — session entry claims `pnpm test → 29 passed (10 файлів)`; the actual gate for this diff is `Tests 40 passed (40)` / `Test Files 12 passed (12)` — stale evidence in the file the human reads to approve the archive.
- `docs/session-notes.md:23` — "ручний smoke (`pnpm dev` + `curl`) не виконано" contradicts the checklist line 4 lines below in the same diff, which records the completed run `live [ 'karashynyard:live:10', 'osio:live:10' ] 20`.
- `docs/session-notes.md:24` — "Починати наступну сесію з" still instructs the next session to replace `smoke: ____`, with the human's smoke output pasted *inside* that instruction; the `dynamic-context` hook surfaces this line verbatim, so the next session is told to redo finished work.
- `apps/api/src/shops/karashynyard.ts:66` — a card with no `data-original` silently yields `imageUrl: ""`; `ProductSchema` accepts it and `ProductCard` renders `<img src="">`, which browsers resolve to the document URL and re-fetch the page as an image. Failing input: a Tilda card using `src="…"` instead of lazy-load `data-original` (a card without a price is skipped; one without an image is not).
- `apps/api/src/lib/cache.ts:7` — no `cache.test.ts` beside it; AGENTS.md: "Logic in `src/lib/` has no Hono import and a Vitest test beside it." TTL expiry (`storedAt + ttlMs <= now()`) is only asserted indirectly through `catalog.test.ts`.
- `apps/api/src/config.ts:24` — `SNAPSHOT_DIR` is unvalidated (`??` guards only `undefined`): `SNAPSHOT_DIR=""` → `join("", "osio.json")` resolves against cwd, every shop reports `unavailable` with no error, while `DATA_SOURCE` on the line above fails fast.
- `apps/api/src/lib/catalog.ts:80` — the resolved shop is keyed by `shop.adapter.shop.key` but read by `shop.snapshotKey`; snapshot products carry `shopKey = snapshotKey`, so if a `CatalogShop` ever pairs mismatched keys, `count` (line 113) is 0 while the products are still served. No guard, no test.
- `apps/web/src/components/ShopSection.tsx:23` — a shop with `status: "live"`/`"snapshot"` and zero products renders an empty `<ul>` and no message. Failing input: snapshot mode over a `data/shops/<key>.json` whose `products` array is empty → heading with nothing under it.

## 2. Verdict

`FIX FIRST` — the code is sound and the gate is green (typecheck, lint, `Tests 40 passed (40)`, `spec:check ok — specs: 0 · active changes: 2 · archived: 0`, hooks selftest), and no finding breaks a spec scenario; but `docs/session-notes.md` carries stale test numbers and contradicts itself about the smoke run, and that file is the evidence a human reads before `/opsx:archive`.
