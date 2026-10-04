import { afterEach, expect, test, vi } from "vitest";
import {
  addToBasket,
  adminLogin,
  adminLogout,
  clearBasket,
  getAdminProducts,
  getAdminSession,
  getAdminSettings,
  getBasket,
  getProducts,
  removeBasketItem,
  setProductVisibility,
  updateBasketItem,
  updateSettings,
} from "./client";

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

test("Admin requests send method, path and body", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);

  fetchMock.mockResolvedValueOnce(jsonResponse(200, { authenticated: true }));
  await expect(getAdminSession()).resolves.toEqual({ authenticated: true });
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/session",
    expect.objectContaining({ method: "GET", credentials: "same-origin" }),
  );

  // The two 204 answers: an empty body resolves undefined, nothing is parsed.
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(adminLogin("secret-token")).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/login",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: '{"token":"secret-token"}',
    }),
  );

  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(adminLogout()).resolves.toBeUndefined();
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/logout",
    expect.objectContaining({ method: "POST", credentials: "same-origin" }),
  );
  expect(fetchMock.mock.calls[2]?.[1]?.body).toBeUndefined();

  const liveSettings = { dataSource: "live", visibility: { karashynyard: null, osio: null } };
  fetchMock.mockResolvedValueOnce(jsonResponse(200, liveSettings));
  await expect(getAdminSettings()).resolves.toEqual(liveSettings);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/settings",
    expect.objectContaining({ method: "GET", credentials: "same-origin" }),
  );

  const snapshotSettings = { dataSource: "snapshot", visibility: { karashynyard: null, osio: null } };
  fetchMock.mockResolvedValueOnce(jsonResponse(200, snapshotSettings));
  await expect(updateSettings({ dataSource: "snapshot" })).resolves.toEqual(snapshotSettings);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/settings",
    expect.objectContaining({
      method: "PUT",
      credentials: "same-origin",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: '{"dataSource":"snapshot"}',
    }),
  );

  const adminProducts = {
    source: "snapshot",
    shops: [
      { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "snapshot", total: 1, visible: 1 },
    ],
    products: [{ ...kolrabi, visible: true }],
  };
  fetchMock.mockResolvedValueOnce(jsonResponse(200, adminProducts));
  await expect(getAdminProducts()).resolves.toEqual(adminProducts);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/products",
    expect.objectContaining({ method: "GET", credentials: "same-origin" }),
  );

  const hidden = { id: "osio:6abcf192b7db2532803d266d", visible: false, visibility: [] };
  fetchMock.mockResolvedValueOnce(jsonResponse(200, hidden));
  await expect(setProductVisibility("osio:6abcf192b7db2532803d266d", false)).resolves.toEqual(hidden);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/admin/products/osio:6abcf192b7db2532803d266d/visibility",
    expect.objectContaining({
      method: "PUT",
      credentials: "same-origin",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: '{"visible":false}',
    }),
  );
  expect(fetchMock).toHaveBeenCalledTimes(7);
});

test("Product id is URL-encoded in the visibility path", async () => {
  // The same rule as the basket item paths: "#" encoded, the ":" between shop key and source id literal.
  const body = { id: "osio:a#b", visible: true, visibility: ["osio:a#b"] };
  const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(200, body));
  vi.stubGlobal("fetch", fetchMock);

  await expect(setProductVisibility("osio:a#b", true)).resolves.toEqual(body);

  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/products/osio:a%23b/visibility");
});

test("Login failures carry the status", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);

  // The page tells 401 from 503 by the error's status, not by parsing the message.
  fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Invalid token" }));
  const wrongToken = adminLogin("wrong-token");
  await expect(wrongToken).rejects.toBeInstanceOf(Error);
  await expect(wrongToken).rejects.toThrow(/^POST \/api\/admin\/login failed: 401$/);
  await expect(wrongToken).rejects.toMatchObject({ status: 401 });

  fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: "Admin is not configured" }));
  const unconfigured = adminLogin("secret-token");
  await expect(unconfigured).rejects.toBeInstanceOf(Error);
  await expect(unconfigured).rejects.toThrow(/^POST \/api\/admin\/login failed: 503$/);
  await expect(unconfigured).rejects.toMatchObject({ status: 503 });

  fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }));
  const settings = getAdminSettings();
  await expect(settings).rejects.toBeInstanceOf(Error);
  await expect(settings).rejects.toThrow(/^GET \/api\/admin\/settings failed: 401$/);
  await expect(settings).rejects.toMatchObject({ status: 401 });
});
