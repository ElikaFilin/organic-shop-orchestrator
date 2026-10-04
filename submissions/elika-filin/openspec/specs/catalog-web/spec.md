# catalog-web Specification

## Purpose

The storefront's home page: shows every shop's products in Organic Catalog, grouped by shop with links back
to the source, and tells the buyer when the catalog is loading, has failed, or is served from a saved copy.

## Requirements

### Requirement: Catalog page lists products by shop
Route `/` SHALL render the heading "Organic Catalog" and, for each shop in the API response order, a section
headed by a link with the shop's name to the shop URL, containing a list (`<ul>`) with one card per product
of that shop: the image (`alt` = product name), the name, the unit, the price formatted `"<price> ₴"`, and a
link with visible text "У магазині" and accessible name `"У магазині: <name>"` (`aria-label`) to the product's
`productUrl`, so screen-reader users can tell the links apart. Ukrainian copy.

#### Scenario: Two shops with products
- **WHEN** `getProducts()` resolves with `{ source: "live", shops: [ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "live", count: 2 }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "live", count: 1 } ], products: [ <karashynyard:1498486363994 "Філе індички, 1 кг" 665 unit "1 кг">, <karashynyard:1651059869009 "Каре молочної телятини, 1 кг" 1410 unit "1 кг">, <osio:6abcf192b7db2532803d266d "Капуста кольрабі, органічна осіння" 195 unit "Качан 350-450 г"> ] }`
  (full objects as in `data/shops/*.json`) and route `/` is rendered
- **THEN** there is a level-1 heading "Organic Catalog"; a link named "Карашин Яр" with
  `href="https://karashynyard.com.ua/#rec638772397"`; a link named "OSIO organic" with
  `href="https://osio-organic.com.ua/"`; the list under "Карашин Яр" has 2 items and the list under
  "OSIO organic" has 1
- **AND** an image with `alt="Філе індички, 1 кг"` and
  `src="https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg"`; the texts "665 ₴",
  "1410 ₴", "195 ₴", "1 кг" and "Качан 350-450 г" are shown; the link named "У магазині: Філе індички, 1 кг" has
  `href="https://karashynyard.com.ua/#rec638772397"` and the link named "У магазині: Капуста кольрабі, органічна осіння" has
  `href="https://osio-organic.com.ua/products/6abcf192b7db2532803d266d"`
- **AND** no element with `role="status"` is rendered

### Requirement: Catalog page states
While `getProducts()` is pending the page SHALL render an element with `role="status"` showing
"Завантажуємо каталог…" and no product list; when it rejects the page SHALL render an element with
`role="status"` showing "Не вдалося завантажити каталог" and no product list. In the ready state a shop whose
`status` is `"snapshot-fallback"` SHALL show the note "Показано збережену копію" with `role="status"` inside its
section; shops with `status` `"live"` or `"snapshot"` (the chosen snapshot mode) SHALL show no note, so a
response in which every shop is `live` or `snapshot` renders no `role="status"` element at all. A shop section whose `status` is `"unavailable"` SHALL show the note
"Магазин тимчасово недоступний" with `role="status"` and no list; a section with `status` `"live"` or `"snapshot"` and zero
products SHALL show "Немає товарів" with `role="status"` and no list.

#### Scenario: Loading state
- **WHEN** `getProducts()` returns a promise that has not settled and route `/` is rendered
- **THEN** an element with `role="status"` shows "Завантажуємо каталог…" and no product list is rendered

#### Scenario: Error state
- **WHEN** `getProducts()` rejects with `new Error("GET /api/products failed: 503")` and route `/` is rendered
- **THEN** an element with `role="status"` shows "Не вдалося завантажити каталог" and no product list is rendered

#### Scenario: Snapshot fallback note per shop
- **WHEN** `getProducts()` resolves with the "Two shops with products" response, except `shops[0]` has
  `status: "snapshot-fallback"` and `error: "karashynyard: HTTP 503"`, and route `/` is rendered
- **THEN** the section "Карашин Яр" contains an element with `role="status"` showing
  "Показано збережену копію", the section "OSIO organic" contains no `role="status"` element, and all 3
  product cards are still rendered

#### Scenario: Chosen snapshot mode shows no note
- **WHEN** `getProducts()` resolves with the "Two shops with products" response, except `source: "snapshot"`
  and both shops have `status: "snapshot"`, and route `/` is rendered
- **THEN** no element with `role="status"` is rendered, and all 3 product cards are rendered (the list under
  "Карашин Яр" has 2 items, the list under "OSIO organic" has 1)

#### Scenario: Unavailable shop
- **WHEN** `getProducts()` resolves with `{ source: "live", shops: [ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "unavailable", error: "karashynyard: HTTP 503", count: 0 }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "live", count: 1 } ], products: [ <osio:6abcf192b7db2532803d266d "Капуста кольрабі, органічна осіння" 195> ] }`
  and route `/` is rendered
- **THEN** the section under "Карашин Яр" contains an element with `role="status"` and text "Магазин тимчасово недоступний"
  and no list, and the section under "OSIO organic" has a list with 1 item

#### Scenario: Shop with no products
- **WHEN** `getProducts()` resolves with `{ source: "snapshot", shops: [ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "snapshot", count: 0 }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", count: 1 } ], products: [ <osio:6abcf192b7db2532803d266d "Капуста кольрабі, органічна осіння" 195> ] }`
  and route `/` is rendered
- **THEN** the section under "Карашин Яр" contains an element with `role="status"` and text "Немає товарів" and no list

### Requirement: API client
All server calls SHALL go through `src/api/client.ts`: `getProducts()` requests `GET /api/products`,
validates the JSON body with the shared catalog response schema and returns it; a non-2xx answer rejects
with `Error("GET /api/products failed: <status>")`. Components never call `fetch` directly.

#### Scenario: Successful request
- **WHEN** global `fetch` answers `/api/products` with status 200 and the JSON body
  `{ source: "snapshot", shops: [ { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", count: 1 } ], products: [ <osio:6abcf192b7db2532803d266d, price 195, as in data/shops/osio.json> ] }`
- **THEN** `getProducts()` resolves with an object deep-equal to that body, and `fetch` was called once with
  `"/api/products"`

#### Scenario: Failed request
- **WHEN** global `fetch` answers `/api/products` with status 503
- **THEN** `getProducts()` rejects with an `Error` whose message is `GET /api/products failed: 503`
