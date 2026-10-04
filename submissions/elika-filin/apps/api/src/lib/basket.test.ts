import type { Product, StoredBasket } from "@organic/shared";
import { expect, test } from "vitest";
import { createBasketService } from "./basket";
import type { BasketStore } from "./store/baskets";

const BASKET_A = "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc";

const fileIndychky: Product = {
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
};
// A price in kopiykas, chosen because 1.1 × 3 is the classic binary-float trap: 3.3000000000000003.
const kopiyky: Product = { ...fileIndychky, id: "osio:kopiyky", sourceId: "kopiyky", shopKey: "osio", price: 1.1 };

const products = [fileIndychky, kopiyky];

/** The store as a value: no file, no queue — the service's own rules are what this file tests. */
function memoryStore(initial: Record<string, StoredBasket> = {}): BasketStore & { file: Record<string, StoredBasket> } {
  const file: Record<string, StoredBasket> = { ...initial };
  return {
    file,
    get: (id) => Promise.resolve(file[id]),
    update: (id, mutate) => {
      const next = mutate(file[id]);
      if (next) file[id] = next;
      return Promise.resolve(next);
    },
  };
}

function newService(initial?: Record<string, StoredBasket>) {
  const store = memoryStore(initial);
  const service = createBasketService({
    store,
    catalog: {
      findProducts: (ids) =>
        Promise.resolve(new Map(products.filter((product) => ids.includes(product.id)).map((p) => [p.id, p]))),
    },
    now: () => Date.parse("2026-10-04T10:00:00.000Z"),
  });
  return { store, service };
}

function basketWith(items: StoredBasket["items"]): Record<string, StoredBasket> {
  return { [BASKET_A]: { updatedAt: "2026-10-04T09:00:00.000Z", items } };
}

test("Adding merges into the existing line and caps at 99", async () => {
  const { service, store } = newService();

  const first = await service.addItem(BASKET_A, { productId: fileIndychky.id, quantity: 2 });
  const second = await service.addItem(BASKET_A, { productId: fileIndychky.id, quantity: 98 });

  expect(first.ok && first.basket.items).toEqual([
    { productId: fileIndychky.id, quantity: 2, product: fileIndychky },
  ]);
  expect(second.ok && second.basket.items[0]?.quantity).toBe(99);
  expect(second.ok && second.basket.totals).toEqual({ count: 99, sum: 65835 });
  // The merge keeps the line's addedAt, so basket order never changes under the buyer.
  expect(store.file[BASKET_A]?.items).toEqual([
    { productId: fileIndychky.id, quantity: 99, addedAt: "2026-10-04T10:00:00.000Z" },
  ]);
});

test("Totals are rounded to kopiykas", async () => {
  const { service } = newService(basketWith([{ productId: kopiyky.id, quantity: 3, addedAt: "2026-10-04T09:00:00.000Z" }]));

  const basket = await service.get(BASKET_A);

  // Without the rounding this is 3.3000000000000003.
  expect(kopiyky.price * 3).not.toBe(3.3);
  expect(basket.totals).toEqual({ count: 3, sum: 3.3 });
});

test("Integer prices stay integers", async () => {
  const { service } = newService(
    basketWith([{ productId: fileIndychky.id, quantity: 2, addedAt: "2026-10-04T09:00:00.000Z" }]),
  );

  expect((await service.get(BASKET_A)).totals).toEqual({ count: 2, sum: 1330 });
});

test("An unknown product is not added", async () => {
  const { service, store } = newService();

  const result = await service.addItem(BASKET_A, { productId: "osio:000000000000000000000000", quantity: 1 });

  expect(result).toEqual({ ok: false, error: "Product not found" });
  expect(store.file[BASKET_A]).toBeUndefined();
});

test("Changing or removing a line that is not there is a miss, not a write", async () => {
  const { service, store } = newService();

  await expect(service.updateItem(BASKET_A, fileIndychky.id, 3)).resolves.toEqual({
    ok: false,
    error: "Basket item not found",
  });
  await expect(service.removeItem(BASKET_A, fileIndychky.id)).resolves.toEqual({
    ok: false,
    error: "Basket item not found",
  });
  expect(store.file[BASKET_A]).toBeUndefined();
});

test("A line whose product is gone counts zero", async () => {
  const { service } = newService(
    basketWith([
      { productId: fileIndychky.id, quantity: 2, addedAt: "2026-10-04T09:00:00.000Z" },
      { productId: "osio:000000000000000000000000", quantity: 1, addedAt: "2026-10-04T09:01:00.000Z" },
    ]),
  );

  const basket = await service.get(BASKET_A);

  expect(basket.items[1]).toEqual({ productId: "osio:000000000000000000000000", quantity: 1, product: null });
  expect(basket.totals).toEqual({ count: 2, sum: 1330 });
});
