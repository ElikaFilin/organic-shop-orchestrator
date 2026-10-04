# Review · add-catalog · code-reviewer · round 1 · 2026-10-04 (restored from the session task output; round 2 overwrote the file)

> agent: code-reviewer · tools: Read, Grep, Glob, Bash(git diff *), Bash(git status *) · separate `claude -p` session, read-only

## 1. Findings

- `apps/api/src/lib/catalog.ts:76` — the snapshot fallback is an unguarded `await snapshots.read(...)`, so an I/O or validation failure rejects `load()` and Hono answers 500, contradicting catalog-api spec "GET /api/products SHALL answer 200 in both cases — never 500 because a shop is down" — live mode, karashynyard adapter returns `{ok:false,error:"karashynyard: HTTP 503"}`, `data/shops/karashynyard.json` missing or holding a product with `price: "665"` → `ENOENT`/zod throw → `GET /api/products` 500 instead of 200 with `status:"snapshot-fallback"`; same at line 63 for chosen snapshot mode; no test covers the unreadable-snapshot path.
- `apps/api/src/lib/snapshot.ts:24` — the in-flight promise is memoized without ever clearing a rejection, so one transient read error is cached for the process lifetime — `read("osio")` fails once (EMFILE, half-written file); the file is fine a second later, but every later request still gets the same rejected promise until the server restarts.
- `apps/api/src/shops/osio.ts:70` — `payload.filter(isOsioItem)` silently drops malformed items instead of reporting a typed failure, against shop-adapters spec "map **each** array item to a Product in response order" — upstream returns the 12 items with item 3's `description: null` → 11 products, that product vanishes from the storefront with no `error` and no fallback for the shop.
- `apps/web/src/components/ProductCard.tsx:19` — every card's link has the identical accessible name "У магазині" with no product context, so link-by-link screen-reader navigation gives N indistinguishable entries (the page test at `CatalogPage.test.tsx:121` already shows three links sharing one name); needs e.g. `aria-label={`У магазині: ${product.name}`}`.
- `apps/web/src/components/ShopSection.tsx:13` — the conditional "Показано збережену копію" note and `ProductCard`'s `formatPrice` are user-visible behaviour with no Testing Library test beside them; `.claude/rules/web.md` requires a test next to such a component — they are only asserted one level up in `pages/CatalogPage.test.tsx`.
- `apps/api/src/lib/catalog.ts:65` — no in-flight de-duplication on a cold cache: K concurrent requests before the first adapter result lands each call `fetchProducts()`, so a startup burst of 20 requests hits karashynyard.com.ua 20 times rather than once per 5 minutes.

## 2. Verdict

`FIX FIRST`

