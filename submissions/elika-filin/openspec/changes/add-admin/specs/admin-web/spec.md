# Spec Delta

## Purpose

The administrator's page at `/admin`: a token login form and, once signed in, a panel to switch the catalog
between live and snapshot data and to tick which products of each shop the storefront shows — every call
going through the shared API client.

## ADDED Requirements

### Requirement: Admin page resolves the session first
Route `/admin` SHALL call `getAdminSession()` once on mount and, while it or the panel's data is pending,
render an element with `role="status"` showing "Завантажуємо…" and nothing else. `{ authenticated: false }`
renders the login form; `{ authenticated: true }` loads `getAdminSettings()` and `getAdminProducts()` and
renders the panel. Neither panel call is made for an unauthenticated visitor.

#### Scenario: Loading state
- **WHEN** `getAdminSession()` returns a promise that never settles (`new Promise(() => {})`), `getBasket()`
  resolves with the empty basket
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [], totals: { count: 0, sum: 0 } }`, and route
  `/admin` is rendered
- **THEN** an element with `role="status"` shows "Завантажуємо…"; no heading "Вхід для адміністратора", no
  heading "Адмін-панель", no button "Увійти", no checkbox and no element with `role="alert"` is rendered;
  `getAdminSession` was called once and `getAdminSettings` and `getAdminProducts` were not called

#### Scenario: Not authenticated shows the login form
- **WHEN** `getAdminSession()` resolves with `{ authenticated: false }`, `getBasket()` resolves with the empty
  basket `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [], totals: { count: 0, sum: 0 } }`, and
  route `/admin` is rendered
- **THEN** a level-2 heading "Вхід для адміністратора" is shown; a password input (`type="password"`) is
  labelled "Токен адміністратора"; a button "Увійти" is shown; no heading "Адмін-панель", no checkbox and no
  element with `role="alert"` is rendered; `getAdminSettings` and `getAdminProducts` were not called
- **AND** the header still shows the link "Адмін" with `href="/admin"`

#### Scenario: Authenticated shows the panel
- **WHEN** `getAdminSession()` resolves with `{ authenticated: true }`, `getAdminSettings()` resolves with
  `{ dataSource: "live", visibility: { karashynyard: null, osio: null } }`, `getAdminProducts()` resolves
  with the "four-product admin response"
  `{ source: "live", shops: [ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "live", total: 3, visible: 2 }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot-fallback", error: "osio: HTTP 502", total: 1, visible: 1 } ], products: [ { ...<karashynyard:1498486363994 "Філе індички, 1 кг" 665>, visible: true }, { ...<karashynyard:1651059869009 "Каре молочної телятини, 1 кг" 1410>, visible: true }, { ...<karashynyard:1743423686258 "Гречаний чай з жасмином 100 г (99 чашок)" 480>, visible: false }, { ...<osio:6abcf192b7db2532803d266d "Капуста кольрабі, органічна осіння" 195>, visible: true } ] }`
  (full objects as in `data/shops/*.json`), and route `/admin` is rendered
- **THEN** a level-2 heading "Адмін-панель" is shown; a group named "Джерело даних" contains a radio
  "Наживо" that is checked and a radio "Знімок" that is not; a region named "Карашин Яр" contains the text
  "наживо", the text "Видимих: 2" and a list with 3 items holding the checkboxes "Філе індички, 1 кг"
  (checked), "Каре молочної телятини, 1 кг" (checked) and "Гречаний чай з жасмином 100 г (99 чашок)" (not
  checked); a region named "OSIO organic" contains the text "збережена копія", the text "Видимих: 1" and one
  checkbox "Капуста кольрабі, органічна осіння" (checked); a button "Вийти" is shown; no heading
  "Вхід для адміністратора" and no `role="status"` or `role="alert"` element is rendered
- **AND** `getAdminSession`, `getAdminSettings` and `getAdminProducts` were each called exactly once

### Requirement: Login form
Submitting the login form SHALL call `adminLogin(token)` with the input's value. On success the page loads
and renders the panel as for an authenticated visitor. On a rejection whose `status` is 401 the form stays
and shows "Невірний токен" in an element with `role="alert"`; `status` 503 shows "Адмінку не налаштовано"
the same way; any other failure (a rejection with another `status` or none) shows "Не вдалося увійти". A
submit removes the previous alert before `adminLogin` is called, so an alert never outlives the attempt that
raised it.

#### Scenario: Wrong token
- **WHEN** `getAdminSession()` resolves with `{ authenticated: false }`, `adminLogin` rejects with
  `Object.assign(new Error("POST /api/admin/login failed: 401"), { status: 401 })`, route `/admin` is
  rendered, the user types `wrong-token` into "Токен адміністратора" and clicks "Увійти"
- **THEN** `adminLogin` was called once with `"wrong-token"`; an element with `role="alert"` shows
  "Невірний токен"; the heading "Вхід для адміністратора" is still shown; `getAdminSettings` was not called

#### Scenario: Admin not configured
- **WHEN** the same page is rendered with `adminLogin` rejecting with
  `Object.assign(new Error("POST /api/admin/login failed: 503"), { status: 503 })`, the user types
  `secret-token` and clicks "Увійти"
- **THEN** `adminLogin` was called once with `"secret-token"` and an element with `role="alert"` shows
  "Адмінку не налаштовано"; the login form is still shown

#### Scenario: Login failure other than 401/503 and alert reset
- **WHEN** `getAdminSession()` resolves with `{ authenticated: false }`, `adminLogin` rejects on its first call
  with `Object.assign(new Error("POST /api/admin/login failed: 500"), { status: 500 })` and resolves with
  `undefined` on its second call, `getAdminSettings()` resolves with
  `{ dataSource: "live", visibility: { karashynyard: null, osio: null } }`, `getAdminProducts()` resolves
  with the four-product admin response, route `/admin` is rendered, the user types `secret-token` into
  "Токен адміністратора" and clicks "Увійти"
- **THEN** `adminLogin` was called once with `"secret-token"`; an element with `role="alert"` shows
  "Не вдалося увійти"; the heading "Вхід для адміністратора" is still shown; `getAdminSettings` and
  `getAdminProducts` were not called
- **WHEN** the user clicks "Увійти" again
- **THEN** `adminLogin` was called twice, each time with `"secret-token"`; a level-2 heading "Адмін-панель" is
  shown; no element with `role="alert"` is rendered; `getAdminSettings` and `getAdminProducts` were each
  called once

#### Scenario: Successful login opens the panel
- **WHEN** `getAdminSession()` resolves with `{ authenticated: false }`, `adminLogin` resolves with
  `undefined`, `getAdminSettings()` resolves with
  `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`, `getAdminProducts()` resolves
  with the four-product admin response except `source: "snapshot"` and both shops `status: "snapshot"` (no
  `error`), route `/admin` is rendered, the user types `secret-token` into "Токен адміністратора" and clicks
  "Увійти"
- **THEN** `adminLogin` was called once with `"secret-token"`; a level-2 heading "Адмін-панель" is shown; the
  radio "Знімок" is checked and "Наживо" is not; the region "Карашин Яр" contains the text "знімок"; no
  `role="alert"` element is rendered; `getAdminSettings` and `getAdminProducts` were each called once

### Requirement: Data source switch
The panel SHALL render a fieldset whose legend is "Джерело даних" with two radios, "Наживо" (`value="live"`)
and "Знімок" (`value="snapshot"`), the one matching `settings.dataSource` checked. Selecting the other SHALL
call `updateSettings({ dataSource })`, re-render the radios from the returned settings, show "Збережено" in
an element with `role="status"`, and reload the product sections with a second `getAdminProducts()` (the live
and snapshot lists differ). A rejection shows "Не вдалося зберегти" with `role="alert"` and leaves the radios
as they were.

#### Scenario: Radio switches the data source
- **WHEN** the panel is rendered as in "Authenticated shows the panel" (`dataSource: "live"`),
  `updateSettings` resolves with `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`,
  `getAdminProducts` resolves with the four-product admin response on its first call and, on its second
  call, with the same response except `source: "snapshot"` and both shops `status: "snapshot"` (no `error`),
  and the user clicks the radio "Знімок"
- **THEN** `updateSettings` was called once with `{ dataSource: "snapshot" }`; the radio "Знімок" is checked
  and "Наживо" is not; an element with `role="status"` shows "Збережено"; `getAdminProducts` was called
  twice; the region "Карашин Яр" shows the text "знімок" and the region "OSIO organic" shows the text
  "знімок" and no longer "збережена копія"

#### Scenario: Source switch failure keeps the radio
- **WHEN** the panel is rendered as in "Authenticated shows the panel" (`dataSource: "live"`),
  `updateSettings` rejects with `Object.assign(new Error("PUT /api/admin/settings failed: 500"), { status: 500 })`,
  and the user clicks the radio "Знімок"
- **THEN** `updateSettings` was called once with `{ dataSource: "snapshot" }`; an element with `role="alert"`
  shows "Не вдалося зберегти"; the radio "Наживо" is still checked and "Знімок" is not; no element with
  `role="status"` is rendered; `getAdminProducts` was called once in total (no reload); the region
  "Карашин Яр" still shows the text "наживо"

### Requirement: Product visibility checkboxes
For each shop in response order the panel SHALL render a section (`<section aria-labelledby>`) with a
level-3 heading = the shop name, a status note — "наживо" for `live`, "знімок" for `snapshot`,
"збережена копія" for `snapshot-fallback`, "недоступний" for `unavailable` — the text "Видимих: N" where N
is the number of the shop's products currently ticked, and, when the shop has products, a list (`<ul>`) with
one item per product holding a checkbox labelled with the product name, checked when `visible`; a shop with
no products renders no list. Changing a checkbox SHALL call `setProductVisibility(id, checked)` and, when it
resolves, set the checkbox to the returned `visible` and recount "Видимих: N"; a rejection shows
"Не вдалося зберегти" with `role="alert"` and leaves the checkbox unchanged.

#### Scenario: Unticking hides a product
- **WHEN** the panel is rendered as in "Authenticated shows the panel", `setProductVisibility` resolves with
  `{ id: "karashynyard:1498486363994", visible: false, visibility: ["karashynyard:1651059869009"] }`, and
  the user clicks the checkbox "Філе індички, 1 кг"
- **THEN** `setProductVisibility` was called once with `("karashynyard:1498486363994", false)`; that
  checkbox is not checked; the region "Карашин Яр" shows "Видимих: 1"; the region "OSIO organic" still shows
  "Видимих: 1"; no `role="alert"` element is rendered

#### Scenario: Ticking shows a product
- **WHEN** the panel is rendered as in "Authenticated shows the panel", `setProductVisibility` resolves with
  `{ id: "karashynyard:1743423686258", visible: true, visibility: ["karashynyard:1498486363994", "karashynyard:1651059869009", "karashynyard:1743423686258"] }`,
  and the user clicks the checkbox "Гречаний чай з жасмином 100 г (99 чашок)"
- **THEN** `setProductVisibility` was called once with `("karashynyard:1743423686258", true)`; that checkbox
  is checked; the region "Карашин Яр" shows "Видимих: 3"

#### Scenario: Save failure keeps the checkbox
- **WHEN** the panel is rendered as in "Authenticated shows the panel", `setProductVisibility` rejects with
  `Object.assign(new Error("PUT /api/admin/products/karashynyard:1498486363994/visibility failed: 500"), { status: 500 })`,
  and the user clicks the checkbox "Філе індички, 1 кг"
- **THEN** `setProductVisibility` was called once with `("karashynyard:1498486363994", false)`; an element
  with `role="alert"` shows "Не вдалося зберегти"; the checkbox "Філе індички, 1 кг" is still checked; the
  region "Карашин Яр" still shows "Видимих: 2" and the region "OSIO organic" still shows "Видимих: 1"; no
  element with `role="status"` is rendered

#### Scenario: Status notes per shop
- **WHEN** `getAdminSession()` resolves with `{ authenticated: true }`, `getAdminSettings()` resolves with
  `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`, `getAdminProducts()` resolves
  with
  `{ source: "snapshot", shops: [ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "snapshot", total: 1, visible: 1 }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "unavailable", error: "osio: HTTP 503", total: 0, visible: 0 } ], products: [ { ...<karashynyard:1498486363994 "Філе індички, 1 кг" 665>, visible: true } ] }`
  and route `/admin` is rendered
- **THEN** the region "Карашин Яр" contains the text "знімок", the text "Видимих: 1" and a list with 1 item;
  the region "OSIO organic" contains the text "недоступний", the text "Видимих: 0" and no list

### Requirement: Logout
Clicking "Вийти" SHALL call `adminLogout()` and, when it resolves, render the login form (heading
"Вхід для адміністратора") in place of the panel without a second `getAdminSession()` call.

#### Scenario: Logout returns to the login form
- **WHEN** the panel is rendered as in "Authenticated shows the panel", `adminLogout` resolves with
  `undefined`, and the user clicks "Вийти"
- **THEN** `adminLogout` was called once; the heading "Вхід для адміністратора" is shown; no heading
  "Адмін-панель", no button "Вийти" and no checkbox is rendered; `getAdminSession` was called once in total

### Requirement: Admin functions of the API client
`src/api/client.ts` SHALL export `getAdminSession()` (`GET /api/admin/session`), `adminLogin(token)`
(`POST /api/admin/login`, body `{ token }`, resolves `undefined` on 204), `adminLogout()`
(`POST /api/admin/logout`, resolves `undefined`), `getAdminSettings()` (`GET /api/admin/settings`),
`updateSettings({ dataSource })` (`PUT /api/admin/settings`, body `{ dataSource }`), `getAdminProducts()`
(`GET /api/admin/products`) and `setProductVisibility(id, visible)`
(`PUT /api/admin/products/<id>/visibility`, body `{ visible }`). The `id` in that path SHALL be
percent-encoded by the same rule as the basket item paths of `add-basket`'s "Basket functions of the API
client": `encodeURIComponent` except the `:` between shop key and source id, which stays literal
(`ProductIdSchema` permits `#`, `?` and `%`, which would otherwise truncate or corrupt the path). Each
function goes through the same request helper as the basket functions: `fetch` with
`credentials: "same-origin"`, a JSON `Content-Type` header only when a body is sent, a 2xx JSON body
validated with the shared schema; a non-2xx answer rejects with an `Error` whose message is
`<METHOD> <path> failed: <status>` and whose `status` property is the HTTP status, so the page can tell 401
from 503. Components never call `fetch`.

#### Scenario: Admin requests send method, path and body
- **WHEN** global `fetch` answers with status 200 and the JSON body `{ authenticated: true }`
- **THEN** `getAdminSession()` resolves with `{ authenticated: true }` and `fetch` was called with
  `"/api/admin/session"` and an init whose `credentials` is `"same-origin"`
- **WHEN** global `fetch` answers with status 204 and an empty body
- **THEN** `adminLogin("secret-token")` resolves with `undefined` and `fetch` was called with
  `"/api/admin/login"` and an init whose `method` is `"POST"`, `credentials` is `"same-origin"`, `headers`
  include `"Content-Type": "application/json"` and `body` is `'{"token":"secret-token"}'`
- **WHEN** global `fetch` answers with status 204 and an empty body
- **THEN** `adminLogout()` resolves with `undefined` and `fetch` was called with `"/api/admin/logout"` and an
  init whose `method` is `"POST"` and `body` is `undefined`
- **WHEN** global `fetch` answers with status 200 and the body
  `{ dataSource: "live", visibility: { karashynyard: null, osio: null } }`
- **THEN** `getAdminSettings()` resolves with an object deep-equal to that body and `fetch` was called with
  `"/api/admin/settings"` and an init whose `method` is `"GET"`
- **WHEN** global `fetch` answers with status 200 and the body
  `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`
- **THEN** `updateSettings({ dataSource: "snapshot" })` resolves with an object deep-equal to that body and
  `fetch` was called with `"/api/admin/settings"` and an init whose `method` is `"PUT"` and `body` is
  `'{"dataSource":"snapshot"}'`
- **WHEN** global `fetch` answers with status 200 and the body
  `{ source: "snapshot", shops: [ { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", total: 1, visible: 1 } ], products: [ { ...<the full osio:6abcf192b7db2532803d266d Product from data/shops/osio.json, price 195>, visible: true } ] }`
- **THEN** `getAdminProducts()` resolves with an object deep-equal to that body and `fetch` was called with
  `"/api/admin/products"`
- **WHEN** global `fetch` answers with status 200 and the body
  `{ id: "osio:6abcf192b7db2532803d266d", visible: false, visibility: [] }`
- **THEN** `setProductVisibility("osio:6abcf192b7db2532803d266d", false)` resolves with an object deep-equal
  to that body and `fetch` was called with `"/api/admin/products/osio:6abcf192b7db2532803d266d/visibility"`
  and an init whose `method` is `"PUT"` and `body` is `'{"visible":false}'`

#### Scenario: Product id is URL-encoded in the visibility path
- **WHEN** global `fetch` answers with status 200 and the body `{ id: "osio:a#b", visible: true, visibility: ["osio:a#b"] }`
  and `setProductVisibility("osio:a#b", true)` is awaited
- **THEN** `fetch` was called with the path `"/api/admin/products/osio:a%23b/visibility"` (the `#` encoded, the
  `:` literal — exactly as `updateBasketItem("osio:a#b", 2)` requests `/api/basket/items/osio:a%23b`) and the
  call resolved with an object deep-equal to that body

#### Scenario: Login failures carry the status
- **WHEN** global `fetch` answers with status 401 and the body `{ error: "Invalid token" }`
- **THEN** `adminLogin("wrong-token")` rejects with an `Error` whose message is
  `POST /api/admin/login failed: 401` and whose `status` is `401`
- **WHEN** global `fetch` answers with status 503 and the body `{ error: "Admin is not configured" }`
- **THEN** `adminLogin("secret-token")` rejects with an `Error` whose message is
  `POST /api/admin/login failed: 503` and whose `status` is `503`
- **WHEN** global `fetch` answers with status 401 and the body `{ error: "Unauthorized" }`
- **THEN** `getAdminSettings()` rejects with an `Error` whose message is
  `GET /api/admin/settings failed: 401` and whose `status` is `401`
