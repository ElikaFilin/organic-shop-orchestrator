# catalog-api Specification

## Purpose

Assembles the storefront's product list from the shop adapters or from the committed snapshots, keeps it
available when a shop is down, and serves it over REST in the normalized `Product` contract that both apps share.

## Requirements

### Requirement: Normalized product contract
The system SHALL expose one `Product` schema shared by API and web: `id` = `"<shopKey>:<sourceId>"`,
`shopKey` ∈ {`karashynyard`, `osio`}, `shopName`, `sourceId`, `name`, `price` (number, UAH, exactly as
published), `currency: "UAH"`, `imageUrl`, `productUrl`, `description`, `category`, `unit`, `inStock`.
A snapshot file in `data/shops/` SHALL be read once per process and a failed read SHALL NOT be memoized. It SHALL conform to
`{ shop: { key, name, url }, fetchedAt, products: [{ sourceId, name, price, currency, imageUrl, productUrl, description, category, unit, inStock }] }`.

#### Scenario: Snapshot product normalizes to a Product
- **WHEN** `data/shops/karashynyard.json` is loaded through the snapshot loader
- **THEN** it yields 10 products whose first element equals `{ id: "karashynyard:1498486363994", shopKey: "karashynyard", shopName: "Карашин Яр", sourceId: "1498486363994", name: "Філе індички, 1 кг", price: 665, currency: "UAH", imageUrl: "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg", productUrl: "https://karashynyard.com.ua/#rec638772397", description: "Ніжне філе без кістки для котлет, запікання, тушкування та дитячих страв.", category: "Індичка з вільного вигулу", unit: "1 кг", inStock: true }`
- **AND** `ProductSchema.safeParse(...)` of that element has `success: true`

#### Scenario: A failed snapshot read is retried
- **WHEN** `createSnapshotSource(dir).read("osio")` is called while `dir` has no `osio.json`, then the file is written
  (a copy of `data/shops/osio.json`) and `read("osio")` is called again
- **THEN** the first call rejects with an `Error` and the second call resolves with 10 products whose first `id` is
  `"osio:6abcf192b7db2532803d266d"` (a rejection is never memoized)

### Requirement: Data source mode
The catalog SHALL run in one of two modes, `live` or `snapshot`. The initial mode comes from `DATA_SOURCE`
(default `live`, read only in `apps/api/src/config.ts`) and can be changed at runtime through the catalog
service (`setSource`), so a later change only has to add the UI.

#### Scenario: Config reads DATA_SOURCE
- **WHEN** `loadConfig({})` is called
- **THEN** `dataSource` is `"live"`
- **WHEN** `loadConfig({ DATA_SOURCE: "snapshot" })` is called
- **THEN** `dataSource` is `"snapshot"`
- **WHEN** `loadConfig({ DATA_SOURCE: "foo" })` is called
- **THEN** it throws an `Error` with message `DATA_SOURCE must be "live" or "snapshot", got "foo"`

#### Scenario: Snapshot mode serves the committed files
- **WHEN** the catalog runs in `snapshot` mode over `data/shops/` with fake adapters, and `GET /api/products`
  is requested through `app.request()`
- **THEN** the status is 200 and the body is `{ source: "snapshot", shops: [ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "snapshot", count: 10 }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", count: 10 } ], products: [...] }`
  with 20 products: `products[0]` is `id: "karashynyard:1498486363994"`, `price: 665`; `products[9]` is
  `id: "karashynyard:1743423686258"`, `price: 480`; `products[10]` is `id: "osio:6abcf192b7db2532803d266d"`,
  `price: 195`; `products[19]` is `id: "osio:69e5236361852dec4059d4e8"`, `price: 215`
- **AND** neither fake adapter was called

#### Scenario: Runtime switch to snapshot
- **WHEN** the catalog service starts in `live` mode, `setSource("snapshot")` is called, and then
  `GET /api/products` is requested
- **THEN** the body has `source: "snapshot"`, both shops have `status: "snapshot"` and `count: 10`, and the
  fake adapters were not called

### Requirement: Live mode with snapshot fallback
In `live` mode the catalog SHALL fetch each shop through its adapter. A shop whose adapter returns `ok: false`
SHALL be served from its snapshot in `data/shops/<key>.json` with `status: "snapshot-fallback"` and the
adapter's `error`; a shop whose adapter succeeds has `status: "live"` and no `error`. If the snapshot cannot be
read either (missing file, invalid JSON, schema failure), the shop SHALL be reported with `status: "unavailable"`,
`count: 0` and the adapter's `error`, and its products are omitted. `GET /api/products` SHALL answer 200 in all
three cases — never 500 because a shop is down.

#### Scenario: Both shops live
- **WHEN** the catalog runs in `live` mode; the fake karashynyard adapter returns `{ ok: true, products }` with
  the 10 snapshot products followed by sourceIds `1629901938947` ("Філе зі стегна індички, 1 кг", 665) and
  `1636965991022` ("Стегно індички, 1 кг", 595); the fake osio adapter returns its 10 snapshot products; and
  `GET /api/products` is requested
- **THEN** the status is 200, the body has `source: "live"`, `shops[0]` equals
  `{ key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "live", count: 10 }`
  (no `error` key), `shops[1].status` is `"live"` with `count: 10`, `products.length` is 20,
  `products[0].id` is `"karashynyard:1498486363994"`, `products[10].id` is `"osio:6abcf192b7db2532803d266d"`
- **AND** no product has `sourceId` `"1629901938947"` or `"1636965991022"`

#### Scenario: One shop down falls back to its snapshot
- **WHEN** the catalog runs in `live` mode; the fake karashynyard adapter returns
  `{ ok: false, error: "karashynyard: HTTP 503" }`; the fake osio adapter returns its 10 snapshot products;
  and `GET /api/products` is requested
- **THEN** the status is 200, the body has `source: "live"`, `shops[0]` equals
  `{ key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "snapshot-fallback", error: "karashynyard: HTTP 503", count: 10 }`,
  `shops[1].status` is `"live"`, `products.length` is 20 and `products[0]` is `id: "karashynyard:1498486363994"`, `price: 665`

#### Scenario: Shop down and its snapshot unreadable
- **WHEN** the catalog runs in `live` mode over an empty temporary snapshot directory (no `karashynyard.json`); the
  fake karashynyard adapter returns `{ ok: false, error: "karashynyard: HTTP 503" }`; the fake osio adapter returns its
  10 snapshot products; and `GET /api/products` is requested
- **THEN** the status is 200, the body has `source: "live"`, `shops[0]` equals
  `{ key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "unavailable", error: "karashynyard: HTTP 503", count: 0 }`,
  `shops[1].status` is `"live"` with `count: 10`, `products.length` is 10 and `products[0].id` is `"osio:6abcf192b7db2532803d266d"`

### Requirement: Live results are cached per shop for five minutes
In `live` mode a successful adapter result SHALL be reused for 5 minutes (300 000 ms) per shop before the
adapter is called again; a failed result SHALL NOT be cached, so the next request retries the shop. Concurrent
loads on a cold cache SHALL share one in-flight adapter call per shop instead of each calling the adapter.

#### Scenario: Second load within five minutes reuses the cache
- **WHEN** the catalog runs in `live` mode with an injected clock `now`, a cache created as
  `createTtlCache({ ttlMs: 300000, now })` on the same clock, and both fake adapters returning
  `{ ok: true, products }` with their 10 snapshot products on every call; `load()` is called at `now = 0`,
  then at `now = 299000`, then at `now = 300000`
- **THEN** the fake karashynyard adapter has been called once after the second load and twice after the third
- **AND** the fake osio adapter likewise: once after the second load, twice after the third

#### Scenario: A failed fetch is not cached
- **WHEN** the catalog runs in `live` mode with an injected clock and a `createTtlCache({ ttlMs: 300000, now })`
  cache; the fake karashynyard adapter returns `{ ok: true, products }` (its 10 snapshot products) on every
  call; the fake osio adapter returns `{ ok: false, error: "osio: HTTP 502" }` at `now = 0` and
  `{ ok: true, products }` (its 10 snapshot products) at `now = 1000`; and `load()` is called at both times
- **THEN** the first load reports osio `status: "snapshot-fallback"`, `error: "osio: HTTP 502"`; the second
  load reports osio `status: "live"` and the adapter has been called twice

#### Scenario: Concurrent cold loads call each adapter once
- **WHEN** the catalog runs in `live` mode with an empty cache and both fake adapters resolving their 10 snapshot
  products after a tick, and `load()` is called three times without awaiting in between (`Promise.all`)
- **THEN** each fake adapter has been called exactly once and each of the three results has `products.length` 20

### Requirement: Visible products are the first ten per shop
The catalog SHALL choose the products it serves with one pure selection function over the full per-shop lists:
`selectVisibleProducts(perShop: ShopProducts[], visibility?: ShopVisibility): Product[]` with
`ShopProducts = { key: ShopKey; products: Product[] }` (exported from `apps/api/src/lib/catalog.ts`) and
`ShopVisibility = { karashynyard: string[] | null; osio: string[] | null }` (the admin settings' `visibility`,
exported from `@organic/shared`; omitted = both `null`). A shop whose entry is `null` serves its first 10
products in upstream order; a shop whose entry is an array serves exactly the products whose `id` is in the
array, in upstream order, ignoring ids that are not in its upstream list (an empty array serves none). Shops
are concatenated in configured order (karashynyard, then osio); `count` per shop is the number of its
products served. The catalog service reads the visibility from the admin settings store on every load, so a
change is served by the next `GET /api/products` without a restart.

#### Scenario: Selection keeps the first ten of each shop in order
- **WHEN** `selectVisibleProducts([{ key: "karashynyard", products: <the 12> }, { key: "osio", products: <the first 3 snapshot products> }])`
  is called, where `<the 12>` are karashynyard's 10 snapshot products followed by sourceIds `1629901938947`
  ("Філе зі стегна індички, 1 кг", 665) and `1636965991022` ("Стегно індички, 1 кг", 595), and
  `<the first 3 snapshot products>` are osio's `products[0..2]` from `data/shops/osio.json`
- **THEN** it returns 13 products: ids 0–9 are the 10 karashynyard snapshot ids in snapshot order (first
  `"karashynyard:1498486363994"`, tenth `"karashynyard:1743423686258"`), ids 10–12 are
  `"osio:6abcf192b7db2532803d266d"`, `"osio:6a31801b6f67d681cfdb7e21"`, `"osio:6a82acaa52fcb3f74e97821d"`

#### Scenario: Selection serves the chosen ids in upstream order
- **WHEN** `selectVisibleProducts([{ key: "karashynyard", products: <the 10 snapshot products> }, { key: "osio", products: <the first 3 snapshot products> }], { karashynyard: ["karashynyard:1743423686258", "karashynyard:1498486363994"], osio: null })`
  is called, where `<the 10 snapshot products>` are karashynyard's `products[0..9]` from
  `data/shops/karashynyard.json` and `<the first 3 snapshot products>` are osio's `products[0..2]` from
  `data/shops/osio.json`
- **THEN** it returns 5 products whose ids are, in order, `"karashynyard:1498486363994"` (price 665),
  `"karashynyard:1743423686258"` (price 480), `"osio:6abcf192b7db2532803d266d"`,
  `"osio:6a31801b6f67d681cfdb7e21"`, `"osio:6a82acaa52fcb3f74e97821d"` — the chosen karashynyard ids in
  upstream order, not in array order

#### Scenario: Ids missing upstream are ignored and an empty list hides the shop
- **WHEN** `selectVisibleProducts(<the same perShop>, { karashynyard: ["karashynyard:1498486363994", "karashynyard:0000000000000"], osio: [] })`
  is called
- **THEN** it returns exactly 1 product, `id: "karashynyard:1498486363994"`, `price: 665`

#### Scenario: Catalog honours the admin's visibility
- **WHEN** the catalog runs in `snapshot` mode over `data/shops/` with fake adapters and a settings store on a
  temp directory whose `admin-settings.json` is
  `{"dataSource":"snapshot","visibility":{"karashynyard":["karashynyard:1743423686258","karashynyard:1498486363994"],"osio":null}}`,
  and `GET /api/products` is requested through `app.request()`
- **THEN** the status is 200, `shops[0]` equals
  `{ key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "snapshot", count: 2 }`,
  `shops[1]` equals
  `{ key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", count: 10 }`,
  `products.length` is 12, `products[0]` is `id: "karashynyard:1498486363994"`, `price: 665`, `products[1]`
  is `id: "karashynyard:1743423686258"`, `price: 480`, `products[2].id` is `"osio:6abcf192b7db2532803d266d"`
  and `products[11].id` is `"osio:69e5236361852dec4059d4e8"`
- **AND** neither fake adapter was called

#### Scenario: A visibility change is served without restart
- **WHEN** on the same app, after that request, the store's
  `update((current) => ({ ...current, visibility: { ...current.visibility, karashynyard: null } }))` is
  awaited and `GET /api/products` is requested again
- **THEN** `shops[0].count` is 10, `products.length` is 20 and `products[9]` is
  `id: "karashynyard:1743423686258"`, `price: 480`

#### Scenario: Corrupt settings file falls back to defaults
- **WHEN** `.data/admin-settings.json` in the temp data dir holds the text `{"dataSource":"snapshot"}` (missing
  `visibility`, so the store's schema rejects it), the catalog runs in `snapshot` mode over `data/shops/`, and
  `GET /api/products` is requested
- **THEN** the status is 200 with 20 products (the default first ten per shop) and the failure is reported once on
  stderr naming the file; the storefront never answers 500 because the admin file is bad

### Requirement: Product by id
`GET /api/products/:id` SHALL answer 200 with the product whose `id` matches in the shop's **full** current list
(`findProduct(id)` searches `loadAll()`, not the admin-filtered served list), or 404 with `{ error: "Product not found" }`.
It needs no prior list request. A product hidden by the admin therefore still resolves — a basket line keeps its
price when the admin unticks the product, and a direct link still works.

#### Scenario: Known id
- **WHEN** the catalog runs in `snapshot` mode over `data/shops/` on a fresh app and
  `GET /api/products/osio:6abcf192b7db2532803d266d` is requested with no prior request to `GET /api/products`
- **THEN** the status is 200 and the body equals `{ id: "osio:6abcf192b7db2532803d266d", shopKey: "osio", shopName: "OSIO organic", sourceId: "6abcf192b7db2532803d266d", name: "Капуста кольрабі, органічна осіння", price: 195, currency: "UAH", imageUrl: "https://fra1.digitaloceanspaces.com/arsubs-1/6abcf18f504a4d6030570003", productUrl: "https://osio-organic.com.ua/products/6abcf192b7db2532803d266d", description: "🥬 Кольрабі — соковита, хрустка капуста з ніжним солодкуватим смаком. Ось чим вона корисна: • Вітамін С підтримує імунну систему, потрібен для утворення колагену та допомагає засвоювати залізо з рослинної їжі. • Клітковина сприяє регулярному випорожненню, підтримує кишкову мікрофлору й допомагає…", category: "Овочі", unit: "Качан 350-450 г", inStock: true }`

#### Scenario: Unknown id
- **WHEN** `GET /api/products/osio:000000000000000000000000` is requested on the same snapshot-mode app
- **THEN** the status is 404 and the body is `{ error: "Product not found" }`

#### Scenario: Hidden product still resolves by id
- **WHEN** the catalog runs in `snapshot` mode with visibility `{ karashynyard: ["karashynyard:1743423686258"], osio: null }`
  and `GET /api/products/karashynyard:1498486363994` is requested
- **THEN** the status is 200 and the body has `id: "karashynyard:1498486363994"` and `price: 665`, while
  `GET /api/products` serves 11 products (1 + 10) without that id
