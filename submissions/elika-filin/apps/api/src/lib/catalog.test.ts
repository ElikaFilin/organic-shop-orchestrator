import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogResponse, Product } from "@organic/shared";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "../app";
import type { ShopAdapter } from "../shops/types";
import { createTtlCache } from "./cache";
import { createCatalogService, selectVisibleProducts, type ShopProducts } from "./catalog";
import { createSnapshotSource } from "./snapshot";
import { createBasketStore } from "./store/baskets";

// The committed snapshots in data/shops/, passed as a value. Both fake adapters answer with "their 10 snapshot
// products" exactly as the committed files hold them.
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

const KARASHYNYARD_SHOP = {
  key: "karashynyard",
  name: "Карашин Яр",
  url: "https://karashynyard.com.ua/#rec638772397",
} as const;
const OSIO_SHOP = { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/" } as const;

function liveService(now: () => number) {
  const karashynyard = vi.fn<ShopAdapter["fetchProducts"]>();
  const osio = vi.fn<ShopAdapter["fetchProducts"]>();
  const service = createCatalogService({
    source: "live",
    shops: [
      { adapter: { shop: KARASHYNYARD_SHOP, fetchProducts: karashynyard }, snapshotKey: "karashynyard" },
      { adapter: { shop: OSIO_SHOP, fetchProducts: osio }, snapshotKey: "osio" },
    ],
    snapshots,
    cache: createTtlCache({ ttlMs: 300000, now }),
    now,
  });
  return { service, karashynyard, osio };
}

describe("selectVisibleProducts", () => {
  test("Selection keeps the first ten of each shop in order", () => {
    const perShop: ShopProducts[] = [
      { key: "karashynyard", products: [...karashynyardSnapshot, ...karashynyardBeyondTen] },
      { key: "osio", products: osioSnapshot.slice(0, 3) },
    ];

    const visible = selectVisibleProducts(perShop);

    expect(visible).toHaveLength(13);
    expect(visible.map((p) => p.id)).toEqual([
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
      "osio:6abcf192b7db2532803d266d",
      "osio:6a31801b6f67d681cfdb7e21",
      "osio:6a82acaa52fcb3f74e97821d",
    ]);
  });

  test("Selection serves the chosen ids in upstream order", () => {
    const perShop: ShopProducts[] = [
      { key: "karashynyard", products: karashynyardSnapshot },
      { key: "osio", products: osioSnapshot.slice(0, 3) },
    ];

    const visible = selectVisibleProducts(perShop, {
      karashynyard: ["karashynyard:1743423686258", "karashynyard:1498486363994"],
      osio: null,
    });

    // The chosen karashynyard ids come back in upstream order, not in the order the admin listed them.
    expect(visible.map((p) => p.id)).toEqual([
      "karashynyard:1498486363994",
      "karashynyard:1743423686258",
      "osio:6abcf192b7db2532803d266d",
      "osio:6a31801b6f67d681cfdb7e21",
      "osio:6a82acaa52fcb3f74e97821d",
    ]);
    expect(visible[0]?.price).toBe(665);
    expect(visible[1]?.price).toBe(480);
  });

  test("Ids missing upstream are ignored and an empty list hides the shop", () => {
    const perShop: ShopProducts[] = [
      { key: "karashynyard", products: karashynyardSnapshot },
      { key: "osio", products: osioSnapshot.slice(0, 3) },
    ];

    const visible = selectVisibleProducts(perShop, {
      karashynyard: ["karashynyard:1498486363994", "karashynyard:0000000000000"],
      osio: [],
    });

    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ id: "karashynyard:1498486363994", price: 665 });
  });
});

describe("createCatalogService", () => {
  test("Second load within five minutes reuses the cache", async () => {
    let time = 0;
    const now = () => time;
    const { service, karashynyard, osio } = liveService(now);
    karashynyard.mockResolvedValue({ ok: true, products: karashynyardSnapshot });
    osio.mockResolvedValue({ ok: true, products: osioSnapshot });

    await service.load();
    time = 299000;
    await service.load();
    expect(karashynyard).toHaveBeenCalledTimes(1);
    expect(osio).toHaveBeenCalledTimes(1);

    time = 300000;
    await service.load();
    expect(karashynyard).toHaveBeenCalledTimes(2);
    expect(osio).toHaveBeenCalledTimes(2);
  });

  test("A failed fetch is not cached", async () => {
    let time = 0;
    const now = () => time;
    const { service, karashynyard, osio } = liveService(now);
    karashynyard.mockResolvedValue({ ok: true, products: karashynyardSnapshot });
    osio
      .mockResolvedValueOnce({ ok: false, error: "osio: HTTP 502" })
      .mockResolvedValue({ ok: true, products: osioSnapshot });

    const first = await service.load();
    expect(first.shops[1]).toMatchObject({ key: "osio", status: "snapshot-fallback", error: "osio: HTTP 502" });

    time = 1000;
    const second = await service.load();
    expect(second.shops[1]).toMatchObject({ key: "osio", status: "live" });
    expect(osio).toHaveBeenCalledTimes(2);
  });

  test("Concurrent cold loads call each adapter once", async () => {
    const { service, karashynyard, osio } = liveService(() => 0);
    // Both adapters resolve after a tick, so the three loads overlap on a cold cache.
    karashynyard.mockImplementation(async () => {
      await Promise.resolve();
      return { ok: true, products: karashynyardSnapshot };
    });
    osio.mockImplementation(async () => {
      await Promise.resolve();
      return { ok: true, products: osioSnapshot };
    });

    const results = await Promise.all([service.load(), service.load(), service.load()]);

    expect(karashynyard).toHaveBeenCalledTimes(1);
    expect(osio).toHaveBeenCalledTimes(1);
    for (const result of results) expect(result.products).toHaveLength(20);
  });

  test("Mismatched shop keys throw at construction", () => {
    const build = () =>
      createCatalogService({
        source: "live",
        shops: [
          {
            adapter: { shop: KARASHYNYARD_SHOP, fetchProducts: vi.fn<ShopAdapter["fetchProducts"]>() },
            snapshotKey: "osio",
          },
        ],
        snapshots,
        cache: createTtlCache({ ttlMs: 300000, now: () => 0 }),
        now: () => 0,
      });

    expect(build).toThrow(Error);
    expect(build).toThrow(/^catalog shop key mismatch: karashynyard vs osio$/);
  });

  test("Runtime switch to snapshot", async () => {
    const { service, karashynyard, osio } = liveService(() => 0);
    expect(service.getSource()).toBe("live");

    service.setSource("snapshot");
    const basketStore = createBasketStore(join(mkdtempSync(join(tmpdir(), "baskets-")), "baskets.json"));
    const res = await createApp({ catalog: service, basketStore }).request("/api/products");

    expect(res.status).toBe(200);
    const body = (await res.json()) as CatalogResponse;
    expect(body.source).toBe("snapshot");
    expect(body.shops).toMatchObject([
      { key: "karashynyard", status: "snapshot", count: 10 },
      { key: "osio", status: "snapshot", count: 10 },
    ]);
    expect(karashynyard).not.toHaveBeenCalled();
    expect(osio).not.toHaveBeenCalled();
  });
});
