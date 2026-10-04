import { mkdtempSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultVisibility,
  type AdminSettings,
  type CatalogResponse,
  type DataSource,
  type Product,
} from "@organic/shared";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "../app";
import { createTtlCache } from "../lib/cache";
import { createCatalogService } from "../lib/catalog";
import { createSnapshotSource } from "../lib/snapshot";
import { createAdminSettingsStore } from "../lib/store/admin-settings";
import { createBasketStore } from "../lib/store/baskets";
import type { ShopAdapter } from "../shops/types";

/** The admin settings of an app under test: a store over a fresh temp directory, so no test shares a file. */
function tempSettingsStore(defaults?: AdminSettings) {
  const dir = mkdtempSync(join(tmpdir(), "admin-settings-"));
  return createAdminSettingsStore(
    join(dir, "admin-settings.json"),
    defaults ?? { dataSource: "snapshot", visibility: defaultVisibility() },
  );
}

// The committed snapshots in data/shops/, passed as a value. The fake adapters answer with "their 10 snapshot
// products" exactly as the committed files hold them; snapshot mode and the fallback read the same files.
const snapshotDir = fileURLToPath(new URL("../../../../data/shops", import.meta.url));
const karashynyardSnapshot: Product[] = await createSnapshotSource(snapshotDir).read("karashynyard");
const osioSnapshot: Product[] = await createSnapshotSource(snapshotDir).read("osio");

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

const KARASHYNYARD_SHOP = {
  key: "karashynyard",
  name: "Карашин Яр",
  url: "https://karashynyard.com.ua/#rec638772397",
} as const;
const OSIO_SHOP = { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/" } as const;

function appWithFakeShops(source: DataSource, dir: string = snapshotDir) {
  const karashynyard = vi.fn<ShopAdapter["fetchProducts"]>();
  const osio = vi.fn<ShopAdapter["fetchProducts"]>();
  const catalog = createCatalogService({
    source,
    shops: [
      { adapter: { shop: KARASHYNYARD_SHOP, fetchProducts: karashynyard }, snapshotKey: "karashynyard" },
      { adapter: { shop: OSIO_SHOP, fetchProducts: osio }, snapshotKey: "osio" },
    ],
    snapshots: createSnapshotSource(dir),
    cache: createTtlCache({ ttlMs: 300000, now: () => 0 }),
    now: () => 0,
    settings: { read: async () => ({ dataSource: source, visibility: defaultVisibility() }) },
  });
  // The products routes never touch the basket, but the app requires a store: a temp one keeps it isolated.
  const basketStore = createBasketStore(join(mkdtempSync(join(tmpdir(), "baskets-")), "baskets.json"));
  const app = createApp({ catalog, basketStore, settingsStore: tempSettingsStore(), adminToken: undefined });
  return { app, karashynyard, osio };
}

describe("GET /api/products", () => {
  test("Snapshot mode serves the committed files", async () => {
    const { app, karashynyard, osio } = appWithFakeShops("snapshot");

    const res = await app.request("/api/products");

    expect(res.status).toBe(200);
    const body = (await res.json()) as CatalogResponse;
    expect(body).toEqual({
      source: "snapshot",
      shops: [
        {
          key: "karashynyard",
          name: "Карашин Яр",
          url: "https://karashynyard.com.ua/#rec638772397",
          status: "snapshot",
          count: 10,
        },
        { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", count: 10 },
      ],
      products: expect.any(Array),
    });
    expect(body.products).toHaveLength(20);
    expect(body.products[0]).toMatchObject({ id: "karashynyard:1498486363994", price: 665 });
    expect(body.products[9]).toMatchObject({ id: "karashynyard:1743423686258", price: 480 });
    expect(body.products[10]).toMatchObject({ id: "osio:6abcf192b7db2532803d266d", price: 195 });
    expect(body.products[19]).toMatchObject({ id: "osio:69e5236361852dec4059d4e8", price: 215 });
    expect(karashynyard).not.toHaveBeenCalled();
    expect(osio).not.toHaveBeenCalled();
  });

  test("Both shops live", async () => {
    const { app, karashynyard, osio } = appWithFakeShops("live");
    karashynyard.mockResolvedValue({ ok: true, products: [...karashynyardSnapshot, ...karashynyardBeyondTen] });
    osio.mockResolvedValue({ ok: true, products: osioSnapshot });

    const res = await app.request("/api/products");

    expect(res.status).toBe(200);
    const body = (await res.json()) as CatalogResponse;
    expect(body.source).toBe("live");
    expect(body.shops[0]).toEqual({
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "live",
      count: 10,
    });
    expect(body.shops[0]).not.toHaveProperty("error");
    expect(body.shops[1]).toMatchObject({ status: "live", count: 10 });
    expect(body.products).toHaveLength(20);
    expect(body.products[0]?.id).toBe("karashynyard:1498486363994");
    expect(body.products[10]?.id).toBe("osio:6abcf192b7db2532803d266d");
    const sourceIds = body.products.map((p) => p.sourceId);
    expect(sourceIds).not.toContain("1629901938947");
    expect(sourceIds).not.toContain("1636965991022");
  });

  test("One shop down falls back to its snapshot", async () => {
    const { app, karashynyard, osio } = appWithFakeShops("live");
    karashynyard.mockResolvedValue({ ok: false, error: "karashynyard: HTTP 503" });
    osio.mockResolvedValue({ ok: true, products: osioSnapshot });

    const res = await app.request("/api/products");

    expect(res.status).toBe(200);
    const body = (await res.json()) as CatalogResponse;
    expect(body.source).toBe("live");
    expect(body.shops[0]).toEqual({
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "snapshot-fallback",
      error: "karashynyard: HTTP 503",
      count: 10,
    });
    expect(body.shops[1]?.status).toBe("live");
    expect(body.products).toHaveLength(20);
    expect(body.products[0]).toMatchObject({ id: "karashynyard:1498486363994", price: 665 });
  });

  test("Shop down and its snapshot unreadable", async () => {
    // An empty temp directory: karashynyard.json is missing, so the fallback read fails too.
    const emptyDir = await mkdtemp(join(tmpdir(), "organic-snapshots-"));
    const { app, karashynyard, osio } = appWithFakeShops("live", emptyDir);
    karashynyard.mockResolvedValue({ ok: false, error: "karashynyard: HTTP 503" });
    osio.mockResolvedValue({ ok: true, products: osioSnapshot });

    const res = await app.request("/api/products");

    expect(res.status).toBe(200);
    const body = (await res.json()) as CatalogResponse;
    expect(body.source).toBe("live");
    expect(body.shops[0]).toEqual({
      key: "karashynyard",
      name: "Карашин Яр",
      url: "https://karashynyard.com.ua/#rec638772397",
      status: "unavailable",
      error: "karashynyard: HTTP 503",
      count: 0,
    });
    expect(body.shops[1]).toMatchObject({ status: "live", count: 10 });
    expect(body.products).toHaveLength(10);
    expect(body.products[0]?.id).toBe("osio:6abcf192b7db2532803d266d");
  });
});

describe("GET /api/products/:id", () => {
  // One fresh snapshot-mode app for both scenarios: its very first request is the /:id lookup below.
  const { app } = appWithFakeShops("snapshot");

  test("Known id", async () => {
    const res = await app.request("/api/products/osio:6abcf192b7db2532803d266d");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "osio:6abcf192b7db2532803d266d",
      shopKey: "osio",
      shopName: "OSIO organic",
      sourceId: "6abcf192b7db2532803d266d",
      name: "Капуста кольрабі, органічна осіння",
      price: 195,
      currency: "UAH",
      imageUrl: "https://fra1.digitaloceanspaces.com/arsubs-1/6abcf18f504a4d6030570003",
      productUrl: "https://osio-organic.com.ua/products/6abcf192b7db2532803d266d",
      description:
        "🥬 Кольрабі — соковита, хрустка капуста з ніжним солодкуватим смаком. Ось чим вона корисна: • Вітамін С підтримує імунну систему, потрібен для утворення колагену та допомагає засвоювати залізо з рослинної їжі. • Клітковина сприяє регулярному випорожненню, підтримує кишкову мікрофлору й допомагає…",
      category: "Овочі",
      unit: "Качан 350-450 г",
      inStock: true,
    });
  });

  test("Unknown id", async () => {
    const res = await app.request("/api/products/osio:000000000000000000000000");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Product not found" });
  });
});
