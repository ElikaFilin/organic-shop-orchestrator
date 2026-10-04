import { afterEach, expect, test, vi } from "vitest";
import { getProducts } from "./client";

// osio:6abcf192b7db2532803d266d exactly as data/shops/osio.json holds it.
const catalogBody = {
  source: "snapshot",
  shops: [{ key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", count: 1 }],
  products: [
    {
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
    },
  ],
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("Successful request", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(200, catalogBody));
  vi.stubGlobal("fetch", fetchMock);

  await expect(getProducts()).resolves.toEqual(catalogBody);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products");
});

test("Failed request", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => new Response("Service Unavailable", { status: 503 })),
  );

  const request = getProducts();

  await expect(request).rejects.toBeInstanceOf(Error);
  await expect(request).rejects.toThrow(/^GET \/api\/products failed: 503$/);
});
