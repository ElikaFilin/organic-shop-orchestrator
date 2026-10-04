# Proposal

## Why

`add-catalog` shows the first ten products of each shop and `add-basket` lets a buyer collect them, but nobody
can *run* the storefront: the data source is fixed at startup by `DATA_SOURCE`, and the ten visible products
are whatever a shop happens to list first (for Карашин Яр that is ten turkey products out of 133 on the page).
This change adds the `/admin` page named in `docs/intent.md` — protected by the token in `.env` — where the
owner switches the catalog between live and snapshot data and ticks which products of each shop the
storefront shows. It is the last of the three planned changes and turns the catalog from accidental into
curated; it is written after `add-basket`'s delta specs and design, which it builds on without restating.

## What Changes

- **Shared contract** (`packages/shared`): the admin settings shape
  `{ dataSource: "live" | "snapshot", visibility: { karashynyard: string[] | null, osio: string[] | null } }`
  (`null` = the default first-ten rule, an array = the product ids the admin chose), the login body, the
  session answer, the settings update body, the admin product listing (`{ source, shops: [{ key, name, url,
  status, error?, total, visible }], products: [{ ...Product, visible }] }`) and the visibility toggle body
  and answer.
- **Config**: `AppConfig` gains `adminToken` from `ADMIN_TOKEN` (optional; `config.ts` stays the only reader
  of `process.env`).
- **Admin authentication** (`apps/api/src/lib/admin-auth.ts`, `src/routes/admin.ts`, mounted at
  `/api/admin`): `POST /api/admin/login { token }` answers 503 `{ error: "Admin is not configured" }` when no
  token is configured, 401 `{ error: "Invalid token" }` on a mismatch, and 204 with a **signed** `httpOnly`
  cookie `admin_session` (value `admin`, HMAC-SHA256 with the admin token as secret, `SameSite=Lax`, path `/`,
  12 hours) on success; `POST /api/admin/logout` answers 204 and deletes the cookie;
  `GET /api/admin/session` answers `{ authenticated: true | false }` and never 401; every other
  `/api/admin/*` route answers 401 `{ error: "Unauthorized" }` without a valid signed cookie.
- **Admin settings store** (`apps/api/src/lib/store/admin-settings.ts`): one JSON file
  `<dataDir>/admin-settings.json` (path passed to the constructor, atomic write, missing file = defaults:
  `dataSource` from config, `visibility` `null` for both shops). At startup the persisted `dataSource`, when
  the file exists, overrides `DATA_SOURCE`.
- **Catalog** (`apps/api/src/lib/catalog.ts`): `selectVisibleProducts(perShop, visibility)` — `null` keeps the
  first ten in upstream order, an array serves exactly the listed ids in upstream order (ids no longer upstream
  are ignored); `count` per shop is the number served. The service takes the settings store and reads the
  visibility on every load, so `GET /api/products` reflects an admin change at once; it also exposes the full
  per-shop lists for the admin listing. The server seeds the catalog's source from the persisted settings.
  **BREAKING** (internal signatures only): `createCatalogService` gains a required `settings` option,
  `CatalogService` gains `loadAll()`, and `createApp` gains `settingsStore` and `adminToken` — the existing
  test stubs and call sites get a setup-only edit each.
- **Admin endpoints** (all behind the cookie guard): `GET /api/admin/settings`; `PUT /api/admin/settings
  { dataSource }` (applies the source immediately, 400 `{ error: "Invalid request body" }` for anything else);
  `GET /api/admin/products` listing **every** product the catalog currently has per shop with `visible`
  computed from the settings; `PUT /api/admin/products/:id/visibility { visible }` answering
  `{ id, visible, visibility }` (the shop's array is created from the current default on the first toggle),
  404 `{ error: "Product not found" }` for an id outside the shop's full list, 400
  `{ error: "Invalid product id" }` for a malformed id.
- **Web** (`apps/web`): route `/admin` — a login form ("Вхід для адміністратора", password input "Токен
  адміністратора", button "Увійти", alerts "Невірний токен" / "Адмінку не налаштовано") and, once signed in,
  the panel "Адмін-панель" with the "Джерело даних" radios "Наживо" / "Знімок" (saving shows "Збережено"), one
  section per shop with its status note and a checkbox per product ("Видимих: N" per shop), and "Вийти".
  While the session or the panel loads the page shows "Завантажуємо…"; a login failure other than 401 / 503
  shows "Не вдалося увійти"; a failed save shows "Не вдалося зберегти" and leaves the radio or checkbox as it
  was. Seven client functions in `src/api/client.ts` over the same request helper as the basket client (the
  product id percent-encoded in the visibility path by the basket functions' rule — `encodeURIComponent`
  except the literal `:`); a non-2xx answer rejects with an `Error` that also carries `status`, so the page
  can tell 401 from 503.
- **Layout polish** (`catalog-web`): the header gets a `<nav>` with "Каталог" (`/`), the existing "Кошик (N)"
  (`/basket`, from `add-basket`) and "Адмін" (`/admin`); the app forces a light color scheme
  (`index.css`: `:root { color-scheme: light; }`, body `bg-white text-stone-900`) because in the 2026-10-04
  smoke run the headings were unreadable in dark mode.
- **Tests**: one test per spec scenario, written before the implementation — config, settings store on a temp
  directory, selection with explicit visibility, catalog honouring the settings, auth routes, admin routes
  (incl. 401 / 404 / 400), client functions, layout nav and theme, and the admin page states (loading, login
  form and its failures, panel toggles, radio and their failures, logout) with a mocked client — plus a unit
  test beside each new `src/lib` module and each new component (`lib/admin-auth.ts`, `lib/admin.ts`,
  `AdminLoginForm.tsx`, `AdminShopSection.tsx`), as AGENTS.md and `.claude/rules/web.md` require. Never the
  live shops.

## Capabilities

### New Capabilities
- `admin-auth`: the admin token configuration, login / logout / session endpoints, the signed session cookie
  and the guard every other admin route sits behind.
- `admin-settings`: the persisted admin settings (data source and per-shop visibility), their defaults and
  startup precedence, the settings and product-listing endpoints and the per-product visibility toggle.
- `admin-web`: the `/admin` page — login form states, the data-source radios, the per-shop product checkboxes,
  logout — and the admin functions of the API client.

### Modified Capabilities
- `catalog-api`: the requirement "Visible products are the first ten per shop" is **MODIFIED** — the selection
  takes the admin's visibility (`null` = first ten, array = the chosen ids in upstream order) and the catalog
  service reads it from the settings on every load, so the served list follows an admin change at once.
- `catalog-web`: one **ADDED** requirement — the header navigation ("Каталог", "Кошик (N)", "Адмін") and the
  forced light color scheme. The basket link itself is specified by `add-basket` and only placed here.

## Impact

- `apps/api`: new `src/lib/admin-auth.ts`, `src/lib/admin.ts`, `src/lib/store/admin-settings.ts`,
  `src/routes/admin.ts` (each with a test beside it); `src/config.ts` gains `adminToken`; `src/lib/catalog.ts` gains the
  `settings` option, `loadAll()` and the two-argument `selectVisibleProducts`; `src/app.ts` becomes
  `createApp({ catalog, basketStore, settingsStore, adminToken, now })`; `src/server.ts` reads the settings
  before building the catalog. **Signature changes** touch every existing call site with a setup-only edit:
  `src/app.test.ts` (stub catalog gains `loadAll`, new `createApp` arguments), `src/routes/products.test.ts`
  and `src/lib/catalog.test.ts` (`createCatalogService` gains `settings`; `createApp` arguments) and
  `add-basket`'s `src/routes/basket.test.ts` (`newApp()` arguments, fake catalog gains `loadAll`).
- `apps/web`: `src/api/client.ts` — the request helper takes a response schema (typed structurally, so
  `apps/web` never imports `zod`), throws `ApiError` (an `Error` with `status`) and gains the seven admin
  functions, the visibility path encoded like the basket item paths; new `src/pages/AdminPage.tsx` (state and
  panel markup), `src/components/AdminLoginForm.tsx` and `src/components/AdminShopSection.tsx` (each with a
  test beside it); `src/router.tsx` gains route `/admin`; `src/App.tsx` gains the nav links; `src/index.css`
  and `index.html` get the light scheme.
- `packages/shared`: `ShopVisibilitySchema`, `AdminSettingsSchema`, `UpdateAdminSettingsSchema`,
  `AdminLoginSchema`, `AdminSessionSchema`, `SetProductVisibilitySchema`, `ProductVisibilityResponseSchema`,
  `AdminShopSummarySchema`, `AdminProductSchema`, `AdminProductsResponseSchema`, `defaultVisibility()` and
  their types.
- Runtime: `.data/admin-settings.json` is created on the first admin write; `.env` needs `ADMIN_TOKEN` for the
  admin to work (without it the storefront runs and `/admin` says "Адмінку не налаштовано"). A product the
  admin hides disappears from `GET /api/products` but still resolves by id, so a basket that holds it keeps
  its price (`add-basket`'s "Товар недоступний" stays for products that left the shop upstream).
- Dependencies: none added — `hono/cookie` (`setSignedCookie`, `getSignedCookie`, `deleteCookie`) ships with
  `hono`; zod only through `@organic/shared` (`apps/web` does not import `zod` itself — it is not resolvable
  from there, so the client types its schema option structurally).
- Order of changes: applied **after** `add-basket` is on disk (it uses `config.dataDir`, `createApp` with
  `basketStore`, `ProductIdSchema`, the client's request helper, `BasketProvider` and the header basket link).

Out of scope for this change:
- more than one admin, user accounts, roles, password reset, rate limiting or lock-out after failed logins;
- editing product fields (name, price, image, description), reordering products, adding products by hand;
- an audit log of admin actions, undo, settings history;
- HTTPS-only cookies (`Secure` flag off for local http development), CSRF tokens, session revocation lists;
- a database or any store beyond `.data/admin-settings.json`; per-admin settings;
- changes to the shop adapters or the snapshot files (`add-catalog`'s reused-lid risk stays recorded there).
