import { readFileSync } from "node:fs";
import type { Product } from "@organic/shared";
import { describe, expect, test, vi } from "vitest";
import { createKarashynyardAdapter } from "./karashynyard";
import type { FetchLike, ShopFetchResult } from "./types";

// Real Tilda markup captured on 2026-10-04 and trimmed by fixtures/make-fixtures.py: records rec2364055923,
// rec638772397, rec2366129053, rec638782031, rec2375538863, rec638793505 — five t776__col cards plus one
// t776__product-full popup block per card (same lid, same fields) that must not become a product.
const fixtureHtml = readFileSync(new URL("../../fixtures/karashynyard.html", import.meta.url), "utf8");

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

describe("karashynyard adapter", () => {
  test("Fixture page yields its products in page order", async () => {
    const fetchMock = fetchStub(200, fixtureHtml);

    const result = await createKarashynyardAdapter({ fetch: fetchMock }).fetchProducts();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://karashynyard.com.ua/");
    expect(result.ok).toBe(true);
    const products = productsOf(result);
    expect(products.map((p) => p.sourceId)).toEqual([
      "1498486363994",
      "1628604400123",
      "1781040705497",
      "1652947963962",
    ]);
    expect(products[0]).toEqual({
      id: "karashynyard:1498486363994",
      shopKey: "karashynyard",
      shopName: "Карашин Яр",
      sourceId: "1498486363994",
      name: "Філе індички, 1 кг",
      price: 665,
      currency: "UAH",
      imageUrl: "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg",
      productUrl: "https://karashynyard.com.ua/#rec638772397",
      description: "Ніжне філе без кістки для котлет, запікання, тушкування та дитячих страв.",
      category: "Індичка з вільного вигулу",
      unit: "1 кг",
      inStock: true,
    });
    expect(products[2]).toMatchObject({
      name: "Фермерське курча 800 г - 1,1 кг",
      price: 545,
      productUrl: "https://karashynyard.com.ua/#rec638782031",
      category: "Курка та інша птиця з вільного вигулу (качка, перепела, цесарка)",
      unit: "800 г - 1,1 кг",
    });
  });

  test("Repeated product id keeps the first card", async () => {
    // The last record rec638793505 holds a card whose data-product-lid is again 1498486363994, titled
    // "Домашня сметана, 0,5 л" with price 270 — Tilda reuses lids across records.
    const fetchMock = fetchStub(200, fixtureHtml);

    const products = productsOf(await createKarashynyardAdapter({ fetch: fetchMock }).fetchProducts());

    const repeated = products.filter((p) => p.sourceId === "1498486363994");
    expect(repeated).toHaveLength(1);
    expect(repeated[0]).toMatchObject({
      name: "Філе індички, 1 кг",
      price: 665,
      productUrl: "https://karashynyard.com.ua/#rec638772397",
    });
    expect(products.some((p) => p.name === "Домашня сметана, 0,5 л")).toBe(false);
  });

  test("Card without an image is skipped", async () => {
    // The real first card of the fixture (lid 1498486363994) with both image attributes removed. Its lid is
    // then free, so the repeated-lid card of rec638793505 ("Домашня сметана, 0,5 л") takes it — still 4 products.
    const firstCardImage =
      '<img src="https://thb.tildacdn.net/tild3635-3935-4665-b364-633939613631/-/empty/___13.jpg" data-original="https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg"';
    const withoutImage = fixtureHtml.replace(firstCardImage, "<img");
    expect(withoutImage).not.toBe(fixtureHtml);

    const products = productsOf(await createKarashynyardAdapter({ fetch: fetchStub(200, withoutImage) }).fetchProducts());

    expect(products.map((p) => p.sourceId)).toEqual([
      "1628604400123",
      "1781040705497",
      "1652947963962",
      "1498486363994",
    ]);
    expect(products[3]).toMatchObject({ name: "Домашня сметана, 0,5 л", price: 270 });
  });

  test("Card without data-original falls back to src", async () => {
    const withoutOriginal = fixtureHtml.replace(
      ' data-original="https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg"',
      "",
    );

    const products = productsOf(await createKarashynyardAdapter({ fetch: fetchStub(200, withoutOriginal) }).fetchProducts());

    expect(products[0]).toMatchObject({
      sourceId: "1498486363994",
      imageUrl: "https://thb.tildacdn.net/tild3635-3935-4665-b364-633939613631/-/empty/___13.jpg",
    });
  });

  test("Page without store records is a failure", async () => {
    const fetchMock = fetchStub(200, "<html><body><p>Технічні роботи</p></body></html>");

    await expect(createKarashynyardAdapter({ fetch: fetchMock }).fetchProducts()).resolves.toEqual({
      ok: false,
      error: "karashynyard: no product cards found",
    });
  });

  test("Non-2xx status", async () => {
    const fetchMock = fetchStub(503, "Service Unavailable");

    await expect(createKarashynyardAdapter({ fetch: fetchMock }).fetchProducts()).resolves.toEqual({
      ok: false,
      error: "karashynyard: HTTP 503",
    });
  });
});
