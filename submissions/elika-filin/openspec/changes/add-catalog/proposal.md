# Proposal

## Why

Organic Catalog exists only as a skeleton: a health endpoint and a heading, no products. The first vertical
slice has to put real products from both shops — Карашин Яр (a Tilda page) and OSIO organic (a JSON API) —
in front of the buyer, and prove the data path (live fetch → normalized `Product` → REST → page) works and keeps
working when a shop is down. The basket (`add-basket`) and the admin panel (`add-admin`) build on this contract,
so it has to be right first.

## What Changes

- **Shop adapters** (`apps/api/src/shops/`): `karashynyard` fetches `https://karashynyard.com.ua/` and parses the
  Tilda store cards (`data-product-lid`, `li_title__N`, `li_descr__N`, `li_price__N`, `data-original`, category
  from the nearest preceding heading record); `osio` fetches
  `https://arsubs-production-1-back-t5tdi.ondigitalocean.app/v1/products` and maps its JSON. Adapters return a
  typed `{ ok: true, products } | { ok: false, error }` and never throw.
- **Shared contract** (`packages/shared`): zod schema + type for the normalized `Product`
  (`id = "<shopKey>:<sourceId>"`, UAH price exactly as published), the shop info / status, the
  `GET /api/products` response, the snapshot file in `data/shops/`, and the data-source mode.
- **Catalog assembly** (`apps/api/src/lib/`): data source `live | snapshot` (initial value from `DATA_SOURCE`,
  default `live`, switchable at runtime so `add-admin` only has to add the UI); snapshot loader for
  `data/shops/*.json`; per-shop fallback to the snapshot when a live fetch fails, reported as
  `status: "snapshot-fallback"` with the error; in-memory cache of live results, 5 minutes per shop; one pure
  selection function that keeps the first 10 products per shop in upstream order (`add-admin` swaps it for
  admin-chosen visibility).
- **REST** (`apps/api/src/routes/products.ts`): `GET /api/products` → `{ source, shops, products }`;
  `GET /api/products/:id` → the product or `404 { error }`. The API never answers 500 because a shop is down.
- **Web** (`apps/web`): React Router with route `/` rendering the catalog page — heading "Organic Catalog", one
  section per shop (name links to the shop), a card per product (image, name, unit, price as `665 ₴`, link
  "У магазині"), loading / error states with `role="status"`, and the note "Показано збережену копію" for a shop
  served from its snapshot. All server calls go through `src/api/client.ts`.
- **Fixtures and tests**: `apps/api/fixtures/karashynyard.html` (real markup: 3 heading + 3 store records kept
  whole, trimmed to 5 cards — one of them a real repeated Tilda lid) and `apps/api/fixtures/osio.json` (real
  response trimmed to 12 items), committed with the change together with `make-fixtures.py`, the script that
  cut them from the 2026-10-04 captures (provenance only); one test per spec scenario, written before the
  implementation. Tests never hit the live shops.
- **Config**: `AppConfig` gains `dataSource` and `snapshotDir`; `createApp` takes its dependencies as values.

## Capabilities

### New Capabilities
- `shop-adapters`: fetching one shop's products from its live source and normalizing them (Tilda HTML for
  karashynyard, JSON API for osio), with typed failures instead of exceptions.
- `catalog-api`: the normalized `Product` contract, data-source modes (live / snapshot) with per-shop snapshot
  fallback and a 5-minute cache, visible-product selection, and the `/api/products` endpoints.
- `catalog-web`: the catalog page at `/` — shop sections, product cards, loading / error / fallback states — and
  the API client the page uses.

### Modified Capabilities
- none — this is the first change; `openspec/specs/` is empty.

## Impact

- `apps/api`: new `src/shops/{types,karashynyard,osio}.ts`, `src/lib/{catalog,snapshot,cache}.ts`,
  `src/routes/products.ts`, `fixtures/`; `app.ts` gains a dependency parameter, `config.ts` reads `DATA_SOURCE`,
  `server.ts` wires the real adapters; `app.test.ts` passes test dependencies.
- `apps/web`: `main.tsx` mounts the router, `App.tsx` becomes the layout with the heading, new
  `router.tsx`, `pages/CatalogPage.tsx`, `components/{ProductCard,ShopSection}.tsx`, `api/client.ts`.
- `packages/shared`: `Product`, `ShopInfo`, `ShopStatus`, `CatalogResponse`, `SnapshotFile`, `DataSource`
  schemas and types.
- `data/shops/karashynyard.json` and `data/shops/osio.json` become runtime inputs (snapshot source and fallback)
  and must stay committed.
- Dependencies: none added — `hono`, `zod`, `react-router` are already installed. The Tilda page is parsed with
  regular expressions over its stable markup rather than an HTML-parser dependency (see design.md).
- Network: in live mode the API calls each shop at most once per 5 minutes; tests use fixtures only.

Out of scope for this change:
- the basket (`add-basket`) — no basket UI, cookie or store;
- the admin panel, admin token, the switch UI and per-product visibility (`add-admin`) — only the
  switchable-mode mechanism and the pure selection function land here;
- persisting live results to disk or refreshing `data/shops/*.json` (`pnpm shops:refresh` is untouched);
- product detail page, search, filtering, sorting, pagination;
- a third shop, image proxying, retries or circuit breakers beyond the snapshot fallback.
