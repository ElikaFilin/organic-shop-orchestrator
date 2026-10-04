# Tasks

Scenario names below are the `#### Scenario:` headings in `specs/*/spec.md`; each test asserts the scenario's
exact WHEN values and THEN output. This change is applied after `add-basket` is on disk — its
`createBasketStore`, `config.dataDir`, `createApp({ catalog, basketStore })`, `ProductIdSchema`, the client's
request helper, `BasketProvider` and the header basket link are imported or edited, never re-implemented.
Fixed values used by the tests: admin token `secret-token`, session cookie
`admin_session=admin.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D` (design.md Context), basket id
`0f3c9d6e-7a1b-4c2d-9e8f-123456789abc`. Every command below is on the loop allow-list (`scripts/loop.mjs`):
`pnpm test <path>`, `pnpm typecheck`, `pnpm lint`, `pnpm hooks:selftest`, `pnpm check`, the Grep tool; no task
needs `pnpm dev`, `curl`, a browser or `.env`.

## 1. Scenario tests first (red run)

- [ ] 1.1 Precondition (read-only, Grep tool): `add-basket` is on disk — `export function createBasketStore` in
  `apps/api/src/lib/store/baskets.ts`, `dataDir` in `apps/api/src/config.ts`, `basketStore` in
  `apps/api/src/app.ts`, `export const ProductIdSchema` in `packages/shared/src/index.ts`, `getBasket` in
  `apps/web/src/api/client.ts`, `BasketProvider` in `apps/web/src/basket/BasketContext.tsx`,
  `path: "basket"` in `apps/web/src/router.tsx`, and — from `add-basket`'s review group 8 — `itemPath` in
  `apps/web/src/api/client.ts` and the files `apps/api/src/lib/basket.test.ts` and
  `apps/web/src/components/BasketLine.test.tsx`. Verify: all ten patterns match; if any is missing, stop and
  report that this change cannot start before `add-basket` (including its group 8) is implemented.
- [ ] 1.2 `apps/api/src/config.test.ts` — add the test "Config reads ADMIN_TOKEN" next to the existing config
  tests: `expect(loadConfig({}).adminToken).toBeUndefined()`,
  `expect(loadConfig({ ADMIN_TOKEN: "secret-token" }).adminToken).toBe("secret-token")`,
  `expect(loadConfig({ ADMIN_TOKEN: "   " }).adminToken).toBeUndefined()`. Verify: `pnpm test apps/api/src/config`
  reports it failing on `"secret-token"` vs `undefined`.
- [ ] 1.3 `apps/api/src/lib/store/admin-settings.test.ts` — four tests, one per scenario: "Missing file reads as
  defaults", "Reads persisted settings", "Update writes atomically", "Invalid file content is an error". Each
  test creates `mkdtempSync(join(tmpdir(), "admin-settings-"))`, builds
  `createAdminSettingsStore(join(dir, "admin-settings.json"), { dataSource: "live", visibility: { karashynyard: null, osio: null } })`
  and removes the dir in `afterEach` (`rmSync(dir, { recursive: true, force: true })`); the "persisted" and
  "invalid" tests `writeFileSync` the exact JSON string from the scenario before creating the store;
  assertions use `readdirSync(dir)`, `JSON.parse(readFileSync(..., "utf8"))` and, for the invalid file,
  `await expect(store.read()).rejects.toBeInstanceOf(Error)` plus `readFileSync` equal to `{"dataSource":"foo"}`.
  Verify: the file imports `./admin-settings`, which does not exist yet.
- [ ] 1.4 `apps/api/src/lib/catalog.test.ts` — add two tests to the `selectVisibleProducts` describe:
  "Selection serves the chosen ids in upstream order" (`selectVisibleProducts([{ key: "karashynyard", products: karashynyardSnapshot }, { key: "osio", products: osioSnapshot.slice(0, 3) }], { karashynyard: ["karashynyard:1743423686258", "karashynyard:1498486363994"], osio: null })`
  → `map((p) => p.id)` equals the 5 ids in the scenario's order and `visible[0]?.price` is 665,
  `visible[1]?.price` 480) and "Ids missing upstream are ignored and an empty list hides the shop"
  (`{ karashynyard: ["karashynyard:1498486363994", "karashynyard:0000000000000"], osio: [] }` → length 1,
  id `karashynyard:1498486363994`, price 665). The existing "Selection keeps the first ten of each shop in
  order" test is untouched (its one-argument call stays valid). Verify: `pnpm test apps/api/src/lib/catalog`
  reports exactly these two tests failing (13 ids returned instead of 5 / 1).
- [ ] 1.5 `apps/api/src/routes/products-visibility.test.ts` (a new file, so `add-catalog`'s
  `products.test.ts` stays green in the red run) — three tests: "Catalog honours the admin's visibility",
  "A visibility change is served without restart" (same app, the store's `update` between the two requests)
  and "Persisted data source overrides DATA_SOURCE" (`loadConfig({}).dataSource` as the default,
  `catalog.getSource()` and the fake adapters' call counts asserted; second half over an empty temp dir).
  Helper `appOverSettings(json?: string)`: temp dir, optional `writeFileSync(<dir>/admin-settings.json, json)`,
  `createAdminSettingsStore(join(dir, "admin-settings.json"), { dataSource: "snapshot", visibility: { karashynyard: null, osio: null } })`
  (or the `loadConfig({})` default for the startup test), fake adapters as `products.test.ts` builds them,
  `createCatalogService({ source, shops, snapshots: createSnapshotSource(<repo>/data/shops), cache, now: () => 0, settings: store })`,
  `createApp({ catalog, basketStore: <temp basket store>, settingsStore: store, adminToken: undefined })`.
  Verify: the file imports `../lib/store/admin-settings`, which does not exist yet.
- [ ] 1.6 `apps/api/src/routes/admin.test.ts` — twenty-two tests, one per route scenario, in `describe` blocks per
  requirement: admin-auth — "Login with the right token sets the session cookie", "Login with a wrong token",
  "Login without a configured token", "Login body without a token is rejected", "Logout clears the cookie",
  "Session reflects the cookie", "Missing cookie is unauthorized", "Tampered cookie is unauthorized", "Valid
  cookie passes the guard", "Unconfigured admin rejects every cookie"; admin-settings — "Settings on a fresh
  install", "Switch to snapshot applies immediately", "Switch back to live", "Invalid settings body", "Live mode
  lists products beyond the first ten", "Snapshot mode with a visibility array", "Fallback shop lists its
  snapshot", "Unavailable shop lists nothing", "Hide a visible product", "Show a product beyond the first ten",
  "Unknown product", "Malformed id or body". Helpers in the test file (design.md D12):
  `newApp({ source, adminToken, settingsFile?, karashynyard?, osio?, snapshotDir? })` (temp dirs for the
  settings and basket stores, `vi.fn` adapters, `createTtlCache({ ttlMs: 300000, now: () => 0 })`, the
  `karashynyardBeyondTen` literals copied from `products.test.ts`), `login(app)` → `(await app.request("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "secret-token" }) })).headers.get("set-cookie")!.split(";")[0]`,
  `req(app, method, path, { cookie?, body?, rawBody? })`; constants
  `SIGNATURE = "YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D"` with the one-line check
  `expect(encodeURIComponent(createHmac("sha256", "secret-token").update("admin").digest("base64"))).toBe(SIGNATURE)`
  beside it, and `OTHER_SIGNATURE = "%2FPIVjLj4NPDY7r3QD9XpFnAbAO6%2F%2BG9MWfTiAQpvCdg%3D"`. `Set-Cookie` is
  read with `res.headers.get("set-cookie")`, its absence with `toBeNull()`; 204 bodies with `await res.text()`
  equal to `""`; expected `product` objects are `toEqual` against the snapshot products read through
  `createSnapshotSource`. Verify: the file imports `./admin` and `../lib/store/admin-settings`, both missing yet.
- [ ] 1.7 `apps/api/src/lib/admin-auth.test.ts` and `apps/api/src/lib/admin.test.ts` — the unit tests beside the two
  `src/lib` modules (AGENTS.md: "a Vitest test beside it"; design.md D5, D6, D12), asserting the scenario values
  directly on the functions. `admin-auth.test.ts`, three tests: "Unconfigured admin cannot log in"
  (`createAdminAuth({ adminToken: undefined })` → `secret` is `undefined` and `login("secret-token")` equals
  `{ ok: false, error: "Admin is not configured" }`), "Wrong token is rejected"
  (`createAdminAuth({ adminToken: "secret-token" }).login("wrong-token")` equals `{ ok: false, error: "Invalid token" }`),
  "Right token is accepted" (`login("secret-token")` equals `{ ok: true }` and `secret` is `"secret-token"`).
  `admin.test.ts`: helper `newService(json?)` → a temp dir (`mkdtempSync(join(tmpdir(), "admin-service-"))`, removed in
  `afterEach`), optional `writeFileSync(<dir>/admin-settings.json, json)`,
  `createAdminSettingsStore(join(dir, "admin-settings.json"), { dataSource: "live", visibility: { karashynyard: null, osio: null } })`,
  a stub catalog `{ loadAll: async () => inventory, setSource: vi.fn() }` where `inventory` is
  `{ source: "live", shops: [ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "live", products: [...karashynyardSnapshot, ...karashynyardBeyondTen] }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot-fallback", error: "osio: HTTP 502", products: osioSnapshot } ] }`
  (the snapshots through `createSnapshotSource(<repo>/data/shops).read(key)`, `karashynyardBeyondTen` the two
  literals of `products.test.ts`), and `createAdminService({ catalog, settings: store })`. Seven tests:
  "listProducts flags the first ten when visibility is null" (`source` is `"live"`; `shops` equals
  `[ { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "live", total: 12, visible: 10 }, { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot-fallback", error: "osio: HTTP 502", total: 10, visible: 10 } ]`;
  `products.length` is 22; `products[0]` equals the full `karashynyard:1498486363994` Product (price 665) plus
  `visible: true`; `products[10]` is `id: "karashynyard:1629901938947"`, `visible: false`; `products[12]` is
  `id: "osio:6abcf192b7db2532803d266d"`, `visible: true`); "listProducts flags the chosen ids" (file
  `{"dataSource":"live","visibility":{"karashynyard":["karashynyard:1743423686258","karashynyard:1498486363994"],"osio":null}}`
  → `shops[0]` has `total: 12`, `visible: 2`; `products[0].visible` is true, `products[1].visible` false
  (`karashynyard:1628604400123`), `products[9].visible` true (`karashynyard:1743423686258`), `products[10].visible`
  false); "First toggle creates the default array and removes the id"
  (`setProductVisibility("karashynyard:1498486363994", false)` equals
  `{ ok: true, result: { id: "karashynyard:1498486363994", visible: false, visibility: <the 9-element array of "Hide a visible product"> } }`
  and `read()` resolves `visibility: { karashynyard: <that array>, osio: null }`); "Append shows a product beyond the
  first ten" (`setProductVisibility("karashynyard:1636965991022", true)` on a fresh store → `visibility` equals the
  11-element array of "Show a product beyond the first ten"); "Repeating a toggle is idempotent" (hiding
  `karashynyard:1498486363994` twice → the same 9-element result both times;
  `setProductVisibility("karashynyard:1498486363994", true)` on a fresh store → `visibility` equals the 10 snapshot ids
  in snapshot order, no duplicate); "Unknown product writes nothing"
  (`setProductVisibility("osio:000000000000000000000000", true)` equals `{ ok: false, error: "Product not found" }`,
  `readdirSync(dir)` is `[]` and `read()` resolves the defaults); "updateSettings persists before switching the catalog"
  (`updateSettings({ dataSource: "snapshot" })` resolves `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`,
  `JSON.parse(readFileSync(<dir>/admin-settings.json, "utf8")).dataSource` is `"snapshot"` and `setSource` was called
  once with `"snapshot"`). Verify: the files import `./admin-auth` and `./admin`, which do not exist yet.
- [ ] 1.8 `apps/web/src/api/client.test.ts` — add three tests next to the catalog and basket client tests: "Admin
  requests send method, path and body" (one `mockResolvedValueOnce` per call, `new Response(null, { status: 204 })`
  for the two 204 answers, `expect(fetchMock).toHaveBeenLastCalledWith(path, expect.objectContaining({ method, credentials: "same-origin", ... }))`
  and `body: undefined` where the scenario says so; the `setProductVisibility` call asserts the literal path
  `"/api/admin/products/osio:6abcf192b7db2532803d266d/visibility"`), "Product id is URL-encoded in the visibility
  path" (`setProductVisibility("osio:a#b", true)` with `fetch` answering 200 and
  `{ id: "osio:a#b", visible: true, visibility: ["osio:a#b"] }` → `fetchMock.mock.calls[0]?.[0]` is
  `"/api/admin/products/osio:a%23b/visibility"`, the same shape as `add-basket`'s "Product id is URL-encoded in the
  path" test) and "Login failures carry the status" (`rejects.toThrow(/^POST \/api\/admin\/login failed: 401$/)` and
  `rejects.toMatchObject({ status: 401 })`, likewise 503 and the `GET /api/admin/settings failed: 401` case).
  Verify: the file imports `getAdminSession`, `adminLogin`, `adminLogout`, `getAdminSettings`, `updateSettings`,
  `getAdminProducts`, `setProductVisibility` from `./client` — none exported yet, so the run fails on the missing exports.
- [ ] 1.9 `apps/web/src/App.test.tsx` — add "Header navigation on the catalog page": `vi.mock("./api/client")`,
  `getProducts` resolves with the two-shops response, `getBasket` with the empty basket; render the routes at
  `/`, then `within(await screen.findByRole("navigation")).getAllByRole("link")` has length 3 with names
  "Каталог" / "Кошик (0)" / "Адмін" and hrefs `/` / `/basket` / `/admin` in order; render again at `/basket`
  and assert the same three. `apps/web/src/theme.test.ts` — "Light color scheme is forced":
  `readFileSync(fileURLToPath(new URL("./index.css", import.meta.url)), "utf8")` matches
  `/:root\s*\{[^}]*color-scheme:\s*light;?[^}]*\}/`, and `../index.html` matches `/<body[^>]*class="[^"]*\bbg-white\b[^"]*"/`
  and `/<body[^>]*class="[^"]*\btext-stone-900\b[^"]*"/`. Verify: the nav test fails (1 link, no "Каталог")
  and both theme assertions fail.
- [ ] 1.10 `apps/web/src/pages/AdminPage.test.tsx` — fourteen scenario tests: "Loading state", "Not authenticated
  shows the login form", "Authenticated shows the panel", "Wrong token", "Admin not configured", "Login failure other
  than 401/503 and alert reset", "Successful login opens the panel", "Radio switches the data source", "Source switch
  failure keeps the radio", "Unticking hides a product", "Ticking shows a product", "Save failure keeps the checkbox",
  "Status notes per shop", "Logout returns to the login form" — plus one test for design.md D10's failed state (no
  scenario): "Failed panel load" (`getAdminSession` rejects with `Error("GET /api/admin/session failed: 500")` → an
  element with `role="status"` shows "Не вдалося завантажити адмін-панель", no heading "Вхід для адміністратора" and
  no heading "Адмін-панель"). `vi.mock("../api/client")`; `getBasket` resolves with the empty basket in `beforeEach`
  (the layout calls it); the four-product admin response and the product literals from `data/shops/*.json` live in
  the test file; routes rendered with `createMemoryRouter(routes, { initialEntries: ["/admin"] })`; the pending
  session of "Loading state" is `vi.mocked(getAdminSession).mockReturnValue(new Promise(() => {}))`; the two-call
  `adminLogin` of "Login failure other than 401/503 and alert reset" is `mockRejectedValueOnce(<status 500 error>)`
  then `mockResolvedValueOnce(undefined)`; queries: `findByRole("heading", { level: 2, name })`,
  `getByLabelText("Токен адміністратора")` (assert `type="password"`), `getByRole("button", { name })`,
  `findByRole("alert")` / `queryByRole("alert")`, `findByRole("status")` / `queryByRole("status")`,
  `getByRole("group", { name: "Джерело даних" })`, `getByRole("radio", { name })` + `toBeChecked()` /
  `not.toBeChecked()`, `getByRole("region", { name })` + `within(region).getByText(...)`,
  `within(region).getByRole("checkbox", { name })`, `within(region).queryByRole("list")`; rejections built as
  `Object.assign(new Error("POST /api/admin/login failed: 401"), { status: 401 })`; after a rejected mutation the
  unchanged radio / checkbox and count are asserted once `findByRole("alert")` has resolved;
  `fireEvent.change(input, { target: { value } })`, `fireEvent.click` on buttons, radios and checkboxes,
  `findBy…` / `waitFor` after every mutation; call counts with `toHaveBeenCalledTimes`. Verify: route `/admin`
  renders nothing yet — every test fails on the missing heading or status element.
- [ ] 1.11 `apps/web/src/components/AdminLoginForm.test.tsx` and `apps/web/src/components/AdminShopSection.test.tsx` —
  the Testing Library tests beside the two components (`.claude/rules/web.md`; design.md D10, D12), rendered directly
  with `render(<Component … />)` and `vi.fn()` callbacks — no router, no client mock. `AdminLoginForm.test.tsx`, three
  tests: "Submit passes the typed token" (`onSubmit` resolves `undefined`; a level-2 heading "Вхід для адміністратора"
  and an input labelled "Токен адміністратора" with `type="password"` are rendered; `fireEvent.change` to
  `secret-token`, click "Увійти" → `onSubmit` was called once with `"secret-token"`; `queryByRole("alert")` is `null`),
  "Alert text per status" (`test.each` over `[401, "Невірний токен"]`, `[503, "Адмінку не налаштовано"]`,
  `[500, "Не вдалося увійти"]` with `onSubmit` rejecting `Object.assign(new Error(`POST /api/admin/login failed: ${status}`), { status })`,
  plus a row rejecting `new Error("boom")` (no `status`) → "Не вдалося увійти"; `await screen.findByRole("alert")` has
  that text and the heading is still rendered), "Alert is cleared on the next submit" (the first `onSubmit` rejects
  with status 401 → alert "Невірний токен"; the second call returns `new Promise(() => {})`; click "Увійти" again →
  `queryByRole("alert")` is `null` and `onSubmit` was called twice). `AdminShopSection.test.tsx`, four tests over
  `shop = { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "live", total: 3, visible: 2 }`
  and the three karashynyard products of the four-product admin response (`visible` true / true / false):
  "Status note per status" (`test.each`: `live` → "наживо", `snapshot` → "знімок", `snapshot-fallback` with
  `error: "karashynyard: HTTP 503"` → "збережена копія", `unavailable` → "недоступний"; the text is inside
  `getByRole("region", { name: "Карашин Яр" })` and `queryByRole("status")` is `null`), "Counts the ticked products and
  lists every product" ("Видимих: 2"; `getAllByRole("listitem")` has length 3; the checkbox "Філе індички, 1 кг" is
  checked, "Каре молочної телятини, 1 кг" checked, "Гречаний чай з жасмином 100 г (99 чашок)" not checked), "No list
  when the shop has no products" (`products={[]}` and `shop` with `status: "unavailable", total: 0, visible: 0` →
  "Видимих: 0" and `queryByRole("list")` is `null`), "Checkbox change calls back with id and checked" (click
  "Гречаний чай з жасмином 100 г (99 чашок)" → `onToggle` was called with `("karashynyard:1743423686258", true)`; click
  "Філе індички, 1 кг" → `("karashynyard:1498486363994", false)`; two calls in total). Verify: the files import
  `./AdminLoginForm` and `./AdminShopSection`, which do not exist yet.
- [ ] 1.12 Run `pnpm test` and quote the failing lines (one per new or extended test file: "Failed to resolve
  import" for `./admin-settings`, `../lib/store/admin-settings`, `./admin` (the route and the lib test), `./admin-auth`,
  `./AdminLoginForm` and `./AdminShopSection`; missing exports of `./client`; red assertions in `config.test.ts`,
  `catalog.test.ts` (two tests), `App.test.tsx`, `theme.test.ts`, `AdminPage.test.tsx`; `add-catalog`'s and
  `add-basket`'s own tests stay green). Verify: the quoted red output is in the transcript before any task in group 2
  starts.

## 2. Shared contract

- [ ] 2.1 `packages/shared/src/index.ts`: add `ShopVisibilitySchema`, `defaultVisibility()`, `AdminSettingsSchema`,
  `UpdateAdminSettingsSchema` (strict), `AdminLoginSchema`, `AdminSessionSchema`, `SetProductVisibilitySchema`,
  `ProductVisibilityResponseSchema`, `AdminShopSummarySchema`, `AdminProductSchema`, `AdminProductsResponseSchema`
  and their `z.infer` types exactly as in design.md D1 (zod 4, no I/O, no framework import). Verify:
  `pnpm typecheck` exits 0 for `@organic/shared`, and `AdminSettingsSchema.safeParse` of
  `{ dataSource: "snapshot", visibility: { karashynyard: ["karashynyard:1743423686258"], osio: null } }` succeeds
  while `{ dataSource: "foo" }` and `{ dataSource: "live", visibility: { karashynyard: null } }` (osio missing)
  fail (asserted by the 1.3 and 1.6 tests once green).

## 3. API — config and settings store

- [ ] 3.1 `apps/api/src/config.ts`: `adminToken: string | undefined` from `ADMIN_TOKEN`, blank = `undefined`
  (design.md D2); still the only file that reads `process.env`. Verify: `pnpm test apps/api/src/config` passes
  all config tests and `pnpm hooks:selftest` stays green.
- [ ] 3.2 `apps/api/src/lib/store/admin-settings.ts`: `createAdminSettingsStore(filePath, defaults)` with `read`
  and `update` (design.md D3): `ENOENT` → a clone of the defaults, schema validation that throws on a bad file,
  one promise-chain queue, `mkdir` + `<file>.<uuid>.tmp` + `rename`, temp file unlinked on a failed write. No
  Hono import. Verify: the four tests of 1.3 pass (`pnpm test apps/api/src/lib/store/admin-settings`).

## 4. API — catalog visibility

- [ ] 4.1 `apps/api/src/lib/catalog.ts`: export `visibleOfShop(products, chosen)`; `selectVisibleProducts(perShop, visibility = defaultVisibility())`
  built on it; `CatalogServiceOptions.settings: { read(): Promise<AdminSettings> }` (required); `loadAll()` on
  `CatalogService` returning the resolved shops with their full lists; `load()` = `loadAll()` + the settings'
  visibility + `selectVisibleProducts` + summaries (design.md D4). Verify: the two selection tests of 1.4 pass
  (`pnpm test apps/api/src/lib/catalog -t "Selection"`).
- [ ] 4.2 Adapt the existing `createCatalogService` call sites — `apps/api/src/lib/catalog.test.ts` (`liveService`
  and the "Mismatched shop keys throw at construction" build) and `apps/api/src/routes/products.test.ts`
  (`appWithFakeShops`) — to pass `settings: { read: async () => ({ dataSource: source, visibility: defaultVisibility() }) }`
  (setup only; assertions unchanged). Verify: `pnpm test apps/api/src/lib/catalog apps/api/src/routes/products`
  is fully green, including the three tests of 1.5 in `products-visibility.test.ts`, and the Grep tool finds no
  `createCatalogService({` under `apps/api/src` without a `settings` key within the following 12 lines (the
  only other match is the function definition).

## 5. API — admin auth, service, routes, wiring

- [ ] 5.1 `apps/api/src/lib/admin-auth.ts`: `createAdminAuth({ adminToken })` with `secret` and
  `login(token): AdminLoginResult` (design.md D5). No Hono import. Verify: the three tests of 1.7's
  `admin-auth.test.ts` pass (`pnpm test apps/api/src/lib/admin-auth`) and `pnpm typecheck` exits 0 for `@organic/api`;
  the 1.6 login tests assert the same through HTTP in 5.3.
- [ ] 5.2 `apps/api/src/lib/admin.ts`: `createAdminService({ catalog, settings })` with `getSettings`,
  `updateSettings` (persist, then `catalog.setSource`), `listProducts` (`loadAll` + `visibleOfShop` flags,
  `total` / `visible` per shop) and `setProductVisibility` (first-toggle default from `visibleOfShop(products, null)`,
  append / remove, `{ ok: false, error: "Product not found" }`) — design.md D6. No Hono import. Verify: the seven
  tests of 1.7's `admin.test.ts` pass (`pnpm test apps/api/src/lib/admin.test`) and `pnpm typecheck` exits 0; the 1.6
  settings / products tests assert the same through HTTP in 5.3.
- [ ] 5.3 `apps/api/src/routes/admin.ts`: `adminRoutes(auth, service)` — `POST /login` (parse → 400, `auth.login`
  → 503 / 401, `setSignedCookie` + 204), `POST /logout` (`deleteCookie` + 204), `GET /session`, the guard on
  `/settings/*` and `/products/*`, and the four guarded handlers with `{ error: "Invalid request body" }`,
  `{ error: "Invalid product id" }` (400) and the 404 mapping (design.md D7). `apps/api/src/app.ts`:
  `createApp({ catalog, basketStore, settingsStore, adminToken, now = Date.now })` building the auth and the
  service and mounting `/api/admin` (design.md D8). Verify: the twenty-two tests of 1.6 pass
  (`pnpm test apps/api/src/routes/admin`).
- [ ] 5.4 Adapt every `createApp` call site to the new signature and wire the server: `apps/api/src/app.test.ts`
  (stub catalog gains `loadAll: async () => ({ source: "snapshot", shops: [] })`; `settingsStore` on a temp dir,
  `adminToken: undefined`), `apps/api/src/routes/products.test.ts` and `apps/api/src/lib/catalog.test.ts` ("Runtime
  switch to snapshot"), and `add-basket`'s `apps/api/src/routes/basket.test.ts` (`fakeCatalog` gains
  `loadAll: async () => { throw new Error("not used"); }` — the `{ ...fakeCatalog, findProduct }` literal of
  "Non-integer price sums without float noise" inherits it; both `createApp` calls there — `newApp()` and the
  one inside that test — pass the temp settings store and `adminToken: undefined`) — setup only, assertions
  unchanged; `apps/api/src/server.ts` builds the settings store
  on `join(config.dataDir, "admin-settings.json")` with defaults from `config.dataSource`, awaits `read()`, seeds
  `source: settings.dataSource`, passes `settings: settingsStore` to the catalog and `settingsStore` +
  `adminToken: config.adminToken` to `createApp` (design.md D8). Verify: the Grep tool finds no `createApp({`
  under `apps/api/src` without `settingsStore` within the following 8 lines (the only other match is the function
  definition in `app.ts`), `pnpm test apps/api` is fully green and `pnpm typecheck` exits 0 (a missed call site
  shows as TS2345 — property `settingsStore` or `adminToken` is missing).

## 6. Web — client, layout, admin page

- [ ] 6.1 `apps/web/src/api/client.ts`: generalise the request helper to
  `request<T>(method, path, { schema?: { parse(input: unknown): T }; body? })` — the `schema` option typed
  structurally, so the file imports from `@organic/shared` only and never from `zod` (`zod` is not resolvable from
  `apps/web`; design.md D9 — do not `pnpm add zod`), add `export class ApiError extends Error` with `status`, extract
  `add-basket`'s `encodeURIComponent(productId).replaceAll("%3A", ":")` from `itemPath` into one private
  `encodeProductId(id)` that `itemPath` keeps using, rewrite the five basket functions over the helper
  (`schema: BasketResponseSchema`, paths unchanged), add the seven admin functions with `encodeProductId(id)` in the
  visibility path (design.md D9); `getProducts` untouched. Verify: `pnpm test apps/web/src/api` passes all client
  tests — `add-catalog`'s two, `add-basket`'s four and the three of 1.8 — and `pnpm typecheck` exits 0 for
  `@organic/web` (a `zod` import would fail it with TS2307).
- [ ] 6.2 `apps/web/src/App.tsx`: the nav `<Link to="/">Каталог</Link>`, the existing `<Link to="/basket">Кошик ({count})</Link>`,
  `<Link to="/admin">Адмін</Link>` (design.md D11); `apps/web/src/index.css` adds `:root { color-scheme: light; }`
  after the Tailwind import; `apps/web/index.html` sets `<body class="bg-white text-stone-900">`. Verify:
  `pnpm test apps/web/src/App apps/web/src/theme` passes, and `pnpm test apps/web/src/pages` keeps `add-catalog`'s
  and `add-basket`'s page tests green (the extra links render no `role="status"` element).
- [ ] 6.3 `apps/web/src/components/AdminLoginForm.tsx` (`onSubmit` prop, its own `alert` state, exported
  `loginAlert()` — the three alert texts), `apps/web/src/components/AdminShopSection.tsx` (`shop`, `products`,
  `onToggle` props: heading, status note, "Видимих: N", checkbox list) and `apps/web/src/pages/AdminPage.tsx`
  (design.md D10: the state machine, "Завантажуємо…", "Не вдалося завантажити адмін-панель", the login form, and the
  panel markup — "Адмін-панель", "Джерело даних" radios + "Збережено" + products reload, one `AdminShopSection` per
  shop, the "Не вдалося зберегти" alert, "Вийти"; no separate `AdminPanel` component); `apps/web/src/router.tsx` adds
  `{ path: "admin", Component: AdminPage }` under `App`. Tailwind utilities only, Ukrainian copy, labelled inputs,
  `<ul>` lists. Verify: the seven component tests of 1.11 pass
  (`pnpm test apps/web/src/components/AdminLoginForm apps/web/src/components/AdminShopSection`), the fifteen tests of
  1.10 pass (`pnpm test apps/web/src/pages/AdminPage`) and `pnpm test` is green for the whole workspace.

## 7. Integration and done

- [ ] 7.1 `docs/session-notes.md`: tick the "адмінка `/admin`" checklist line with the automated proof — quote the
  `pnpm test` result lines of the 1.6 tests "Login with the right token sets the session cookie", "Switch to
  snapshot applies immediately" and "Hide a visible product", and of the 1.10 test "Unticking hides a product" —
  and end the line with the placeholder `smoke: ____`, which the human replaces after the smoke run below; add
  the session's progress entry (Зроблено / Не працює / Починати наступну сесію з) naming the dark-mode heading
  fix from the previous entry as done. Verify: the line reads `[x]`, names `pnpm test` and the four test names,
  and ends with `smoke: ____`.
- [ ] 7.2 Run `pnpm check` and quote its summary lines (Tests … passed, spec:check ok — …).

### Human smoke run (outside the loop, after 7.2)

Not a checkbox: `pnpm dev` is a foreground watcher and `curl` / a browser are not on the loop's allow-list, so
the loop never waits for this step; the automated proof of the same behaviour is the 1.6 and 1.10 tests. A human
sets `ADMIN_TOKEN` in `.env`, runs `pnpm dev`, opens http://localhost:5173/admin, sees "Вхід для адміністратора",
enters a wrong token and sees "Невірний токен", enters the real one and sees "Адмін-панель" with "Наживо"
checked and every live product of both shops listed (more than ten for Карашин Яр), unticks "Філе індички, 1 кг",
sees "Видимих: 9", opens http://localhost:5173/ and sees nine Карашин Яр cards without it, switches to "Знімок",
sees "Збережено" and the snapshot notes, reloads `/admin` and is still signed in, clicks "Вийти" and is back at
the login form; checks that `.data/admin-settings.json` holds `"dataSource": "snapshot"` and the nine ids, and
that the page is readable with the OS in dark mode. Then the human replaces `smoke: ____` in the "адмінка" line
of `docs/session-notes.md` with what was seen.
