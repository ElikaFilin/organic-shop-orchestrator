# Design

## Context

See proposal.md — Why. This change is applied **after** `add-catalog` has landed, and builds on its contract
exactly (its delta specs and design.md): `@organic/shared` exports `SHOP_KEYS`, `ShopKeySchema`,
`ProductSchema` / `Product`, `CatalogResponseSchema`; `apps/api/src/lib/catalog.ts` exports
`createCatalogService(...)` returning `{ getSource, setSource, load, findProduct }` where
`findProduct(id)` = `(await load()).products.find((p) => p.id === id)` (works on a cold service, follows the
mode / cache / fallback path); `createApp({ catalog })` mounts `productsRoutes` at `/api/products`;
`config.ts` has `{ port, dataSource, snapshotDir }` with `snapshotDir` resolved via `import.meta.url`. The web
has `router.tsx` (`routes` + `createBrowserRouter`), `App` as the layout (h1 + `<Outlet />`), `CatalogPage`,
`ShopSection`, `ProductCard` (an `<li>` with `formatPrice(price)` = `` `${price} ₴` ``), `client.ts` with
`getProducts()`, and tests that render `createMemoryRouter(routes, { initialEntries })` with
`vi.mock("../api/client")`. Nothing basket-related exists; `.data/` is git-ignored and absent until the
first write. The `add-catalog` code is on disk and the references above were checked against it:
`apps/api/src/app.ts` exports `createApp({ catalog }: AppDependencies)` and it is called from exactly four
places — `src/server.ts`, `src/app.test.ts`, `src/routes/products.test.ts` and `src/lib/catalog.test.ts`
("Runtime switch to snapshot") — all of which this change touches (D5).

Constraints: `.claude/rules/api-routes.md` (one file per resource in `src/routes/`, parse with the shared zod
schemas, `400 { error }` / `404 { error }`, one `src/lib` call per handler, stores in `src/lib/store/*.ts` take
their file path, the basket id lives in `httpOnly` cookie `basket_id`) and `.claude/rules/web.md` (pages per
route, every server call in `client.ts`, Ukrainian copy, named buttons, `<ul>` lists, labelled inputs,
`role="status"`, Tailwind only, a test beside every component with behaviour). `process.env` only in
`config.ts`. No new dependency.

Hono 4.13 facts, verified in the installed `hono/dist/helper/cookie` + `hono/dist/utils/cookie` and against
Context7 (`/websites/hono_dev`): `setCookie(c, name, value, opts)` appends one `Set-Cookie` header serialized
as `name=value` then `; Max-Age=<seconds>` (`maxAge` is **seconds**), `; Path=<path>`, `; HttpOnly`,
`; SameSite=<Capitalized>` — in that order, so 30 days = `maxAge: 2_592_000` and the header is exactly
`basket_id=<uuid>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`; the value is `encodeURIComponent`-ed
(a UUID is unchanged); `getCookie(c, name)` parses the request's `Cookie` header; `app.request(path, { headers:
{ Cookie: "basket_id=…" } })` exercises all of it without a server.

Conflict surfaced (not silently resolved): `add-catalog`'s requirement "Catalog page lists products by shop"
ends with "no basket controls". This change adds the control through an `ADDED` requirement in the same
`catalog-web` capability and leaves that text alone (no `MODIFIED` is possible while `openspec/specs/` is
empty); the add-catalog scenarios still pass because the button renders no `role="status"` element until it
is clicked. The human decides when to drop the phrase (see proposal.md).

## Goals / Non-Goals

**Goals:**
- Basket logic pure and injectable (store, catalog, clock): every API scenario runs through `app.request()`
  on a temp directory with a fake catalog — no network, no real `.data/`.
- One basket object in the browser: the header and `/basket` render the same state, and every mutation
  returns the full basket, so the UI never refetches.
- Zero new dependencies; the store is short enough to read in one sitting.
- The identity middleware isolated in the basket router, so `add-admin`'s `admin_session` cookie can copy
  the shape.

**Non-Goals:**
- Signed cookies, CSRF tokens, rate limiting, basket expiry, multi-process locking of the JSON file,
  optimistic UI, a loading skeleton beyond one `role="status"` line.

## Decisions

1. **Shared schemas** (zod 4, `packages/shared/src/index.ts`): `BasketIdSchema = z.uuid()`;
   `ProductIdSchema = z.string().regex(new RegExp(`^(${SHOP_KEYS.join("|")}):[^\\s/]+$`))` — mirrors
   `Product.id = "<shopKey>:<sourceId>"` and keeps 400 (malformed) apart from 404 (well-formed, unknown);
   `BasketQuantitySchema = z.number().int().min(1).max(99)`;
   `AddBasketItemSchema = z.object({ productId: ProductIdSchema, quantity: BasketQuantitySchema.default(1) })`;
   `UpdateBasketItemSchema = z.object({ quantity: BasketQuantitySchema })`;
   `BasketLineSchema = z.object({ productId: ProductIdSchema, quantity: BasketQuantitySchema, product: ProductSchema.nullable() })`;
   `BasketTotalsSchema = z.object({ count: z.number().int().min(0), sum: z.number().min(0) })`;
   `BasketResponseSchema = z.object({ id: BasketIdSchema, items: z.array(BasketLineSchema), totals: BasketTotalsSchema })`;
   persisted shape `StoredBasketLineSchema = z.object({ productId: ProductIdSchema, quantity: BasketQuantitySchema, addedAt: z.iso.datetime() })`,
   `StoredBasketSchema = z.object({ updatedAt: z.iso.datetime(), items: z.array(StoredBasketLineSchema) })`,
   `BasketsFileSchema = z.object({ baskets: z.record(z.string(), StoredBasketSchema) })`; `z.infer` types
   `BasketId`, `ProductId`, `AddBasketItem`, `UpdateBasketItem`, `BasketLine`, `BasketTotals`,
   `BasketResponse`, `StoredBasketLine`, `StoredBasket`, `BasketsFile`.
   *Alternatives:* keep the file schema inside the API — rejected to follow the `SnapshotFileSchema`
   precedent (every persisted shape in one place); `z.string()` for timestamps — `z.iso.datetime()` catches a
   store bug for free (`new Date(ms).toISOString()` always satisfies it).
2. **Store** (`apps/api/src/lib/store/baskets.ts`): `createBasketStore(filePath)` returns
   `BasketStore = { get(id): Promise<StoredBasket | undefined>; update(id, mutate: (current: StoredBasket | undefined) => StoredBasket): Promise<StoredBasket> }`.
   `get` reads the whole file (`ENOENT` → `{ baskets: {} }`, anything else rethrown) and validates it with
   `BasketsFileSchema`. `update` runs read → `mutate` → write inside one promise chain
   (`queue = queue.then(op, op)`), so concurrent requests in the same process never lose an update. Write =
   `mkdir(dirname(filePath), { recursive: true })`, `writeFile(`${filePath}.${randomUUID()}.tmp`,
   JSON.stringify(file, null, 2))`, `rename(tmp, filePath)` (atomic replace within one directory on POSIX);
   on a failed write the temp file is unlinked and the error rethrown. A file that exists but fails the
   schema throws — the basket endpoints then answer 500 until a human fixes or removes the file; buyers'
   baskets are never silently discarded. No in-memory cache: the file is tiny and correctness beats speed.
   *Alternatives:* cache the parsed file — stale after a manual edit, no measurable gain; one file per basket
   — more files, same atomicity story, harder to list for `add-admin`; plain `get` / `put` without a queue —
   lost updates on a double-click.
3. **Basket service** (`apps/api/src/lib/basket.ts`, no Hono import):
   `createBasketService({ store, catalog, now })` with `catalog: Pick<CatalogService, "findProduct">` and
   `now: () => number` (the catalog cache's clock style; timestamps are `new Date(now()).toISOString()`).
   Methods: `get(id)`, `clear(id)` → `Promise<BasketResponse>`; `addItem(id, { productId, quantity })`,
   `updateItem(id, productId, quantity)`, `removeItem(id, productId)` →
   `Promise<BasketResult>` with
   `BasketResult = { ok: true; basket: BasketResponse } | { ok: false; error: "Product not found" | "Basket item not found" }`.
   `addItem` awaits `catalog.findProduct(productId)` first (a 404 never writes), then
   `store.update(id, …)`: existing line → `quantity = Math.min(99, existing + quantity)`, `addedAt` kept;
   new line appended with `addedAt = now`. `updateItem` / `removeItem` `get` first and answer `ok: false`
   without writing when the line is absent. `clear` writes `{ updatedAt: now, items: [] }`. An id with no
   stored basket reads as the empty basket; nothing is written until the first mutation (a `GET` never
   creates a file entry). `toResponse(id, stored)` keeps stored order, awaits `catalog.findProduct` per line
   (`?? null`) and reduces totals over lines with a product: `count += quantity`, `sum += product.price *
   quantity` — integer UAH, never rounded.
   *Alternatives:* throwing `NotFoundError` from lib and catching in the route — control flow moves into the
   handler, and typed results are already the project's convention (adapters).
4. **Route** (`apps/api/src/routes/basket.ts`): `basketRoutes(service)` =
   `new Hono<{ Variables: { basketId: string } }>()`. Middleware `app.use("*", …)`:
   `const parsed = BasketIdSchema.safeParse(getCookie(c, "basket_id")); const id = parsed.success ? parsed.data : randomUUID();`
   when not parsed → `setCookie(c, "basket_id", id, { httpOnly: true, path: "/", sameSite: "Lax", maxAge: 60 * 60 * 24 * 30 })`;
   `c.set("basketId", id); await next()`. Handlers stay three lines: parse
   (`await c.req.json().catch(() => undefined)` → `AddBasketItemSchema` / `UpdateBasketItemSchema`
   `.safeParse` → `c.json({ error: "Invalid request body" }, 400)`; `ProductIdSchema.safeParse(c.req.param("productId"))`
   → `c.json({ error: "Invalid product id" }, 400)`, param before body), one service call, then
   `c.json(result.basket, 201)` (POST) / `c.json(basket, 200)` / `c.json({ error: result.error }, 404)`.
   The middleware also runs on 400 / 404 answers, so a first visit always gets its cookie. `secure` is not
   set: dev is http on localhost; a TLS deployment adds `secure: true` in this one place.
   *Alternatives:* `setSignedCookie` — needs a secret in config and the owner decided on a plain UUID; an
   `X-Basket-Id` header — not a cookie, would not survive a reload without client code.
5. **App wiring**: `createApp({ catalog, basketStore, now = Date.now }: AppDependencies)` builds the service and
   mounts `app.route("/api/basket", basketRoutes(service))` next to the products router. `config.ts`:
   `dataDir: env.DATA_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../.data")` (same
   technique as `snapshotDir`). `server.ts`: `createBasketStore(join(config.dataDir, "baskets.json"))`. The
   three `add-catalog` tests that call `createApp` — `app.test.ts`, `routes/products.test.ts` and
   `lib/catalog.test.ts` (its "Runtime switch to snapshot" test) — gain
   `basketStore: createBasketStore(join(mkdtempSync(join(tmpdir(), "baskets-")), "baskets.json"))` plus the
   `mkdtempSync` / `tmpdir` / `join` imports. `basketStore` is required, so a call site that is missed fails
   `pnpm typecheck` with TS2345 instead of silently running on a default.
   *Alternative:* an optional `basketStore` with an in-memory default — would hide a missing wiring in
   production; rejected.
6. **Web state** (`apps/web/src/basket/BasketContext.tsx`): `BasketProvider` + `useBasket()`. State
   `{ status: "loading" } | { status: "error" } | { status: "ready"; basket: BasketResponse }`; the provider
   calls `getBasket()` once in a mount-only `useEffect` (`try { setReady(await getBasket()) } catch { setError() }`),
   exposes `setBasket(basket)` so whoever receives a fresh basket from a mutation stores it, and derives
   `count = status === "ready" ? basket.totals.count : 0`. `App` renders
   `<BasketProvider><header><h1>Organic Catalog</h1><nav><Link to="/basket">Кошик ({count})</Link></nav></header><Outlet /></BasketProvider>`.
   *Alternatives:* a callback prop from `App` to the cards — the data router builds the tree outside React,
   there is no prop path; a store library — new dependency; re-fetching `getBasket()` after every mutation —
   one extra request per click for data the response already carries (the owner's "refreshes after every
   mutation" is met either way; the spec pins "without a second `getBasket()` call").
7. **Product card button** (`ProductCard.tsx`): `<button type="button">Додати в кошик</button>` with local
   state `"idle" | "pending" | "added" | "failed"`; click → `setBasket(await addToBasket(product.id, 1))` →
   `"added"` renders `<span role="status">Додано</span>`; a rejection renders
   `<span role="status">Не вдалося додати</span>` (**assumption** — the owner's list stops at the success
   text; a card must say something when the call fails; no spec scenario, one extra test is welcome). The
   button stays enabled after success (quantities merge server-side), and no `role="status"` element exists
   before a click, so add-catalog's "no `role="status"`" assertions still hold.
8. **Basket page** (`apps/web/src/pages/BasketPage.tsx`; `router.tsx` adds
   `{ path: "basket", Component: BasketPage }` as a child of `App`): renders from the provider state —
   `loading` → `<h2>Кошик</h2>` + `<p role="status">Завантажуємо кошик…</p>`; `error` →
   `<p role="status">Не вдалося завантажити кошик</p>` (both **assumptions**, same reasoning as D7);
   `ready` with no lines → `<p role="status">Кошик порожній</p>` + `<Link to="/">До каталогу</Link>`;
   `ready` with lines → `<ul>` of `BasketLine`, `<p>Разом: {formatPrice(totals.sum)}</p>`,
   `<button>Очистити кошик</button>` → `setBasket(await clearBasket())`. `formatPrice` is imported from
   `ProductCard.tsx`, not duplicated.
9. **Basket line** (`apps/web/src/components/BasketLine.tsx`, an `<li>`): product present → `<img alt={name}>`,
   name, unit, `formatPrice(price)`, `<input type="number" min={1} max={99} aria-label="Кількість">`,
   `formatPrice(price * quantity)`, `<button>Видалити</button>`; product `null` → `<span>Товар недоступний</span>`
   in place of image / name / unit / prices, input and button kept. The input keeps a local text state
   (`useState(String(quantity))`, reset by `key={`${productId}:${quantity}`}` on the `<li>`); `onChange` →
   `const n = Number(value)`; if `Number.isInteger(n) && n >= 1 && n <= 99` →
   `setBasket(await updateBasketItem(productId, n))`, otherwise the typed text stays local and nothing is
   sent (lets the buyer clear the field before typing). "Видалити" → `setBasket(await removeBasketItem(productId))`.
   A rejected mutation leaves the last known basket on screen (**assumption**).
   *Alternatives:* `onBlur` only — the owner said "change calls `updateBasketItem`" and
   `fireEvent.change` is the natural test; debouncing — premature for a number input.
10. **Client** (`client.ts`): one private `request(method, path, body?)` →
    `fetch(path, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })`;
    `!res.ok` → `throw new Error(`${method} ${path} failed: ${res.status}`)`; otherwise
    `BasketResponseSchema.parse(await res.json())`. `getBasket = () => request("GET", "/api/basket")`,
    `addToBasket = (productId, quantity) => request("POST", "/api/basket/items", { productId, quantity })`,
    `updateBasketItem = (productId, quantity) => request("PATCH", `/api/basket/items/${productId}`, { quantity })`,
    `removeBasketItem = (productId) => request("DELETE", `/api/basket/items/${productId}`)`,
    `clearBasket = () => request("DELETE", "/api/basket")`. `getProducts` is untouched. Product ids contain
    `:` only, which needs no encoding in a path segment, so the paths read exactly as in the spec.

## File layout

```
packages/shared/src/index.ts                       + basket schemas and types (D1)
apps/api/src/config.ts (+ config.test.ts)          + dataDir / DATA_DIR (D5)
apps/api/src/lib/store/baskets.ts (+ .test.ts)     createBasketStore(filePath): get, update — atomic JSON file (D2)
apps/api/src/lib/basket.ts                         createBasketService({ store, catalog, now }), BasketResult (D3; covered by the route tests)
apps/api/src/routes/basket.ts (+ .test.ts)         basketRoutes(service): cookie middleware + five handlers (D4)
apps/api/src/app.ts / app.test.ts / server.ts      createApp({ catalog, basketStore, now }); store wired from config.dataDir (D5)
apps/api/src/routes/products.test.ts               passes a temp basketStore (signature change only)
apps/api/src/lib/catalog.test.ts                   passes a temp basketStore in "Runtime switch to snapshot" (signature change only)
apps/web/src/api/client.ts (+ client.test.ts)      + getBasket, addToBasket, updateBasketItem, removeBasketItem, clearBasket (D10)
apps/web/src/basket/BasketContext.tsx              BasketProvider, useBasket (D6; covered by App / page tests)
apps/web/src/App.tsx (+ App.test.tsx)              provider + header link "Кошик (N)" (D6)
apps/web/src/components/ProductCard.tsx (+ .test)  + "Додати в кошик" / "Додано" (D7)
apps/web/src/components/BasketLine.tsx             one <li> of the basket page (D9; covered by BasketPage tests)
apps/web/src/pages/BasketPage.tsx (+ .test.tsx)    route /basket (D8)
apps/web/src/router.tsx                            + { path: "basket", Component: BasketPage }
apps/web/src/pages/CatalogPage.test.tsx            setup only: getBasket mocked with a resolved empty basket
```

## Risks / Trade-offs

- [Unsigned UUID cookie] → whoever knows an id can read or alter that basket. Accepted for an anonymous
  basket that holds no personal data: ids are 122 random bits, not guessable; `add-admin` signs its own
  session cookie. If it ever matters, `setSignedCookie` with a secret from config touches only the middleware.
- [No `Secure` attribute] → by design for http on localhost; a TLS deployment sets `secure: true` in D4.
- [One JSON file, whole-file rewrite] → O(baskets) per write — fine for a capstone; the in-process queue
  prevents lost updates, but two API processes on one file would race (Non-Goal, documented).
- [Corrupt `baskets.json`] → the store throws, `/api/basket` answers 500 until a human fixes or deletes the
  file; chosen over silently starting from an empty file.
- [`findProduct` per line calls `load()`] → cached 5 minutes in live mode, memoized snapshots in snapshot
  mode (add-catalog D4 / D5), so a 10-line basket costs no extra shop requests; batching through one
  `load()` would change the catalog API — not now.
- [`createApp` signature and the header fetch touch add-catalog tests] → five setup-only edits (D5:
  `app.test.ts`, `routes/products.test.ts`, `lib/catalog.test.ts`; D6: `CatalogPage.test.tsx` and the existing
  heading test of `App.test.tsx`), listed in explicit tasks (1.7, 5.2, 6.2) so the red run stays attributable
  to the new scenarios.
- [Quantity input UX] → typing `0` or clearing the field sends nothing, and the server rejects out-of-range
  values with 400, so the page can never show an invalid quantity coming from the server.
- [32 scenarios → 32 tests] → helpers (fake catalog built from `data/shops/*.json`, temp-store factory, a
  request builder that sets the `Cookie` header) live in the test files, not in `src/`.

## Open Questions

None that would change the specs, the approach or the task breakdown.
