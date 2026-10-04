# Spec Delta

## Purpose

Keeps an anonymous buyer's basket on the server — identified by an `httpOnly` cookie and stored in a JSON
file — and serves it over REST: the lines joined with the catalog's current product data, totals in UAH, and
the add / change / remove / clear operations with their validation and not-found rules.

## ADDED Requirements

### Requirement: Anonymous basket cookie
Every `/api/basket` endpoint SHALL identify the buyer by the cookie `basket_id`. A request without it, or
with a value that is not a UUID, SHALL get a new id from `crypto.randomUUID()` and the response header
`Set-Cookie: basket_id=<id>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax` (30 days). A request whose
`basket_id` is a UUID SHALL use that basket and get no `Set-Cookie` header.

#### Scenario: First request sets the basket cookie
- **WHEN** `GET /api/basket` is requested through `createApp({ catalog, basketStore }).request()` with no
  `Cookie` header, the store pointing at `baskets.json` in an empty temp directory
- **THEN** the status is 200 and the body is `{ id: <id>, items: [], totals: { count: 0, sum: 0 } }` where
  `<id>` matches `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`
- **AND** the response header `Set-Cookie` equals
  `basket_id=<id>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax` with the same `<id>` as the body

#### Scenario: Request with the cookie reuses the basket
- **WHEN** `POST /api/basket/items` with header `Cookie: basket_id=0f3c9d6e-7a1b-4c2d-9e8f-123456789abc` and
  JSON body `{ "productId": "karashynyard:1498486363994", "quantity": 2 }` is requested, and then
  `GET /api/basket` with the same `Cookie` header
- **THEN** the GET answers 200 with `id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc"`, `items.length` 1,
  `items[0].productId` `"karashynyard:1498486363994"`, `items[0].quantity` 2 and
  `totals: { count: 2, sum: 1330 }`
- **AND** neither response has a `Set-Cookie` header

#### Scenario: Malformed cookie gets a fresh basket
- **WHEN** `GET /api/basket` is requested with header `Cookie: basket_id=not-a-uuid`
- **THEN** the status is 200, the body `id` is not `"not-a-uuid"` and matches the UUID pattern above, and
  `items` is `[]`
- **AND** the response header `Set-Cookie` equals
  `basket_id=<that id>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`

### Requirement: Basket contents and totals
`GET /api/basket` SHALL answer 200 with `{ id, items, totals }`: `items` holds one line per product in the
order the lines were added, each `{ productId, quantity, product }` where `product` is the catalog's current
`Product` for that id (`catalog.findProduct`) or `null` when the catalog no longer serves it; `totals.count`
is the sum of `quantity` over lines with a product, `totals.sum` the sum of `price × quantity` over the same
lines (UAH number, rounded to 2 decimal places — kopiykas — so a non-integer price never leaks binary float noise
into the response; integer prices stay integers). Lines with `product: null` add 0 to both.

#### Scenario: Totals add up the lines
- **WHEN** with `Cookie: basket_id=0f3c9d6e-7a1b-4c2d-9e8f-123456789abc`, `POST /api/basket/items`
  `{ "productId": "karashynyard:1498486363994", "quantity": 2 }`, then `POST /api/basket/items`
  `{ "productId": "osio:6abcf192b7db2532803d266d", "quantity": 1 }`, then `GET /api/basket` are requested
  on an app whose fake catalog's `findProduct` knows the 20 products of `data/shops/*.json`
- **THEN** the GET body is
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [ { productId: "karashynyard:1498486363994", quantity: 2, product: <the full karashynyard:1498486363994 Product: "Філе індички, 1 кг", price 665> }, { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: <the full osio:6abcf192b7db2532803d266d Product: "Капуста кольрабі, органічна осіння", price 195> } ], totals: { count: 3, sum: 1525 } }`

#### Scenario: Unavailable product counts zero
- **WHEN** the store file already holds basket `6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f` with lines
  `[ { productId: "karashynyard:1498486363994", quantity: 2, addedAt: "2026-10-04T10:00:00.000Z" }, { productId: "osio:000000000000000000000000", quantity: 1, addedAt: "2026-10-04T10:01:00.000Z" } ]`
  (written through the store before the request) and `GET /api/basket` is requested with
  `Cookie: basket_id=6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f`
- **THEN** the status is 200, `items[0]` is
  `{ productId: "karashynyard:1498486363994", quantity: 2, product: <full Product, price 665> }`, `items[1]`
  is `{ productId: "osio:000000000000000000000000", quantity: 1, product: null }` and `totals` is
  `{ count: 2, sum: 1330 }`

#### Scenario: Non-integer price sums without float noise
- **WHEN** the fake catalog also serves a product `test:fraction` with `price: 1.1`, a basket holds that line with
  `quantity: 3`, and `GET /api/basket` is requested
- **THEN** `totals` equals `{ count: 3, sum: 3.3 }` (raw `1.1 * 3` is `3.3000000000000003`)

### Requirement: Add a product to the basket
`POST /api/basket/items` with body `{ productId, quantity? }` (`quantity` an integer 1..99, default 1) SHALL
add a line for the product when `catalog.findProduct(productId)` returns it and answer 201 with the basket;
when the line already exists the quantities are added and capped at 99. When the catalog does not know the
product it SHALL answer 404 `{ error: "Product not found" }` and leave the basket unchanged.

#### Scenario: Add a product with an explicit quantity
- **WHEN** `POST /api/basket/items` with `Cookie: basket_id=0f3c9d6e-7a1b-4c2d-9e8f-123456789abc` and body
  `{ "productId": "karashynyard:1498486363994", "quantity": 2 }` is requested on an empty basket
- **THEN** the status is 201 and the body is
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [ { productId: "karashynyard:1498486363994", quantity: 2, product: <full Product: name "Філе індички, 1 кг", price 665, unit "1 кг", imageUrl "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg"> } ], totals: { count: 2, sum: 1330 } }`

#### Scenario: Add without a quantity defaults to one
- **WHEN** `POST /api/basket/items` with body `{ "productId": "osio:6abcf192b7db2532803d266d" }` is
  requested on an empty basket
- **THEN** the status is 201, `items` is
  `[ { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: <full Product, price 195> } ]` and
  `totals` is `{ count: 1, sum: 195 }`

#### Scenario: Adding an existing line merges and caps at 99
- **WHEN** `POST /api/basket/items` `{ "productId": "karashynyard:1498486363994", "quantity": 2 }` is
  requested, then again with `{ "productId": "karashynyard:1498486363994", "quantity": 98 }`, both with
  `Cookie: basket_id=0f3c9d6e-7a1b-4c2d-9e8f-123456789abc`
- **THEN** the second response has status 201, `items.length` 1, `items[0].quantity` 99 and
  `totals: { count: 99, sum: 65835 }`
- **WHEN** a third `POST /api/basket/items` `{ "productId": "karashynyard:1498486363994", "quantity": 1 }`
  follows with the same cookie
- **THEN** the status is 201, `items[0].quantity` is still 99 and `totals.sum` is 65835

#### Scenario: Unknown product is rejected
- **WHEN** `POST /api/basket/items` with `Cookie: basket_id=0f3c9d6e-7a1b-4c2d-9e8f-123456789abc` and body
  `{ "productId": "osio:000000000000000000000000", "quantity": 1 }` is requested on an empty basket
- **THEN** the status is 404 and the body is `{ error: "Product not found" }`
- **AND** a following `GET /api/basket` with the same cookie answers `items: []` and
  `totals: { count: 0, sum: 0 }`

### Requirement: Change the quantity of a line
`PATCH /api/basket/items/:productId` with body `{ quantity }` (integer 1..99) SHALL set that line's quantity
and answer 200 with the basket; when the basket has no line for `productId` it SHALL answer 404
`{ error: "Basket item not found" }`.

The existence check and the write SHALL happen inside one store update (one queued operation), so a concurrent
clear or remove cannot slip between them.

#### Scenario: Change the quantity
- **WHEN** after `POST /api/basket/items` `{ "productId": "karashynyard:1498486363994", "quantity": 2 }`,
  `PATCH /api/basket/items/karashynyard:1498486363994` with body `{ "quantity": 5 }` is requested with the
  same `Cookie: basket_id=0f3c9d6e-7a1b-4c2d-9e8f-123456789abc`
- **THEN** the status is 200, `items` is
  `[ { productId: "karashynyard:1498486363994", quantity: 5, product: <full Product, price 665> } ]` and
  `totals` is `{ count: 5, sum: 3325 }`

#### Scenario: Change a line that does not exist
- **WHEN** `PATCH /api/basket/items/osio:6abcf192b7db2532803d266d` with body `{ "quantity": 1 }` is
  requested on an empty basket
- **THEN** the status is 404 and the body is `{ error: "Basket item not found" }`

#### Scenario: Clear and change the quantity race
- **WHEN** a basket holds the line `karashynyard:1498486363994` with `quantity: 2`, and `DELETE /api/basket` and
  `PATCH /api/basket/items/karashynyard:1498486363994` with body `{ quantity: 3 }` are sent concurrently with
  `Promise.all` (the DELETE issued first) using the same cookie
- **THEN** the DELETE answers 200 with `items: []`, the PATCH answers 404 `{ error: "Basket item not found" }`, and a
  following `GET /api/basket` has `items: []` and `totals: { count: 0, sum: 0 }`

### Requirement: Remove a line
`DELETE /api/basket/items/:productId` SHALL remove that line and answer 200 with the basket; when the basket
has no line for `productId` it SHALL answer 404 `{ error: "Basket item not found" }`.

#### Scenario: Remove a line
- **WHEN** after `POST` of `{ "productId": "karashynyard:1498486363994", "quantity": 2 }` and
  `{ "productId": "osio:6abcf192b7db2532803d266d", "quantity": 1 }` (totals count 3, sum 1525),
  `DELETE /api/basket/items/karashynyard:1498486363994` is requested with the same cookie
- **THEN** the status is 200, `items` is
  `[ { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: <full Product, price 195> } ]` and
  `totals` is `{ count: 1, sum: 195 }`

#### Scenario: Remove a line that does not exist
- **WHEN** `DELETE /api/basket/items/karashynyard:1743423686258` is requested on an empty basket
- **THEN** the status is 404 and the body is `{ error: "Basket item not found" }`

### Requirement: Clear the basket
`DELETE /api/basket` SHALL remove every line and answer 200 with the emptied basket
`{ id, items: [], totals: { count: 0, sum: 0 } }`.

#### Scenario: Clear a basket with lines
- **WHEN** after `POST` of `{ "productId": "karashynyard:1498486363994", "quantity": 2 }` and
  `{ "productId": "osio:69e5236361852dec4059d4e8", "quantity": 1 }` (totals count 3, sum 1545),
  `DELETE /api/basket` is requested with `Cookie: basket_id=0f3c9d6e-7a1b-4c2d-9e8f-123456789abc`
- **THEN** the status is 200 and the body is
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [], totals: { count: 0, sum: 0 } }`
- **AND** a following `GET /api/basket` with the same cookie answers the same body

### Requirement: Invalid input is rejected
Request bodies and the `:productId` parameter SHALL be validated with the shared zod schemas before any
lookup: a body that is not JSON, lacks a required field, has a `productId` that is not
`<shopKey>:<sourceId>` (shop key `karashynyard` or `osio`), or a `quantity` that is not an integer in 1..99
answers 400 `{ error: "Invalid request body" }`; a `:productId` parameter that is not `<shopKey>:<sourceId>`
answers 400 `{ error: "Invalid product id" }`. A 400 SHALL NOT change the basket.

#### Scenario: Invalid body
- **WHEN** `POST /api/basket/items` with body `{ "productId": "karashynyard:1498486363994", "quantity": 0 }`
  is requested
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }`
- **WHEN** `POST /api/basket/items` with body
  `{ "productId": "karashynyard:1498486363994", "quantity": 100 }` is requested
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }`
- **WHEN** `POST /api/basket/items` with body `{ "quantity": 1 }` is requested
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }`
- **WHEN** `POST /api/basket/items` with body `{ "productId": "not-a-product" }` is requested
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }`
- **WHEN** after `POST /api/basket/items` `{ "productId": "karashynyard:1498486363994", "quantity": 2 }`
  with `Cookie: basket_id=0f3c9d6e-7a1b-4c2d-9e8f-123456789abc`,
  `PATCH /api/basket/items/karashynyard:1498486363994` with body `{ "quantity": 1.5 }` is requested with the
  same cookie
- **THEN** the status is 400, the body is `{ error: "Invalid request body" }`, and `GET /api/basket` with
  the same cookie still answers `items[0].quantity` 2

#### Scenario: Invalid product id in the path
- **WHEN** `PATCH /api/basket/items/not-a-product` with body `{ "quantity": 1 }` is requested
- **THEN** the status is 400 and the body is `{ error: "Invalid product id" }`
- **WHEN** `DELETE /api/basket/items/not-a-product` is requested
- **THEN** the status is 400 and the body is `{ error: "Invalid product id" }`

### Requirement: Baskets persist in a JSON file
Baskets SHALL be stored in one JSON file whose path the store receives as a constructor value
(`<dataDir>/baskets.json` in production), shaped
`{ baskets: { <id>: { updatedAt: <ISO>, items: [ { productId, quantity, addedAt: <ISO> } ] } } }`. A missing
file SHALL read as no baskets and SHALL NOT be created by a read. Every write SHALL replace the file
atomically — written to a temporary file in the same directory, then renamed over `baskets.json` — and keep
the other baskets.

A record that fails validation SHALL be skipped (and reported on stderr) instead of failing the whole file, so one
corrupt basket never takes down the others.

#### Scenario: Missing file means no baskets
- **WHEN** a store is created on `<tmp>/baskets.json`, `<tmp>` being a fresh empty temp directory, and
  `get("0f3c9d6e-7a1b-4c2d-9e8f-123456789abc")` is awaited
- **THEN** it resolves to `undefined` and the directory listing of `<tmp>` is `[]` (no file was created)

#### Scenario: Reads a basket from an existing file
- **WHEN** `<tmp>/baskets.json` contains
  `{"baskets":{"0f3c9d6e-7a1b-4c2d-9e8f-123456789abc":{"updatedAt":"2026-10-04T10:00:00.000Z","items":[{"productId":"karashynyard:1498486363994","quantity":2,"addedAt":"2026-10-04T10:00:00.000Z"}]}}}`
  and a store on that path awaits `get("0f3c9d6e-7a1b-4c2d-9e8f-123456789abc")`
- **THEN** it resolves to
  `{ updatedAt: "2026-10-04T10:00:00.000Z", items: [ { productId: "karashynyard:1498486363994", quantity: 2, addedAt: "2026-10-04T10:00:00.000Z" } ] }`

#### Scenario: Update writes the basket to the file
- **WHEN** on a store over an empty temp directory
  `update("0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", () => ({ updatedAt: "2026-10-04T10:00:00.000Z", items: [ { productId: "karashynyard:1498486363994", quantity: 2, addedAt: "2026-10-04T10:00:00.000Z" } ] }))`
  is awaited
- **THEN** it resolves to that basket, `JSON.parse(readFileSync("<tmp>/baskets.json", "utf8"))` deep-equals
  `{ baskets: { "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc": <that basket> } }` and
  `get("0f3c9d6e-7a1b-4c2d-9e8f-123456789abc")` resolves to the same basket

#### Scenario: Write is atomic and keeps other baskets
- **WHEN** `<tmp>/baskets.json` holds basket `0f3c9d6e-7a1b-4c2d-9e8f-123456789abc` (the file of the
  previous scenario) and
  `update("6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f", (current) => ({ updatedAt: "2026-10-04T10:05:00.000Z", items: [ ...(current?.items ?? []), { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, addedAt: "2026-10-04T10:05:00.000Z" } ] }))`
  is awaited
- **THEN** the callback received `current` = `undefined`, the directory listing of `<tmp>` is exactly
  `["baskets.json"]` (no temporary file left behind) and the file parses to two baskets:
  `0f3c9d6e-7a1b-4c2d-9e8f-123456789abc` unchanged and `6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f` with
  `updatedAt: "2026-10-04T10:05:00.000Z"` and the single osio line

#### Scenario: A corrupt record does not break other baskets
- **WHEN** `baskets.json` in a temp dir holds two baskets — `11111111-1111-4111-8111-111111111111` with one valid line
  `{ productId: "osio:6abcf192b7db2532803d266d", quantity: 1, addedAt: "2026-10-04T10:00:00.000Z" }` and
  `22222222-2222-4222-8222-222222222222` whose only line has `productId: "bad id"` — and the store reads both ids
- **THEN** the first id yields its one line and the second id yields an empty basket (no throw)

### Requirement: Data directory configuration
`AppConfig` SHALL carry `dataDir`: by default the repository's `.data` directory (resolved from
`apps/api/src/config.ts`, not from the working directory), overridable by `DATA_DIR`; `config.ts` stays the
only file that reads `process.env`. The server SHALL build the basket store on `<dataDir>/baskets.json`.

#### Scenario: Config reads DATA_DIR
- **WHEN** `loadConfig({})` is called
- **THEN** `dataDir` is an absolute path equal to
  `resolve(<directory of apps/api/src/config.ts>, "../../../.data")` — the repository's `.data`
- **WHEN** `loadConfig({ DATA_DIR: "/tmp/organic-baskets" })` is called
- **THEN** `dataDir` is `"/tmp/organic-baskets"`
- **WHEN** `loadConfig({ DATA_DIR: "" })` is called
- **THEN** it throws an `Error` with message `DATA_DIR must be a non-empty path` (like `SNAPSHOT_DIR`)
