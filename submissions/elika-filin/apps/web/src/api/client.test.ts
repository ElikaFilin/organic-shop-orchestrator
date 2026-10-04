import { afterEach, expect, test, vi } from "vitest";
import { addToBasket, clearBasket, getBasket, getProducts, removeBasketItem, updateBasketItem } from "./client";

// osio:6abcf192b7db2532803d266d exactly as data/shops/osio.json holds it.
const kolrabi = {
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
};

const catalogBody = {
  source: "snapshot",
  shops: [{ key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", count: 1 }],
  products: [kolrabi],
};

const oneLineBasket = {
  id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
  items: [{ productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: kolrabi }],
  totals: { count: 1, sum: 195 },
};

const emptyBasket = {
  id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
  items: [],
  totals: { count: 0, sum: 0 },
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

test("getBasket requests the basket", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValueOnce(jsonResponse(200, oneLineBasket));
  vi.stubGlobal("fetch", fetchMock);

  await expect(getBasket()).resolves.toEqual(oneLineBasket);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/basket", expect.objectContaining({ credentials: "same-origin" }));
});

test("Mutations send method, path and JSON body", async () => {
  // POST answers 201, every other method 200 — always with the empty basket.
  const fetchMock = vi.fn<typeof fetch>(async (_input, init) =>
    jsonResponse(init?.method === "POST" ? 201 : 200, emptyBasket),
  );
  vi.stubGlobal("fetch", fetchMock);

  await expect(addToBasket("karashynyard:1498486363994", 1)).resolves.toEqual(emptyBasket);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/basket/items",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: '{"productId":"karashynyard:1498486363994","quantity":1}',
    }),
  );

  await expect(updateBasketItem("karashynyard:1498486363994", 3)).resolves.toEqual(emptyBasket);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/basket/items/karashynyard:1498486363994",
    expect.objectContaining({
      method: "PATCH",
      credentials: "same-origin",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: '{"quantity":3}',
    }),
  );

  await expect(removeBasketItem("karashynyard:1498486363994")).resolves.toEqual(emptyBasket);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/basket/items/karashynyard:1498486363994",
    expect.objectContaining({ method: "DELETE", credentials: "same-origin" }),
  );
  expect(fetchMock.mock.calls[2]?.[1]?.body).toBeUndefined();

  await expect(clearBasket()).resolves.toEqual(emptyBasket);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/basket",
    expect.objectContaining({ method: "DELETE", credentials: "same-origin" }),
  );
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test("Product id is URL-encoded in the path", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(200, emptyBasket));
  vi.stubGlobal("fetch", fetchMock);

  await updateBasketItem("osio:a#b", 2);

  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/basket/items/osio:a%23b");
});

test("Failed request rejects with method, path and status", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);

  fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: "Product not found" }));
  const add = addToBasket("osio:000000000000000000000000", 1);
  await expect(add).rejects.toBeInstanceOf(Error);
  await expect(add).rejects.toThrow(/^POST \/api\/basket\/items failed: 404$/);

  fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: "Basket item not found" }));
  const update = updateBasketItem("karashynyard:1498486363994", 2);
  await expect(update).rejects.toBeInstanceOf(Error);
  await expect(update).rejects.toThrow(/^PATCH \/api\/basket\/items\/karashynyard:1498486363994 failed: 404$/);

  fetchMock.mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }));
  const get = getBasket();
  await expect(get).rejects.toBeInstanceOf(Error);
  await expect(get).rejects.toThrow(/^GET \/api\/basket failed: 503$/);
});
