# Spec Delta

## Purpose

Keeps the administrator's choices — which data source the catalog serves and which products of each shop the
storefront shows — in one JSON file, applies them to the catalog at once, and exposes them through the admin
endpoints: read and change the source, list every product with its visibility, toggle one product.

## ADDED Requirements

### Requirement: Settings file and defaults
The admin settings SHALL be the object
`{ dataSource: "live" | "snapshot", visibility: { karashynyard: string[] | null, osio: string[] | null } }`
(`null` = that shop's default, the first ten products in upstream order; an array = the product ids the
admin chose), persisted in one JSON file whose path the store receives as a constructor value together with
the defaults (`<dataDir>/admin-settings.json` in production; `dataSource` from config, both shops `null`).
A missing file SHALL read as the defaults and SHALL NOT be created by a read; a file that fails the schema
SHALL be an error, never silently replaced. Every write SHALL replace the file atomically (temporary file in
the same directory, then rename).

#### Scenario: Missing file reads as defaults
- **WHEN** a store is created on `<tmp>/admin-settings.json` (`<tmp>` a fresh empty temp directory) with the
  defaults `{ dataSource: "live", visibility: { karashynyard: null, osio: null } }` and `read()` is awaited
- **THEN** it resolves to `{ dataSource: "live", visibility: { karashynyard: null, osio: null } }` and the
  directory listing of `<tmp>` is `[]` (no file was created)

#### Scenario: Reads persisted settings
- **WHEN** `<tmp>/admin-settings.json` contains
  `{"dataSource":"snapshot","visibility":{"karashynyard":["karashynyard:1743423686258","karashynyard:1498486363994"],"osio":null}}`
  and a store on that path with the defaults above awaits `read()`
- **THEN** it resolves to
  `{ dataSource: "snapshot", visibility: { karashynyard: ["karashynyard:1743423686258", "karashynyard:1498486363994"], osio: null } }`

#### Scenario: Update writes atomically
- **WHEN** on a store over an empty temp directory with the defaults above
  `update((current) => ({ ...current, dataSource: "snapshot" }))` is awaited
- **THEN** the callback received `current` equal to the defaults, the call resolves to
  `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`, the directory listing of
  `<tmp>` is exactly `["admin-settings.json"]` (no temporary file left behind),
  `JSON.parse(readFileSync("<tmp>/admin-settings.json", "utf8"))` deep-equals that object, and a following
  `read()` resolves to the same object

#### Scenario: Invalid file content is an error
- **WHEN** `<tmp>/admin-settings.json` contains `{"dataSource":"foo"}` and a store on that path awaits
  `read()`
- **THEN** the promise rejects with an `Error` and the file is left unchanged (its text is still
  `{"dataSource":"foo"}`)

### Requirement: Persisted data source overrides the environment at startup
At startup the server SHALL read the settings store (defaults built from `config.dataSource`) and start the
catalog in the `dataSource` it returns: the persisted value when the file exists, `DATA_SOURCE` otherwise.
A settings file that cannot be read SHALL fail startup instead of silently serving the default.

#### Scenario: Persisted data source overrides DATA_SOURCE
- **WHEN** `<tmp>/admin-settings.json` contains
  `{"dataSource":"snapshot","visibility":{"karashynyard":null,"osio":null}}`, a store on that path is created
  with the defaults `{ dataSource: loadConfig({}).dataSource, visibility: { karashynyard: null, osio: null } }`
  (that is `"live"`), `settings = await store.read()`, a catalog with fake adapters is created with
  `source: settings.dataSource` and that store as its `settings`, and `GET /api/products` is requested
  through `app.request()`
- **THEN** `settings.dataSource` is `"snapshot"`, `catalog.getSource()` is `"snapshot"`, the response has
  `source: "snapshot"`, both shops `status: "snapshot"` with `count: 10`, and neither fake adapter was called
- **WHEN** the same store is created over an empty temp directory
- **THEN** `store.read()` resolves with `dataSource: "live"`

### Requirement: Read the settings
`GET /api/admin/settings` SHALL answer 200 with the current settings object exactly as the store reads it.

#### Scenario: Settings on a fresh install
- **WHEN** `GET /api/admin/settings` is requested with a valid session cookie on an app in `snapshot` mode
  whose settings store is on an empty temp directory with the defaults
  `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`
- **THEN** the status is 200 and the body is
  `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`

### Requirement: Change the data source
`PUT /api/admin/settings` with body `{ dataSource }` (`"live"` or `"snapshot"`, no other keys) SHALL
persist the value, switch the catalog to it before answering, and answer 200 with the settings object; the
next `GET /api/products` has `source` equal to the new value. Any other body — not JSON, missing or invalid
`dataSource`, extra keys — SHALL answer 400 `{ error: "Invalid request body" }` and change nothing.

#### Scenario: Switch to snapshot applies immediately
- **WHEN** on an app in `live` mode (fake adapters resolving their 10 snapshot products, settings store on an
  empty temp directory with defaults `{ dataSource: "live", visibility: { karashynyard: null, osio: null } }`),
  `PUT /api/admin/settings` with a valid session cookie and body `{ "dataSource": "snapshot" }` is requested,
  then `GET /api/products`
- **THEN** the PUT answers 200 with `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`;
  the GET answers `source: "snapshot"`, `shops[0]` equal to
  `{ key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "snapshot", count: 10 }`,
  `shops[1].status` `"snapshot"`, and neither fake adapter was called
- **AND** `JSON.parse(readFileSync("<tmp>/admin-settings.json", "utf8")).dataSource` is `"snapshot"` and
  `GET /api/admin/settings` with the cookie answers the same settings object

#### Scenario: Switch back to live
- **WHEN** after the previous scenario `PUT /api/admin/settings` with the cookie and body
  `{ "dataSource": "live" }` is requested, then `GET /api/products`
- **THEN** the PUT answers 200 with `{ dataSource: "live", visibility: { karashynyard: null, osio: null } }`,
  the GET answers `source: "live"` with `shops[0].status` `"live"` and `shops[1].status` `"live"`, `count: 10`
  each, and each fake adapter has been called exactly once

#### Scenario: Invalid settings body
- **WHEN** with a valid session cookie on the snapshot-mode app, `PUT /api/admin/settings` is requested with
  body `{ "dataSource": "foo" }`
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }`
- **WHEN** it is requested with body `{}`
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }`
- **WHEN** it is requested with body `{ "dataSource": "live", "visibility": { "karashynyard": [] } }`
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }` (only `dataSource` is
  accepted here)
- **WHEN** it is requested with the non-JSON body `not json`
- **THEN** the status is 400, the body is `{ error: "Invalid request body" }`, and `GET /api/admin/settings`
  still answers `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`

### Requirement: List every product with its visibility
`GET /api/admin/products` SHALL answer 200 with
`{ source, shops: [{ key, name, url, status, error?, total, visible }], products: [{ ...Product, visible }] }`:
`products` holds **every** product the catalog currently has for each shop, in upstream order, shops in
configured order — in `live` mode the full adapter result (or the full snapshot when the shop fell back), in
`snapshot` mode the full snapshot; `visible` is computed from the settings (`null` → the first ten `true`,
the rest `false`; an array → `true` when the id is in it); `total` is the length of the shop's full list and
`visible` the number of its products with `visible: true`; `status` and `error` are the catalog's.

#### Scenario: Live mode lists products beyond the first ten
- **WHEN** on an app in `live` mode with a valid session cookie, the fake karashynyard adapter returns
  `{ ok: true, products }` with its 10 snapshot products followed by sourceIds `1629901938947`
  ("Філе зі стегна індички, 1 кг", 665) and `1636965991022` ("Стегно індички, 1 кг", 595), the fake osio
  adapter returns its 10 snapshot products, the settings are the defaults, and `GET /api/admin/products` is
  requested
- **THEN** the status is 200, `source` is `"live"`, `shops` equals
  `[ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "live", total: 12, visible: 10 }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "live", total: 10, visible: 10 } ]`
  (no `error` keys), `products.length` is 22, `products[0]` equals the full `karashynyard:1498486363994`
  Product (price 665) plus `visible: true`, `products[9]` is `id: "karashynyard:1743423686258"`,
  `visible: true`, `products[10]` is `id: "karashynyard:1629901938947"`, `name: "Філе зі стегна індички, 1 кг"`,
  `price: 665`, `visible: false`, `products[11]` is `id: "karashynyard:1636965991022"`, `price: 595`,
  `visible: false`, `products[12]` is `id: "osio:6abcf192b7db2532803d266d"`, `visible: true` and
  `products[21]` is `id: "osio:69e5236361852dec4059d4e8"`, `visible: true`

#### Scenario: Snapshot mode with a visibility array
- **WHEN** on an app in `snapshot` mode whose settings file holds
  `{"dataSource":"snapshot","visibility":{"karashynyard":["karashynyard:1743423686258","karashynyard:1498486363994"],"osio":null}}`,
  `GET /api/admin/products` is requested with a valid session cookie
- **THEN** the status is 200, `source` is `"snapshot"`, `shops[0]` equals
  `{ key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "snapshot", total: 10, visible: 2 }`,
  `shops[1]` equals
  `{ key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", total: 10, visible: 10 }`,
  `products.length` is 20, `products[0]` is `id: "karashynyard:1498486363994"`, `visible: true`,
  `products[1]` is `id: "karashynyard:1628604400123"`, `visible: false`, `products[9]` is
  `id: "karashynyard:1743423686258"`, `visible: true`, and `products[10]` is
  `id: "osio:6abcf192b7db2532803d266d"`, `visible: true`

#### Scenario: Fallback shop lists its snapshot
- **WHEN** on an app in `live` mode the fake karashynyard adapter returns
  `{ ok: false, error: "karashynyard: HTTP 503" }`, the fake osio adapter returns its 10 snapshot products,
  and `GET /api/admin/products` is requested with a valid session cookie
- **THEN** the status is 200, `shops[0]` equals
  `{ key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "snapshot-fallback", error: "karashynyard: HTTP 503", total: 10, visible: 10 }`,
  `shops[1].status` is `"live"`, `products.length` is 20 and `products[0]` is
  `id: "karashynyard:1498486363994"`, `visible: true`

#### Scenario: Unavailable shop lists nothing
- **WHEN** on an app in `live` mode over an empty temporary snapshot directory, the fake karashynyard adapter
  returns `{ ok: false, error: "karashynyard: HTTP 503" }`, the fake osio adapter returns its 10 snapshot
  products, and `GET /api/admin/products` is requested with a valid session cookie
- **THEN** the status is 200, `shops[0]` equals
  `{ key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "unavailable", error: "karashynyard: HTTP 503", total: 0, visible: 0 }`,
  `products.length` is 10 and `products[0]` is `id: "osio:6abcf192b7db2532803d266d"`, `visible: true`

### Requirement: Toggle a product's visibility
`PUT /api/admin/products/:id/visibility` with body `{ visible: boolean }` SHALL find the product in its
shop's full list; on the first toggle for that shop the shop's `visibility` array is created from the current
default (the ids of the first ten products of the full list, in upstream order), then the id is appended
(`true`, unless already present) or removed (`false`); the settings are persisted and the catalog serves the
change on the next request. It answers 200 `{ id, visible, visibility }` with the shop's array after the
change; 404 `{ error: "Product not found" }` when the id is in no shop's full list (nothing is written); 400
`{ error: "Invalid product id" }` when `:id` is not `<shopKey>:<sourceId>`; 400
`{ error: "Invalid request body" }` when the body is not JSON or `visible` is not a boolean.

#### Scenario: Hide a visible product
- **WHEN** on an app in `snapshot` mode with the default settings and a valid session cookie,
  `PUT /api/admin/products/karashynyard:1498486363994/visibility` with body `{ "visible": false }` is
  requested, then `GET /api/products`
- **THEN** the PUT answers 200 with
  `{ id: "karashynyard:1498486363994", visible: false, visibility: ["karashynyard:1628604400123", "karashynyard:1781040705497", "karashynyard:1652947963962", "karashynyard:1651059869009", "karashynyard:1766158125517", "karashynyard:1695632413443", "karashynyard:1648566839990", "karashynyard:1685968207499", "karashynyard:1743423686258"] }`;
  the GET answers `shops[0].count` 9, `shops[1].count` 10, `products.length` 19, `products[0].id`
  `"karashynyard:1628604400123"` and no product with id `"karashynyard:1498486363994"`
- **AND** `JSON.parse(readFileSync("<tmp>/admin-settings.json", "utf8")).visibility` equals
  `{ karashynyard: <that 9-element array>, osio: null }`
- **WHEN** the same PUT is repeated with the same body
- **THEN** it answers 200 with the same body (the toggle is idempotent)

#### Scenario: Show a product beyond the first ten
- **WHEN** on an app in `live` mode whose fake karashynyard adapter returns its 10 snapshot products followed
  by sourceIds `1629901938947` and `1636965991022` (as in "Live mode lists products beyond the first ten"),
  with the default settings and a valid session cookie,
  `PUT /api/admin/products/karashynyard:1636965991022/visibility` with body `{ "visible": true }` is
  requested, then `GET /api/products`
- **THEN** the PUT answers 200 with
  `{ id: "karashynyard:1636965991022", visible: true, visibility: ["karashynyard:1498486363994", "karashynyard:1628604400123", "karashynyard:1781040705497", "karashynyard:1652947963962", "karashynyard:1651059869009", "karashynyard:1766158125517", "karashynyard:1695632413443", "karashynyard:1648566839990", "karashynyard:1685968207499", "karashynyard:1743423686258", "karashynyard:1636965991022"] }`;
  the GET answers `shops[0].count` 11, `products.length` 21, `products[10]` is
  `id: "karashynyard:1636965991022"`, `name: "Стегно індички, 1 кг"`, `price: 595`, and `products[11].id` is
  `"osio:6abcf192b7db2532803d266d"`
- **AND** no served product has `sourceId` `"1629901938947"`

#### Scenario: Unknown product
- **WHEN** on the snapshot-mode app with the default settings and a valid session cookie,
  `PUT /api/admin/products/osio:000000000000000000000000/visibility` with body `{ "visible": true }` is
  requested
- **THEN** the status is 404, the body is `{ error: "Product not found" }`, and `GET /api/admin/settings`
  still answers `visibility: { karashynyard: null, osio: null }`

#### Scenario: Malformed id or body
- **WHEN** with a valid session cookie `PUT /api/admin/products/not-a-product/visibility` with body
  `{ "visible": true }` is requested
- **THEN** the status is 400 and the body is `{ error: "Invalid product id" }`
- **WHEN** `PUT /api/admin/products/karashynyard:1498486363994/visibility` with body `{ "visible": "yes" }`
  is requested
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }`
- **WHEN** `PUT /api/admin/products/karashynyard:1498486363994/visibility` with the non-JSON body `not json`
  is requested
- **THEN** the status is 400, the body is `{ error: "Invalid request body" }` and `GET /api/admin/settings`
  still answers `visibility: { karashynyard: null, osio: null }`
