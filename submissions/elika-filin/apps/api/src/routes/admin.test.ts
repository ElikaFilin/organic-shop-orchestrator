import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AdminProductsResponse,
  AdminSettings,
  CatalogResponse,
  DataSource,
  Product,
  ProductVisibilityResponse,
} from "@organic/shared";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createApp } from "../app";
import { createTtlCache } from "../lib/cache";
import { createCatalogService } from "../lib/catalog";
import { createSnapshotSource } from "../lib/snapshot";
import { createAdminSettingsStore } from "../lib/store/admin-settings";
import { createBasketStore } from "../lib/store/baskets";
import type { ShopAdapter, ShopFetchResult } from "../shops/types";

// Pinned by the spec: the value `admin` signed with the admin token `secret-token` (URL-encoded base64 of
// the HMAC-SHA256), and the same value signed with `other-secret`. Re-derived with `sign()` in the tests.
const SIGNATURE = "YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D";
const OTHER_SIGNATURE = "%2FPIVjLj4NPDY7r3QD9XpFnAbAO6%2F%2BG9MWfTiAQpvCdg%3D";
const sign = (secret: string) =>
  encodeURIComponent(createHmac("sha256", secret).update("admin").digest("base64"));

const SESSION_COOKIE = `admin_session=admin.${SIGNATURE}`;
const LOGIN_SET_COOKIE = `${SESSION_COOKIE}; Max-Age=43200; Path=/; HttpOnly; SameSite=Lax`;
const LOGOUT_SET_COOKIE = "admin_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax";

const UNAUTHORIZED = { error: "Unauthorized" };
const INVALID_BODY = { error: "Invalid request body" };
const DEFAULT_VISIBILITY = { karashynyard: null, osio: null };

// The exact settings file of "Snapshot mode with a visibility array".
const CHOSEN_TWO_FILE =
  '{"dataSource":"snapshot","visibility":{"karashynyard":["karashynyard:1743423686258","karashynyard:1498486363994"],"osio":null}}';

// The committed snapshots in data/shops/, passed as a value. The fake adapters answer with "their 10 snapshot
// products" exactly as the committed files hold them; snapshot mode and the fallback read the same files.
const SNAPSHOT_DIR = fileURLToPath(new URL("../../../../data/shops", import.meta.url));
const snapshots = createSnapshotSource(SNAPSHOT_DIR);
const karashynyardSnapshot: Product[] = await snapshots.read("karashynyard");
const osioSnapshot: Product[] = await snapshots.read("osio");

// Two real products that follow the snapshot's ten in the live page (record rec638772397, 2026-10-04 capture).
const karashynyardBeyondTen: Product[] = [
  {
    id: "karashynyard:1629901938947",
    shopKey: "karashynyard",
    shopName: "Карашин Яр",
    sourceId: "1629901938947",
    name: "Філе зі стегна індички, 1 кг",
    price: 665,
    currency: "UAH",
    imageUrl: "https://static.tildacdn.net/tild6632-3864-4762-b034-646135333638/___14.jpg",
    productUrl: "https://karashynyard.com.ua/#rec638772397",
    description: "Соковите м’ясо зі стегна без кістки. Добре підходить для котлет, тушкування, запікання та швидких страв.",
    category: "Індичка з вільного вигулу",
    unit: "1 кг",
    inStock: true,
  },
  {
    id: "karashynyard:1636965991022",
    shopKey: "karashynyard",
    shopName: "Карашин Яр",
    sourceId: "1636965991022",
    name: "Стегно індички, 1 кг",
    price: 595,
    currency: "UAH",
    imageUrl: "https://static.tildacdn.net/tild3435-3938-4564-a135-653937383630/___15.jpg",
    productUrl: "https://karashynyard.com.ua/#rec638772397",
    description: "Соковите стегно індички зі шкіркою для запікання, тушкування та наваристих домашніх страв.",
    category: "Індичка з вільного вигулу",
    unit: "1 кг",
    inStock: true,
  },
];

function snapshotProduct(id: string): Product {
  const found = [...karashynyardSnapshot, ...osioSnapshot].find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no snapshot product ${id}`);
  return found;
}

const KARASHYNYARD_SHOP = {
  key: "karashynyard",
  name: "Карашин Яр",
  url: "https://karashynyard.com.ua/#rec638772397",
} as const;
const OSIO_SHOP = { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/" } as const;

// The fake adapters' answers the scenarios name.
const karashynyardTen: ShopFetchResult = { ok: true, products: karashynyardSnapshot };
const karashynyardTwelve: ShopFetchResult = { ok: true, products: [...karashynyardSnapshot, ...karashynyardBeyondTen] };
const karashynyardDown: ShopFetchResult = { ok: false, error: "karashynyard: HTTP 503" };
const osioTen: ShopFetchResult = { ok: true, products: osioSnapshot };

// The arrays of "Hide a visible product" (the first ten without Філе індички) and "Show a product beyond
// the first ten" (the first ten plus Стегно індички), in upstream order.
const NINE_WITHOUT_FILE = [
  "karashynyard:1628604400123",
  "karashynyard:1781040705497",
  "karashynyard:1652947963962",
  "karashynyard:1651059869009",
  "karashynyard:1766158125517",
  "karashynyard:1695632413443",
  "karashynyard:1648566839990",
  "karashynyard:1685968207499",
  "karashynyard:1743423686258",
];
const TEN_PLUS_STEHNO = [
  "karashynyard:1498486363994",
  "karashynyard:1628604400123",
  "karashynyard:1781040705497",
  "karashynyard:1652947963962",
  "karashynyard:1651059869009",
  "karashynyard:1766158125517",
  "karashynyard:1695632413443",
  "karashynyard:1648566839990",
  "karashynyard:1685968207499",
  "karashynyard:1743423686258",
  "karashynyard:1636965991022",
];

const dirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface AppOptions {
  source: DataSource;
  adminToken: string | undefined;
  /** The text of `<tmp>/admin-settings.json` before the app starts; none = an empty directory. */
  settingsFile?: string;
  karashynyard?: ShopFetchResult;
  osio?: ShopFetchResult;
  snapshotDir?: string;
}

/**
 * A fresh app: fake adapters answering what the scenario says (or nothing), the committed snapshots, a
 * settings store on an empty temp directory whose defaults are `{ dataSource: source, both shops null }`,
 * and a temp basket store the admin routes never touch.
 */
function newApp({ source, adminToken, settingsFile, karashynyard: karashynyardAnswer, osio: osioAnswer, snapshotDir = SNAPSHOT_DIR }: AppOptions) {
  const dir = tempDir("admin-settings-");
  if (settingsFile !== undefined) writeFileSync(join(dir, "admin-settings.json"), settingsFile);
  const store = createAdminSettingsStore(join(dir, "admin-settings.json"), {
    dataSource: source,
    visibility: { karashynyard: null, osio: null },
  });
  const karashynyard = vi.fn<ShopAdapter["fetchProducts"]>();
  const osio = vi.fn<ShopAdapter["fetchProducts"]>();
  if (karashynyardAnswer) karashynyard.mockResolvedValue(karashynyardAnswer);
  if (osioAnswer) osio.mockResolvedValue(osioAnswer);
  const catalog = createCatalogService({
    source,
    shops: [
      { adapter: { shop: KARASHYNYARD_SHOP, fetchProducts: karashynyard }, snapshotKey: "karashynyard" },
      { adapter: { shop: OSIO_SHOP, fetchProducts: osio }, snapshotKey: "osio" },
    ],
    snapshots: createSnapshotSource(snapshotDir),
    cache: createTtlCache({ ttlMs: 300000, now: () => 0 }),
    now: () => 0,
    settings: store,
  });
  const basketStore = createBasketStore(join(tempDir("baskets-"), "baskets.json"));
  return { app: createApp({ catalog, basketStore, settingsStore: store, adminToken }), dir, store, karashynyard, osio };
}

type App = ReturnType<typeof createApp>;
type Method = "GET" | "POST" | "PUT";

interface RequestOptions {
  cookie?: string;
  body?: unknown;
  /** Sent as-is (with the JSON content type), for the "not json" bodies. */
  rawBody?: string;
}

function req(app: App, method: Method, path: string, { cookie, body, rawBody }: RequestOptions = {}) {
  const payload = rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
  return app.request(path, {
    method,
    headers: {
      ...(cookie === undefined ? {} : { Cookie: cookie }),
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: payload,
  });
}

/** Logs in with the right token and returns the `Set-Cookie` value up to the first `;`. */
async function login(app: App): Promise<string> {
  const res = await app.request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "secret-token" }),
  });
  const header = res.headers.get("set-cookie");
  if (header === null) throw new Error(`login answered ${res.status} without a Set-Cookie header`);
  return header.split(";")[0] ?? "";
}

const readSettingsFile = (dir: string): AdminSettings =>
  JSON.parse(readFileSync(join(dir, "admin-settings.json"), "utf8")) as AdminSettings;

const catalogOf = async (app: App): Promise<CatalogResponse> =>
  (await (await app.request("/api/products")).json()) as CatalogResponse;

const adminProductsOf = async (app: App) => {
  const res = await req(app, "GET", "/api/admin/products", { cookie: SESSION_COOKIE });
  return { res, body: (await res.json()) as AdminProductsResponse };
};

describe("Admin login", () => {
  test("Login with the right token sets the session cookie", async () => {
    expect(sign("secret-token")).toBe(SIGNATURE);
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const res = await app.request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "secret-token" }),
    });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.get("set-cookie")).toBe(LOGIN_SET_COOKIE);
  });

  test("Login with a wrong token", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const res = await req(app, "POST", "/api/admin/login", { body: { token: "wrong-token" } });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid token" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("Login without a configured token", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: undefined });

    const res = await req(app, "POST", "/api/admin/login", { body: { token: "secret-token" } });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Admin is not configured" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("Login body without a token is rejected", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const noToken = await req(app, "POST", "/api/admin/login", { body: { password: "secret-token" } });
    expect(noToken.status).toBe(400);
    expect(await noToken.json()).toEqual(INVALID_BODY);

    const notJson = await req(app, "POST", "/api/admin/login", { rawBody: "not json" });
    expect(notJson.status).toBe(400);
    expect(await notJson.json()).toEqual(INVALID_BODY);
    expect(notJson.headers.get("set-cookie")).toBeNull();
  });
});

describe("Admin logout", () => {
  test("Logout clears the cookie", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const withCookie = await req(app, "POST", "/api/admin/logout", { cookie: SESSION_COOKIE });
    expect(withCookie.status).toBe(204);
    expect(await withCookie.text()).toBe("");
    expect(withCookie.headers.get("set-cookie")).toBe(LOGOUT_SET_COOKIE);

    // Needs no session: the same answer without a cookie.
    const withoutCookie = await req(app, "POST", "/api/admin/logout");
    expect(withoutCookie.status).toBe(204);
    expect(withoutCookie.headers.get("set-cookie")).toBe(LOGOUT_SET_COOKIE);
  });
});

describe("Session check", () => {
  test("Session reflects the cookie", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const anonymous = await req(app, "GET", "/api/admin/session");
    expect(anonymous.status).toBe(200);
    expect(await anonymous.json()).toEqual({ authenticated: false });

    const cookie = await login(app);
    expect(cookie).toBe(SESSION_COOKIE);
    const signedIn = await req(app, "GET", "/api/admin/session", { cookie });
    expect(signedIn.status).toBe(200);
    expect(await signedIn.json()).toEqual({ authenticated: true });

    // Never 401, even when no token is configured: the page needs an answer, not an error.
    const unconfigured = newApp({ source: "snapshot", adminToken: undefined });
    const res = await req(unconfigured.app, "GET", "/api/admin/session", { cookie });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false });
  });
});

describe("Admin routes require the session cookie", () => {
  test("Missing cookie is unauthorized", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const getSettings = await req(app, "GET", "/api/admin/settings");
    expect(getSettings.status).toBe(401);
    expect(await getSettings.json()).toEqual(UNAUTHORIZED);

    const putSettings = await req(app, "PUT", "/api/admin/settings", { body: { dataSource: "live" } });
    expect(putSettings.status).toBe(401);
    expect(await putSettings.json()).toEqual(UNAUTHORIZED);

    const getProducts = await req(app, "GET", "/api/admin/products");
    expect(getProducts.status).toBe(401);
    expect(await getProducts.json()).toEqual(UNAUTHORIZED);

    const putVisibility = await req(app, "PUT", "/api/admin/products/karashynyard:1498486363994/visibility", {
      body: { visible: false },
    });
    expect(putVisibility.status).toBe(401);
    expect(await putVisibility.json()).toEqual(UNAUTHORIZED);

    // Nothing was applied: the storefront still serves the snapshot defaults.
    const catalog = await catalogOf(app);
    expect(catalog.source).toBe("snapshot");
    expect(catalog.products).toHaveLength(20);
  });

  test("Tampered cookie is unauthorized", async () => {
    expect(sign("other-secret")).toBe(OTHER_SIGNATURE);
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    // The value changed, the signature kept.
    const renamed = await req(app, "GET", "/api/admin/settings", { cookie: `admin_session=root.${SIGNATURE}` });
    expect(renamed.status).toBe(401);
    expect(await renamed.json()).toEqual(UNAUTHORIZED);

    // The value `admin` signed with another secret.
    const otherSecret = await req(app, "GET", "/api/admin/settings", {
      cookie: `admin_session=admin.${OTHER_SIGNATURE}`,
    });
    expect(otherSecret.status).toBe(401);
    expect(await otherSecret.json()).toEqual(UNAUTHORIZED);

    // Not a signature at all.
    const garbage = await req(app, "GET", "/api/admin/settings", { cookie: "admin_session=admin.garbage" });
    expect(garbage.status).toBe(401);
    expect(await garbage.json()).toEqual(UNAUTHORIZED);
  });

  test("Valid cookie passes the guard", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const cookie = await login(app);
    expect(cookie).toBe(SESSION_COOKIE);
    const res = await req(app, "GET", "/api/admin/settings", { cookie });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dataSource: "snapshot", visibility: DEFAULT_VISIBILITY });
  });

  test("Unconfigured admin rejects every cookie", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: undefined });

    const res = await req(app, "GET", "/api/admin/settings", { cookie: SESSION_COOKIE });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(UNAUTHORIZED);
  });
});

describe("Read the settings", () => {
  test("Settings on a fresh install", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const res = await req(app, "GET", "/api/admin/settings", { cookie: SESSION_COOKIE });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dataSource: "snapshot", visibility: DEFAULT_VISIBILITY });
  });
});

describe("Change the data source", () => {
  test("Switch to snapshot applies immediately", async () => {
    const { app, dir, karashynyard, osio } = newApp({
      source: "live",
      adminToken: "secret-token",
      karashynyard: karashynyardTen,
      osio: osioTen,
    });

    const put = await req(app, "PUT", "/api/admin/settings", { cookie: SESSION_COOKIE, body: { dataSource: "snapshot" } });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ dataSource: "snapshot", visibility: DEFAULT_VISIBILITY });

    const catalog = await catalogOf(app);
    expect(catalog.source).toBe("snapshot");
    expect(catalog.shops[0]).toEqual({
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "snapshot",
      count: 10,
    });
    expect(catalog.shops[1]?.status).toBe("snapshot");
    expect(karashynyard).not.toHaveBeenCalled();
    expect(osio).not.toHaveBeenCalled();

    expect(readSettingsFile(dir).dataSource).toBe("snapshot");
    const settings = await req(app, "GET", "/api/admin/settings", { cookie: SESSION_COOKIE });
    expect(await settings.json()).toEqual({ dataSource: "snapshot", visibility: DEFAULT_VISIBILITY });
  });

  test("Switch back to live", async () => {
    const { app, karashynyard, osio } = newApp({
      source: "live",
      adminToken: "secret-token",
      karashynyard: karashynyardTen,
      osio: osioTen,
    });
    // After the previous scenario: the admin has switched to the snapshot and the storefront served it.
    const toSnapshot = await req(app, "PUT", "/api/admin/settings", { cookie: SESSION_COOKIE, body: { dataSource: "snapshot" } });
    expect(toSnapshot.status).toBe(200);
    expect((await catalogOf(app)).source).toBe("snapshot");

    const put = await req(app, "PUT", "/api/admin/settings", { cookie: SESSION_COOKIE, body: { dataSource: "live" } });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ dataSource: "live", visibility: DEFAULT_VISIBILITY });

    const catalog = await catalogOf(app);
    expect(catalog.source).toBe("live");
    expect(catalog.shops[0]).toMatchObject({ status: "live", count: 10 });
    expect(catalog.shops[1]).toMatchObject({ status: "live", count: 10 });
    expect(karashynyard).toHaveBeenCalledTimes(1);
    expect(osio).toHaveBeenCalledTimes(1);
  });

  test("Invalid settings body", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });
    const put = (options: RequestOptions) =>
      req(app, "PUT", "/api/admin/settings", { cookie: SESSION_COOKIE, ...options });

    const unknownSource = await put({ body: { dataSource: "foo" } });
    expect(unknownSource.status).toBe(400);
    expect(await unknownSource.json()).toEqual(INVALID_BODY);

    const empty = await put({ body: {} });
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual(INVALID_BODY);

    // Only dataSource is accepted here: a body that also carries visibility is refused, not trimmed.
    const extraKey = await put({ body: { dataSource: "live", visibility: { karashynyard: [] } } });
    expect(extraKey.status).toBe(400);
    expect(await extraKey.json()).toEqual(INVALID_BODY);

    const notJson = await put({ rawBody: "not json" });
    expect(notJson.status).toBe(400);
    expect(await notJson.json()).toEqual(INVALID_BODY);

    const settings = await req(app, "GET", "/api/admin/settings", { cookie: SESSION_COOKIE });
    expect(await settings.json()).toEqual({ dataSource: "snapshot", visibility: DEFAULT_VISIBILITY });
  });
});

describe("List every product with its visibility", () => {
  test("Live mode lists products beyond the first ten", async () => {
    const { app } = newApp({
      source: "live",
      adminToken: "secret-token",
      karashynyard: karashynyardTwelve,
      osio: osioTen,
    });

    const { res, body } = await adminProductsOf(app);

    expect(res.status).toBe(200);
    expect(body.source).toBe("live");
    expect(body.shops).toEqual([
      {
        key: "karashynyard",
        name: "Карашин Яр",
        url: "https://karashynyard.com.ua/#rec638772397",
        status: "live",
        total: 12,
        visible: 10,
      },
      { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "live", total: 10, visible: 10 },
    ]);
    expect(body.shops[0]).not.toHaveProperty("error");
    expect(body.shops[1]).not.toHaveProperty("error");
    expect(body.products).toHaveLength(22);
    expect(snapshotProduct("karashynyard:1498486363994").price).toBe(665);
    expect(body.products[0]).toEqual({ ...snapshotProduct("karashynyard:1498486363994"), visible: true });
    expect(body.products[9]).toMatchObject({ id: "karashynyard:1743423686258", visible: true });
    expect(body.products[10]).toMatchObject({
      id: "karashynyard:1629901938947",
      name: "Філе зі стегна індички, 1 кг",
      price: 665,
      visible: false,
    });
    expect(body.products[11]).toMatchObject({ id: "karashynyard:1636965991022", price: 595, visible: false });
    expect(body.products[12]).toMatchObject({ id: "osio:6abcf192b7db2532803d266d", visible: true });
    expect(body.products[21]).toMatchObject({ id: "osio:69e5236361852dec4059d4e8", visible: true });
  });

  test("Snapshot mode with a visibility array", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token", settingsFile: CHOSEN_TWO_FILE });

    const { res, body } = await adminProductsOf(app);

    expect(res.status).toBe(200);
    expect(body.source).toBe("snapshot");
    expect(body.shops[0]).toEqual({
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "snapshot",
      total: 10,
      visible: 2,
    });
    expect(body.shops[1]).toEqual({
      key: "osio",
      name: "OSIO organic",
      url: "https://osio-organic.com.ua/",
      status: "snapshot",
      total: 10,
      visible: 10,
    });
    expect(body.products).toHaveLength(20);
    expect(body.products[0]).toMatchObject({ id: "karashynyard:1498486363994", visible: true });
    expect(body.products[1]).toMatchObject({ id: "karashynyard:1628604400123", visible: false });
    expect(body.products[9]).toMatchObject({ id: "karashynyard:1743423686258", visible: true });
    expect(body.products[10]).toMatchObject({ id: "osio:6abcf192b7db2532803d266d", visible: true });
  });

  test("Fallback shop lists its snapshot", async () => {
    const { app } = newApp({ source: "live", adminToken: "secret-token", karashynyard: karashynyardDown, osio: osioTen });

    const { res, body } = await adminProductsOf(app);

    expect(res.status).toBe(200);
    expect(body.shops[0]).toEqual({
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "snapshot-fallback",
      error: "karashynyard: HTTP 503",
      total: 10,
      visible: 10,
    });
    expect(body.shops[1]?.status).toBe("live");
    expect(body.products).toHaveLength(20);
    expect(body.products[0]).toMatchObject({ id: "karashynyard:1498486363994", visible: true });
  });

  test("Unavailable shop lists nothing", async () => {
    // An empty temp directory: karashynyard.json is missing, so the fallback read fails too.
    const { app } = newApp({
      source: "live",
      adminToken: "secret-token",
      karashynyard: karashynyardDown,
      osio: osioTen,
      snapshotDir: tempDir("organic-snapshots-"),
    });

    const { res, body } = await adminProductsOf(app);

    expect(res.status).toBe(200);
    expect(body.shops[0]).toEqual({
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "unavailable",
      error: "karashynyard: HTTP 503",
      total: 0,
      visible: 0,
    });
    expect(body.products).toHaveLength(10);
    expect(body.products[0]).toMatchObject({ id: "osio:6abcf192b7db2532803d266d", visible: true });
  });
});

describe("Toggle a product's visibility", () => {
  test("Hide a visible product", async () => {
    const { app, dir } = newApp({ source: "snapshot", adminToken: "secret-token" });
    const hide = () =>
      req(app, "PUT", "/api/admin/products/karashynyard:1498486363994/visibility", {
        cookie: SESSION_COOKIE,
        body: { visible: false },
      });
    const expected: ProductVisibilityResponse = {
      id: "karashynyard:1498486363994",
      visible: false,
      visibility: NINE_WITHOUT_FILE,
    };

    const put = await hide();
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual(expected);

    const catalog = await catalogOf(app);
    expect(catalog.shops[0]?.count).toBe(9);
    expect(catalog.shops[1]?.count).toBe(10);
    expect(catalog.products).toHaveLength(19);
    expect(catalog.products[0]?.id).toBe("karashynyard:1628604400123");
    expect(catalog.products.map((p) => p.id)).not.toContain("karashynyard:1498486363994");

    expect(readSettingsFile(dir).visibility).toEqual({ karashynyard: NINE_WITHOUT_FILE, osio: null });

    // Idempotent: the same answer the second time.
    const again = await hide();
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(expected);
  });

  test("Show a product beyond the first ten", async () => {
    const { app } = newApp({
      source: "live",
      adminToken: "secret-token",
      karashynyard: karashynyardTwelve,
      osio: osioTen,
    });

    const put = await req(app, "PUT", "/api/admin/products/karashynyard:1636965991022/visibility", {
      cookie: SESSION_COOKIE,
      body: { visible: true },
    });

    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({
      id: "karashynyard:1636965991022",
      visible: true,
      visibility: TEN_PLUS_STEHNO,
    });

    const catalog = await catalogOf(app);
    expect(catalog.shops[0]?.count).toBe(11);
    expect(catalog.products).toHaveLength(21);
    expect(catalog.products[10]).toMatchObject({
      id: "karashynyard:1636965991022",
      name: "Стегно індички, 1 кг",
      price: 595,
    });
    expect(catalog.products[11]?.id).toBe("osio:6abcf192b7db2532803d266d");
    expect(catalog.products.map((p) => p.sourceId)).not.toContain("1629901938947");
  });

  test("Unknown product", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const put = await req(app, "PUT", "/api/admin/products/osio:000000000000000000000000/visibility", {
      cookie: SESSION_COOKIE,
      body: { visible: true },
    });

    expect(put.status).toBe(404);
    expect(await put.json()).toEqual({ error: "Product not found" });

    const settings = await req(app, "GET", "/api/admin/settings", { cookie: SESSION_COOKIE });
    expect(await settings.json()).toMatchObject({ visibility: DEFAULT_VISIBILITY });
  });

  test("Malformed id or body", async () => {
    const { app } = newApp({ source: "snapshot", adminToken: "secret-token" });

    const malformedId = await req(app, "PUT", "/api/admin/products/not-a-product/visibility", {
      cookie: SESSION_COOKIE,
      body: { visible: true },
    });
    expect(malformedId.status).toBe(400);
    expect(await malformedId.json()).toEqual({ error: "Invalid product id" });

    const notBoolean = await req(app, "PUT", "/api/admin/products/karashynyard:1498486363994/visibility", {
      cookie: SESSION_COOKIE,
      body: { visible: "yes" },
    });
    expect(notBoolean.status).toBe(400);
    expect(await notBoolean.json()).toEqual(INVALID_BODY);

    const notJson = await req(app, "PUT", "/api/admin/products/karashynyard:1498486363994/visibility", {
      cookie: SESSION_COOKIE,
      rawBody: "not json",
    });
    expect(notJson.status).toBe(400);
    expect(await notJson.json()).toEqual(INVALID_BODY);

    const settings = await req(app, "GET", "/api/admin/settings", { cookie: SESSION_COOKIE });
    expect(await settings.json()).toMatchObject({ visibility: DEFAULT_VISIBILITY });
  });
});
