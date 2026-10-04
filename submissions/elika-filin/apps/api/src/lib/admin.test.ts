import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AdminSettings, Product } from "@organic/shared";
import { afterEach, expect, test, vi } from "vitest";
import { createAdminService } from "./admin";
import type { CatalogInventory, CatalogService } from "./catalog";
import { createSnapshotSource } from "./snapshot";
import { createAdminSettingsStore } from "./store/admin-settings";

// The committed snapshots in data/shops/, read exactly as the catalog builds them.
const snapshotDir = fileURLToPath(new URL("../../../../data/shops", import.meta.url));
const snapshots = createSnapshotSource(snapshotDir);
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

// What the catalog's loadAll() answers in the route scenarios: karashynyard live with 12 products, osio
// fallen back to its snapshot.
const inventory: CatalogInventory = {
  source: "live",
  shops: [
    {
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "live",
      products: [...karashynyardSnapshot, ...karashynyardBeyondTen],
    },
    {
      key: "osio",
      name: "OSIO organic",
      url: "https://osio-organic.com.ua/",
      status: "snapshot-fallback",
      error: "osio: HTTP 502",
      products: osioSnapshot,
    },
  ],
};

const DEFAULTS: AdminSettings = { dataSource: "live", visibility: { karashynyard: null, osio: null } };

const CHOSEN_TWO_FILE =
  '{"dataSource":"live","visibility":{"karashynyard":["karashynyard:1743423686258","karashynyard:1498486363994"],"osio":null}}';

// The first ten karashynyard ids in snapshot order, and the arrays of the "Hide" / "Show" scenarios.
const FIRST_TEN = [
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
];
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
const TEN_PLUS_STEHNO = [...FIRST_TEN, "karashynyard:1636965991022"];

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** The service over a stub catalog and a real settings store on a fresh temp directory. */
function newService(json?: string) {
  const dir = mkdtempSync(join(tmpdir(), "admin-service-"));
  dirs.push(dir);
  const file = join(dir, "admin-settings.json");
  if (json !== undefined) writeFileSync(file, json);
  const store = createAdminSettingsStore(file, {
    dataSource: "live",
    visibility: { karashynyard: null, osio: null },
  });
  // Records what the file held at the moment the catalog was switched, so "persist first" is asserted.
  const persistedAtSwitch: string[] = [];
  const setSource = vi.fn<CatalogService["setSource"]>(() => {
    persistedAtSwitch.push(
      existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as AdminSettings).dataSource : "nothing persisted",
    );
  });
  const catalog = { loadAll: async () => inventory, setSource };
  return { dir, file, store, setSource, persistedAtSwitch, service: createAdminService({ catalog, settings: store }) };
}

test("listProducts flags the first ten when visibility is null", async () => {
  const { service } = newService();

  const listing = await service.listProducts();

  expect(listing.source).toBe("live");
  expect(listing.shops).toEqual([
    {
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "live",
      total: 12,
      visible: 10,
    },
    {
      key: "osio",
      name: "OSIO organic",
      url: "https://osio-organic.com.ua/",
      status: "snapshot-fallback",
      error: "osio: HTTP 502",
      total: 10,
      visible: 10,
    },
  ]);
  expect(listing.products).toHaveLength(22);
  expect(snapshotProduct("karashynyard:1498486363994").price).toBe(665);
  expect(listing.products[0]).toEqual({ ...snapshotProduct("karashynyard:1498486363994"), visible: true });
  expect(listing.products[10]).toMatchObject({ id: "karashynyard:1629901938947", visible: false });
  expect(listing.products[12]).toMatchObject({ id: "osio:6abcf192b7db2532803d266d", visible: true });
});

test("listProducts flags the chosen ids", async () => {
  const { service } = newService(CHOSEN_TWO_FILE);

  const listing = await service.listProducts();

  expect(listing.shops[0]).toMatchObject({ key: "karashynyard", total: 12, visible: 2 });
  expect(listing.products[0]).toMatchObject({ id: "karashynyard:1498486363994", visible: true });
  expect(listing.products[1]).toMatchObject({ id: "karashynyard:1628604400123", visible: false });
  expect(listing.products[9]).toMatchObject({ id: "karashynyard:1743423686258", visible: true });
  expect(listing.products[10]).toMatchObject({ id: "karashynyard:1629901938947", visible: false });
});

test("First toggle creates the default array and removes the id", async () => {
  const { service, store } = newService();

  const result = await service.setProductVisibility("karashynyard:1498486363994", false);

  expect(result).toEqual({
    ok: true,
    result: { id: "karashynyard:1498486363994", visible: false, visibility: NINE_WITHOUT_FILE },
  });
  expect((await store.read()).visibility).toEqual({ karashynyard: NINE_WITHOUT_FILE, osio: null });
});

test("Append shows a product beyond the first ten", async () => {
  const { service } = newService();

  const result = await service.setProductVisibility("karashynyard:1636965991022", true);

  expect(result).toEqual({
    ok: true,
    result: { id: "karashynyard:1636965991022", visible: true, visibility: TEN_PLUS_STEHNO },
  });
});

test("Repeating a toggle is idempotent", async () => {
  const { service } = newService();
  const hidden = { ok: true, result: { id: "karashynyard:1498486363994", visible: false, visibility: NINE_WITHOUT_FILE } };

  await expect(service.setProductVisibility("karashynyard:1498486363994", false)).resolves.toEqual(hidden);
  await expect(service.setProductVisibility("karashynyard:1498486363994", false)).resolves.toEqual(hidden);

  // Showing a product that is already visible appends nothing: the ten snapshot ids, no duplicate.
  const fresh = newService();
  const shown = await fresh.service.setProductVisibility("karashynyard:1498486363994", true);
  expect(shown).toEqual({
    ok: true,
    result: { id: "karashynyard:1498486363994", visible: true, visibility: FIRST_TEN },
  });
});

test("Unknown product writes nothing", async () => {
  const { service, store, dir } = newService();

  const result = await service.setProductVisibility("osio:000000000000000000000000", true);

  expect(result).toEqual({ ok: false, error: "Product not found" });
  expect(readdirSync(dir)).toEqual([]);
  await expect(store.read()).resolves.toEqual(DEFAULTS);
});

test("updateSettings persists before switching the catalog", async () => {
  const { service, file, setSource, persistedAtSwitch } = newService();

  const result = await service.updateSettings({ dataSource: "snapshot" });

  expect(result).toEqual({ dataSource: "snapshot", visibility: { karashynyard: null, osio: null } });
  expect((JSON.parse(readFileSync(file, "utf8")) as AdminSettings).dataSource).toBe("snapshot");
  expect(setSource).toHaveBeenCalledTimes(1);
  expect(setSource).toHaveBeenCalledWith("snapshot");
  // The file already held the new source when the catalog was switched.
  expect(persistedAtSwitch).toEqual(["snapshot"]);
});
