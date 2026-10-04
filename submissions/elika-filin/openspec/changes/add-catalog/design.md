# Design

## Context

See proposal.md — Why. Current state: `apps/api` has `createApp()` with `/api/health` and `config.ts` with
`port`; `apps/web` renders one heading without a router; `packages/shared` exports `SHOP_KEYS` only. No
adapters, no routes. The two adapter fixtures are already committed in `apps/api/fixtures/` (test data, not
implementation): `karashynyard.html` and `osio.json`, cut from the 2026-10-04 captures by `make-fixtures.py`
(kept beside them as provenance, never run by tests). The spec values below — the five kept lids, osio
`products[1]` "Щавлик органічний, осінній " with its trailing space, `products[11]` id
`6aa15f6d98ecadd65969cc45` price 315 — are pinned to those exact files; a re-capture of the live sites would
not reproduce them, so the fixtures are never regenerated during apply.

Constraints from `AGENTS.md` / `.claude/rules`: `process.env` only in `apps/api/src/config.ts`; handlers thin
(parse → one `src/lib` call → `c.json`); logic in `src/lib` has no Hono import; adapters return typed failures;
tests use `apps/api/fixtures/`, never the live shops; no new dependency without asking; Ukrainian UI copy;
Tailwind utilities only; status messages use `role="status"`.

Upstream facts observed on 2026-10-04 (they shape the parsers and the fixtures):

- `https://karashynyard.com.ua/` is one Tilda page of 33 records. Eight records of `data-record-type="776"`
  hold 133 product cards; each is preceded by a type-43 heading record
  `<div class="t030__title t-title …"><strong>Індичка з вільного вигулу</strong></div>`. Inside a card the price
  cell `field="li_price__<lid>"` is a plain integer; the currency ("грн.") sits in a sibling element. The first
  store record (`rec638772397`, 38 turkey products) is what "first 10 in upstream order" yields live.
  Tilda **reuses lids across records**: `1498486363994` is "Філе індички, 1 кг" in `rec638772397` and
  "Домашня сметана, 0,5 л" in `rec638793505`; `1497456130776` repeats the same way.
- The OSIO API (`GET …/v1/products`) returns 63 items; none is `isComingSoon` today; `name`/`unit` sometimes
  carry a trailing space; descriptions contain newlines. The committed snapshot `data/shops/osio.json` is a
  hand-picked 10, not the API's first 10, so live and snapshot lists legitimately differ.
- The snapshot descriptions were produced by: collapse whitespace, and if longer than 300 characters cut at the
  last space before position 300 and add `…` (verified against all 10 entries). The osio adapter applies the
  same rule so one product looks identical in both modes.

## Goals / Non-Goals

**Goals:**
- One adapter interface; a third shop is a new file in `src/shops/`, not a rewrite.
- Catalog logic pure and injectable (adapters, snapshot reader, clock), so every spec scenario runs without
  network and the route tests use `app.request()` with fakes.
- The "which products are visible" rule isolated in one pure function so `add-admin` replaces only that.
- The data-source mode switchable at runtime (`setSource`) so `add-admin` adds only the UI and the auth.

**Non-Goals:**
- Caching to disk, retries, circuit breakers, request timeouts beyond a single abort timeout.
- An HTML-parser dependency; SSR; a product-detail route; styling beyond Tailwind utilities.

## Decisions

1. **Adapter contract** — `ShopAdapter = { shop: ShopInfo; fetchProducts(): Promise<ShopFetchResult> }`,
   `ShopFetchResult = { ok: true; products: Product[] } | { ok: false; error: string }` (in
   `src/shops/types.ts`). Factories `createKarashynyardAdapter({ fetch })` / `createOsioAdapter({ fetch })`
   take a `FetchLike = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>`;
   `server.ts` passes `(url) => fetch(url, { signal: AbortSignal.timeout(10_000) })`, tests pass a stub
   returning fixture text. Each adapter also exports its pure parser (`parseKarashynyardHtml(html)`,
   `parseOsioJson(text)`) so the fixture tests need no fetch at all.
   *Alternatives:* class hierarchy (more ceremony for two shops); adapters using global `fetch` (tests would
   stub globals and could leak to the network).
2. **Tilda parsing with regular expressions, no dependency.** Split the page at record open tags
   (`<div id="(rec\d+)" class="r t-rec…" … data-record-type="(\d+)">`), carry the last `t-title` text as the
   current category, and inside type-776 records split at `<div class="t776__col` **only** — every record also
   holds one `<div class="t776__product-full js-product" data-product-lid="…">` popup block per product with the
   same lid and fields, so splitting on `js-product` or on `data-product-lid` alone doubles every product; read `data-product-lid`,
   `li_title__`, `li_descr__`, `li_price__`, `data-original`; strip tags, decode entities, collapse whitespace.
   `unit` = first match of
   `/\d+(?:[.,]\d+)?(?:\s*(?:кг|г|шт|мл|л))?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(?:кг|г|шт|мл|л)(?![\p{L}\p{N}])/u`
   over the name; empty when absent. The closing guard is the Unicode lookahead `(?![\p{L}\p{N}])`, **not
   `\b`**: in JavaScript `\b` is ASCII-only even with the `u` flag, so there is never a word boundary after a
   Cyrillic unit word and a `\b` version matches none of the 10 snapshot names (every karashynyard product
   would get `unit: ""`). Verified in Node against `data/shops/karashynyard.json`: the lookahead version
   returns exactly the snapshot `unit` for all 10 names — "1 кг", "900 г", "800 г - 1,1 кг", "1 -1,5 кг",
   "700 г", "330 г", "10 шт", and "100 г" for "Гречаний чай з жасмином 100 г (99 чашок)" — and "0,5 л" for
   "Домашня сметана, 0,5 л".
   Cards without an integer price are skipped. **Duplicate `sourceId`: first occurrence wins** — ids must be
   unique for `/api/products/:id` and the basket; the snapshot's `sourceId` is the bare lid, so changing the
   key would break the committed data. *Alternative:* `cheerio`/`node-html-parser` — needs a dependency
   decision for a flat, stable structure; *alternative key* `<recId>-<lid>` — deferred to `add-admin`, which
   is the first change to expose products beyond the first record (see Risks).
3. **Osio normalization** — trim `name`, `unit`, `categoryName`; description rule from Context above;
   `inStock = !isComingSoon`; `productUrl = https://osio-organic.com.ua/products/<id>`. Body parsed with
   `JSON.parse` inside try/catch → `"osio: invalid JSON"`; non-array or empty → `"osio: no products"`;
   each item validated loosely (id/name/price/imageUrl/unit/categoryName/description/isComingSoon).
4. **Catalog service** (`src/lib/catalog.ts`) — `createCatalogService({ source, shops, snapshots, cache, now })`
   returns `{ getSource(), setSource(s), load(): Promise<CatalogResponse>, findProduct(id) }`. `load` resolves
   each shop (in parallel): snapshot mode → snapshot; live mode → cache hit, else adapter; `ok` → cache +
   `status: "live"`; failure → snapshot + `status: "snapshot-fallback"` + `error`. Then
   `selectVisibleProducts(perShop: ShopProducts[]): Product[]` — pure, "first 10 per shop, shops in configured
   order" — builds `products`, and `count` = served per shop. Its input type is exported from the same file:
   `export type ShopProducts = { key: ShopKey; products: Product[] }` — one entry per configured shop, in
   configured order, `products` = that shop's full upstream list — so the selection test builds its input
   literally. `findProduct(id)` is `(await load()).products.find((p) => p.id === id)`: it goes through the
   same mode / cache / fallback path as `GET /api/products`, works on a cold service (no prior `load()`), and
   so `/api/products/:id` and the future basket agree on what exists. Shops are configured as
   `[{ adapter, snapshotKey }]` in the order karashynyard, osio.
   *Alternatives:* module-level singleton with its own clock — untestable TTL and fallback; `findProduct`
   over the last served list — a cold service would answer 404 for every id until the list was requested.
5. **Snapshot reader** (`src/lib/snapshot.ts`) — `createSnapshotSource(dir)` with `read(key)`: reads
   `<dir>/<key>.json` once (memoized), validates with `SnapshotFileSchema`, maps to `Product[]` (adds `id`,
   `shopKey`, `shopName`). Takes its directory as a value like the stores rule prescribes.
6. **TTL cache** (`src/lib/cache.ts`) — `createTtlCache<T>({ ttlMs: 300_000, now })` with `get(key)` /
   `set(key, value)`; expiry `storedAt + ttlMs <= now()`; only `ok` adapter results are stored.
7. **Config** — `AppConfig = { port, dataSource, snapshotDir }`; `DATA_SOURCE` parsed with the shared
   `DataSourceSchema`, invalid values throw at startup (fail fast beats silently serving the wrong source);
   `snapshotDir` defaults to `<repo>/data/shops` resolved from `config.ts` via `import.meta.url`, overridable by
   `SNAPSHOT_DIR` (used by nothing yet; keeps tests free of `process.env`).
8. **App wiring** — `createApp({ catalog })`; `src/routes/products.ts` exports `productsRoutes(catalog)` (a Hono
   sub-app mounted at `/api/products`): `GET /` → `c.json(await catalog.load())`, `GET /:id` → product or
   `404 { error: "Product not found" }`. `app.test.ts` passes a stub catalog for the health test. `server.ts`
   builds the real adapters, the service and the app from `loadConfig()`.
9. **Web** — React Router in data mode: `router.tsx` exports `routes` (`{ path: "/", Component: App,
   children: [{ index: true, Component: CatalogPage }] }`) and `router = createBrowserRouter(routes)`;
   `main.tsx` renders `<RouterProvider router={router} />` (`react-router` / `react-router/dom`); tests use
   `createMemoryRouter(routes, { initialEntries: ["/"] })`. `App` becomes the layout (header with the h1 +
   `<Outlet />`). `CatalogPage` loads with `useEffect` + a `{ status: "loading" | "error" | "ready" }` state
   and calls `getProducts()` from `src/api/client.ts`; page tests `vi.mock("../api/client")`. `ShopSection`
   = `<section aria-labelledby>` with `<h2><a href>` name, the fallback note (`role="status"`) when
   `status === "snapshot-fallback"`, and a `<ul>` of `ProductCard` (`<li>`: `<img alt>`, name, unit,
   `formatPrice(price)` = `` `${price} ₴` `` — no digit grouping, so 1410 → "1410 ₴" — and the "У магазині"
   link). *Alternative:* route `loader`s — data fetching would move into the router and the client mock would
   have to go through loader plumbing; not worth it for one page.
10. **Shared schemas** (zod 4): `ShopKeySchema = z.enum(SHOP_KEYS)`, `ProductSchema`,
    `ShopStatusSchema = z.enum(["live", "snapshot", "snapshot-fallback"])` (the third value is the snapshot
    mode's own status, so the web can distinguish a fallback from a chosen snapshot), `ShopSummarySchema`
    (`key, name, url, status, error?, count`), `CatalogResponseSchema`, `SnapshotFileSchema`,
    `DataSourceSchema = z.enum(["live", "snapshot"])`, plus `z.infer` types and `SHOPS` metadata
    (`{ karashynyard: { name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397" }, osio: { name: "OSIO organic", url: "https://osio-organic.com.ua/" } }`).

## File layout

```
packages/shared/src/index.ts                  schemas + types + SHOPS metadata
apps/api/fixtures/karashynyard.html           real markup, 3 heading + 3 store records kept whole, 5 cards + their 5 popup blocks (one repeated lid)
apps/api/fixtures/osio.json                   real /v1/products response, first 12 items
apps/api/fixtures/make-fixtures.py            provenance only: the script that cut both fixtures from the captures; not run
apps/api/src/config.ts                        + dataSource, snapshotDir
apps/api/src/shops/types.ts                   ShopAdapter, ShopFetchResult, FetchLike
apps/api/src/shops/karashynyard.ts (+ .test)  parseKarashynyardHtml, createKarashynyardAdapter
apps/api/src/shops/osio.ts (+ .test)          parseOsioJson, createOsioAdapter
apps/api/src/lib/snapshot.ts (+ .test)        createSnapshotSource
apps/api/src/lib/cache.ts                     createTtlCache (covered by catalog tests)
apps/api/src/lib/catalog.ts (+ .test)         ShopProducts, selectVisibleProducts, createCatalogService
apps/api/src/routes/products.ts (+ .test)     productsRoutes(catalog)
apps/api/src/app.ts / app.test.ts / server.ts createApp({ catalog }); wiring
apps/web/src/api/client.ts (+ .test)          getProducts()
apps/web/src/components/ProductCard.tsx       card + formatPrice
apps/web/src/components/ShopSection.tsx       section + fallback note
apps/web/src/pages/CatalogPage.tsx (+ .test)  states: loading / error / ready
apps/web/src/router.tsx, App.tsx, main.tsx    routes, layout, RouterProvider
```

## Risks / Trade-offs

- [Tilda markup changes] → the parser finds zero cards → typed failure → snapshot fallback with a visible
  note; the fixture pins today's markup so the break shows up in tests when the fixture is re-captured.
- [Reused lids across records] → first occurrence wins; today 2 of 133 live products are dropped (a dairy
  item and a milk item that share lids with earlier cards). Visible products in this change all come from the
  first record, so nothing shown is affected. `add-admin` exposes the full list and must decide on a composite
  key (`<recId>-<lid>`) and a snapshot migration — recorded here so it is not rediscovered.
- [Live list ≠ snapshot list] → expected; `add-admin` visibility settings are the fix, not the adapter.
- [Snapshot file unreadable while a shop is down] → a committed file missing is a deployment error; the API
  may 500 in that case. Not covered by spec on purpose.
- [Slow shop] → 10 s abort timeout in the real fetch; a timeout is a typed failure, and the cache hides the
  cost for 5 minutes after a success.
- [27 scenarios → 27 tests] → each test is a handful of lines over shared fixtures/fakes; keep helpers in the
  test files, not in `src/`.
