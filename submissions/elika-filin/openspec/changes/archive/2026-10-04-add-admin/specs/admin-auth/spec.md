# Spec Delta

## Purpose

Lets one administrator sign in with the token configured in the server's environment and keeps that session
in a signed `httpOnly` cookie, so the admin endpoints answer only to a valid session while the storefront
stays public.

## ADDED Requirements

### Requirement: Admin token configuration
`AppConfig` SHALL carry `adminToken`: the value of `ADMIN_TOKEN`, read only in `apps/api/src/config.ts`;
`undefined` when the variable is unset or blank (empty or whitespace only). An undefined token means "admin
not configured" and SHALL NOT fail startup — the storefront works without an admin.

#### Scenario: Config reads ADMIN_TOKEN
- **WHEN** `loadConfig({})` is called
- **THEN** `adminToken` is `undefined`
- **WHEN** `loadConfig({ ADMIN_TOKEN: "secret-token" })` is called
- **THEN** `adminToken` is `"secret-token"`
- **WHEN** `loadConfig({ ADMIN_TOKEN: "   " })` is called
- **THEN** `adminToken` is `undefined`

### Requirement: Admin login
`POST /api/admin/login` with JSON body `{ token }` SHALL answer, in this order of checks: 400
`{ error: "Invalid request body" }` when the body is not JSON or `token` is not a string; 503
`{ error: "Admin is not configured" }` when `adminToken` is undefined; 401 `{ error: "Invalid token" }` when
`token !== adminToken`; otherwise 204 with an empty body and the header
`Set-Cookie: admin_session=admin.<signature>; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax` (12 hours),
where `<signature>` is the URL-encoded base64 HMAC-SHA256 of the value `admin` keyed with `adminToken`.
No `Set-Cookie` header is sent on 400, 401 or 503.

#### Scenario: Login with the right token sets the session cookie
- **WHEN** `POST /api/admin/login` with header `Content-Type: application/json` and body
  `{ "token": "secret-token" }` is requested through `createApp({ ..., adminToken: "secret-token" }).request()`
- **THEN** the status is 204, `await res.text()` is `""` and the response header `Set-Cookie` equals exactly
  `admin_session=admin.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax`
  (`YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0=` is
  `createHmac("sha256", "secret-token").update("admin").digest("base64")`, URL-encoded)

#### Scenario: Login with a wrong token
- **WHEN** `POST /api/admin/login` with body `{ "token": "wrong-token" }` is requested on the app configured
  with `adminToken: "secret-token"`
- **THEN** the status is 401, the body is `{ error: "Invalid token" }` and there is no `Set-Cookie` header

#### Scenario: Login without a configured token
- **WHEN** `POST /api/admin/login` with body `{ "token": "secret-token" }` is requested on an app created with
  `adminToken: undefined`
- **THEN** the status is 503, the body is `{ error: "Admin is not configured" }` and there is no `Set-Cookie`
  header

#### Scenario: Login body without a token is rejected
- **WHEN** `POST /api/admin/login` with body `{ "password": "secret-token" }` is requested on the app
  configured with `adminToken: "secret-token"`
- **THEN** the status is 400 and the body is `{ error: "Invalid request body" }`
- **WHEN** `POST /api/admin/login` with the non-JSON body `not json` is requested on the same app
- **THEN** the status is 400, the body is `{ error: "Invalid request body" }` and there is no `Set-Cookie`
  header

### Requirement: Admin logout
`POST /api/admin/logout` SHALL answer 204 with an empty body and the header
`Set-Cookie: admin_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`, whether or not the request carries
a session cookie. It needs no session.

#### Scenario: Logout clears the cookie
- **WHEN** `POST /api/admin/logout` is requested with header
  `Cookie: admin_session=admin.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D` (the cookie of a successful
  login on the app configured with `adminToken: "secret-token"`)
- **THEN** the status is 204, `await res.text()` is `""` and the response header `Set-Cookie` equals exactly
  `admin_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
- **WHEN** `POST /api/admin/logout` is requested with no `Cookie` header
- **THEN** the status is 204 and `Set-Cookie` equals the same header

### Requirement: Session check
`GET /api/admin/session` SHALL answer 200 `{ authenticated: true }` when the admin is configured and the
request carries an `admin_session` cookie whose signature verifies with `adminToken` and whose value is
`admin`; otherwise 200 `{ authenticated: false }`. It SHALL never answer 401.

#### Scenario: Session reflects the cookie
- **WHEN** `GET /api/admin/session` is requested with no `Cookie` header on the app configured with
  `adminToken: "secret-token"`
- **THEN** the status is 200 and the body is `{ authenticated: false }`
- **WHEN** `GET /api/admin/session` is requested with header
  `Cookie: admin_session=admin.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D` (the `Set-Cookie` of a login
  on the same app, the part before the first `;`)
- **THEN** the status is 200 and the body is `{ authenticated: true }`
- **WHEN** the same request with that cookie is made on an app created with `adminToken: undefined`
- **THEN** the status is 200 and the body is `{ authenticated: false }`

### Requirement: Admin routes require the session cookie
Every `/api/admin/*` route other than `POST /api/admin/login`, `POST /api/admin/logout` and
`GET /api/admin/session` SHALL answer 401 `{ error: "Unauthorized" }` — before any parsing or lookup —
unless the request carries an `admin_session` cookie whose signature verifies with `adminToken` and whose
value is `admin`. When no `adminToken` is configured, no cookie verifies.

#### Scenario: Missing cookie is unauthorized
- **WHEN** on the snapshot-mode app configured with `adminToken: "secret-token"` and with no `Cookie` header,
  these are requested: `GET /api/admin/settings`; `PUT /api/admin/settings` with body
  `{ "dataSource": "live" }`; `GET /api/admin/products`;
  `PUT /api/admin/products/karashynyard:1498486363994/visibility` with body `{ "visible": false }`
- **THEN** each answers 401 with the body `{ error: "Unauthorized" }`
- **AND** a following `GET /api/products` still answers `source: "snapshot"` with 20 products (nothing was
  applied)

#### Scenario: Tampered cookie is unauthorized
- **WHEN** `GET /api/admin/settings` is requested on the app configured with `adminToken: "secret-token"`
  with header `Cookie: admin_session=root.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D` (the login cookie
  with its value changed and its signature kept)
- **THEN** the status is 401 and the body is `{ error: "Unauthorized" }`
- **WHEN** the same request is made with header
  `Cookie: admin_session=admin.%2FPIVjLj4NPDY7r3QD9XpFnAbAO6%2F%2BG9MWfTiAQpvCdg%3D` (the value `admin`
  signed with `"other-secret"`)
- **THEN** the status is 401 and the body is `{ error: "Unauthorized" }`
- **WHEN** the same request is made with header `Cookie: admin_session=admin.garbage`
- **THEN** the status is 401 and the body is `{ error: "Unauthorized" }`

#### Scenario: Valid cookie passes the guard
- **WHEN** after `POST /api/admin/login` with body `{ "token": "secret-token" }`, the `Set-Cookie` value up
  to the first `;` (`admin_session=admin.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D`) is sent back as the
  `Cookie` header of `GET /api/admin/settings` on the same app (snapshot mode, settings store on an empty
  temp directory with defaults `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`)
- **THEN** the status is 200 and the body is
  `{ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } }`

#### Scenario: Unconfigured admin rejects every cookie
- **WHEN** `GET /api/admin/settings` is requested with header
  `Cookie: admin_session=admin.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D` on an app created with
  `adminToken: undefined`
- **THEN** the status is 401 and the body is `{ error: "Unauthorized" }`
