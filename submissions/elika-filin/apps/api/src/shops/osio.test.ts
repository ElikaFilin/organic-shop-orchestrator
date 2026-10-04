import { readFileSync } from "node:fs";
import type { Product } from "@organic/shared";
import { describe, expect, test, vi } from "vitest";
import { createOsioAdapter } from "./osio";
import type { FetchLike, ShopFetchResult } from "./types";

// The real GET /v1/products response captured on 2026-10-04, trimmed to its first 12 items by
// fixtures/make-fixtures.py. products[1] carries a trailing space in its name; products[11] is the sweet pepper.
const fixtureJson = readFileSync(new URL("../../fixtures/osio.json", import.meta.url), "utf8");
const fixtureItems = JSON.parse(fixtureJson) as Record<string, unknown>[];

const OSIO_PRODUCTS_URL = "https://arsubs-production-1-back-t5tdi.ondigitalocean.app/v1/products";

function fetchStub(status: number, body: string) {
  return vi.fn<FetchLike>(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }));
}

function productsOf(result: ShopFetchResult): Product[] {
  if (!result.ok) throw new Error(`expected an ok result, got failure "${result.error}"`);
  return result.products;
}

describe("osio adapter", () => {
  test("Fixture response yields twelve products in response order", async () => {
    const fetchMock = fetchStub(200, fixtureJson);

    const result = await createOsioAdapter({ fetch: fetchMock }).fetchProducts();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(OSIO_PRODUCTS_URL);
    expect(result.ok).toBe(true);
    const products = productsOf(result);
    expect(products).toHaveLength(12);
    expect(products[0]?.id).toBe("osio:6abcf192b7db2532803d266d");
    expect(products[11]?.id).toBe("osio:6aa15f6d98ecadd65969cc45");
    expect(products[0]).toEqual({
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
    expect(products[1]).toMatchObject({
      name: "Щавлик органічний, осінній",
      price: 150,
      unit: "100 г",
      category: "Зелень",
      inStock: true,
    });
  });

  test("Request carries the tenant header", async () => {
    const fetchMock = fetchStub(200, fixtureJson);

    await createOsioAdapter({ fetch: fetchMock }).fetchProducts();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(OSIO_PRODUCTS_URL);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "Application-Instance": "3fc23022-4cf1-4d8b-a24c-c50e2651d4e0",
    });
  });

  test("Coming-soon item is out of stock", async () => {
    expect(fixtureItems[11]).toMatchObject({ id: "6aa15f6d98ecadd65969cc45", price: 315 });
    const fetchMock = fetchStub(200, JSON.stringify([{ ...fixtureItems[11], isComingSoon: true }]));

    const products = productsOf(await createOsioAdapter({ fetch: fetchMock }).fetchProducts());

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: "osio:6aa15f6d98ecadd65969cc45",
      name: "Перець солодкий червоний і жовтий , органічний",
      price: 315,
      inStock: false,
    });
  });

  test("Malformed item is skipped", async () => {
    const items = fixtureItems.map((item, index) => (index === 2 ? { ...item, description: null } : item));
    const fetchMock = fetchStub(200, JSON.stringify(items));

    const products = productsOf(await createOsioAdapter({ fetch: fetchMock }).fetchProducts());

    expect(products).toHaveLength(11);
    expect(products[2]?.id).toBe(`osio:${fixtureItems[3]?.id as string}`);
    expect(products.map((p) => p.id)).not.toContain(`osio:${fixtureItems[2]?.id as string}`);
  });

  test("Non-JSON body is a failure", async () => {
    const fetchMock = fetchStub(200, "<!doctype html><title>502 Bad Gateway</title>");

    await expect(createOsioAdapter({ fetch: fetchMock }).fetchProducts()).resolves.toEqual({
      ok: false,
      error: "osio: invalid JSON",
    });
  });

  test("Empty product list is a failure", async () => {
    const fetchMock = fetchStub(200, "[]");

    await expect(createOsioAdapter({ fetch: fetchMock }).fetchProducts()).resolves.toEqual({
      ok: false,
      error: "osio: no products",
    });
  });

  test("Network error", async () => {
    const fetchMock = vi.fn<FetchLike>().mockRejectedValue(new Error("ECONNRESET"));

    await expect(createOsioAdapter({ fetch: fetchMock }).fetchProducts()).resolves.toEqual({
      ok: false,
      error: "osio: ECONNRESET",
    });
  });
});
