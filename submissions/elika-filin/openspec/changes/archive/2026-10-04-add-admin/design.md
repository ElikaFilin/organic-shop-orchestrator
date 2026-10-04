# Design

## Context

See proposal.md — Why. This change is applied **after** `add-basket` is on disk and builds on its design
(D1–D10) and `add-catalog`'s archived specs exactly. From `add-catalog` (observed in the code):
`createCatalogService({ source, shops, snapshots, cache, now })` returns
`{ getSource, setSource, load, findProduct }`; `load()` resolves each shop (`resolveShop` → snapshot / cache /
adapter / fallback) into `{ key, products, status, error? }` and then calls the pure
`selectVisibleProducts(perShop)` ("first ten per shop") before building `ShopSummary`s with
`count = products served`; `config.ts` has `{ port, dataSource, snapshotDir }` and is the only reader of
`process.env`; `App` is the layout; `index.css` is `@import "tailwindcss";` and `index.html`'s `<body>` has
no class. From `add-basket` (its design, which is the contract even where the code has not landed yet):
`config.dataDir` (`DATA_DIR`, default `<repo>/.data`); `createBasketStore(filePath)` with `get` / `update`
(promise-queued read → mutate → atomic write); `createApp({ catalog, basketStore, now })`; `ProductIdSchema`
in `@organic/shared`; the client's private `request(method, path, body?)` helper and the five basket
functions; `BasketProvider` + `useBasket()` and the header `<nav><Link to="/basket">Кошик ({count})</Link></nav>`
in `App.tsx`; page tests that render `createMemoryRouter(routes, { initialEntries })` with
`vi.mock("../api/client")` and a resolved `getBasket`. `add-basket`'s `src/routes/basket.test.ts` is already
on disk (its `newApp()` calls `createApp({ catalog: fakeCatalog, basketStore })` with a fake catalog typed as
the full service, and its "Non-integer price sums without float noise" test builds a second
`createApp({ catalog: { ...fakeCatalog, findProduct }, basketStore })`) — this change must keep it green.
`add-basket`'s review group 8 is on disk too: `lib/basket.test.ts` and `BasketLine.test.tsx` beside their
code, and the client's `itemPath` encoding product ids with `encodeURIComponent(productId).replaceAll("%3A", ":")`
(basket-web: "percent-encoded with `encodeURIComponent` except the `:`").

Constraints: `.claude/rules/api-routes.md` (one file per resource; parse with the shared zod schemas; `400`
/ `404` with `{ error }`; one `src/lib` call per handler; stores take their file path; the admin session in
`httpOnly` cookie `admin_session`), `.claude/rules/web.md` (one page per route, every call in `client.ts`,
Ukrainian copy, named buttons, `<ul>` lists, labelled inputs, `role="status"`, Tailwind only, a test beside
each behaviour), `process.env` only in `config.ts`, no new dependency, no live shops in tests.

Hono 4.13.13 facts, verified against the installed `hono/dist/helper/cookie` and `hono/dist/utils/cookie`
and with a throwaway `app.request()` script on 2026-10-04 (consistent with the Context7 query logged as row
4 of `docs/context7-log.md`): `setSignedCookie(c, name, value, secret, opts)` writes
`name=<encodeURIComponent(value + "." + base64(HMAC-SHA256(secret, value)))>` followed by `; Max-Age=<s>`,
`; Path=<p>`, `; HttpOnly`, `; SameSite=<Capitalized>` in that order — so for `adminToken: "secret-token"`
the login header is exactly
`admin_session=admin.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax`;
`getSignedCookie(c, secret, name)` decodes the request cookie, splits at the **last** `.`, returns the value
(`"admin"`) when the 44-character base64 signature verifies, `false` when it does not (tampered value, other
secret) and `undefined` when the cookie is missing or the signature is malformed (`admin.garbage`);
`deleteCookie(c, name, { path: "/", httpOnly: true, sameSite: "Lax" })` writes exactly
`admin_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`; `app.use("/x/*", mw)` also matches `/x`
(verified), so two `use` calls cover every guarded path; `c.body(null, 204)` is the empty 204.

## Goals / Non-Goals

**Goals:**
- One rule for "which products are visible", in one pure function, used by the served list, the admin
  listing's `visible` flags and the default array created on the first toggle — so the three can never
  disagree.
- Every API scenario runs through `app.request()` on temp directories with fake adapters and a real settings
  store: no network, no real `.data/`, no `process.env`.
- The admin page renders from one state object; every mutation re-renders from the server's answer, never
  from an optimistic guess.
- Zero new dependencies; `add-basket`'s request helper is generalised, not duplicated, and `apps/web` never
  imports `zod` (it is a dependency of `packages/shared` only).
- Every new `src/lib` module and every new component with user-visible behaviour has a test beside it
  (AGENTS.md, `.claude/rules/web.md`), in addition to the one-test-per-scenario route and page tests.

**Non-Goals:**
- Session storage, refresh, revocation or expiry handling beyond the cookie's `Max-Age`; constant-time token
  comparison, rate limiting, CSRF tokens, the `Secure` cookie flag (http on localhost).
- Caching the settings file in memory; multi-process locking of `.data/`.
- Optimistic UI, loading skeletons beyond one `role="status"` line, product search or paging in the panel.

## Decisions

1. **Shared schemas** (zod 4, `packages/shared/src/index.ts`):
   `ShopVisibilitySchema = z.record(ShopKeySchema, z.array(z.string()).nullable())` — in zod 4 a record keyed
   by an enum is exhaustive, so both shops are required and a third shop key is a type error until it is
   added everywhere; `defaultVisibility = (): ShopVisibility => ({ karashynyard: null, osio: null })` (a
   function, so no shared mutable object); `AdminSettingsSchema = z.object({ dataSource: DataSourceSchema, visibility: ShopVisibilitySchema })`
   (also the file shape); `UpdateAdminSettingsSchema = z.strictObject({ dataSource: DataSourceSchema })`
   (strict: the owner's "400 for anything else" — a body that also carries `visibility` is refused rather than
   silently trimmed); `AdminLoginSchema = z.object({ token: z.string() })`;
   `AdminSessionSchema = z.object({ authenticated: z.boolean() })`;
   `SetProductVisibilitySchema = z.object({ visible: z.boolean() })`;
   `ProductVisibilityResponseSchema = z.object({ id: ProductIdSchema, visible: z.boolean(), visibility: z.array(z.string()) })`;
   `AdminShopSummarySchema = ShopSummarySchema.omit({ count: true }).extend({ total: z.number().int().min(0), visible: z.number().int().min(0) })`;
   `AdminProductSchema = ProductSchema.extend({ visible: z.boolean() })`;
   `AdminProductsResponseSchema = z.object({ source: DataSourceSchema, shops: z.array(AdminShopSummarySchema), products: z.array(AdminProductSchema) })`;
   `z.infer` types `ShopVisibility`, `AdminSettings`, `UpdateAdminSettings`, `AdminLogin`, `AdminSession`,
   `SetProductVisibility`, `ProductVisibilityResponse`, `AdminShopSummary`, `AdminProduct`,
   `AdminProductsResponse`. *Alternatives:* ids as `sourceId` per shop — the owner specified product ids and
   the toggle route receives a product id; `z.partialRecord` — a missing shop would silently mean "default".
2. **Config** (`config.ts`): `adminToken: string | undefined` =
   `env.ADMIN_TOKEN !== undefined && env.ADMIN_TOKEN.trim() !== "" ? env.ADMIN_TOKEN : undefined`. A blank
   token is "unset" (**assumption**: `.env.example` ships `ADMIN_TOKEN=` for a copied `.env`; failing fast
   would block the storefront for a user who has no admin yet, unlike `DATA_SOURCE` whose wrong value would
   serve the wrong data). The property is declared non-optional with `undefined` in its type so every
   `createApp` call site must pass it explicitly.
3. **Settings store** (`apps/api/src/lib/store/admin-settings.ts`):
   `createAdminSettingsStore(filePath, defaults: AdminSettings)` returns
   `AdminSettingsStore = { read(): Promise<AdminSettings>; update(mutate: (current: AdminSettings) => AdminSettings): Promise<AdminSettings> }`.
   `read`: `readFile` → `ENOENT` → `structuredClone(defaults)`; anything else rethrown; a present file is
   `AdminSettingsSchema.parse(JSON.parse(text))` and a failure throws (never rewritten — the basket-store
   precedent: the admin answers 500 and startup fails loudly until a human fixes the file). `update` runs read
   → `mutate` → write inside one promise chain (`queue = queue.then(op, op)`), write =
   `mkdir(dirname, { recursive: true })`, `writeFile(`${filePath}.${randomUUID()}.tmp`, JSON.stringify(next, null, 2))`,
   `rename(tmp, filePath)`, temp file unlinked on failure. No in-memory cache: the file is a few hundred
   bytes and a manual edit must be picked up. *Alternatives:* reuse `createBasketStore` with a generic
   schema — different shape (one object, not a map by id) and a `defaults` concept the basket store has no use
   for; two files (source / visibility) — two atomicity stories for one settings object.
4. **Catalog** (`apps/api/src/lib/catalog.ts`): `selectVisibleProducts(perShop, visibility = defaultVisibility())`
   keeps the one-argument call of the archived scenario valid and delegates per shop to the exported
   `visibleOfShop(products: Product[], chosen: string[] | null): Product[]` =
   `chosen === null ? products.slice(0, 10) : products.filter((p) => chosen.includes(p.id))` — the single
   place the rule lives (D6 reuses it for `visible` flags and the first-toggle default). `CatalogServiceOptions`
   gains a required `settings: { read(): Promise<AdminSettings> }` (the store itself in production; a stub or
   a temp-dir store in tests); `CatalogService` gains
   `loadAll(): Promise<CatalogInventory>` with
   `CatalogInventory = { source: DataSource; shops: Array<{ key: ShopKey; name: string; url: string; status: ShopStatus; error?: string; products: Product[] }> }`
   — the resolved shops with their **full** lists, exactly what `load()` computed internally before; `load()`
   becomes `loadAll()` + `(await settings.read()).visibility` + `selectVisibleProducts` + summaries, so one
   `GET /api/products` costs one small file read (also per `findProduct`, i.e. per basket line — negligible).
   `source` stays in the service and is switched by `setSource` (D6), so `add-catalog`'s "Runtime switch to
   snapshot" scenario holds unchanged; the server seeds it from the persisted settings (D8). *Alternatives:*
   reading `dataSource` from the settings on every load — would leave `setSource` meaningless and break the
   archived scenario; pushing visibility into the service (`setVisibility`) — a second copy of the truth that
   would drift from the file after a manual edit; an optional `settings` defaulting to `null` visibility —
   would hide a missed wiring in production (the `add-basket` D5 precedent).
5. **Admin auth** (`apps/api/src/lib/admin-auth.ts` + `admin-auth.test.ts`, no Hono import):
   `createAdminAuth({ adminToken })` returns
   `AdminAuth = { readonly secret: string | undefined; login(token: string): AdminLoginResult }` with
   `AdminLoginResult = { ok: true } | { ok: false; error: "Admin is not configured" | "Invalid token" }`;
   `login` answers "not configured" when `secret` is undefined and compares with `===` otherwise (the owner's
   rule; constant-time comparison is a Non-Goal — one admin, local use, no rate limiting anyway). The cookie
   itself is an HTTP concern and stays in the route (D7). *Alternative:* a session store with random ids —
   the owner chose a signed cookie with the token as secret, which needs no storage and is invalidated by
   changing `ADMIN_TOKEN`. `admin-auth.test.ts` asserts the three `login` results on the function itself
   (`adminToken: undefined` → `{ ok: false, error: "Admin is not configured" }`; `"wrong-token"` against
   `"secret-token"` → `{ ok: false, error: "Invalid token" }`; `"secret-token"` → `{ ok: true }`) and
   `secret`; the route tests assert the same through HTTP.
6. **Admin service** (`apps/api/src/lib/admin.ts` + `admin.test.ts`, no Hono import):
   `createAdminService({ catalog, settings })` with `catalog: Pick<CatalogService, "loadAll" | "setSource">`
   returns `AdminService`: `getSettings()` = `settings.read()`; `updateSettings({ dataSource })` =
   `const next = await settings.update((s) => ({ ...s, dataSource })); catalog.setSource(next.dataSource); return next;`
   (persist first — if the write fails the catalog is left as it was, in step with the file);
   `listProducts()` = `loadAll()` + `read()` → for each shop `visibleIds = new Set(visibleOfShop(shop.products, chosen).map((p) => p.id))`,
   products mapped to `{ ...product, visible: visibleIds.has(product.id) }`, summary
   `{ key, name, url, status, error?, total: products.length, visible: visibleIds.size }` (an `error` key only
   when present, like `ShopSummary`); `setProductVisibility(id, visible)` → `loadAll()`, the shop whose
   `products` contain `id` or `{ ok: false, error: "Product not found" }`, else
   `settings.update((s) => { const current = s.visibility[key] ?? visibleOfShop(shop.products, null).map((p) => p.id); const next = visible ? (current.includes(id) ? current : [...current, id]) : current.filter((x) => x !== id); return { ...s, visibility: { ...s.visibility, [key]: next } }; })`
   → `{ ok: true, result: { id, visible, visibility: next } }`. Array order is append order (serving order
   is always upstream order, so it does not matter). *Alternative:* storing hidden ids instead of visible ids
   — the owner's model is "the ids the admin chose", and it makes "show beyond the first ten" a plain append.
   `admin.test.ts` drives the service over a stub `loadAll` (the 12-product karashynyard list and the osio
   snapshot the route scenarios use) and a settings store on a temp directory, asserting the same values as
   the route scenarios: the `visible` flags with `total` / `visible` per shop for `null` and for an array, the
   first-toggle default array, append, remove, an idempotent repeat, "not found" writing nothing, and
   `updateSettings` persisting before `setSource`.
7. **Admin routes** (`apps/api/src/routes/admin.ts`): `adminRoutes(auth, service)` = `new Hono()`;
   constants `COOKIE = "admin_session"`, `COOKIE_OPTIONS = { httpOnly: true, path: "/", sameSite: "Lax" as const }`,
   `SESSION_MAX_AGE = 43_200`; helper
   `isAuthenticated(c) = auth.secret !== undefined && (await getSignedCookie(c, auth.secret, COOKIE)) === "admin"`.
   Public handlers: `POST /login` — parse `AdminLoginSchema` (`await c.req.json().catch(() => undefined)`)
   → 400; `auth.login(token)` → 503 / 401 by `error`; else
   `await setSignedCookie(c, COOKIE, "admin", auth.secret, { ...COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE })` and
   `c.body(null, 204)`; `POST /logout` — `deleteCookie(c, COOKIE, COOKIE_OPTIONS)`, `c.body(null, 204)`;
   `GET /session` — `c.json({ authenticated: await isAuthenticated(c) })`. Guard:
   `routes.use("/settings/*", guard)` and `routes.use("/products/*", guard)` (both match the bare path too —
   verified), `guard` = `isAuthenticated` ? `next()` : `c.json({ error: "Unauthorized" }, 401)` — bound to
   paths rather than registration order, so a later route cannot slip in front of it. Guarded handlers (three
   lines each): `GET /settings` → `c.json(await service.getSettings())`; `PUT /settings` →
   `UpdateAdminSettingsSchema.safeParse` → 400 → `c.json(await service.updateSettings(body), 200)`;
   `GET /products` → `c.json(await service.listProducts())`; `PUT /products/:id/visibility` →
   `ProductIdSchema.safeParse(c.req.param("id"))` → `{ error: "Invalid product id" }` 400 (param before
   body, as the basket route does) → `SetProductVisibilitySchema.safeParse` → 400 → service → 200 `result` or
   404 `{ error }`. Mounted in `createApp` at `/api/admin`. *Alternative:* a `/api/admin/*` middleware with a
   public-path allow-list — string matching on `c.req.path` under a mount prefix is the brittle part.
8. **App wiring and startup**: `createApp({ catalog, basketStore, settingsStore, adminToken, now = Date.now }: AppDependencies)`
   builds `createAdminAuth({ adminToken })` and `createAdminService({ catalog, settings: settingsStore })`
   and mounts `adminRoutes(auth, service)`; `adminToken: string | undefined` and `settingsStore` are required
   keys, so a missed call site fails `pnpm typecheck` (TS2345). `server.ts` (top-level `await`, already used
   by the test files under the same tsconfig):
   `const settingsStore = createAdminSettingsStore(join(config.dataDir, "admin-settings.json"), { dataSource: config.dataSource, visibility: defaultVisibility() }); const settings = await settingsStore.read();`
   then `createCatalogService({ source: settings.dataSource, ..., settings: settingsStore })` and
   `createApp({ catalog, basketStore, settingsStore, adminToken: config.adminToken })` — the persisted source
   wins over `DATA_SOURCE`; a corrupt file no longer stops the boot — the `read()` is caught, the defaults
   serve and one `console.error` names the file (review finding, task group 8). Setup-only edits to existing
   tests: `app.test.ts` (stub catalog gains `loadAll: async () => ({ source: "snapshot", shops: [] })`; new
   `createApp` arguments), `routes/products.test.ts` and `lib/catalog.test.ts` (`createCatalogService` gains
   `settings`; `createApp` gains the arguments), `routes/basket.test.ts` from `add-basket` (`fakeCatalog`
   gains `loadAll` throwing `new Error("not used")`, inherited by the `{ ...fakeCatalog, findProduct }`
   literal of "Non-integer price sums without float noise"; both its `createApp` calls — `newApp()` and the
   one inside that test — pass a temp settings store and `adminToken: undefined`). Each test file gets one helper `tempSettingsStore(defaults?)` =
   `createAdminSettingsStore(join(mkdtempSync(join(tmpdir(), "admin-settings-")), "admin-settings.json"), defaults ?? { dataSource: "snapshot", visibility: defaultVisibility() })`.
9. **Client** (`apps/web/src/api/client.ts`): `add-basket`'s private helper becomes
   `request<T>(method: string, path: string, options: { schema?: { parse(input: unknown): T }; body?: unknown } = {}): Promise<T>`.
   The `schema` option is typed **structurally** (`{ parse(input: unknown): T }`, which every zod schema
   satisfies), not as `ZodType<T>`: `zod` is a dependency of `packages/shared` only, and under pnpm's isolated
   layout nothing under `apps/web` can resolve `import type { ZodType } from "zod"` — `pnpm test` would stay
   green because a type import is erased, but `pnpm typecheck` fails with TS2307 "Cannot find module 'zod'"
   (verified on 2026-10-04: no `node_modules/zod` in `apps/web/` or the repo root). Adding `zod` to
   `apps/web` would be a new dependency (proposal.md: none added; AGENTS.md: ask first), so `client.ts`
   imports from `@organic/shared` only and never from `zod` — do not `pnpm add zod`. Same `fetch(path, { method, credentials: "same-origin", headers: body !== undefined ? { "Content-Type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined })`,
   `!res.ok` → `throw new ApiError(method, path, res.status)` where
   `export class ApiError extends Error { constructor(method, path, readonly status: number) { super(`${method} ${path} failed: ${status}`); this.name = "ApiError"; } }`
   (an `Error` with the same message `add-basket`'s tests assert, plus `status`); no `schema` → resolves
   `undefined` (204); else `schema.parse(await res.json())`. The five basket functions become one-liners
   passing `schema: BasketResponseSchema` (behaviour unchanged, their paths still built by `add-basket`'s
   `itemPath`, so their tests stay green); `getProducts` is left as `add-catalog` wrote it. New: `getAdminSession = () => request("GET", "/api/admin/session", { schema: AdminSessionSchema })`,
   `adminLogin = (token) => request<void>("POST", "/api/admin/login", { body: { token } })`,
   `adminLogout = () => request<void>("POST", "/api/admin/logout")`,
   `getAdminSettings = () => request("GET", "/api/admin/settings", { schema: AdminSettingsSchema })`,
   `updateSettings = (input: UpdateAdminSettings) => request("PUT", "/api/admin/settings", { schema: AdminSettingsSchema, body: input })`,
   `getAdminProducts = () => request("GET", "/api/admin/products", { schema: AdminProductsResponseSchema })`,
   `setProductVisibility = (id, visible) => request("PUT", `/api/admin/products/${encodeProductId(id)}/visibility`, { schema: ProductVisibilityResponseSchema, body: { visible } })`
   — the id goes through the one private `encodeProductId(id) = encodeURIComponent(id).replaceAll("%3A", ":")`
   that `add-basket`'s `itemPath` already applies (its task 8.3, on disk: `encodeURIComponent` except the
   literal `:`; basket-web scenario "Product id is URL-encoded in the path", `osio:a#b` →
   `/api/basket/items/osio:a%23b`), extracted so both callers of the helper follow one rule
   (`ProductIdSchema` permits `#`, `?`, `%`; an unencoded `osio:a#b` reaches the server as `osio:a` → 404).
   The client scenarios therefore pin `/api/admin/products/osio:6abcf192b7db2532803d266d/visibility` for a
   plain id and `/api/admin/products/osio:a%23b/visibility` for `osio:a#b`. The admin-settings API scenarios
   send the raw id through `app.request()`: Hono decodes `:id`, so an encoded `%23` and a literal `:` reach
   the handler as the same value.
   The page reads the status with a type guard (`(e as { status?: unknown }).status === 401`), so tests can
   reject with `Object.assign(new Error(...), { status })` under the automocked module. *Alternative:* a
   second helper for the admin — duplicates the fetch contract the basket tests already pin.
10. **Admin page** (`apps/web/src/pages/AdminPage.tsx` + `components/AdminLoginForm.tsx` and
    `components/AdminShopSection.tsx`, each with a test beside it; `router.tsx` adds
    `{ path: "admin", Component: AdminPage }` under `App`). The page owns the state and renders the panel
    markup itself — there is no separate `AdminPanel` component: a panel that only forwards the page's state
    and three callbacks would be one more file owing a test of its own (`web.md`) that repeats the page tests.
    State:
    `{ status: "checking" } | { status: "anonymous" } | { status: "loading" } | { status: "ready"; settings: AdminSettings; products: AdminProductsResponse; saved: boolean; alert?: string } | { status: "failed" }`.
    Mount: `getAdminSession()` → `false` → `anonymous`; `true` → `loading` →
    `Promise.all([getAdminSettings(), getAdminProducts()])` → `ready`; a rejected session check or panel load →
    `failed` with `<p role="status">Не вдалося завантажити адмін-панель</p>` (**assumption**, no scenario —
    covered by one extra page test, "Failed panel load"). `checking` / `loading` render
    `<p role="status">Завантажуємо…</p>` and nothing else (scenario "Loading state").
    `AdminLoginForm({ onSubmit })` with `onSubmit: (token: string) => Promise<void>` owns its own `alert`
    state: `<form onSubmit>`, `<h2>Вхід для адміністратора</h2>`,
    `<label>Токен адміністратора <input type="password" /></label>`, `<button type="submit">Увійти</button>`,
    `alert && <p role="alert">{alert}</p>`; submit → `setAlert(undefined)` → `onSubmit(token)`; a rejection
    → `setAlert(loginAlert(error))` with the exported pure `loginAlert(error: unknown): string` — 401 →
    "Невірний токен", 503 → "Адмінку не налаштовано", any other `status` or none → "Не вдалося увійти"
    (scenarios "Wrong token", "Admin not configured", "Login failure other than 401/503 and alert reset").
    The page passes `onSubmit = async (token) => { await adminLogin(token); setState({ status: "loading" }); await loadPanel(); }`,
    so on success the form unmounts and never touches its state again. The panel, rendered by the page in
    the `ready` state: `<h2>Адмін-панель</h2>`, `<fieldset><legend>Джерело даних</legend>` with two
    `<label><input type="radio" name="dataSource" value=…/> …</label>` (checked = `settings.dataSource`),
    `onChange` → `alert = undefined` → `const next = await updateSettings({ dataSource })` →
    `settings = next, saved = true` → `products = await getAdminProducts()` (the lists differ by source —
    **assumption** recorded in the spec); `saved && <p role="status">Збережено</p>`; one `AdminShopSection`
    per `products.shops` entry with that shop's products (`products.products.filter(p => p.shopKey === key)`)
    and the page's `onToggle`; `alert && <p role="alert">{alert}</p>`; `<button type="button">Вийти</button>`
    → `adminLogout()` → `anonymous`. `AdminShopSection({ shop, products, onToggle })` is presentational
    (`<section aria-labelledby>`, `<h3>{name}</h3>`, `<p>{STATUS_NOTE[status]}</p>` with
    `STATUS_NOTE = { live: "наживо", snapshot: "знімок", "snapshot-fallback": "збережена копія", unavailable: "недоступний" }`,
    `<p>Видимих: {products.filter(p => p.visible).length}</p>`, and when `products.length > 0` a `<ul>` of
    `<li><label><input type="checkbox" checked={visible} onChange={(e) => onToggle(id, e.currentTarget.checked)} /> {name}</label></li>`);
    the page's `onToggle` → `alert = undefined` → `const r = await setProductVisibility(id, checked)` → the
    product's `visible = r.visible` in page state (count recomputed from the flags — one source of truth). A
    rejected `updateSettings` or `setProductVisibility` → `alert = "Не вдалося зберегти"` and nothing else
    changes, so the radios and the checkbox re-render from the unchanged state (scenarios "Source switch
    failure keeps the radio", "Save failure keeps the checkbox"); a rejected products reload after a
    successful `updateSettings` keeps the previous lists and shows the same alert (**assumption**, no
    scenario). The status note is plain text, not `role="status"`: it is a label, and keeping "Збережено"
    the only live region makes `getByRole("status")` unambiguous. *Alternatives:* a route `loader` +
    `action` — the client mock would have to go through router plumbing, and the three other pages use
    `useEffect` state; a context for the admin state — only one page reads it; a separate `AdminPanel`
    component — see above.
11. **Layout and theme**: `App.tsx`'s `<nav>` becomes
    `<Link to="/">Каталог</Link> <Link to="/basket">Кошик ({count})</Link> <Link to="/admin">Адмін</Link>`
    (the basket link exactly as `add-basket` D6 renders it); `index.css` =
    `@import "tailwindcss";\n\n:root {\n  color-scheme: light;\n}`; `index.html` gets
    `<body class="bg-white text-stone-900">`. Both are asserted by reading the files (jsdom cannot see them):
    the only honest test for a stylesheet rule. *Alternative:* `@layer base { body { @apply … } }` in
    `index.css` — `web.md` wants utility classes in markup, and the body lives in `index.html`.
12. **Tests**: one test per scenario, named after it, in the config / store / catalog / route / client /
    layout / page test files tasks.md lists — plus a unit test beside every new `src/lib` module and every
    new component (AGENTS.md: "a Vitest test beside it"; `web.md`: "a Testing Library test beside it" — the
    rule both previous changes were sent back for: `add-catalog`'s `cache.test.ts`, `add-basket`'s
    `lib/basket.test.ts` and `BasketLine.test.tsx`): `lib/admin-auth.test.ts`, `lib/admin.test.ts`,
    `components/AdminLoginForm.test.tsx`, `components/AdminShopSection.test.tsx`. The unit tests assert the
    same values as the scenarios they sit under (the same ids, arrays, notes and alert texts), so each maps
    to a scenario and never pins a second truth; the route and page tests remain the scenario tests of
    record. API helpers live in `routes/admin.test.ts`:
    `newApp({ source, adminToken, settingsFile?, karashynyard?, osio?, snapshotDir? })` (temp dirs for the
    settings and basket stores, fake adapters as in `products.test.ts`, `createTtlCache` on `now: () => 0`),
    `login(app)` → the `Set-Cookie` value before the first `;`, `req(app, method, path, { cookie?, body?, rawBody? })`.
    Constants `SIGNATURE = "YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D"` and
    `OTHER_SIGNATURE = "%2FPIVjLj4NPDY7r3QD9XpFnAbAO6%2F%2BG9MWfTiAQpvCdg%3D"` with a one-line
    `createHmac` check beside them so a reader can re-derive them. Web tests mock `../api/client` and give
    `getBasket` the empty basket (the layout calls it on mount, per `add-basket`).

## File layout

```
packages/shared/src/index.ts                          + admin / visibility schemas, defaultVisibility() (D1)
apps/api/src/config.ts (+ config.test.ts)             + adminToken / ADMIN_TOKEN (D2)
apps/api/src/lib/store/admin-settings.ts (+ .test.ts) createAdminSettingsStore(filePath, defaults): read, update (D3)
apps/api/src/lib/catalog.ts (+ catalog.test.ts)       visibleOfShop, selectVisibleProducts(perShop, visibility?), loadAll(), settings option (D4)
apps/api/src/lib/admin-auth.ts (+ admin-auth.test.ts) createAdminAuth({ adminToken }) (D5; unit test: the three login results)
apps/api/src/lib/admin.ts (+ admin.test.ts)           createAdminService({ catalog, settings }) (D6; unit test over a stub loadAll + temp settings store)
apps/api/src/routes/admin.ts (+ admin.test.ts)        adminRoutes(auth, service): login / logout / session, guard, settings, products, visibility (D7)
apps/api/src/app.ts / app.test.ts / server.ts         createApp({ catalog, basketStore, settingsStore, adminToken, now }); startup reads the settings (D8)
apps/api/src/routes/products.test.ts                  settings option + createApp arguments (setup) · + visibility / startup scenarios
apps/api/src/lib/catalog.test.ts                      settings option + createApp arguments (setup) · + selection scenarios
apps/api/src/routes/basket.test.ts                    add-basket's file: fakeCatalog.loadAll + newApp() arguments (setup only)
apps/web/src/api/client.ts (+ client.test.ts)         request<T>(method, path, { schema?: { parse(input: unknown): T }, body? }) — no zod import, ApiError, encodeProductId() shared with itemPath, seven admin functions (D9)
apps/web/src/pages/AdminPage.tsx (+ .test.tsx)        route /admin: state machine, "Завантажуємо…", login form | panel markup ("Адмін-панель", "Джерело даних" radios, "Збережено", "Не вдалося зберегти", shop sections, "Вийти") (D10)
apps/web/src/components/AdminLoginForm.tsx (+ .test.tsx)   heading, password input, "Увійти", loginAlert() and the alert (D10)
apps/web/src/components/AdminShopSection.tsx (+ .test.tsx) <section>: name, status note, "Видимих: N", checkbox list, onToggle (D10)
apps/web/src/router.tsx                               + { path: "admin", Component: AdminPage }
apps/web/src/App.tsx (+ App.test.tsx)                 nav "Каталог" · "Кошик (N)" · "Адмін" (D11)
apps/web/src/index.css, apps/web/index.html           color-scheme: light; body bg-white text-stone-900 (D11)
apps/web/src/theme.test.ts                            "Light color scheme is forced" (reads the two files)
```

## Risks / Trade-offs

- [Token as HMAC secret] → changing `ADMIN_TOKEN` logs every session out (desired); a leaked token is both the
  password and the signing key — accepted for one local admin; a leaked cookie is valid for 12 hours and
  cannot be revoked early (Non-Goal). Mitigation: `httpOnly`, `SameSite=Lax`, short `Max-Age`.
- [`===` comparison, no rate limiting] → timing and brute force are theoretical on localhost with one admin;
  recorded as out of scope in proposal.md.
- [Settings read on every catalog load] → one small file read per `GET /api/products`; a basket resolves all
  its lines through one `catalog.findProducts(ids)`, so it is one read per request, not one per line (review
  finding, task group 8). Measured in microseconds against a 5-minute adapter cache. If it ever matters, the
  store can memoise on `mtime` behind the same `read()`.
- [Corrupt `admin-settings.json`] → the storefront keeps serving: boot and every catalog load catch the read,
  fall back to the defaults and report the file name once on stderr. The admin routes still answer 500, so the
  admin's own choices are never silently rewritten, but one bad file no longer takes `/api/products` and the
  baskets down (review finding, task group 8).
- [Hidden product in a basket] → `findProducts` searches the **full** lists (`loadAll()`), so a product the
  admin hides keeps its price in baskets that hold it and still resolves by id; only `GET /api/products` is
  filtered. `product: null` stays the answer for a product that left the shop upstream.
- [Visibility ids vs. live list] → an array chosen in snapshot mode may name ids the live page lacks (and vice
  versa, the snapshot being a hand-picked ten); they are ignored, never an error, and the admin listing shows
  the current source's full list so the admin can re-tick. `add-catalog`'s reused-lid risk (two live products
  dropped by first-wins) is unchanged and still recorded there.
- [Signature changes touch five existing test files] → setup-only edits listed in explicit tasks (4.2, 5.4)
  so the red run stays attributable to the new scenarios; `basketStore`-style required keys turn a missed call
  site into a typecheck error.
- [Exact HMAC literals in the spec] → pinned to `secret-token` / `admin`; a reader can re-derive them with
  `createHmac("sha256", "secret-token").update("admin").digest("base64")`, and the test keeps that line.
- [51 new scenarios → 51 scenario tests + 4 unit-test files] → helpers stay in the test files; the route
  file holds 22 tests, like `add-basket`'s 16, grouped by `describe` per requirement; the page file 15 (14
  scenarios + the failed-state test); the unit tests beside `lib/admin-auth.ts`, `lib/admin.ts`,
  `AdminLoginForm.tsx` and `AdminShopSection.tsx` reuse the scenarios' values, so a changed scenario is
  changed in two places at most, never silently in one.
- [Structural `schema` type in the client] → `{ parse(input: unknown): T }` accepts any object with a
  `parse`, not only zod schemas; the seven admin functions and the five basket functions pass schemas from
  `@organic/shared`, so the loss of nominal typing is theoretical and buys a `zod`-free `apps/web`.

## Migration Plan

- Deploy: `pnpm check` green; set `ADMIN_TOKEN` in `.env` (without it the storefront runs and `/admin` shows
  "Адмінку не налаштовано"); `.data/admin-settings.json` is created on the first admin write — nothing to
  migrate; the first visit after deploy serves the first ten per shop exactly as before.
- Rollback: delete `.data/admin-settings.json` (the defaults return) or unset `ADMIN_TOKEN` (the admin is
  closed, the storefront unaffected).

## Open Questions

None that would change the specs, the approach or the task breakdown.
