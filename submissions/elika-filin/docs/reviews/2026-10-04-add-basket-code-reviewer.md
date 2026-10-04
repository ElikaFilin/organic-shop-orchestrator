# Review · add-basket · code-reviewer · 2026-10-04T12:17:47.444Z

> agent: code-reviewer · tools: Read, Grep, Glob, Bash(git diff *), Bash(git status *) · model: claude-opus-5[1m] · turns: 19 · cost: $0.96 · 182 s
> The reviewer is a separate `claude -p` session with read-only tools; the maker never sees this prompt.

## 1. Findings

- `apps/web/src/pages/BasketPage.tsx:33` — the `key` embeds `line.quantity`, so every server-confirmed change remounts the row and destroys the focused `<input>`; combined with `BasketLine.tsx:19` firing a PATCH on every keystroke, typing a two-digit quantity is impossible. Failing input: on `/basket` with a line at 1, click the field and type `2` then `5` to reach 25 — the `2` is PATCHed, the row remounts, focus is lost and the `5` never lands; the basket is left at 2. `BasketPage.test.tsx` stays green only because `fireEvent.change` sets the whole value at once and needs no focus.
- `apps/api/src/lib/store/baskets.ts:33` — `BasketsFileSchema.parse` validates the *whole* file, so one bad record takes down every buyer's basket. Failing input: `baskets.json` containing any line whose `productId` no longer matches `ProductIdSchema` (e.g. a shop key dropped from `SHOP_KEYS` by `add-admin`) → `GET /api/basket` throws → 500 for all basket ids, not just the corrupt one.
- `apps/api/src/lib/basket.ts:80` — `updateItem`/`removeItem` check with `store.get` and mutate with `store.update` as two separately queued operations, so the 404 contract is not held. Failing input: `DELETE /api/basket` concurrent with `PATCH /api/basket/items/karashynyard:1498486363994` on the same cookie — the PATCH passes the existence check, then rewrites the cleared basket and answers `200` with empty `items` instead of `404 Basket item not found`.
- `apps/web/src/components/ProductCard.tsx:14` — `state === "pending"` is assigned but never rendered and the button is never `disabled`, so there is no feedback during the request and a double-click sends two POSTs. Failing input: double-click "Додати в кошик" → quantity 2 in the basket for one intended add.
- `apps/web/src/api/client.ts:29` — `productId` is interpolated into the path with no `encodeURIComponent`; the comment's claim that an id "contains `:` only" is not enforced — `sourceId` is `z.string()` and `ProductIdSchema` permits `[^\s/]+`, i.e. `#`, `?`, `%`. Failing input: a live product `osio:a#b` → the server receives `osio:a` → `404`.
- `apps/web/src/components/BasketLine.tsx:21,25` and `apps/web/src/pages/BasketPage.tsx:12` — every mutation failure is swallowed with `() => {}` and nothing is shown; failing input: the API is down, the buyer clicks "Видалити" or "Очистити кошик" and the page is silent, with no `role="status"` anywhere (only the *load* path has an error state, D8).
- `apps/api/src/lib/basket.ts:1` and `apps/web/src/components/BasketLine.tsx:1` — rule broken: AGENTS.md "logic in `src/lib/` … has a Vitest test beside it" and the web rule "a component with a user-visible behaviour has a Testing Library test beside it". Neither `apps/api/src/lib/basket.test.ts` nor `apps/web/src/components/BasketLine.test.tsx` exists; both are covered only through the route/page tests.
- `apps/web/src/components/BasketLine.tsx:53` / `apps/api/src/lib/basket.ts:44` — `price * quantity` is raw float arithmetic and `formatPrice` does not round (correct per the no-rounding rule), so a non-integer price renders a binary artefact. Failing input: `price: 19.99`, quantity 3 → `Разом: 59.97000000000001 ₴` and the same value in the API's `totals.sum`.

## 2. Verdict

FIX FIRST
