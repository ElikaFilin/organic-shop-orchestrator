import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BasketResponse, Product, StoredBasket } from "@organic/shared";
import { afterEach, describe, expect, test } from "vitest";
import { createApp } from "../app";
import { createCatalogService } from "../lib/catalog";
import { createSnapshotSource } from "../lib/snapshot";
import { createBasketStore, type BasketStore } from "../lib/store/baskets";

const BASKET_A = "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc";
const BASKET_B = "6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const cookieHeader = (id: string) => `basket_id=${id}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`;

// The 20 products the fake catalog knows: data/shops/*.json read exactly as the snapshot source builds them.
const snapshotDir = fileURLToPath(new URL("../../../../data/shops", import.meta.url));
const snapshots = createSnapshotSource(snapshotDir);
const snapshotProducts: Product[] = [...(await snapshots.read("karashynyard")), ...(await snapshots.read("osio"))];

function product(id: string): Product {
  const found = snapshotProducts.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no snapshot product ${id}`);
  return found;
}

const fileIndychky = product("karashynyard:1498486363994");
const kolrabi = product("osio:6abcf192b7db2532803d266d");
const ohirochky = product("osio:69e5236361852dec4059d4e8");

// Only findProduct is exercised through the basket; the rest would hide a wrong dependency, so it throws.
const fakeCatalog: ReturnType<typeof createCatalogService> = {
  getSource: () => {
    throw new Error("not used");
  },
  setSource: () => {
    throw new Error("not used");
  },
  load: () => {
    throw new Error("not used");
  },
  findProduct: async (id) => snapshotProducts.find((candidate) => candidate.id === id),
};

/**
 * A store that keeps the baskets in memory, so a test can seed a line the file schema would reject
 * (`test:fraction` is not `<shopKey>:<sourceId>`) without touching the on-disk format.
 */
function memoryStore(initial: Record<string, StoredBasket>): BasketStore {
  const baskets: Record<string, StoredBasket> = { ...initial };
  return {
    get: (id) => Promise.resolve(baskets[id]),
    update: (id, mutate) => {
      const next = mutate(baskets[id]);
      if (next) baskets[id] = next;
      return Promise.resolve(next);
    },
  };
}

const dirs: string[] = [];

/** A fresh app over a basket store in an empty temp directory. */
function newApp() {
  const dir = mkdtempSync(join(tmpdir(), "baskets-"));
  dirs.push(dir);
  const basketStore = createBasketStore(join(dir, "baskets.json"));
  return { app: createApp({ catalog: fakeCatalog, basketStore }), basketStore };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type App = ReturnType<typeof createApp>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";

function req(app: App, method: Method, path: string, { cookie, body }: { cookie?: string; body?: unknown } = {}) {
  return app.request(path, {
    method,
    headers: {
      ...(cookie ? { Cookie: `basket_id=${cookie}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const json = (res: Response) => res.json() as Promise<BasketResponse>;

describe("Anonymous basket cookie", () => {
  test("First request sets the basket cookie", async () => {
    const { app } = newApp();

    const res = await req(app, "GET", "/api/basket");

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toMatch(UUID);
    expect(body).toEqual({ id: body.id, items: [], totals: { count: 0, sum: 0 } });
    expect(res.headers.get("set-cookie")).toBe(cookieHeader(body.id));
  });

  test("Request with the cookie reuses the basket", async () => {
    const { app } = newApp();

    const post = await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 2 },
    });
    const res = await req(app, "GET", "/api/basket", { cookie: BASKET_A });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toBe(BASKET_A);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.productId).toBe("karashynyard:1498486363994");
    expect(body.items[0]?.quantity).toBe(2);
    expect(body.totals).toEqual({ count: 2, sum: 1330 });
    expect(post.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("Malformed cookie gets a fresh basket", async () => {
    const { app } = newApp();

    const res = await req(app, "GET", "/api/basket", { cookie: "not-a-uuid" });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).not.toBe("not-a-uuid");
    expect(body.id).toMatch(UUID);
    expect(body.items).toEqual([]);
    expect(res.headers.get("set-cookie")).toBe(cookieHeader(body.id));
  });
});

describe("Basket contents and totals", () => {
  test("Totals add up the lines", async () => {
    const { app } = newApp();

    await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 2 },
    });
    await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "osio:6abcf192b7db2532803d266d", quantity: 1 },
    });
    const res = await req(app, "GET", "/api/basket", { cookie: BASKET_A });

    expect(res.status).toBe(200);
    expect(fileIndychky).toMatchObject({ name: "Філе індички, 1 кг", price: 665 });
    expect(kolrabi).toMatchObject({ name: "Капуста кольрабі, органічна осіння", price: 195 });
    expect(await json(res)).toEqual({
      id: BASKET_A,
      items: [
        { productId: "karashynyard:1498486363994", quantity: 2, product: fileIndychky },
        { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: kolrabi },
      ],
      totals: { count: 3, sum: 1525 },
    });
  });

  test("Unavailable product counts zero", async () => {
    const { app, basketStore } = newApp();
    await basketStore.update(BASKET_B, () => ({
      updatedAt: "2026-10-04T10:01:00.000Z",
      items: [
        { productId: "karashynyard:1498486363994", quantity: 2, addedAt: "2026-10-04T10:00:00.000Z" },
        { productId: "osio:000000000000000000000000", quantity: 1, addedAt: "2026-10-04T10:01:00.000Z" },
      ],
    }));

    const res = await req(app, "GET", "/api/basket", { cookie: BASKET_B });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(fileIndychky.price).toBe(665);
    expect(body.items[0]).toEqual({ productId: "karashynyard:1498486363994", quantity: 2, product: fileIndychky });
    expect(body.items[1]).toEqual({ productId: "osio:000000000000000000000000", quantity: 1, product: null });
    expect(body.totals).toEqual({ count: 2, sum: 1330 });
  });

  test("Non-integer price sums without float noise", async () => {
    const fraction: Product = { ...kolrabi, id: "test:fraction", sourceId: "fraction", price: 19.99 };
    const catalog: ReturnType<typeof createCatalogService> = {
      ...fakeCatalog,
      findProduct: async (id) => (id === fraction.id ? fraction : snapshotProducts.find((p) => p.id === id)),
    };
    const app = createApp({
      catalog,
      basketStore: memoryStore({
        [BASKET_A]: {
          updatedAt: "2026-10-04T10:00:00.000Z",
          items: [{ productId: fraction.id, quantity: 3, addedAt: "2026-10-04T10:00:00.000Z" }],
        },
      }),
    });

    const res = await req(app, "GET", "/api/basket", { cookie: BASKET_A });

    expect(res.status).toBe(200);
    // A kopiyka price reaches the response as kopiykas; the noisy multiplications are in lib/basket.test.ts.
    expect((await json(res)).totals).toEqual({ count: 3, sum: 59.97 });
  });
});

describe("POST /api/basket/items", () => {
  test("Add a product with an explicit quantity", async () => {
    const { app } = newApp();

    const res = await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 2 },
    });

    expect(res.status).toBe(201);
    expect(fileIndychky).toMatchObject({
      name: "Філе індички, 1 кг",
      price: 665,
      unit: "1 кг",
      imageUrl: "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg",
    });
    expect(await json(res)).toEqual({
      id: BASKET_A,
      items: [{ productId: "karashynyard:1498486363994", quantity: 2, product: fileIndychky }],
      totals: { count: 2, sum: 1330 },
    });
  });

  test("Add without a quantity defaults to one", async () => {
    const { app } = newApp();

    const res = await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "osio:6abcf192b7db2532803d266d" },
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(kolrabi.price).toBe(195);
    expect(body.items).toEqual([{ productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: kolrabi }]);
    expect(body.totals).toEqual({ count: 1, sum: 195 });
  });

  test("Adding an existing line merges and caps at 99", async () => {
    const { app } = newApp();
    const add = (quantity: number) =>
      req(app, "POST", "/api/basket/items", {
        cookie: BASKET_A,
        body: { productId: "karashynyard:1498486363994", quantity },
      });

    await add(2);
    const second = await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 98 },
    });

    expect(second.status).toBe(201);
    const capped = await json(second);
    expect(capped.items).toHaveLength(1);
    expect(capped.items[0]?.quantity).toBe(99);
    expect(capped.totals).toEqual({ count: 99, sum: 65835 });

    const third = await add(1);

    expect(third.status).toBe(201);
    const still = await json(third);
    expect(still.items[0]?.quantity).toBe(99);
    expect(still.totals.sum).toBe(65835);
  });

  test("Unknown product is rejected", async () => {
    const { app } = newApp();

    const res = await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "osio:000000000000000000000000", quantity: 1 },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Product not found" });

    const after = await json(await req(app, "GET", "/api/basket", { cookie: BASKET_A }));
    expect(after.items).toEqual([]);
    expect(after.totals).toEqual({ count: 0, sum: 0 });
  });
});

describe("PATCH /api/basket/items/:productId", () => {
  test("Change the quantity", async () => {
    const { app } = newApp();
    await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 2 },
    });

    const res = await req(app, "PATCH", "/api/basket/items/karashynyard:1498486363994", {
      cookie: BASKET_A,
      body: { quantity: 5 },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items).toEqual([{ productId: "karashynyard:1498486363994", quantity: 5, product: fileIndychky }]);
    expect(body.totals).toEqual({ count: 5, sum: 3325 });
  });

  test("Change a line that does not exist", async () => {
    const { app } = newApp();

    const res = await req(app, "PATCH", "/api/basket/items/osio:6abcf192b7db2532803d266d", {
      cookie: BASKET_A,
      body: { quantity: 1 },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Basket item not found" });
  });

  test("Clear and change the quantity race", async () => {
    const { app } = newApp();
    await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 2 },
    });

    // The existence check must sit inside the store update, or the PATCH re-adds the line the DELETE dropped.
    const [cleared, patched] = await Promise.all([
      req(app, "DELETE", "/api/basket", { cookie: BASKET_A }),
      req(app, "PATCH", "/api/basket/items/karashynyard:1498486363994", { cookie: BASKET_A, body: { quantity: 3 } }),
    ]);

    expect(cleared.status).toBe(200);
    expect((await json(cleared)).items).toEqual([]);
    expect(patched.status).toBe(404);
    expect(await patched.json()).toEqual({ error: "Basket item not found" });

    const after = await json(await req(app, "GET", "/api/basket", { cookie: BASKET_A }));
    expect(after.items).toEqual([]);
    expect(after.totals).toEqual({ count: 0, sum: 0 });
  });
});

describe("DELETE /api/basket/items/:productId", () => {
  test("Remove a line", async () => {
    const { app } = newApp();
    await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 2 },
    });
    const filled = await json(
      await req(app, "POST", "/api/basket/items", {
        cookie: BASKET_A,
        body: { productId: "osio:6abcf192b7db2532803d266d", quantity: 1 },
      }),
    );
    expect(filled.totals).toEqual({ count: 3, sum: 1525 });

    const res = await req(app, "DELETE", "/api/basket/items/karashynyard:1498486363994", { cookie: BASKET_A });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items).toEqual([{ productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: kolrabi }]);
    expect(body.totals).toEqual({ count: 1, sum: 195 });
  });

  test("Remove a line that does not exist", async () => {
    const { app } = newApp();

    const res = await req(app, "DELETE", "/api/basket/items/karashynyard:1743423686258", { cookie: BASKET_A });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Basket item not found" });
  });
});

describe("DELETE /api/basket", () => {
  test("Clear a basket with lines", async () => {
    const { app } = newApp();
    await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 2 },
    });
    const filled = await json(
      await req(app, "POST", "/api/basket/items", {
        cookie: BASKET_A,
        body: { productId: "osio:69e5236361852dec4059d4e8", quantity: 1 },
      }),
    );
    expect(ohirochky.price).toBe(215);
    expect(filled.totals).toEqual({ count: 3, sum: 1545 });

    const res = await req(app, "DELETE", "/api/basket", { cookie: BASKET_A });

    expect(res.status).toBe(200);
    const emptied = { id: BASKET_A, items: [], totals: { count: 0, sum: 0 } };
    expect(await json(res)).toEqual(emptied);
    const after = await req(app, "GET", "/api/basket", { cookie: BASKET_A });
    expect(after.status).toBe(200);
    expect(await json(after)).toEqual(emptied);
  });
});

describe("Invalid input is rejected", () => {
  test("Invalid body", async () => {
    const { app } = newApp();
    const post = (body: unknown) => req(app, "POST", "/api/basket/items", { cookie: BASKET_A, body });
    const invalidBody = { error: "Invalid request body" };

    const zero = await post({ productId: "karashynyard:1498486363994", quantity: 0 });
    expect(zero.status).toBe(400);
    expect(await zero.json()).toEqual(invalidBody);

    const hundred = await post({ productId: "karashynyard:1498486363994", quantity: 100 });
    expect(hundred.status).toBe(400);
    expect(await hundred.json()).toEqual(invalidBody);

    const noProduct = await post({ quantity: 1 });
    expect(noProduct.status).toBe(400);
    expect(await noProduct.json()).toEqual(invalidBody);

    const malformedId = await post({ productId: "not-a-product" });
    expect(malformedId.status).toBe(400);
    expect(await malformedId.json()).toEqual(invalidBody);

    await post({ productId: "karashynyard:1498486363994", quantity: 2 });
    const fraction = await req(app, "PATCH", "/api/basket/items/karashynyard:1498486363994", {
      cookie: BASKET_A,
      body: { quantity: 1.5 },
    });
    expect(fraction.status).toBe(400);
    expect(await fraction.json()).toEqual(invalidBody);
    const unchanged = await json(await req(app, "GET", "/api/basket", { cookie: BASKET_A }));
    expect(unchanged.items[0]?.quantity).toBe(2);
  });

  test("Invalid product id in the path", async () => {
    const { app } = newApp();
    const invalidId = { error: "Invalid product id" };

    const patch = await req(app, "PATCH", "/api/basket/items/not-a-product", {
      cookie: BASKET_A,
      body: { quantity: 1 },
    });
    expect(patch.status).toBe(400);
    expect(await patch.json()).toEqual(invalidId);

    const remove = await req(app, "DELETE", "/api/basket/items/not-a-product", { cookie: BASKET_A });
    expect(remove.status).toBe(400);
    expect(await remove.json()).toEqual(invalidId);
  });

  // Requirement text with no scenario of its own: "a body that is not JSON … answers 400
  // { error: "Invalid request body" }" and "A 400 SHALL NOT change the basket".
  test("Body that is not JSON is rejected", async () => {
    const { app } = newApp();
    const invalidBody = { error: "Invalid request body" };
    const rawRequest = (method: Method, path: string, body?: string) =>
      app.request(path, {
        method,
        headers: { Cookie: `basket_id=${BASKET_A}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body,
      });

    const text = await rawRequest("POST", "/api/basket/items", "not json");
    expect(text.status).toBe(400);
    expect(await text.json()).toEqual(invalidBody);

    const empty = await rawRequest("POST", "/api/basket/items");
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual(invalidBody);

    const stillEmpty = await json(await req(app, "GET", "/api/basket", { cookie: BASKET_A }));
    expect(stillEmpty.items).toEqual([]);
    expect(stillEmpty.totals).toEqual({ count: 0, sum: 0 });

    await req(app, "POST", "/api/basket/items", {
      cookie: BASKET_A,
      body: { productId: "karashynyard:1498486363994", quantity: 2 },
    });
    const patch = await rawRequest("PATCH", "/api/basket/items/karashynyard:1498486363994", "{quantity: 5}");
    expect(patch.status).toBe(400);
    expect(await patch.json()).toEqual(invalidBody);

    const unchanged = await json(await req(app, "GET", "/api/basket", { cookie: BASKET_A }));
    expect(unchanged.items).toHaveLength(1);
    expect(unchanged.items[0]?.quantity).toBe(2);
  });
});
