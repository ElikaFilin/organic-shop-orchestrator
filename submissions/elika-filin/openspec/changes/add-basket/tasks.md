# Tasks

Scenario names below are the `#### Scenario:` headings in `specs/*/spec.md`; each test asserts the scenario's
exact WHEN values and THEN output. This change is applied after `add-catalog` is on disk — its
`createCatalogService`, `createSnapshotSource`, `createApp`, `routes`, `ProductCard` / `formatPrice`,
`getProducts` and `ProductSchema` are imported, never re-implemented. Fixed basket ids used by the tests:
`0f3c9d6e-7a1b-4c2d-9e8f-123456789abc` and `6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f`. Every command below is on
the loop allow-list (`scripts/loop.mjs`): `pnpm test <path>`, `pnpm typecheck`, `pnpm lint`,
`pnpm hooks:selftest`, `pnpm check`; no task needs `pnpm dev`, `curl` or a browser.

## 1. Scenario tests first (red run)

- [x] 1.1 Precondition (read-only, Grep tool): `add-catalog` is on disk — `export function createCatalogService`
  in `apps/api/src/lib/catalog.ts`, `export function createSnapshotSource` in `apps/api/src/lib/snapshot.ts`,
  `export const routes` in `apps/web/src/router.tsx`, `export function formatPrice` in
  `apps/web/src/components/ProductCard.tsx`, `export async function getProducts` (or `export const getProducts`)
  in `apps/web/src/api/client.ts`, `export const ProductSchema` in `packages/shared/src/index.ts`. Verify: all
  six patterns match; if any is missing, stop and report that this change cannot start before `add-catalog`.
- [x] 1.2 `apps/api/src/lib/store/baskets.test.ts` — four tests, one per scenario: "Missing file means no
  baskets", "Reads a basket from an existing file", "Update writes the basket to the file", "Write is atomic
  and keeps other baskets". Each test creates `mkdtempSync(join(tmpdir(), "baskets-"))`, builds
  `createBasketStore(join(dir, "baskets.json"))` and removes the dir in `afterEach`
  (`rmSync(dir, { recursive: true, force: true })`); the "existing file" tests `writeFileSync` the exact JSON
  string from the scenario before creating the store; assertions use `readdirSync(dir)` and
  `JSON.parse(readFileSync(join(dir, "baskets.json"), "utf8"))`. Verify: the file imports `./baskets`, which
  does not exist yet.
- [x] 1.3 `apps/api/src/config.test.ts` — add the test "Config reads DATA_DIR" next to add-catalog's "Config
  reads DATA_SOURCE": `expect(loadConfig({}).dataDir).toBe(resolve(dirname(fileURLToPath(import.meta.url)), "../../../.data"))`
  (the test file sits in the same directory as `config.ts`) and
  `expect(loadConfig({ DATA_DIR: "/tmp/organic-baskets" }).dataDir).toBe("/tmp/organic-baskets")`. Verify:
  `pnpm test apps/api/src/config` reports it failing with `dataDir` being `undefined`.
- [x] 1.4 `apps/api/src/routes/basket.test.ts` — sixteen tests, one per route scenario: "First request sets
  the basket cookie", "Request with the cookie reuses the basket", "Malformed cookie gets a fresh basket",
  "Totals add up the lines", "Unavailable product counts zero", "Add a product with an explicit quantity",
  "Add without a quantity defaults to one", "Adding an existing line merges and caps at 99", "Unknown product
  is rejected", "Change the quantity", "Change a line that does not exist", "Remove a line", "Remove a line
  that does not exist", "Clear a basket with lines", "Invalid body", "Invalid product id in the path" — plus
  one test for requirement text that has no scenario, "Body that is not JSON is rejected" (a plain-text or
  empty body answers 400 `{ error: "Invalid request body" }` and the basket is unchanged).
  Helpers live in the test file: `snapshotProducts()` — the 20 `Product`s from `data/shops/*.json` through
  `createSnapshotSource(<repo>/data/shops).read(key)` for both keys (dir resolved from `import.meta.url`);
  `fakeCatalog` — typed `ReturnType<typeof createCatalogService>`, `findProduct(id)` resolves from that list,
  `load` / `getSource` / `setSource` throw `new Error("not used")`; `newApp()` — fresh temp dir,
  `createBasketStore(join(dir, "baskets.json"))`, `createApp({ catalog: fakeCatalog, basketStore })`, dir
  removed in `afterEach`; `req(app, method, path, { cookie?, body? })` →
  `app.request(path, { method, headers: { ...(cookie ? { Cookie: `basket_id=${cookie}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined })`.
  Expected `product` objects are `toEqual` against the matching entry of `snapshotProducts()`; the "Unavailable
  product counts zero" test seeds the store with `basketStore.update(...)` before the request; `Set-Cookie` is
  read with `res.headers.get("set-cookie")`. Verify: the file imports `./basket` and the new `createApp`
  signature, both missing yet.
- [x] 1.5 `apps/web/src/api/client.test.ts` — add three tests next to add-catalog's two: "getBasket requests
  the basket", "Mutations send method, path and JSON body", "Failed request rejects with method, path and
  status"; `vi.stubGlobal("fetch", vi.fn())` with `mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))`
  per call and `expect(fetch).toHaveBeenCalledWith(path, expect.objectContaining({ method, credentials: "same-origin", … }))`;
  the osio `Product` literal comes from `data/shops/osio.json` (JSON import or inline, as add-catalog's client
  test does). Verify: the file imports `getBasket`, `addToBasket`, `updateBasketItem`, `removeBasketItem`,
  `clearBasket` from `./client` — none exported yet, so the run fails on the missing exports.
- [x] 1.6 `apps/web/src/components/ProductCard.test.tsx` — one test "Add from the catalog card":
  `vi.mock("../api/client")`; `vi.mocked(getProducts).mockResolvedValue(<two-shops response>)`,
  `vi.mocked(getBasket).mockResolvedValue(<empty basket>)`, `vi.mocked(addToBasket).mockResolvedValue(<one-line basket>)`;
  render `<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />`;
  `await screen.findAllByRole("button", { name: "Додати в кошик" })` has length 3,
  `screen.getByRole("link", { name: "Кошик (0)" })`, `screen.queryByRole("status")` is null;
  `fireEvent.click` on the first button; `await within(firstCard).findByRole("status")` has text "Додано",
  the other two cards have no `status`; `expect(addToBasket).toHaveBeenCalledWith("karashynyard:1498486363994", 1)`
  once; `await screen.findByRole("link", { name: "Кошик (1)" })` has `href="/basket"`. A second test, "Failed
  add shows the failure text on the card", covers design.md D7 (no scenario): `addToBasket` rejects, the
  first card's `status` reads "Не вдалося додати", the other cards have none and the header stays
  "Кошик (0)". Verify: the tests fail on the missing button or the missing `getBasket` export.
- [x] 1.7 `apps/web/src/App.test.tsx` — add "Header link counts the lines on mount" next to the existing
  heading test: `vi.mock("./api/client")`, `getProducts` resolves with the two-shops response, `getBasket`
  resolves with the two-line basket (count 3); render the routes at `/`;
  `await screen.findByRole("link", { name: "Кошик (3)" })` has `href="/basket"`;
  `expect(getBasket).toHaveBeenCalledTimes(1)`. Give the existing heading test the same mocks so it stays
  green. Verify: the new test fails on the missing link.
- [x] 1.8 `apps/web/src/pages/BasketPage.test.tsx` — six tests: "Two lines with totals", "Empty basket",
  "Changing the quantity updates the line", "Removing a line", "Clearing the basket", "Line without a
  product". Same mocking as 1.6, routes rendered at `/basket`; queries:
  `getByRole("heading", { level: 2, name: "Кошик" })`, `getByRole("list")` + `getAllByRole("listitem")`,
  `within(item).getByRole("img")` / `queryByRole("img")`, `within(item).getByText(...)` for a text that
  appears once in the item and `expect(within(item).getAllByText("195 ₴")).toHaveLength(2)` for the osio line,
  whose unit price and line sum are the same string at quantity 1 ("Two lines with totals", "Removing a
  line") — a `getByText("195 ₴")` there would throw "multiple elements found" against a correct page,
  `getAllByRole("spinbutton", { name: "Кількість" })` (assert `toHaveValue(2)`, `toHaveAttribute("min", "1")`,
  `toHaveAttribute("max", "99")`), `getAllByRole("button", { name: "Видалити" })`,
  `getByRole("button", { name: "Очистити кошик" })`, `getByRole("status")`,
  `getByRole("link", { name: "До каталогу" })`, `queryByRole("list")`, `queryByText(/^Разом:/)`,
  `screen.getAllByRole("img")` has length 1 in "Line without a product";
  `fireEvent.change(input, { target: { value: "3" } })` for the quantity, `fireEvent.click` for the buttons,
  `findBy…` after each mutation. Three more tests cover design.md D8 / D9 (no scenario): "Loading state
  while the basket is fetched" (`getBasket` pending → heading, `status` "Завантажуємо кошик…", header
  "Кошик (0)", no list; resolving it renders the lines), "Error state when the basket cannot be loaded"
  (`getBasket` rejects → `status` "Не вдалося завантажити кошик", no list, header "Кошик (0)") and "A
  rejected mutation leaves the last known basket on screen" (`updateBasketItem` and `removeBasketItem`
  reject → both lines, "Разом: 1525 ₴" and "Кошик (3)" stay). Verify: route `/basket` renders nothing yet —
  the heading query fails.
- [x] 1.9 Run `pnpm test` and quote the failing lines (one per new or extended test file: "Failed to resolve
  import" for `./baskets` and `./basket`, missing exports of `./client`, red assertions in `config.test.ts`,
  `App.test.tsx`, `ProductCard.test.tsx`, `BasketPage.test.tsx`; add-catalog's own tests stay green). Verify:
  the quoted red output is in the transcript before any task in group 2 starts.

## 2. Shared contract

- [x] 2.1 `packages/shared/src/index.ts`: add `BasketIdSchema`, `ProductIdSchema`, `BasketQuantitySchema`,
  `AddBasketItemSchema`, `UpdateBasketItemSchema`, `BasketLineSchema`, `BasketTotalsSchema`,
  `BasketResponseSchema`, `StoredBasketLineSchema`, `StoredBasketSchema`, `BasketsFileSchema` and their
  `z.infer` types exactly as in design.md D1 (zod 4, no I/O, no framework import). Verify: `pnpm typecheck`
  exits 0 for `@organic/shared`, and `BasketResponseSchema.safeParse` of the "Totals add up the lines" body
  succeeds (asserted by the 1.5 tests once green).

## 3. API — config and store

- [x] 3.1 `apps/api/src/config.ts`: `dataDir` = `env.DATA_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../.data")`
  (design.md D5); still the only file that reads `process.env`. Verify: `pnpm test apps/api/src/config` passes
  both config tests and `pnpm hooks:selftest` stays green.
- [x] 3.2 `apps/api/src/lib/store/baskets.ts`: `createBasketStore(filePath)` with `get` and `update`
  (design.md D2): read + `BasketsFileSchema` validation, `ENOENT` → no baskets, one promise-chain queue,
  `mkdir` + `<file>.<uuid>.tmp` + `rename`, temp file unlinked on a failed write. No Hono import. Verify: the
  four tests of 1.2 pass (`pnpm test apps/api/src/lib/store`).

## 4. API — basket service

- [x] 4.1 `apps/api/src/lib/basket.ts`: `createBasketService({ store, catalog, now })` with `get`, `addItem`
  (findProduct first, merge `Math.min(99, existing + quantity)`, `addedAt` kept), `updateItem`, `removeItem`,
  `clear`, the `BasketResult` union and `toResponse` with the totals reduce over lines that have a product
  (design.md D3). No Hono import, no file I/O outside the store. Verify: `pnpm typecheck` exits 0 (behaviour
  is asserted by the route tests in 5.1).

## 5. API — route and wiring

- [x] 5.1 `apps/api/src/routes/basket.ts`: `basketRoutes(service)` — cookie middleware (`getCookie` →
  `BasketIdSchema.safeParse` → `randomUUID()` + `setCookie(c, "basket_id", id, { httpOnly: true, path: "/", sameSite: "Lax", maxAge: 2592000 })`
  only when the cookie is missing or malformed), five thin handlers with `{ error: "Invalid request body" }`,
  `{ error: "Invalid product id" }` (400) and the 404 mapping of `BasketResult` (design.md D4).
  `apps/api/src/app.ts`: `createApp({ catalog, basketStore, now = Date.now })`, mount at `/api/basket`.
  Verify: the sixteen tests of 1.4 pass (`pnpm test apps/api/src/routes/basket`).
- [x] 5.2 Adapt the three add-catalog tests that call `createApp({ catalog })` to the new signature —
  `apps/api/src/app.test.ts`, `apps/api/src/routes/products.test.ts` and `apps/api/src/lib/catalog.test.ts`
  (its "Runtime switch to snapshot" test) — each passes
  `basketStore: createBasketStore(join(mkdtempSync(join(tmpdir(), "baskets-")), "baskets.json"))` (setup only:
  the `mkdtempSync` / `tmpdir` / `join` imports from `node:fs` / `node:os` / `node:path` plus the extra
  argument; assertions unchanged) — and wire `apps/api/src/server.ts`:
  `createBasketStore(join(config.dataDir, "baskets.json"))` passed to `createApp`. Verify: the Grep tool finds
  no `createApp({ catalog` call under `apps/api/src` that lacks `basketStore` (the only other match is the
  function definition in `app.ts`), `pnpm test apps/api` is fully green and `pnpm typecheck` exits 0 (a
  missed call site shows as TS2345 — property `basketStore` is missing).

## 6. Web — client, state, components, page, router

- [x] 6.1 `apps/web/src/api/client.ts`: private `request(method, path, body?)` and the five exports
  `getBasket`, `addToBasket`, `updateBasketItem`, `removeBasketItem`, `clearBasket` (design.md D10);
  `getProducts` untouched. Verify: the three tests of 1.5 and add-catalog's two client tests pass
  (`pnpm test apps/web/src/api`).
- [x] 6.2 `apps/web/src/basket/BasketContext.tsx` (`BasketProvider`, `useBasket`, tri-state, mount-only
  `getBasket()`, `setBasket`, derived `count` — design.md D6) and `apps/web/src/App.tsx` (provider around
  `<header>` with the h1 and `<nav><Link to="/basket">Кошик ({count})</Link></nav>`, then `<Outlet />`).
  Update `apps/web/src/pages/CatalogPage.test.tsx` setup only: `vi.mocked(getBasket).mockResolvedValue(<empty basket>)`
  in a `beforeEach` (the layout now calls it on mount; add-catalog's assertions unchanged). Verify: both
  `App.test.tsx` tests and the five `CatalogPage.test.tsx` tests pass
  (`pnpm test apps/web/src/App apps/web/src/pages/CatalogPage`).
- [x] 6.3 `apps/web/src/components/ProductCard.tsx`: button "Додати в кошик" →
  `setBasket(await addToBasket(product.id, 1))`, then `<span role="status">Додано</span>`; a rejection →
  `<span role="status">Не вдалося додати</span>` (design.md D7); Tailwind utilities only. Verify: the 1.6
  test passes and add-catalog's "Two shops with products" still finds no `role="status"` element
  (`pnpm test apps/web/src/components/ProductCard apps/web/src/pages/CatalogPage`).
- [x] 6.4 `apps/web/src/components/BasketLine.tsx` (design.md D9) and `apps/web/src/pages/BasketPage.tsx`
  (design.md D8: loading / error / empty / lines states, `formatPrice` imported from `ProductCard.tsx`,
  "Разом: …", "Очистити кошик"); `apps/web/src/router.tsx` adds `{ path: "basket", Component: BasketPage }`
  under `App`. Verify: the six tests of 1.8 pass (`pnpm test apps/web/src/pages/BasketPage`) and `pnpm test`
  is green for the whole workspace.

## 7. Integration and done

- [x] 7.1 `docs/session-notes.md`: tick the "кошик" checklist line with the automated proof — quote the
  `pnpm test` result lines of the 1.4 tests "Request with the cookie reuses the basket" (the basket survives a
  second request with the same cookie, i.e. a reload) and "Totals add up the lines", and of the 1.8 test
  "Changing the quantity updates the line" — and end the line with the placeholder `smoke: ____`, which the
  human replaces after the smoke run below; add the session's progress entry (Зроблено / Не працює / Починати
  наступну сесію з). Verify: the line reads `[x]`, names `pnpm test` and the three test names, and ends with
  `smoke: ____`.
- [x] 7.2 Run `pnpm check` and quote its summary lines (Tests … passed, spec:check ok — …).
  `node scripts/check-verdict.mjs` → GREEN: `Test Files  16 passed (16)`, `Tests  84 passed (84)`,
  `spec:check ok — specs: 3 · active changes: 2 · archived: 1`, `all hook checks passed`.

## 8. Review findings (maker ≠ checker — docs/reviews/2026-10-04-add-basket-code-reviewer.md)

Human decision 2026-10-04 (loop run T12-19-57 stopped: "the spec is self-contradictory"): `:` stays literal in paths;
the URL-encoding scenario now expects `/api/basket/items/osio:a%23b`. The float-noise scenario uses `1.1 × 3`
(the agent showed `19.99 × 3` is exactly `59.97` in IEEE-754).

All eight findings accepted and specified above: totals rounded to kopiykas (spec changed from "never rounded"),
per-record validation in the store, atomic check-and-write for PATCH/DELETE, stable row identity on /basket,
disabled button while adding, visible mutation failures, URL-encoded product ids, tests beside `lib/basket.ts`
and `BasketLine.tsx`.

- [x] 8.1 Scenario tests first: `routes/basket.test.ts` "Non-integer price sums without float noise" and "Clear and
  change the quantity race"; `lib/store/baskets.test.ts` "A corrupt record does not break other baskets";
  `pages/BasketPage.test.tsx` "Quantity input keeps focus across an update" and "Removing a line fails";
  `api/client.test.ts` "Product id is URL-encoded in the path"; `components/ProductCard.test.tsx` "Double click adds
  once" and "Add fails"; `config.test.ts` `DATA_DIR: ""` throws (spec-reviewer finding). Run `pnpm test`, quote the red lines.
  Seven tests were red before 8.2–8.3 (6 failed / 85 passed). The eighth, "Product id is URL-encoded in the path",
  waited for the human decision on the `:` and is now red-then-green on its own:
  `AssertionError: expected '/api/basket/items/osio:a#b' to be '/api/basket/items/osio:a%23b'`.
- [x] 8.2 API: `lib/basket.ts` round `totals.sum` to 2 decimals and do the existence check inside the store update;
  `lib/store/baskets.ts` validate per record, skip and `console.error` corrupt ones; `config.ts` reject an empty
  `DATA_DIR`. Verify: the 8.1 API tests pass.
- [x] 8.3 Web: `BasketPage.tsx` key = `productId`; `BasketLine.tsx`/`BasketPage.tsx` show "Не вдалося оновити кошик"
  (`role="status"`) when a mutation rejects; `ProductCard.tsx` disable the button while pending and show
  "Не вдалося додати" on failure; `api/client.ts` encodes the product id in the path. Verify: the 8.1 web tests pass.
  Per the human decision of 2026-10-04 the `:` stays literal, so the path helper is
  `encodeURIComponent(productId).replaceAll("%3A", ":")` — `osio:a#b` → `/api/basket/items/osio:a%23b`, while the
  sibling scenarios keep `/api/basket/items/karashynyard:1498486363994` in the path and in the error message.
- [x] 8.4 Add `apps/api/src/lib/basket.test.ts` (service: add/merge/cap, totals rounding, not-found results) and
  `apps/web/src/components/BasketLine.test.tsx` (renders name/unit/prices, quantity change calls back, remove calls
  back) beside the code — AGENTS.md / `.claude/rules/web.md`. Verify: `pnpm test` green.
- [x] 8.5 Run `pnpm check` and quote its summary lines (Tests … passed, spec:check ok — …).
  `node scripts/check-verdict.mjs` → GREEN: `Test Files  18 passed (18)`, `Tests  103 passed (103)`,
  `spec:check ok — specs: 3 · active changes: 2 · archived: 1`, `all hook checks passed`.

### Human smoke run (outside the loop, after 7.2)

Not a checkbox: `pnpm dev` is a foreground watcher and `curl` / a browser are not on the loop's allow-list,
so the loop never waits for this step; the automated proof of the same behaviour is the 1.4 and 1.8 tests. A
human runs `pnpm dev`, opens http://localhost:5173/, clicks "Додати в кошик" on "Філе індички, 1 кг", sees
"Додано" and "Кошик (1)" in the header, opens http://localhost:5173/basket, sets the quantity to 2 and sees
"1330 ₴" and "Разом: 1330 ₴", reloads the page and still sees the line (cookie + `.data/baskets.json`), and
checks `curl -i localhost:4000/api/basket` prints a `Set-Cookie: basket_id=…; Max-Age=2592000; Path=/;
HttpOnly; SameSite=Lax` header on a first request. Then the human replaces `smoke: ____` in the "кошик" line
of `docs/session-notes.md` with what was seen.
