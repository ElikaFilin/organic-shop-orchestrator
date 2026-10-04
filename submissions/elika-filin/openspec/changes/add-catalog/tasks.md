# Tasks

Scenario names below are the `#### Scenario:` headings in `specs/*/spec.md`; each test asserts the scenario's
exact WHEN values and THEN output. Fixtures are committed test data in `apps/api/fixtures/`:
`karashynyard.html` (6 whole records, 5 cards plus their popup blocks) and `osio.json` (12 items), cut from
the 2026-10-04 captures by `make-fixtures.py` beside them (provenance only) — never the live shops.

## 1. Scenario tests first (red run)

- [x] 1.1 Confirm the committed fixtures are in place and untouched: `apps/api/fixtures/karashynyard.html`,
  `apps/api/fixtures/osio.json` and `apps/api/fixtures/make-fixtures.py` (provenance only — never run) were
  copied in before apply. The spec values (records rec2364055923, rec638772397, rec2366129053, rec638782031,
  rec2375538863, rec638793505; kept lids 1498486363994, 1628604400123, 1781040705497, 1652947963962,
  1498486363994 again; osio `products[1]` "Щавлик органічний, осінній " with its trailing space,
  `products[11]` id `6aa15f6d98ecadd65969cc45` price 315) are pinned to these exact files, so never re-capture
  or regenerate them. Each store record keeps one `t776__product-full js-product` popup block per kept card
  (same lid, same fields — the parser must not count them). Verify with the Grep tool, not a shell (`grep` and
  `node -e` are not on the allow-list): pattern `class="t776__col[^"]*js-product" data-product-lid="` in
  `apps/api/fixtures/karashynyard.html` matches exactly 5 lines; pattern `data-product-lid="` in the same file
  matches 10 lines; pattern `^    "id": "` in `apps/api/fixtures/osio.json` matches exactly 12 lines. (Human-run
  equivalents: `grep -c '<pattern>' <file>` → `5`, `10`, `12`.) The 12-item count is asserted again by the 1.3
  test "Fixture response yields twelve products in response order" once `pnpm test` is green.
- [x] 1.2 `apps/api/src/shops/karashynyard.test.ts` — four tests, one per scenario: "Fixture page yields its
  products in page order", "Repeated product id keeps the first card", "Page without store records is a
  failure", "Non-2xx status". The adapter gets a stub fetch that resolves with `{ ok, status, text }` from the
  fixture file (`readFileSync`). Verify: the file imports `./karashynyard`, which does not exist yet.
- [x] 1.3 `apps/api/src/shops/osio.test.ts` — five tests: "Fixture response yields twelve products in response
  order", "Coming-soon item is out of stock", "Non-JSON body is a failure", "Empty product list is a failure",
  "Network error" (stub fetch rejects with `new Error("ECONNRESET")`). Verify: imports `./osio`, missing yet.
- [x] 1.4 `apps/api/src/lib/snapshot.test.ts` — "Snapshot product normalizes to a Product" against the real
  `data/shops/karashynyard.json` (directory passed as a value) and `ProductSchema` from `@organic/shared`.
  Verify: imports `./snapshot` and `ProductSchema`, both missing yet.
- [x] 1.5 `apps/api/src/config.test.ts` — "Config reads DATA_SOURCE" (three calls of `loadConfig`, the third
  expects the exact throw message). Verify: `pnpm test` reports it failing on `dataSource` being `undefined`.
- [x] 1.6 `apps/api/src/lib/catalog.test.ts` — "Selection keeps the first ten of each shop in order" (pure
  `selectVisibleProducts`, called with the scenario's literal `ShopProducts[]` input —
  `[{ key: "karashynyard", products: <the 12> }, { key: "osio", products: <the first 3> }]`, type imported
  from `./catalog`), "Second load within five minutes reuses the cache" (both fakes `ok: true` on every call,
  `createTtlCache({ ttlMs: 300000, now })` on the injected clock), "A failed fetch is not cached", "Runtime
  switch to snapshot" (service with fake adapters as `vi.fn()`, injected `now`, snapshot dir `data/shops`).
  Verify: imports `./catalog`, missing yet.
- [x] 1.7 `apps/api/src/routes/products.test.ts` — "Snapshot mode serves the committed files", "Both shops
  live", "One shop down falls back to its snapshot", "Known id" (a fresh app, the `/:id` request is its first
  request — no prior `GET /api/products`), "Unknown id", all through `createApp({ catalog }).request(...)`
  with fake adapters and snapshot dir `data/shops`. Verify: imports `./products` and the new `createApp`
  signature, both missing yet.
- [x] 1.8 `apps/web/src/api/client.test.ts` — "Successful request", "Failed request" with
  `vi.stubGlobal("fetch", vi.fn(...))`. Verify: imports `./client`, missing yet.
- [x] 1.9 `apps/web/src/pages/CatalogPage.test.tsx` — five tests: "Two shops with products", "Loading state",
  "Error state", "Snapshot fallback note per shop", "Chosen snapshot mode shows no note";
  `vi.mock("../api/client")`, render `createMemoryRouter(routes, { initialEntries: ["/"] })` in
  `<RouterProvider>`, query with Testing Library roles (`heading`, `link`, `list`, `listitem`, `img`,
  `status`). Verify: imports `../router`, missing yet.
- [x] 1.10 Run `pnpm test` and quote the failing lines (one per new test file: "Failed to resolve import" or a
  red assertion; `app.test.ts` and `App.test.tsx` stay green). Verify: the quoted red output is in the
  transcript before any task in group 2 starts.

## 2. Shared contract

- [x] 2.1 `packages/shared/src/index.ts`: `ShopKeySchema`, `SHOPS` metadata (names and URLs of both shops),
  `ProductSchema`/`Product`, `ShopStatusSchema`, `ShopSummarySchema`, `CatalogResponseSchema`/`CatalogResponse`,
  `SnapshotFileSchema`/`SnapshotFile`, `DataSourceSchema`/`DataSource` (zod 4, no I/O). Verify:
  `pnpm --filter @organic/shared typecheck` exits 0 and `ProductSchema.safeParse` of the first product of
  `data/shops/karashynyard.json` (with `id`, `shopKey`, `shopName` added) succeeds in 1.4's test setup.

## 3. API — shop adapters

- [x] 3.1 `apps/api/src/shops/types.ts`: `ShopAdapter`, `ShopFetchResult`, `FetchLike` as in design.md D1.
  Verify: `pnpm --filter @organic/api typecheck` exits 0.
- [x] 3.2 `apps/api/src/shops/karashynyard.ts`: `parseKarashynyardHtml` (records → category → cards → fields,
  unit regex, duplicate-lid first-wins, skip cards without an integer price) and `createKarashynyardAdapter`
  (GET `https://karashynyard.com.ua/`, non-2xx → `"karashynyard: HTTP <status>"`, rejection → message, zero
  cards → `"karashynyard: no product cards found"`). Verify: the four tests of 1.2 pass in `pnpm test`.
- [x] 3.3 `apps/api/src/shops/osio.ts`: `parseOsioJson` (trim, description rule, `inStock = !isComingSoon`) and
  `createOsioAdapter` (GET `https://arsubs-production-1-back-t5tdi.ondigitalocean.app/v1/products`, errors
  `"osio: HTTP <status>"`, `"osio: invalid JSON"`, `"osio: no products"`, rejection message). Verify: the five
  tests of 1.3 pass; `products[0].description` equals the snapshot's string character for character.

## 4. API — snapshot, cache, catalog, config

- [x] 4.1 `apps/api/src/lib/snapshot.ts`: `createSnapshotSource(dir).read(key)` — read once, validate with
  `SnapshotFileSchema`, map to `Product[]`. Verify: 1.4 passes.
- [x] 4.2 `apps/api/src/lib/cache.ts`: `createTtlCache({ ttlMs, now })` with `get`/`set`, expiry at
  `storedAt + ttlMs <= now()`. Verify: `pnpm --filter @organic/api typecheck` exits 0 (behaviour is asserted by
  4.3's cache scenarios).
- [x] 4.3 `apps/api/src/lib/catalog.ts`: `export type ShopProducts = { key: ShopKey; products: Product[] }`,
  `selectVisibleProducts(perShop: ShopProducts[]): Product[]` (pure, first 10 per shop, configured shop order)
  and `createCatalogService` (modes, per-shop fallback with `status`/`error`, cache of `ok` results only,
  `getSource`/`setSource`/`load`, and `findProduct(id)` = `(await load()).products.find((p) => p.id === id)`
  so it works on a cold service). No Hono import. Verify: the four tests of 1.6 pass.
- [x] 4.4 `apps/api/src/config.ts`: `dataSource` from `DATA_SOURCE` via `DataSourceSchema` (default `live`,
  invalid → `Error('DATA_SOURCE must be "live" or "snapshot", got "<value>"')`) and `snapshotDir` (default
  `<repo>/data/shops`, `SNAPSHOT_DIR` override). Still the only file reading `process.env`. Verify: 1.5 passes
  and `pnpm hooks:selftest` stays green.

## 5. API — route and wiring

- [x] 5.1 `apps/api/src/routes/products.ts` (`productsRoutes(catalog)`: `GET /` → `catalog.load()`, `GET /:id`
  → product or `404 { error: "Product not found" }`, no logic in handlers) and `apps/api/src/app.ts`
  (`createApp({ catalog })`, mount at `/api/products`); update `app.test.ts` to pass a stub catalog. Verify: the
  five tests of 1.7 and the health test pass.
- [x] 5.2 `apps/api/src/server.ts`: build both adapters with `(url) => fetch(url, { signal:
  AbortSignal.timeout(10_000) })`, the snapshot source, the cache (`ttlMs: 300_000`, `now: Date.now`) and the
  service from `loadConfig()`; pass `{ catalog }` to `createApp`. Verify: `pnpm --filter @organic/api typecheck`
  exits 0 and `pnpm lint` reports no error.

## 6. Web — client, components, page, router

- [x] 6.1 `apps/web/src/api/client.ts`: `getProducts()` → `fetch("/api/products")`, non-2xx →
  `Error("GET /api/products failed: <status>")`, body parsed with `CatalogResponseSchema`. Verify: the two tests
  of 1.8 pass.
- [x] 6.2 `apps/web/src/components/ProductCard.tsx` (`<li>`: `<img alt={name}>`, name, unit, `formatPrice` →
  `"<price> ₴"`, link "У магазині") and `ShopSection.tsx` (`<section aria-labelledby>`, `<h2><a href>` with the
  shop name, note "Показано збережену копію" with `role="status"` when `status === "snapshot-fallback"`,
  `<ul>` of cards). Tailwind utilities only. Verify: `pnpm --filter @organic/web typecheck` exits 0.
- [x] 6.3 `apps/web/src/pages/CatalogPage.tsx` (`useEffect` → `getProducts()`; `role="status"` texts
  "Завантажуємо каталог…" / "Не вдалося завантажити каталог"; one `ShopSection` per shop in response order),
  `apps/web/src/router.tsx` (`routes` + `createBrowserRouter`), `App.tsx` as the layout with the h1 and
  `<Outlet />`, `main.tsx` rendering `<RouterProvider router={router} />`. Keep `App.test.tsx` green (wrap in a
  memory router if `Outlet` needs one). Verify: the five tests of 1.9 pass and the whole `pnpm test` is green.

## 7. Integration and done

- [x] 7.1 Update `docs/session-notes.md`: tick the "каталог" checklist line with the automated proof — quote
  the `pnpm test` result lines of the 1.7 route tests "Snapshot mode serves the committed files" and "Both
  shops live" (each asserts 20 products, 10 per shop, `products[0].price` 665) and of the 1.9 page test "Two
  shops with products" — and end the line with the placeholder `smoke: ____`, which the human replaces after
  the smoke run below; add the session's progress entry (Зроблено / Не працює / Починати наступну сесію з).
  Verify: the line reads `[x]`, names `pnpm test` and the three test names, and ends with `smoke: ____`.
- [x] 7.2 Run `pnpm check` and quote its summary lines (Tests … passed, spec:check ok — …).

## 8. Reality check — OSIO tenant header (spec updated after the first live smoke run)

- [x] 8.1 `apps/api/src/shops/osio.test.ts` — add the test "Request carries the tenant header": a stub fetch `vi.fn()` that
  records `(url, init)` and resolves with the fixture; assert it was called once with the products URL and
  `init.headers` equal to `{ "Application-Instance": "3fc23022-4cf1-4d8b-a24c-c50e2651d4e0" }`. Run `pnpm test` and quote
  the red assertion (the adapter currently calls fetch with the URL only).
- [x] 8.2 `apps/api/src/shops/types.ts`: `FetchLike` accepts an optional second argument `init?: { headers?: Record<string, string> }`;
  `apps/api/src/shops/osio.ts`: send the header; `apps/api/src/server.ts`: pass `init` through to `fetch` together with the
  timeout signal. Verify: the 8.1 test and the whole osio suite pass; `pnpm typecheck` exits 0.
- [x] 8.3 Run `pnpm check` and quote its summary lines (Tests … passed, spec:check ok — …).

## 9. Review findings (maker ≠ checker — docs/reviews/2026-10-04-add-catalog-*.md)

Accepted from the code reviewer: unguarded snapshot read can 500 (spec contradiction), memoized rejected snapshot
read, identical link names, missing component tests, no in-flight de-duplication; from both reviewers: silent drop of
malformed osio items. All are now specified above (scenarios "Shop down and its snapshot unreadable", "A failed
snapshot read is retried", "Concurrent cold loads call each adapter once", "Malformed item is skipped",
"Unavailable shop", and the accessible link name in "Two shops with products").

- [x] 9.1 Scenario tests first: add the five new tests (`products.test.ts` unreadable snapshot on an empty temp dir →
  `status: "unavailable"`; `snapshot.test.ts` failed read retried on a temp dir; `catalog.test.ts` concurrent cold
  loads with adapters resolving after `await Promise.resolve()`; `osio.test.ts` malformed item skipped;
  `CatalogPage.test.tsx` unavailable shop) and update "Two shops with products" to query the links by their new
  accessible names. Run `pnpm test` and quote the red lines.
- [x] 9.2 `packages/shared/src/index.ts`: `ShopStatusSchema` gains `"unavailable"`. `apps/api/src/lib/snapshot.ts`:
  drop a rejected promise from `pending`. `apps/api/src/lib/catalog.ts`: wrap the snapshot read in the fallback path
  (and in snapshot mode) so a failure yields `status: "unavailable"`, `count: 0`; share one in-flight adapter
  promise per shop on a cold cache. `apps/api/src/shops/osio.ts`: keep skipping malformed items (now specified).
  Verify: the API tests of 9.1 pass; `pnpm typecheck` exits 0.
- [x] 9.3 `apps/web/src/components/ProductCard.tsx`: `aria-label={`У магазині: ${product.name}`}` on the link;
  `ShopSection.tsx`: the "Магазин тимчасово недоступний" note (role="status", no `<ul>`) for `status: "unavailable"`.
  Add `ProductCard.test.tsx` (price format "665 ₴", alt, accessible link name) and `ShopSection.test.tsx` (fallback
  note shown only for `snapshot-fallback`, unavailable note only for `unavailable`) beside the components
  (`.claude/rules/web.md`). Verify: the web tests of 9.1 and the two new component tests pass.
- [x] 9.4 Run `pnpm check` and quote its summary lines (Tests … passed, spec:check ok — …).

## 10. Review round 2 (docs/reviews/2026-10-04-add-catalog-code-reviewer.md)

Accepted: card without an image is skipped (spec text updated), `cache.test.ts` beside `cache.ts` (AGENTS.md rule),
empty `SNAPSHOT_DIR` fails fast like `DATA_SOURCE`, a `CatalogShop` whose adapter key differs from `snapshotKey` throws at
construction, a shop with zero products shows "Немає товарів" (scenario "Shop with no products"). The three
session-notes findings were fixed by hand.

- [ ] 10.1 Scenario tests first: `CatalogPage.test.tsx` "Shop with no products"; `cache.test.ts` (set at `now = 0`, hit at
  `299999`, miss at `300000`, miss for an unknown key); `config.test.ts` `SNAPSHOT_DIR: ""` throws
  `Error('SNAPSHOT_DIR must be a non-empty path')`; `catalog.test.ts` mismatched keys throw `Error('catalog shop key mismatch: karashynyard vs osio')`;
  `karashynyard.test.ts` a card without `data-original`/`src` is skipped (fixture string built in the test from one real
  card with the image attribute removed → 4 products from the 5-card fixture variant). Run `pnpm test`, quote the red lines.
- [ ] 10.2 Implement: `karashynyard.ts` (image fallback `data-original` → `src`, else skip), `config.ts`, `catalog.ts` guard,
  `ShopSection.tsx` empty note. Verify: 10.1 tests pass, `pnpm typecheck` exits 0.
- [ ] 10.3 Run `pnpm check` and quote its summary lines (Tests … passed, spec:check ok — …).

### Human smoke run (outside the loop, after 7.2)

Not a checkbox: `pnpm dev` is a foreground watcher and `curl` is not on the loop's allow-list
(`scripts/loop.mjs`, `.claude/settings.json`), so the loop must never wait for this step; the automated proof
of the same behaviour is the 1.7 route tests. A human runs `pnpm dev`, then
`curl -s localhost:4000/api/products | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.source,j.shops.map(x=>x.key+':'+x.status+':'+x.count),j.products.length)})"`
— expected output `live [ 'karashynyard:live:10', 'osio:live:10' ] 20` (first run on 2026-10-04 printed
`osio:snapshot-fallback:10` — see group 8) (or `snapshot-fallback` for a shop
that is down) — and opens http://localhost:5173/ to see "Organic Catalog", two shop sections with 10 cards
each and prices like "665 ₴". Then the human replaces `smoke: ____` in the "каталог" line of
`docs/session-notes.md` with the printed line.
