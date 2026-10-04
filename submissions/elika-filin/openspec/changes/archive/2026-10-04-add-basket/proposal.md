# Proposal

## Why

`add-catalog` puts the products of both shops on one page, but a buyer still cannot collect them: the whole
point of Organic Catalog is one basket over several shops. This change gives every visitor an anonymous,
server-side basket bound to an `httpOnly` cookie — add from a card, change quantities, remove, see the total
on `/basket` — so "pick everything in one go" works before accounts or checkout exist, and so `add-admin`
later builds on a stable basket API instead of inventing one.

## What Changes

- **Shared contract** (`packages/shared`): zod schemas for the basket id (UUID), a product id
  (`<shopKey>:<sourceId>`), a quantity (integer 1..99), the two request bodies (`POST /api/basket/items`,
  `PATCH /api/basket/items/:productId`), the `BasketResponse`
  (`{ id, items: [{ productId, quantity, product: Product | null }], totals: { count, sum } }`) and the
  on-disk baskets file.
- **Config**: `AppConfig` gains `dataDir` (default `<repo>/.data`, override `DATA_DIR`); still the only place
  that reads `process.env`.
- **Basket store** (`apps/api/src/lib/store/baskets.ts`): baskets live in one JSON file
  (`<dataDir>/baskets.json`), one line per `productId` with `quantity` and `addedAt`, `updatedAt` per basket.
  The store takes its file path as a constructor value, writes atomically (temp file, then rename) and treats
  a missing file as "no baskets".
- **Basket logic** (`apps/api/src/lib/basket.ts`): add (merge quantities, cap at 99), change quantity, remove,
  clear; the response joins each line with `catalog.findProduct(productId)` from `add-catalog` — `null` when the
  product is no longer served — and totals count only available lines (`count` = sum of quantities, `sum` =
  sum of `price × quantity`, UAH).
- **REST** (`apps/api/src/routes/basket.ts`, mounted at `/api/basket`): `GET /api/basket`,
  `POST /api/basket/items`, `PATCH /api/basket/items/:productId`, `DELETE /api/basket/items/:productId`,
  `DELETE /api/basket`. All answer JSON; invalid body or param → `400 { error }`; unknown product or missing
  line → `404 { error }`.
- **Anonymous identity**: an `httpOnly` cookie `basket_id` (path `/`, `SameSite=Lax`, max age 30 days, value
  `crypto.randomUUID()`), set on the first request to any `/api/basket` endpoint that carries no valid cookie;
  a request with the cookie reuses that basket.
- **Web** (`apps/web`): every product card gets a button "Додати в кошик" that shows "Додано" (`role="status"`)
  after success; the layout header shows a link "Кошик (N)" to `/basket` that loads once on mount and refreshes
  after every mutation; route `/basket` lists the lines (image, name, unit, unit price, a labelled quantity
  input, line sum, "Видалити"), the total "Разом: … ₴" and "Очистити кошик", or "Кошик порожній" with a link
  "До каталогу" when empty; a line whose product is gone reads "Товар недоступний". All server calls go through
  `src/api/client.ts` (`getBasket`, `addToBasket`, `updateBasketItem`, `removeBasketItem`, `clearBasket`).
- **Tests**: one test per spec scenario, written before the implementation — store tests on a temp directory,
  route tests through `createApp({ catalog, basketStore }).request()` with a fake catalog that knows the
  `data/shops/*.json` products, web tests mocking `src/api/client.ts`.

## Capabilities

### New Capabilities
- `basket-api`: the anonymous basket cookie, the basket contents and totals contract, the add / change /
  remove / clear operations with their validation and not-found rules, the JSON-file persistence and the
  `dataDir` configuration.
- `basket-web`: the header basket link, the `/basket` page (lines, quantity editing, removal, clearing, empty
  and unavailable-product states) and the basket functions of the API client.

### Modified Capabilities
- none in `openspec/specs/` — it is still empty, so no `MODIFIED` block is possible or needed.
- `catalog-web` (introduced by the active change `add-catalog`, not yet archived): this change adds **one new
  requirement** by an `ADDED` delta at `specs/catalog-web/spec.md` — the add-to-basket control on the product
  card. No requirement of `add-catalog` is restated or modified. Note for the human: the `add-catalog`
  requirement "Catalog page lists products by shop" ends with the words "no basket controls"; after this change
  that phrase is stale (its scenarios still hold — a button is not a `role="status"` element). Drop the phrase
  when `add-catalog` is archived, or in a later `MODIFIED` delta once the main spec exists.

## Impact

- `apps/api`: new `src/lib/store/baskets.ts`, `src/lib/basket.ts`, `src/routes/basket.ts` (+ tests);
  `src/config.ts` gains `dataDir` (`DATA_DIR`); `src/app.ts` becomes `createApp({ catalog, basketStore })` and
  `src/server.ts` wires the store from `config.dataDir`. **Signature change**: the three `add-catalog` tests
  that call `createApp({ catalog })` — `src/app.test.ts`, `src/routes/products.test.ts` and
  `src/lib/catalog.test.ts` (its "Runtime switch to snapshot" test) — must pass a basket store on a temp
  directory as well (setup-only edit each: the `node:fs` / `node:os` / `node:path` imports plus the extra
  argument, no behaviour change).
- `apps/web`: `src/api/client.ts` gains five basket functions; new `src/basket/BasketContext.tsx`,
  `src/pages/BasketPage.tsx`, `src/components/BasketLine.tsx`; `src/App.tsx` provides the basket state and the
  header link; `src/components/ProductCard.tsx` gains the button; `src/router.tsx` gains route `/basket`.
  Existing page tests (`CatalogPage.test.tsx`, `App.test.tsx`) must give the mocked `getBasket` a resolved
  value because the layout now calls it on mount.
- `packages/shared`: `BasketIdSchema`, `ProductIdSchema`, `BasketQuantitySchema`, `AddBasketItemSchema`,
  `UpdateBasketItemSchema`, `BasketLineSchema`, `BasketTotalsSchema`, `BasketResponseSchema`,
  `BasketsFileSchema` and their types.
- Runtime data: the API creates `<repo>/.data/baskets.json` on the first write (`.data/` is git-ignored).
  Baskets are shared secrets by id only (an unsigned UUID cookie) — accepted for an anonymous basket; see
  design.md Risks.
- Dependencies: none added — `hono/cookie` ships with `hono`, `crypto.randomUUID` is Node, zod comes through
  `@organic/shared`.
- Order of changes: this change is applied **after** `add-catalog` lands (it imports `Product`,
  `CatalogResponse`, `catalog.findProduct`, `createApp`, the router, `client.ts`, `ProductCard` and
  `formatPrice` from it). Nothing here changes `add-catalog`'s behaviour.

Out of scope for this change:
- checkout, delivery, payment, prices in any currency other than UAH;
- user accounts, sign-in, merging a basket into another one, baskets shared between devices;
- the admin panel and anything in `add-admin`;
- expiry or cleanup of old baskets in `.data/baskets.json`, size limits on the file, a database;
- basket controls beyond add / change quantity / remove / clear (no wishlists, no notes, no stock checks
  beyond "the catalog still serves the product").
