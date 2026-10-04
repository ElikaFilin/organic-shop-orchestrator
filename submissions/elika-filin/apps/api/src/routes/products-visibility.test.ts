import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AdminSettings, CatalogResponse, DataSource } from "@organic/shared";
import { afterEach, expect, test, vi } from "vitest";
import { createApp } from "../app";
import { loadConfig } from "../config";
import { createTtlCache } from "../lib/cache";
import { createCatalogService } from "../lib/catalog";
import { createSnapshotSource } from "../lib/snapshot";
import { createAdminSettingsStore, type AdminSettingsStore } from "../lib/store/admin-settings";
import { createBasketStore } from "../lib/store/baskets";
import type { ShopAdapter } from "../shops/types";

// The committed snapshots in data/shops/, passed as a value; snapshot mode reads them, the fakes never answer.
const snapshotDir = fileURLToPath(new URL("../../../../data/shops", import.meta.url));

const KARASHYNYARD_SHOP = {
  key: "karashynyard",
  name: "Карашин Яр",
  url: "https://karashynyard.com.ua/#rec638772397",
} as const;
const OSIO_SHOP = { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/" } as const;

const SNAPSHOT_DEFAULTS: AdminSettings = { dataSource: "snapshot", visibility: { karashynyard: null, osio: null } };

// The exact settings files of the scenarios.
const CHOSEN_TWO_FILE =
  '{"dataSource":"snapshot","visibility":{"karashynyard":["karashynyard:1743423686258","karashynyard:1498486363994"],"osio":null}}';
const PERSISTED_SNAPSHOT_FILE = '{"dataSource":"snapshot","visibility":{"karashynyard":null,"osio":null}}';

const dirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A settings store on a fresh temp directory, optionally seeded with the scenario's file. */
function newSettingsStore(json: string | undefined, defaults: AdminSettings = SNAPSHOT_DEFAULTS) {
  const dir = tempDir("admin-settings-");
  if (json !== undefined) writeFileSync(join(dir, "admin-settings.json"), json);
  return createAdminSettingsStore(join(dir, "admin-settings.json"), defaults);
}

/** The app of products.test.ts (fake adapters, committed snapshots) over the given settings store. */
function appOver(store: AdminSettingsStore, source: DataSource) {
  const karashynyard = vi.fn<ShopAdapter["fetchProducts"]>();
  const osio = vi.fn<ShopAdapter["fetchProducts"]>();
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
  const app = createApp({ catalog, basketStore, settingsStore: store, adminToken: undefined });
  return { app, catalog, karashynyard, osio };
}

/** A snapshot-mode app whose settings file is `json` (none = the snapshot defaults). */
function appOverSettings(json?: string) {
  const store = newSettingsStore(json);
  return { store, ...appOver(store, "snapshot") };
}

const products = async (app: ReturnType<typeof createApp>) => {
  const res = await app.request("/api/products");
  return { res, body: (await res.json()) as CatalogResponse };
};

test("Catalog honours the admin's visibility", async () => {
  const { app, karashynyard, osio } = appOverSettings(CHOSEN_TWO_FILE);

  const { res, body } = await products(app);

  expect(res.status).toBe(200);
  expect(body.shops[0]).toEqual({
    key: "karashynyard",
    name: "Карашин Яр",
    url: "https://karashynyard.com.ua/#rec638772397",
    status: "snapshot",
    count: 2,
  });
  expect(body.shops[1]).toEqual({
    key: "osio",
    name: "OSIO organic",
    url: "https://osio-organic.com.ua/",
    status: "snapshot",
    count: 10,
  });
  expect(body.products).toHaveLength(12);
  expect(body.products[0]).toMatchObject({ id: "karashynyard:1498486363994", price: 665 });
  expect(body.products[1]).toMatchObject({ id: "karashynyard:1743423686258", price: 480 });
  expect(body.products[2]?.id).toBe("osio:6abcf192b7db2532803d266d");
  expect(body.products[11]?.id).toBe("osio:69e5236361852dec4059d4e8");
  expect(karashynyard).not.toHaveBeenCalled();
  expect(osio).not.toHaveBeenCalled();
});

test("A visibility change is served without restart", async () => {
  const { app, store } = appOverSettings(CHOSEN_TWO_FILE);
  const before = await products(app);
  expect(before.body.shops[0]?.count).toBe(2);

  // The store is written behind the running app's back: the next request must pick it up.
  await store.update((current) => ({ ...current, visibility: { ...current.visibility, karashynyard: null } }));
  const { body } = await products(app);

  expect(body.shops[0]?.count).toBe(10);
  expect(body.products).toHaveLength(20);
  expect(body.products[9]).toMatchObject({ id: "karashynyard:1743423686258", price: 480 });
});

test("Persisted data source overrides DATA_SOURCE", async () => {
  // The server's defaults: `dataSource` from the config (DATA_SOURCE unset = live), both shops null.
  const defaults: AdminSettings = {
    dataSource: loadConfig({}).dataSource,
    visibility: { karashynyard: null, osio: null },
  };
  expect(defaults.dataSource).toBe("live");
  const store = newSettingsStore(PERSISTED_SNAPSHOT_FILE, defaults);

  // The startup sequence of server.ts: read the settings, seed the catalog's source from them.
  const settings = await store.read();
  const { app, catalog, karashynyard, osio } = appOver(store, settings.dataSource);
  const { body } = await products(app);

  expect(settings.dataSource).toBe("snapshot");
  expect(catalog.getSource()).toBe("snapshot");
  expect(body.source).toBe("snapshot");
  expect(body.shops).toMatchObject([
    { key: "karashynyard", status: "snapshot", count: 10 },
    { key: "osio", status: "snapshot", count: 10 },
  ]);
  expect(karashynyard).not.toHaveBeenCalled();
  expect(osio).not.toHaveBeenCalled();

  // No file: DATA_SOURCE (here the config default) wins.
  const empty = newSettingsStore(undefined, defaults);
  await expect(empty.read()).resolves.toMatchObject({ dataSource: "live" });
});
