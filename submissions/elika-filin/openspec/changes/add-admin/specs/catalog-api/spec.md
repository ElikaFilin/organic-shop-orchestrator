# Spec Delta

## MODIFIED Requirements

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
